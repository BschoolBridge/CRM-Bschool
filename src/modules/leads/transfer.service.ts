import { prisma } from "../../lib/prisma";
import { invalidateCounsellorSnapshot } from "../dashboard/cache-keys";
import { fullName } from "../presenters";
import { updateLead } from "./lead.repository";
import { logStatusChange } from "./status-history";

/** Business-rule violation the caller should show to the user verbatim. */
export class TransferError extends Error {}

interface TransferOptions {
  approvedById?: number | null;
  adminApproved?: boolean;
  additionalNotes?: string;
  updateStatus?: boolean;
  reassignPendingActivities?: boolean;
}

/**
 * Move a lead to another counsellor while keeping its history. Completed
 * activities stay with whoever logged them; pending ones move to the new owner.
 */
export async function transferLead(leadId: number, toCounsellorId: number, reason: string, options: TransferOptions = {}) {
  const { approvedById = null, adminApproved = false, additionalNotes = "", updateStatus = true, reassignPendingActivities = true } = options;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { assigned_counsellor: { include: { admin: true } } },
    });
    const from = lead.assigned_counsellor;
    const label = `${lead.first_name} ${lead.last_name}`;
    if (!from) throw new TransferError(`${label} has no assigned counsellor. Use Assign Leads instead.`);
    if (from.id === toCounsellorId) throw new TransferError(`${label} is already assigned to this counsellor.`);
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new TransferError("A transfer reason is required.");

    const to = await tx.counsellor.findUniqueOrThrow({ where: { id: toCounsellorId }, include: { admin: true } });
    const transfer = await tx.leadTransfer.create({
      data: {
        lead_id: lead.id,
        from_counsellor_id: from.id,
        to_counsellor_id: to.id,
        reason: trimmedReason,
        admin_approved: adminApproved,
        approved_by_id: approvedById,
        approved_at: adminApproved ? new Date() : null,
      },
    });

    await updateLead(
      lead.id,
      {
        previous_counsellor_id: from.id,
        assigned_counsellor_id: to.id,
        ...(updateStatus ? { status: "TRANSFERRED" } : {}),
      },
      { db: tx },
    );

    if (reassignPendingActivities) {
      await tx.leadActivity.updateMany({ where: { lead_id: lead.id, is_completed: false }, data: { counsellor_id: to.id } });
    }

    const notes = additionalNotes.trim();
    await tx.leadActivity.create({
      data: {
        lead_id: lead.id,
        counsellor_id: to.id,
        activity_type: "TRANSFER",
        subject: `Lead transferred from ${fullName(from.admin)} to ${fullName(to.admin)}`.slice(0, 200),
        description: notes ? `${trimmedReason}\n\n${notes}` : trimmedReason,
        outcome: "",
        is_completed: true,
        logged_by_admin_id: approvedById,
      },
    });

    if (updateStatus && lead.status !== "TRANSFERRED") {
      await logStatusChange({ id: lead.id, assigned_counsellor_id: to.id }, lead.status, "TRANSFERRED", {
        counsellorId: to.id,
        loggedByAdminId: approvedById,
        note: "Status set during lead transfer",
        db: tx,
      });
    }

    await invalidateCounsellorSnapshot(to.id);
    return transfer;
  });
}

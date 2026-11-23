import { normalizeLeadPhone } from "../../lib/phone";
import { isUniqueViolation, prisma, type Db, type Prisma } from "../../lib/prisma";
import { invalidateAdminDashboard } from "../dashboard/cache-keys";
import { notifyLeadAssigned } from "../notifications/assignment-notifications";
import { fallbackLeadId, formatLeadId, maxNumericLeadId } from "./lead-ids";

export type LeadCreateData = Omit<Prisma.LeadUncheckedCreateInput, "id" | "lead_id" | "notes" | "address" | "enrichment_notes" | "routing_reason"> & {
  lead_id?: string;
  notes?: string;
  address?: string;
  enrichment_notes?: string;
  routing_reason?: string;
};
export type LeadUpdateData = Prisma.LeadUncheckedUpdateInput;

const LEAD_ID_ATTEMPTS = 10;

function normaliseContactFields<T extends { phone?: unknown; alternate_phone?: unknown }>(data: T): T {
  if (typeof data.phone === "string") data.phone = normalizeLeadPhone(data.phone);
  if (typeof data.alternate_phone === "string" && data.alternate_phone) {
    data.alternate_phone = normalizeLeadPhone(data.alternate_phone);
  }
  return data;
}

function graduatedFlag(graduationStatus: unknown): "YES" | "NO" {
  return graduationStatus === "YES" ? "YES" : "NO";
}

/** Rows the lead-assignment notifier needs after a write. */
const ASSIGNMENT_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  lead_id: true,
  source_id: true,
  assigned_counsellor_id: true,
} as const;

/**
 * Create a lead the way Lead.save() did: normalised phones, derived
 * `is_graduated`, sequential L-000001 IDs with retry on collision.
 */
export async function createLead(input: LeadCreateData, options: { db?: Db; notifyAssignment?: boolean } = {}) {
  const db = options.db ?? prisma;
  const data = normaliseContactFields({
    notes: "",
    address: "",
    enrichment_notes: "",
    routing_reason: "",
    ...input,
    is_graduated: graduatedFlag(input.graduation_status ?? "NO"),
  });

  let created = null;
  if (data.lead_id) {
    created = await db.lead.create({ data: data as Prisma.LeadUncheckedCreateInput, select: ASSIGNMENT_SELECT });
  } else {
    for (let attempt = 0; attempt < LEAD_ID_ATTEMPTS && !created; attempt++) {
      const lead_id = formatLeadId((await maxNumericLeadId(db)) + 1);
      try {
        created = await db.lead.create({ data: { ...data, lead_id } as Prisma.LeadUncheckedCreateInput, select: ASSIGNMENT_SELECT });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    created ??= await db.lead.create({
      data: { ...data, lead_id: fallbackLeadId() } as Prisma.LeadUncheckedCreateInput,
      select: ASSIGNMENT_SELECT,
    });
  }

  if (created.assigned_counsellor_id && options.notifyAssignment !== false) await notifyLeadAssigned(created, db);
  await invalidateAdminDashboard();
  return created;
}

/**
 * Update a lead. Notifies the new counsellor when the assignment changes and
 * refreshes dashboard aggregates when status or assignment move.
 */
export async function updateLead(id: number, input: LeadUpdateData, options: { db?: Db } = {}) {
  const db = options.db ?? prisma;
  const data = normaliseContactFields({ ...input });
  const touchesAssignment = "assigned_counsellor_id" in data;

  const before = touchesAssignment || "is_graduated" in data || "graduation_status" in data
    ? await db.lead.findUniqueOrThrow({ where: { id }, select: { assigned_counsellor_id: true, graduation_status: true } })
    : null;
  if (before && ("is_graduated" in data || "graduation_status" in data)) {
    data.is_graduated = graduatedFlag(data.graduation_status ?? before.graduation_status);
  }

  const updated = await db.lead.update({ where: { id }, data, select: ASSIGNMENT_SELECT });

  if (
    touchesAssignment &&
    updated.assigned_counsellor_id &&
    updated.assigned_counsellor_id !== before?.assigned_counsellor_id
  ) {
    await notifyLeadAssigned(updated, db);
  }
  if (touchesAssignment || "status" in data) await invalidateAdminDashboard();
  return updated;
}

/** Mark the lead as worked so it drops to the back of the counsellor's queue. */
export async function touchLastContact(leadId: number, db: Db = prisma): Promise<void> {
  await db.lead.update({ where: { id: leadId }, data: { last_contact_date: new Date() } });
}

export async function deleteLeads(where: Prisma.LeadWhereInput): Promise<number> {
  const { count } = await prisma.lead.deleteMany({ where });
  await invalidateAdminDashboard();
  return count;
}

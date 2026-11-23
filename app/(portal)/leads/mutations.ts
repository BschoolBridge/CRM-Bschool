"use server";

import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { executeAcademicRouting } from "@/modules/ai/ai.service";
import { assignLeads, UNASSIGNED_ASSIGN_BATCH, unassignedAssignmentMessage } from "@/modules/leads/assignment.service";
import { deleteLeads } from "@/modules/leads/lead.repository";
import { extractManageLeadFilters } from "@/modules/leads/lead.queries";
import { invalidateAdminDashboard } from "@/modules/dashboard/cache-keys";
import { field, fieldList, idList } from "@/http/params";
import { reverse } from "@/http/urls";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission, requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { recordFromFormData } from "@/server/form";
import { requiredId } from "@/server/request";
import { DELETE_ALL_CONFIRM_PHRASE, failureText } from "./format";

export async function deleteLead(leadId: number): Promise<void> {
  await requirePermission("delete");
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) notFound();
  try {
    await deleteLeads({ id: lead.id });
    await flash("success", "Lead deleted successfully!");
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Could not delete lead", err));
  }
  redirect(reverse("manage_leads"));
}

export async function deleteListedLead(fd: FormData): Promise<void> {
  await deleteLead(requiredId(field(recordFromFormData(fd), "lead_id")));
}

export async function bulkDeleteLeads(fd: FormData): Promise<void> {
  await requirePermission("delete");
  const ids = idList(fieldList(recordFromFormData(fd), "lead_ids"));
  if (!ids.length) {
    await flash("warning", "No leads selected for deletion.");
    redirect(reverse("manage_leads"));
  }
  try {
    const count = await deleteLeads({ id: { in: ids } });
    await flash("success", `Successfully deleted ${count} lead(s).`);
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Could not delete selected leads", err));
  }
  redirect(reverse("manage_leads"));
}

export async function deleteAllLeads(fd: FormData): Promise<void> {
  await requirePermission("delete");
  if (field(recordFromFormData(fd), "confirm_text") !== DELETE_ALL_CONFIRM_PHRASE) {
    await flash("error", `Confirmation failed. Type exactly: ${DELETE_ALL_CONFIRM_PHRASE}`);
    redirect(reverse("manage_leads"));
  }
  try {
    const n = await prisma.lead.count();
    if (n === 0) {
      await flash("info", "There are no leads to delete.");
      redirect(reverse("manage_leads"));
    }
    await deleteLeads({});
    await flash("success", `Successfully deleted all ${n} lead(s).`);
  } catch (err) {
    unstable_rethrow(err);
    logger.error({ err }, "delete_all_leads failed");
    await flash("error", failureText("Could not delete all leads", err));
  }
  redirect(reverse("manage_leads"));
}

export async function deleteLeadActivity(leadId: number, activityId: number): Promise<void> {
  await requireSuperadmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) notFound();
  const activity = await prisma.leadActivity.findFirst({
    where: { id: activityId, lead_id: leadId },
    select: { id: true },
  });
  if (!activity) notFound();
  await prisma.leadActivity.delete({ where: { id: activity.id } });
  await flash("success", "Activity deleted.");
  redirect(reverse("admin_view_lead", leadId));
}

export async function openBulkTransfer(fd: FormData): Promise<void> {
  await requireAdmin();
  const body = recordFromFormData(fd);
  const scope = field(body, "transfer_scope") || "selected";
  const filters = extractManageLeadFilters(body);
  if (scope === "filtered") {
    if (!Object.keys(filters).length) {
      await flash("warning", "Apply at least one filter on Manage Leads before transferring all matching leads.");
      redirect(reverse("manage_leads"));
    }
    const qs = new URLSearchParams({ transfer_scope: "filtered" });
    for (const [key, value] of Object.entries(filters)) if (value) qs.set(key, value);
    redirect(`${reverse("bulk_transfer_leads")}?${qs.toString()}`);
  }
  const ids = idList(fieldList(body, "lead_ids"));
  if (!ids.length) {
    await flash("warning", "No leads selected for transfer.");
    redirect(reverse("manage_leads"));
  }
  const qs = new URLSearchParams({ transfer_scope: "selected", lead_ids: ids.join(",") });
  redirect(`${reverse("bulk_transfer_leads")}?${qs.toString()}`);
}

export async function assignUnassigned(fd: FormData): Promise<void> {
  await requireAdmin();
  const body = recordFromFormData(fd);
  try {
    const method = field(body, "assignment_method") || "round_robin";
    const rawSelected = fieldList(body, "selected_counsellor_ids").filter((item) => item.trim());
    let counsellorIds = (
      await prisma.counsellor.findMany({ where: { is_active: true }, select: { id: true }, orderBy: { id: "asc" } })
    ).map((counsellor) => counsellor.id);
    let scope = " across all active counsellors";
    if (rawSelected.length) {
      if (rawSelected.some((item) => !/^-?\d+$/.test(item.trim()))) {
        await flash("error", "Selected counsellor list is invalid.");
        redirect(reverse("assign_leads_to_counsellors"));
      }
      const wanted = new Set(rawSelected.map(Number));
      const valid = counsellorIds.filter((id) => wanted.has(id));
      if (valid.length !== wanted.size) {
        await flash("error", "One or more selected counsellors are invalid or inactive.");
        redirect(reverse("assign_leads_to_counsellors"));
      }
      counsellorIds = valid;
      scope = ` for selected counsellors (${valid.length})`;
    }
    if (!counsellorIds.length) {
      await flash("error", "No active counsellors found!");
      redirect(reverse("manage_leads"));
    }
    const unassigned = await prisma.lead.findMany({
      where: { assigned_counsellor_id: null },
      orderBy: { id: "asc" },
      take: UNASSIGNED_ASSIGN_BATCH,
      select: { id: true },
    });
    if (!unassigned.length) {
      await flash("info", "No unassigned leads found!");
      redirect(reverse("manage_leads"));
    }
    const count = await assignLeads(
      unassigned.map((lead) => lead.id),
      counsellorIds,
      method,
    );
    const remaining = await prisma.lead.count({ where: { assigned_counsellor_id: null } });
    if (count === 0) {
      await flash(
        "info",
        remaining > 0
          ? `${remaining} unassigned leads remain. Run assignment again to continue.`
          : "No unassigned leads found!",
      );
    } else {
      await flash("success", unassignedAssignmentMessage(count, remaining, method, scope));
    }
    await invalidateAdminDashboard();
    redirect(reverse("assign_leads_to_counsellors"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Assignment failed", err));
    redirect(reverse("assign_leads_to_counsellors"));
  }
}

export async function manualRoute(leadId: number, fd: FormData): Promise<void> {
  await requireAdmin();
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) notFound();
    const body = recordFromFormData(fd);
    const routeTo = field(body, "route_to");
    if (!routeTo) {
      await flash("error", "Please select a routing option.");
      redirect(reverse("admin_view_lead", leadId));
    }
    const custom = field(body, "custom_reason");
    const label = routeTo.replace(/_/g, " ");
    const reason = custom ? `Manual routing: ${custom}` : `Manually routed to ${label} by admin`;
    if (await executeAcademicRouting(leadId, routeTo, reason)) await flash("success", `Student successfully routed to ${label}.`);
    else await flash("error", "Routing failed. Please try again.");
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Error in manual routing", err));
  }
  redirect(reverse("admin_view_lead", leadId));
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { parseLocalDateTime } from "@/lib/time";
import {
  counsellorActivityFrozenMessage,
  isActivityFrozen,
  maybeFreezeForActivityBurst,
} from "@/modules/activities/activity.service";
import { evaluateConversionScore } from "@/modules/ai/ai.service";
import { logStatusChange } from "@/modules/leads/status-history";
import { updateLead } from "@/modules/leads/lead.repository";
import { leadStatusChoices } from "@/modules/reference/reference.service";
import { recordFromFormData } from "@/server/form";
import { flash } from "@/server/flash";
import { fail } from "../../_lib/access";
import { myLeadsRedirectPath } from "../../_lib/my-leads-filters";
import { ownedActivity, ownedLead } from "./owned";

function safeReferer(referer: string | null, fallback: string) {
  if (!referer) return fallback;
  try {
    const url = new URL(referer);
    if (url.pathname.startsWith("/")) return `${url.pathname}${url.search}`;
  } catch {
    if (referer.startsWith("/")) return referer;
  }
  return fallback;
}

export async function markActivityComplete(leadId: number, activityId: number) {
  const { counsellor, lead, activity } = await ownedActivity(leadId, activityId);
  if (await isActivityFrozen(counsellor.id)) {
    await flash("error", counsellorActivityFrozenMessage());
    redirect(await myLeadsRedirectPath());
  }
  try {
    await prisma.leadActivity.update({
      where: { id: activity.id },
      data: { is_completed: true, completed_date: new Date() },
    });
    await updateLead(lead.id, { last_contact_date: new Date() });
    await flash("success", "Activity marked as completed!");
  } catch (err) {
    await flash("error", fail(err, "Could not update activity"));
  }
  redirect(await myLeadsRedirectPath());
}

export async function deleteLeadActivity(leadId: number, activityId: number) {
  const { lead, activity } = await ownedActivity(leadId, activityId);
  await prisma.leadActivity.delete({ where: { id: activity.id } });
  await flash("success", "Activity deleted.");
  redirect(reverse("lead_detail", lead.id));
}

export async function markFollowupComplete(leadId: number) {
  const { counsellor, lead } = await ownedLead(leadId);
  if (!lead.next_follow_up) {
    await flash("warning", "No visit scheduled for this lead.");
    const referer = (await headers()).get("referer");
    redirect(safeReferer(referer, reverse("lead_detail", lead.id)));
  }
  if (await isActivityFrozen(counsellor.id)) {
    await flash("error", counsellorActivityFrozenMessage());
    redirect(await myLeadsRedirectPath());
  }
  try {
    await prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        counsellor_id: counsellor.id,
        activity_type: "FOLLOW_UP",
        subject: `Visit completed: ${lead.first_name} ${lead.last_name}`,
        description: `Completed scheduled visit with ${lead.first_name} ${lead.last_name}`,
        scheduled_date: lead.next_follow_up,
        completed_date: new Date(),
        is_completed: true,
        duration: 30,
      },
    });
    await maybeFreezeForActivityBurst(counsellor.id);
    await updateLead(lead.id, { next_follow_up: null, last_contact_date: new Date() });
    await flash("success", "Visit marked as completed!");
  } catch (err) {
    await flash("error", fail(err, "Could not complete visit"));
  }
  redirect(await myLeadsRedirectPath());
}

export async function evaluateLeadScore(leadId: number) {
  const { lead } = await ownedLead(leadId);
  try {
    const score = await evaluateConversionScore(lead);
    await flash("success", `Admission likelihood score updated: ${score}`);
  } catch (err) {
    await flash("error", fail(err, "Could not evaluate admission score"));
  }
  redirect(reverse("lead_detail", lead.id));
}

export async function updateLeadStatus(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const newStatus = field(recordFromFormData(fd), "status");
  const valid = new Set((await leadStatusChoices()).map(([code]) => code));
  if (valid.has(newStatus)) {
    try {
      await updateLead(lead.id, { status: newStatus });
      await logStatusChange(lead, lead.status, newStatus, { counsellorId: counsellor.id });
      await flash("success", `Lead status updated to ${newStatus}`);
    } catch (err) {
      await flash("error", fail(err, "Could not update status"));
    }
  } else {
    await flash("error", "Invalid status");
  }
  redirect(reverse("lead_detail", lead.id));
}

export async function scheduleFollowUp(leadId: number, fd: FormData) {
  const { lead } = await ownedLead(leadId);
  const dt = parseLocalDateTime(field(recordFromFormData(fd), "follow_up_date"));
  if (dt) {
    await updateLead(lead.id, { next_follow_up: dt });
    await flash("success", "Visit scheduled successfully!");
  } else {
    await flash("error", "Please provide a valid date");
  }
  redirect(reverse("lead_detail", lead.id));
}

export async function markLeadLost(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const reason = field(recordFromFormData(fd), "reason");
  await updateLead(lead.id, {
    status: "CLOSED_LOST",
    notes: `${lead.notes}\n\nLost Reason: ${reason}`,
  });
  await logStatusChange(lead, lead.status, "CLOSED_LOST", {
    counsellorId: counsellor.id,
    note: reason ? `Lost reason: ${reason}` : "",
  });
  await flash("success", "Lead marked as lost");
  redirect(reverse("lead_detail", lead.id));
}

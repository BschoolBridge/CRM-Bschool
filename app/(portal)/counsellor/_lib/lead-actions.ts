"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { cache } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { parseLocalDateTime } from "@/lib/time";
import { PRESET_OUTCOMES } from "@/modules/activities/activity.form";
import {
  applyActivityToLead,
  counsellorActivityFrozenMessage,
  createPendingFollowup,
  isActivityFrozen,
  maybeFreezeForActivityBurst,
} from "@/modules/activities/activity.service";
import { evaluateConversionScore } from "@/modules/ai/ai.service";
import { logLeadProfileChanges } from "@/modules/leads/field-history";
import { parseLeadNoteMeta } from "@/modules/leads/lead.forms";
import { logStatusChange } from "@/modules/leads/status-history";
import { updateLead } from "@/modules/leads/lead.repository";
import { LEAD_PRIORITIES, leadStatusChoices, nextActionChoices } from "@/modules/reference/reference.service";
import { recordFromFormData } from "@/server/form";
import { flash } from "@/server/flash";
import { fail } from "../../_lib/access";
import { myLeadsRedirectPath } from "../../_lib/my-leads-filters";
import { ownedActivity, ownedLead } from "./owned";

const QUICK_OUTCOME_NEEDS_FOLLOWUP = new Set(["Callback requested", "Interested", "Requested more information"]);

const NOTE_META_ORDER = [
  ["target_exam", "Target exam"],
  ["percentile", "Percentile/score"],
  ["work_experience", "Work experience"],
  ["academic_background", "Academic background"],
  ["budget", "Budget"],
] as const;

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

/** Update freeform counsellor notes while preserving structured website meta lines. */
export async function updateLeadNotes(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const freeform = field(recordFromFormData(fd), "notes").trim();
  const { meta } = parseLeadNoteMeta(lead.notes ?? "");
  const noteLines = [
    freeform,
    ...NOTE_META_ORDER.map(([key, label]) => {
      const value = (meta[key] ?? "").trim();
      return value ? `${label}: ${value}` : "";
    }),
  ].filter(Boolean);
  const nextNotes = noteLines.join("\n");
  try {
    await updateLead(lead.id, { notes: nextNotes });
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    await logLeadProfileChanges(lead, updated, { counsellorId: counsellor.id });
    await flash("success", "Notes updated.");
  } catch (err) {
    await flash("error", fail(err, "Could not update notes"));
  }
  // Keep the notes card in view after save (hash survives the redirect).
  redirect(`${reverse("lead_detail", lead.id)}#lead-notes`);
}

export async function updateLeadStatus(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const newStatus = field(recordFromFormData(fd), "status");
  const choices = await leadStatusChoices();
  const valid = new Map(choices);
  if (valid.has(newStatus)) {
    try {
      await updateLead(lead.id, { status: newStatus });
      await logStatusChange(lead, lead.status, newStatus, { counsellorId: counsellor.id });
      await flash("success", `Lead status updated to ${valid.get(newStatus)}`);
    } catch (err) {
      await flash("error", fail(err, "Could not update status"));
    }
  } else {
    await flash("error", "Invalid status");
  }
  redirect(reverse("lead_detail", lead.id));
}

export async function updateLeadPriority(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const newPriority = field(recordFromFormData(fd), "priority");
  const valid = new Map(LEAD_PRIORITIES);
  if (!valid.has(newPriority as (typeof LEAD_PRIORITIES)[number][0])) {
    await flash("error", "Invalid priority");
    redirect(reverse("lead_detail", lead.id));
  }
  try {
    await updateLead(lead.id, { priority: newPriority });
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    await logLeadProfileChanges(lead, updated, { counsellorId: counsellor.id });
    await flash("success", `Priority updated to ${valid.get(newPriority as (typeof LEAD_PRIORITIES)[number][0])}`);
  } catch (err) {
    await flash("error", fail(err, "Could not update priority"));
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

/**
 * One-step call logging from the Today queue: outcome (+ optional next follow-up).
 * Optionally closes the incomplete queue activity that surfaced this lead.
 */
export async function logQuickOutcome(leadId: number, fd: FormData) {
  const { counsellor, lead } = await ownedLead(leadId);
  const data = recordFromFormData(fd);
  const outcome = field(data, "outcome").trim();
  const notes = field(data, "notes").trim();
  const nextAction = field(data, "next_action").trim();
  const followupDate = parseLocalDateTime(field(data, "followup_date"));
  const activityIdRaw = field(data, "activity_id").trim();
  const activityId = activityIdRaw ? Number(activityIdRaw) : null;
  const backToQueue = field(data, "return_to") === "call_queue";

  const finish = async () => {
    redirect(backToQueue ? reverse("counsellor_call_queue") : reverse("lead_detail", lead.id));
  };

  if (!(PRESET_OUTCOMES as readonly string[]).includes(outcome)) {
    await flash("error", "Pick a valid call outcome.");
    await finish();
  }
  if (await isActivityFrozen(counsellor.id)) {
    await flash("error", counsellorActivityFrozenMessage());
    await finish();
  }

  const wantsFollowup = Boolean(followupDate) || QUICK_OUTCOME_NEEDS_FOLLOWUP.has(outcome);
  if (wantsFollowup && !followupDate) {
    await flash("error", "Choose a next follow-up date/time for this outcome.");
    await finish();
  }

  let resolvedNext = nextAction;
  if (followupDate && !resolvedNext) {
    const codes = new Set((await nextActionChoices()).map(([code]) => code).filter(Boolean));
    resolvedNext = codes.has("CALLBACK") ? "CALLBACK" : codes.has("FOLLOW_UP") ? "FOLLOW_UP" : "";
  }
  if (followupDate && !resolvedNext) {
    await flash("error", "Select a next action for the follow-up.");
    await finish();
  }

  try {
    const activity = await prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        counsellor_id: counsellor.id,
        activity_type: "CALL",
        subject: `Call — ${outcome}`.slice(0, 200),
        description: notes || `Quick outcome logged: ${outcome}`,
        outcome,
        next_action: followupDate ? resolvedNext : "",
        duration: 5,
        is_completed: true,
        completed_date: new Date(),
        scheduled_date: new Date(),
      },
    });
    await maybeFreezeForActivityBurst(counsellor.id);
    await applyActivityToLead(lead, outcome, {
      touchContact: true,
      followupDate: followupDate ?? null,
    });
    if (followupDate) {
      await createPendingFollowup(
        lead.id,
        counsellor.id,
        {
          outcome: activity.outcome,
          next_action: activity.next_action,
          description: activity.description,
          followup_notes: notes,
          next_action_title: notes ? notes.slice(0, 200) : "",
        },
        followupDate,
      );
      await maybeFreezeForActivityBurst(counsellor.id);
    }
    if (activityId && Number.isFinite(activityId)) {
      await prisma.leadActivity.updateMany({
        where: {
          id: activityId,
          lead_id: lead.id,
          counsellor_id: counsellor.id,
          is_completed: false,
        },
        data: { is_completed: true, completed_date: new Date() },
      });
    }
    await Promise.all([
      cache.delete(`crm:shell:c:${counsellor.id}:callqueue`),
      cache.delete(`crm:shell:c:${counsellor.id}:pending`),
    ]);
    await flash(
      "success",
      followupDate ? `Logged “${outcome}” and scheduled the next follow-up.` : `Logged “${outcome}”.`,
    );
  } catch (err) {
    await flash("error", fail(err, "Could not log call outcome"));
  }
  await finish();
}

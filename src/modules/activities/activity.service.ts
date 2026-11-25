import { config } from "../../config/env";
import { logger } from "../../lib/logger";
import { prisma, type Db, type Prisma } from "../../lib/prisma";
import { formatHumanDateTime } from "../../lib/time";
import { notifyAllAdmins } from "../notifications/notifications.service";
import { activityTypeChoices, nextActionChoices } from "../reference/reference.service";
import { updateLead } from "../leads/lead.repository";
import { fullName } from "../presenters";

export const OUTCOME_VISIT_SCHEDULED = "Visit scheduled";
export const VISIT_NEXT_ACTION_CODE = "SCHEDULE_VISIT";
const TERMINAL_STATUSES = new Set(["CLOSED_WON", "CLOSED_LOST", "TRANSFERRED"]);

/**
 * Pipeline rule after logging an activity: no outcome → Awaiting Response;
 * any outcome moves New/Awaiting toward Contacted. Terminal statuses stay.
 */
export function statusAfterOutcome(currentStatus: string, outcome: string | null | undefined): string {
  const text = (outcome ?? "").trim();
  if (TERMINAL_STATUSES.has(currentStatus)) return currentStatus;
  if (!text) return "AWAITING_RESPONSE";
  if (currentStatus === "NEW" || currentStatus === "AWAITING_RESPONSE") return "CONTACTED";
  return currentStatus;
}

const NEXT_ACTION_TO_ACTIVITY: Record<string, string> = {
  CALLBACK: "CALL",
  SEND_BROCHURE: "EMAIL",
  SCHEDULE_VISIT: "FOLLOW_UP",
  SEND_PROPOSAL: "PROPOSAL",
  FOLLOW_UP: "FOLLOW_UP",
  MEETING: "MEETING",
  CALL: "CALL",
  EMAIL: "EMAIL",
};

interface ActivitySource {
  outcome: string;
  next_action: string;
  description: string;
  /** Optional counsellor note for the scheduled follow-up row. */
  followup_notes?: string | null;
  /** Optional custom title for the scheduled follow-up subject. */
  next_action_title?: string | null;
}

async function followupActivityType(source: ActivitySource): Promise<string> {
  if (source.outcome.trim() === OUTCOME_VISIT_SCHEDULED) return "FOLLOW_UP";
  const na = source.next_action.trim();
  if (NEXT_ACTION_TO_ACTIVITY[na]) return NEXT_ACTION_TO_ACTIVITY[na];
  const valid = new Set((await activityTypeChoices()).map(([code]) => code));
  return valid.has(na) ? na : "FOLLOW_UP";
}

async function followupSubject(source: ActivitySource, followupDate: Date | null): Promise<string> {
  const customTitle = (source.next_action_title ?? "").trim();
  if (customTitle) {
    if (followupDate) return `${customTitle.slice(0, 160)} — ${formatHumanDateTime(followupDate)}`.slice(0, 200);
    return customTitle.slice(0, 200);
  }
  if (source.outcome.trim() === OUTCOME_VISIT_SCHEDULED && followupDate) {
    return `Scheduled visit — ${formatHumanDateTime(followupDate)}`;
  }
  const na = source.next_action.trim();
  const label = (await nextActionChoices()).find(([code]) => code === na)?.[1] ?? na;
  if (followupDate) return `${label || "Follow-up"} — ${formatHumanDateTime(followupDate)}`;
  return label || "Follow-up";
}

/** The incomplete follow-up/visit row created after an activity with a next action. */
export async function createPendingFollowup(
  leadId: number,
  counsellorId: number,
  source: ActivitySource,
  followupDate: Date,
  loggedByAdminId: number | null = null,
  db: Db = prisma,
) {
  const followupNotes = (source.followup_notes ?? "").trim();
  const fromDescription = source.description.trim();
  const description = followupNotes
    ? followupNotes.slice(0, 1000)
    : fromDescription
      ? `Follow-up from: ${fromDescription.slice(0, 500)}`
      : "Scheduled from previous activity.";
  return db.leadActivity.create({
    data: {
      lead_id: leadId,
      counsellor_id: counsellorId,
      logged_by_admin_id: loggedByAdminId,
      activity_type: await followupActivityType(source),
      subject: (await followupSubject(source, followupDate)).slice(0, 200),
      description,
      outcome: "",
      next_action: "",
      scheduled_date: followupDate,
      is_completed: false,
    },
  });
}

/**
 * Lead-side effects of logging an activity: last contact, outcome-driven
 * status and, for "Visit scheduled", the lead's visit date.
 */
export async function applyActivityToLead(
  lead: { id: number; status: string },
  outcome: string,
  options: { touchContact: boolean; followupDate: Date | null },
) {
  const data: Prisma.LeadUncheckedUpdateInput = { status: statusAfterOutcome(lead.status, outcome) };
  if (options.touchContact) data.last_contact_date = new Date();
  if (options.followupDate && outcome.trim() === OUTCOME_VISIT_SCHEDULED) data.next_follow_up = options.followupDate;
  await updateLead(lead.id, data);
}

/** Saving an existing activity stamps `edited_at`, like LeadActivity.save() did for updates. */
export function updateActivity(id: number, data: Prisma.LeadActivityUncheckedUpdateInput, db: Db = prisma) {
  return db.leadActivity.update({ where: { id }, data: { ...data, edited_at: new Date() } });
}

// ── Burst freeze ─────────────────────────────────────────────────────────────

export function counsellorActivityFrozenMessage(): string {
  return (
    "You cannot add activities right now because too many were logged in a " +
    "short time. Please contact your administrator to restore access."
  );
}

export async function isActivityFrozen(counsellorId: number): Promise<boolean> {
  const hit = await prisma.counsellorActivityFreezeLog.findFirst({
    where: { counsellor_id: counsellorId, is_active: true },
    select: { id: true },
  });
  return Boolean(hit);
}

/** After an activity is created, freeze the counsellor if they crossed the burst threshold. */
export async function maybeFreezeForActivityBurst(counsellorId: number) {
  if (await isActivityFrozen(counsellorId)) return null;
  const { count: burstCount, windowSeconds } = config.activityBurst;
  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  const recent = await prisma.leadActivity.count({
    where: { counsellor_id: counsellorId, completed_date: { gte: windowStart }, activity_type: { not: "TRANSFER" } },
  });
  if (recent < burstCount) return null;

  const log = await prisma.counsellorActivityFreezeLog.create({
    data: { counsellor_id: counsellorId, activities_in_window: recent, window_seconds: windowSeconds, is_active: true },
  });
  const counsellor = await prisma.counsellor.findUniqueOrThrow({ where: { id: counsellorId }, include: { admin: true } });
  await notifyAllAdmins(
    `Activity freeze: counsellor ${fullName(counsellor.admin)} (${counsellor.employee_id}) logged ` +
      `${log.activities_in_window} activities within ${log.window_seconds} seconds. Adding activities is ` +
      "blocked until an admin unfreezes them. Review: Counsellor detail page.",
  );
  logger.warn({ employeeId: counsellor.employee_id, recent, windowSeconds }, "counsellor frozen from adding activities");
  return log;
}

export async function unfreezeActivityAdd(counsellorId: number, adminUserId: number): Promise<boolean> {
  const { count } = await prisma.counsellorActivityFreezeLog.updateMany({
    where: { counsellor_id: counsellorId, is_active: true },
    data: { is_active: false, unfrozen_at: new Date(), unfrozen_by_id: adminUserId },
  });
  return count > 0;
}

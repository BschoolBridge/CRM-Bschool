import { cache } from "../../lib/cache";
import { prisma, type Db } from "../../lib/prisma";
import type { Choice } from "../../forms/widgets";

export const DEFAULT_LEAD_STATUSES: Choice[] = [
  ["NEW", "New"],
  ["CONTACTED", "Contacted"],
  ["AWAITING_RESPONSE", "Awaiting Response"],
  ["QUALIFIED", "Qualified"],
  ["PROPOSAL_SENT", "Proposal Sent"],
  ["NEGOTIATION", "Negotiation"],
  ["CLOSED_WON", "Closed Won"],
  ["CLOSED_LOST", "Closed Lost"],
  ["TRANSFERRED", "Transferred"],
  ["CONTACT_PENDING", "Contact Pending"],
  ["COUNSELLING_SCHEDULED", "Counselling Scheduled"],
  ["COUNSELLING_COMPLETED", "Counselling Completed"],
  ["PROFILE_EVALUATION_PENDING", "Profile Evaluation Pending"],
  ["COLLEGE_SHORTLISTING", "College Shortlisting"],
  ["APPLICATION_IN_PROGRESS", "Application In Progress"],
  ["APPLICATION_SUBMITTED", "Application Submitted"],
  ["ADMISSION_OFFERED", "Admission Offered"],
  ["CONVERTED", "Converted"],
  ["ON_HOLD", "On Hold"],
  ["DISQUALIFIED", "Disqualified"],
];

export const DEFAULT_ACTIVITY_TYPES: Choice[] = [
  ["CALL", "Phone Call"],
  ["EMAIL", "Email"],
  ["MEETING", "Meeting"],
  ["PROPOSAL", "Proposal Sent"],
  ["FOLLOW_UP", "Visit"],
  ["TRANSFER", "Lead Transfer"],
  ["STATUS_CHANGE", "Status Change"],
  ["NOTE", "Note"],
];

export const LEAD_PRIORITIES: Choice[] = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["URGENT", "Urgent"],
];

export const LEAD_STATUS_CODE_MAX_LENGTH = 50;

interface StatusRow {
  code: string;
  name: string;
  color: string;
  is_active: boolean;
}
interface ActivityTypeRow {
  code: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
}
interface NextActionRow {
  code: string;
  name: string;
  is_active: boolean;
}

export interface ReferenceData {
  statuses: StatusRow[];
  activityTypes: ActivityTypeRow[];
  nextActions: NextActionRow[];
}

const CACHE_KEY = "crm:reference-data:v1";
const CACHE_SECONDS = 300;
const ordered = { orderBy: [{ sort_order: "asc" as const }, { name: "asc" as const }] };

export async function referenceData(): Promise<ReferenceData> {
  return cache.remember(CACHE_KEY, CACHE_SECONDS, async () => {
    const [statuses, activityTypes, nextActions] = await Promise.all([
      prisma.leadStatus.findMany({ ...ordered, select: { code: true, name: true, color: true, is_active: true } }),
      prisma.activityType.findMany({
        ...ordered,
        select: { code: true, name: true, icon: true, color: true, is_active: true },
      }),
      prisma.nextAction.findMany({ ...ordered, select: { code: true, name: true, is_active: true } }),
    ]);
    return { statuses, activityTypes, nextActions };
  });
}

export async function invalidateReferenceData(): Promise<void> {
  await cache.delete(CACHE_KEY);
}

/** Active statuses as (code, name); falls back to the defaults on an empty table. */
export async function leadStatusChoices(): Promise<Choice[]> {
  const { statuses } = await referenceData();
  const active = statuses.filter((s) => s.is_active).map((s) => [s.code, s.name] as const);
  return active.length ? active : DEFAULT_LEAD_STATUSES;
}

export async function activeLeadStatusChoices(): Promise<Choice[]> {
  const { statuses } = await referenceData();
  return statuses.filter((s) => s.is_active).map((s) => [s.code, s.name] as const);
}

export async function allLeadStatusChoices(): Promise<Choice[]> {
  const { statuses } = await referenceData();
  return statuses.map((s) => [s.code, s.name] as const);
}

export async function leadStatusLabel(code: string | null | undefined): Promise<string> {
  const c = (code ?? "").trim();
  if (!c) return "None";
  const { statuses } = await referenceData();
  return statuses.find((s) => s.code === c)?.name ?? titleCaseCode(c);
}

export async function activityTypeChoices(): Promise<Choice[]> {
  const { activityTypes } = await referenceData();
  return activityTypes.filter((t) => t.is_active).map((t) => [t.code, t.name] as const);
}

export async function allActivityTypeChoices(): Promise<Choice[]> {
  const { activityTypes } = await referenceData();
  return activityTypes.map((t) => [t.code, t.name] as const);
}

export async function activityTypeLabel(code: string): Promise<string> {
  const { activityTypes } = await referenceData();
  return activityTypes.find((t) => t.code === code)?.name ?? code;
}

/** NextAction.get_choices(): includes the leading "— None —" option. */
export async function nextActionChoices(): Promise<Choice[]> {
  const { nextActions } = await referenceData();
  return [["", "— None —"], ...nextActions.filter((a) => a.is_active).map((a) => [a.code, a.name] as const)];
}

export async function allNextActionChoices(): Promise<Choice[]> {
  const { nextActions } = await referenceData();
  return nextActions.map((a) => [a.code, a.name] as const);
}

/** Lookup tables used by the status/activity badges in every template. */
export async function templateLookups() {
  const { statuses, activityTypes, nextActions } = await referenceData();
  return {
    lead_status_map: Object.fromEntries(statuses.map((s) => [s.code, { name: s.name, color: s.color }])),
    lead_status_choices: statuses.filter((s) => s.is_active).map((s) => [s.code, s.name]),
    activity_type_map: Object.fromEntries(activityTypes.map((t) => [t.code, t])),
    next_action_map: Object.fromEntries(nextActions.map((a) => [a.code, a.name])),
  };
}

export function titleCaseCode(code: string): string {
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

export async function ensureStatusChangeActivityType(db: Db = prisma): Promise<void> {
  const exists = await db.activityType.findUnique({ where: { code: "STATUS_CHANGE" }, select: { id: true } });
  if (exists) return;
  await db.activityType.create({
    data: {
      code: "STATUS_CHANGE",
      name: "Status Change",
      description: "Lead status was updated",
      icon: "fas fa-exchange-alt",
      color: "warning",
      is_active: true,
      is_system: true,
      sort_order: 65,
    },
  });
  await invalidateReferenceData();
}

/** Normalise an admin-entered code the way the Django views did. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/ /g, "_");
}

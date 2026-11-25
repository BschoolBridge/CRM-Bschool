import { prisma, type Db } from "../../lib/prisma";
import { formatHumanDateTime, formatDjango } from "../../lib/time";
import { fullName, presentActivity } from "../presenters";
import { ensureProfileEditActivityType } from "../reference/reference.service";
import { parseLeadNoteMeta } from "./lead.forms";

type LeadLike = Record<string, unknown> & {
  id: number;
  assigned_counsellor_id: number | null;
};

interface ProfileChangeOptions {
  counsellorId?: number | null;
  loggedByAdminId?: number | null;
  db?: Db;
}

const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "alternate_phone", label: "Alternate phone" },
  { key: "whatsapp_phone", label: "WhatsApp" },
  { key: "preferred_language", label: "Preferred language" },
  { key: "school_name", label: "College / school" },
  { key: "course_interested", label: "Course / exam" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "postal_code", label: "Postal code" },
  { key: "notes", label: "Notes" },
  { key: "priority", label: "Priority" },
  { key: "source_id", label: "Source" },
  { key: "next_follow_up", label: "Next follow-up" },
  { key: "graduation_status", label: "Graduated" },
  { key: "graduation_course", label: "Graduation course" },
  { key: "graduation_year", label: "Graduation year" },
  { key: "graduation_college", label: "Graduation college" },
  { key: "position", label: "Position" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "expected_value", label: "Expected value" },
];

function displayValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (value instanceof Date) return formatDjango(value, "M d, Y H:i") || value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (key === "notes") {
      const freeform = parseLeadNoteMeta(text).freeform.trim();
      return freeform || "—";
    }
    return text || "—";
  }
  return String(value);
}

function sameValue(key: string, left: unknown, right: unknown): boolean {
  if (key === "next_follow_up") {
    const a = left instanceof Date ? left.getTime() : left ? new Date(String(left)).getTime() : null;
    const b = right instanceof Date ? right.getTime() : right ? new Date(String(right)).getTime() : null;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return a === b;
  }
  return displayValue(key, left) === displayValue(key, right);
}

/**
 * Record non-status profile field edits as a completed PROFILE_EDIT activity.
 * Status transitions continue to use logStatusChange().
 */
export async function logLeadProfileChanges(
  before: LeadLike,
  after: LeadLike,
  options: ProfileChangeOptions = {},
) {
  const changes: string[] = [];
  for (const field of TRACKED_FIELDS) {
    if (sameValue(field.key, before[field.key], after[field.key])) continue;
    changes.push(
      `${field.label}: "${displayValue(field.key, before[field.key])}" → "${displayValue(field.key, after[field.key])}"`,
    );
  }
  if (changes.length === 0) return null;

  const counsellorId = options.counsellorId ?? after.assigned_counsellor_id ?? before.assigned_counsellor_id;
  if (!counsellorId) return null;

  const db = options.db ?? prisma;
  await ensureProfileEditActivityType(db);
  const when = formatHumanDateTime(new Date());
  const summary =
    changes.length === 1 ? changes[0]! : `${changes.length} fields updated`;

  return db.leadActivity.create({
    data: {
      lead_id: after.id,
      counsellor_id: counsellorId,
      logged_by_admin_id: options.loggedByAdminId ?? null,
      activity_type: "PROFILE_EDIT",
      subject: `Profile updated (${changes.length} field${changes.length === 1 ? "" : "s"})`.slice(0, 200),
      description: [`Lead profile edited on ${when}.`, "", ...changes].join("\n").slice(0, 8000),
      outcome: summary.slice(0, 200),
      next_action: "",
      is_completed: true,
      duration: 0,
    },
  });
}

/** Newest-first profile edit rows for lead detail pages. */
export async function profileEditHistory(leadId: number, limit = 50) {
  const activities = await prisma.leadActivity.findMany({
    where: { lead_id: leadId, activity_type: "PROFILE_EDIT" },
    include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
    orderBy: [{ completed_date: "desc" }, { id: "desc" }],
    take: limit,
  });

  return activities.map((activity) => {
    presentActivity(activity);
    const changedBy =
      (activity as unknown as { admin_logger_name: string }).admin_logger_name ||
      (activity.counsellor ? fullName(activity.counsellor.admin) : "");
    const lines = (activity.description ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("→"));
    return {
      changed_at: activity.completed_date,
      changed_by: changedBy,
      subject: activity.subject,
      changes: lines,
      activity,
    };
  });
}

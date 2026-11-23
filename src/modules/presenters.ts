import type { Choice } from "../forms/widgets";
import { DEFAULT_ACTIVITY_TYPES, LEAD_PRIORITIES, titleCaseCode } from "./reference/reference.service";

export const GENDER_CHOICES: Choice[] = [
  ["M", "Male"],
  ["F", "Female"],
];
export const GRADUATION_CHOICES: Choice[] = [
  ["YES", "Yes"],
  ["NO", "No"],
];
export const BUSINESS_STATUS: Choice[] = [
  ["PENDING", "Pending"],
  ["ACTIVE", "Active"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];
export const ADMISSION_CALL_STATUS: Choice[] = [
  ["NEW", "New admission"],
  ["CONTACTED", "Contacted"],
  ["DOCUMENTS_PENDING", "Documents pending"],
  ["FEE_PENDING", "Fee pending"],
  ["IN_PROGRESS", "Admission in progress"],
  ["COMPLETED", "Admission completed"],
  ["ON_HOLD", "On hold"],
];
export const ADMISSION_ACTIVITY_TYPES: Choice[] = [
  ["CALL", "Phone call"],
  ["WHATSAPP", "WhatsApp message"],
  ["FEE_REMINDER", "Fee reminder"],
  ["DOCUMENT_REMINDER", "Document reminder"],
  ["FOLLOW_UP", "Scheduled follow-up"],
  ["NOTE", "Note"],
];
export const SOCIAL_CHANNELS: Choice[] = [
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
];

/** get_FOO_display(): label for a stored choice, or the raw value when unknown. */
export function choiceLabel(choices: readonly Choice[], value: unknown): string {
  const v = value === null || value === undefined ? "" : String(value);
  return choices.find(([code]) => code === v)?.[1] ?? v;
}

type Row = Record<string, any>;

function decimalString(value: unknown, places = 2): string | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n.toFixed(places) : String(value);
}

/** Template counterpart of Django's FieldFile: falsy when empty, `.url` when set. */
class StoredFile {
  constructor(readonly name: string) {}
  get url() {
    return `/media/${this.name.split("/").map(encodeURIComponent).join("/")}`;
  }
  toString() {
    return this.name;
  }
}

export function fullName(user: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!user) return "";
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

export function presentUser<T extends Row | null | undefined>(user: T): T {
  if (!user || user.__presented) return user;
  Object.assign(user, {
    __presented: true,
    get_full_name: fullName(user),
    get_gender_display: choiceLabel(GENDER_CHOICES, user.gender),
    profile_pic: user.profile_pic ? new StoredFile(String(user.profile_pic)) : "",
    is_authenticated: true,
  });
  return user;
}

export function presentCounsellor<T extends Row | null | undefined>(counsellor: T): T {
  if (!counsellor || counsellor.__presented) return counsellor;
  counsellor.__presented = true;
  if (counsellor.admin) presentUser(counsellor.admin);
  for (const key of ["performance_rating", "total_business_generated"]) {
    if (key in counsellor) counsellor[key] = decimalString(counsellor[key]);
  }
  return counsellor;
}

export interface StatusLookup {
  [code: string]: { name: string; color: string } | undefined;
}

export function presentLead<T extends Row | null | undefined>(lead: T, statuses?: StatusLookup): T {
  if (!lead || lead.__presented) return lead;
  const statusName = statuses?.[lead.status]?.name ?? (lead.status ? titleCaseCode(String(lead.status)) : "");
  Object.assign(lead, {
    __presented: true,
    full_name: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim(),
    get_priority_display: choiceLabel(LEAD_PRIORITIES, lead.priority),
    get_graduation_status_display: choiceLabel(GRADUATION_CHOICES, lead.graduation_status),
    get_is_graduated_display: choiceLabel(GRADUATION_CHOICES, lead.is_graduated),
    get_status_display: statusName,
    status_label: statusName,
  });
  for (const key of ["expected_value", "actual_value"]) {
    if (key in lead) lead[key] = decimalString(lead[key]);
  }
  presentCounsellor(lead.assigned_counsellor);
  presentCounsellor(lead.previous_counsellor);
  lead.activities?.forEach((a: Row) => presentActivity(a, statuses));
  lead.businesses?.forEach((b: Row) => presentBusiness(b, statuses));
  return lead;
}

export function presentActivity<T extends Row | null | undefined>(activity: T, statuses?: StatusLookup): T {
  if (!activity || activity.__presented) return activity;
  const admin = activity.logged_by_admin;
  Object.assign(activity, {
    __presented: true,
    get_activity_type_display: choiceLabel(DEFAULT_ACTIVITY_TYPES, activity.activity_type),
    was_updated_after_create: activity.edited_at != null,
    admin_logger_name: activity.logged_by_admin_id
      ? fullName(admin) || admin?.email || "Admin"
      : "",
  });
  presentUser(admin);
  presentLead(activity.lead, statuses);
  presentCounsellor(activity.counsellor);
  return activity;
}

export function presentBusiness<T extends Row | null | undefined>(business: T, statuses?: StatusLookup): T {
  if (!business || business.__presented) return business;
  Object.assign(business, {
    __presented: true,
    get_status_display: choiceLabel(BUSINESS_STATUS, business.status),
    value: decimalString(business.value),
  });
  presentLead(business.lead, statuses);
  presentCounsellor(business.counsellor);
  return business;
}

export function presentStudent<T extends Row | null | undefined>(student: T, statuses?: StatusLookup): T {
  if (!student || student.__presented) return student;
  Object.assign(student, {
    __presented: true,
    get_call_status_display: choiceLabel(ADMISSION_CALL_STATUS, student.call_status),
    is_follow_up_overdue: Boolean(
      student.next_follow_up && student.call_status !== "COMPLETED" && student.next_follow_up < new Date(),
    ),
  });
  presentLead(student.lead, statuses);
  presentCounsellor(student.assigned_counsellor);
  presentUser(student.created_by);
  return student;
}

export function presentStudentActivity<T extends Row | null | undefined>(activity: T): T {
  if (!activity || activity.__presented) return activity;
  Object.assign(activity, {
    __presented: true,
    get_activity_type_display: choiceLabel(ADMISSION_ACTIVITY_TYPES, activity.activity_type),
  });
  presentStudent(activity.student);
  presentCounsellor(activity.counsellor);
  presentUser(activity.created_by);
  return activity;
}

export function presentThread<T extends Row | null | undefined>(thread: T): T {
  if (!thread || thread.__presented) return thread;
  Object.assign(thread, { __presented: true, get_channel_display: choiceLabel(SOCIAL_CHANNELS, thread.channel) });
  presentLead(thread.lead);
  return thread;
}

export function presentAll<T>(rows: T[], fn: (row: T) => T): T[] {
  for (const row of rows) fn(row);
  return rows;
}

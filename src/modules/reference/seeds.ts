import { prisma } from "../../lib/prisma";
import { invalidateReferenceData } from "./reference.service";

export const LEAD_STATUS_SEEDS = [
  { code: "NEW", name: "New", color: "info", is_system: true, sort_order: 10 },
  { code: "CONTACTED", name: "Contacted", color: "warning", is_system: false, sort_order: 20 },
  { code: "AWAITING_RESPONSE", name: "Awaiting Response", color: "secondary", is_system: false, sort_order: 25 },
  { code: "QUALIFIED", name: "Qualified", color: "primary", is_system: false, sort_order: 30 },
  { code: "PROPOSAL_SENT", name: "Proposal Sent", color: "info", is_system: false, sort_order: 40 },
  { code: "NEGOTIATION", name: "Negotiation", color: "warning", is_system: false, sort_order: 50 },
  { code: "CLOSED_WON", name: "Closed Won", color: "success", is_system: true, sort_order: 60 },
  { code: "CLOSED_LOST", name: "Closed Lost", color: "danger", is_system: true, sort_order: 70 },
  { code: "TRANSFERRED", name: "Transferred", color: "secondary", is_system: true, sort_order: 80 },
  { code: "CONTACT_PENDING", name: "Contact Pending", color: "secondary", is_system: false, sort_order: 90 },
  { code: "COUNSELLING_SCHEDULED", name: "Counselling Scheduled", color: "info", is_system: false, sort_order: 100 },
  { code: "COUNSELLING_COMPLETED", name: "Counselling Completed", color: "primary", is_system: false, sort_order: 110 },
  { code: "PROFILE_EVALUATION_PENDING", name: "Profile Evaluation Pending", color: "warning", is_system: false, sort_order: 120 },
  { code: "COLLEGE_SHORTLISTING", name: "College Shortlisting", color: "info", is_system: false, sort_order: 130 },
  { code: "APPLICATION_IN_PROGRESS", name: "Application In Progress", color: "primary", is_system: false, sort_order: 140 },
  { code: "APPLICATION_SUBMITTED", name: "Application Submitted", color: "success", is_system: false, sort_order: 150 },
  { code: "ADMISSION_OFFERED", name: "Admission Offered", color: "success", is_system: false, sort_order: 160 },
  { code: "CONVERTED", name: "Converted", color: "success", is_system: false, sort_order: 170 },
  { code: "ON_HOLD", name: "On Hold", color: "warning", is_system: false, sort_order: 180 },
  { code: "DISQUALIFIED", name: "Disqualified", color: "danger", is_system: false, sort_order: 190 },
];

export const ACTIVITY_TYPE_SEEDS = [
  { code: "CALL", name: "Phone Call", icon: "fas fa-phone", color: "info", is_system: true, sort_order: 10 },
  { code: "EMAIL", name: "Email", icon: "fas fa-envelope", color: "primary", is_system: true, sort_order: 20 },
  { code: "MEETING", name: "Meeting", icon: "fas fa-handshake", color: "success", is_system: true, sort_order: 30 },
  { code: "PROPOSAL", name: "Proposal Sent", icon: "fas fa-file-alt", color: "warning", is_system: false, sort_order: 40 },
  { code: "FOLLOW_UP", name: "Visit", icon: "fas fa-calendar-check", color: "success", is_system: true, sort_order: 50 },
  { code: "TRANSFER", name: "Lead Transfer", icon: "fas fa-exchange-alt", color: "secondary", is_system: true, sort_order: 60 },
  { code: "STATUS_CHANGE", name: "Status Change", icon: "fas fa-flag", color: "warning", is_system: true, sort_order: 65 },
  { code: "NOTE", name: "Note", icon: "fas fa-sticky-note", color: "dark", is_system: false, sort_order: 70 },
];

export const NEXT_ACTION_SEEDS = [
  { code: "CALLBACK", name: "Callback", is_system: false, sort_order: 10 },
  { code: "SEND_BROCHURE", name: "Send Brochure", is_system: false, sort_order: 20 },
  { code: "SCHEDULE_VISIT", name: "Visit Scheduled", is_system: false, sort_order: 30 },
  { code: "SEND_PROPOSAL", name: "Send Proposal", is_system: false, sort_order: 40 },
  { code: "FOLLOW_UP", name: "Follow Up", is_system: false, sort_order: 50 },
  { code: "CLOSE_DEAL", name: "Close Deal", is_system: false, sort_order: 60 },
  { code: "NO_ACTION", name: "No Further Action", is_system: false, sort_order: 70 },
];

export const LEAD_SOURCE_SEEDS = [
  { name: "Website enquiry form", description: "Inbound leads from the website enquiry form" },
  { name: "Website Contacts", description: "Inbound leads from the website contact page" },
];

export const ENTRANCE_EXAM_SEEDS = [
  { code: "CAT", name: "CAT", score_kind: "PERCENTILE", sort_order: 10 },
  { code: "XAT", name: "XAT", score_kind: "PERCENTILE", sort_order: 20 },
  { code: "NMAT", name: "NMAT", score_kind: "SCALED", sort_order: 30 },
  { code: "SNAP", name: "SNAP", score_kind: "SCALED", sort_order: 40 },
  { code: "CMAT", name: "CMAT", score_kind: "MIXED", sort_order: 50 },
  { code: "MAT", name: "MAT", score_kind: "MIXED", sort_order: 60 },
  { code: "GMAT", name: "GMAT", score_kind: "SCALED", sort_order: 70 },
  { code: "MAH_MBA_CET", name: "MAH MBA CET", score_kind: "PERCENTILE", sort_order: 80 },
  { code: "OTHER", name: "Other", score_kind: "MIXED", sort_order: 90 },
];

/** Idempotent: inserts missing codes only, never overwrites edits made in the admin panel. */
export async function seedReferenceData() {
  const created = { lead_statuses: 0, activity_types: 0, next_actions: 0, lead_sources: 0, entrance_exams: 0 };

  for (const row of LEAD_STATUS_SEEDS) {
    const exists = await prisma.leadStatus.findUnique({ where: { code: row.code }, select: { id: true } });
    if (exists) continue;
    await prisma.leadStatus.create({ data: { ...row, description: "" } });
    created.lead_statuses++;
  }
  for (const row of ACTIVITY_TYPE_SEEDS) {
    const exists = await prisma.activityType.findUnique({ where: { code: row.code }, select: { id: true } });
    if (exists) continue;
    await prisma.activityType.create({ data: { ...row, description: "" } });
    created.activity_types++;
  }
  for (const row of NEXT_ACTION_SEEDS) {
    const exists = await prisma.nextAction.findUnique({ where: { code: row.code }, select: { id: true } });
    if (exists) continue;
    await prisma.nextAction.create({ data: { ...row, description: "" } });
    created.next_actions++;
  }
  for (const row of LEAD_SOURCE_SEEDS) {
    const exists = await prisma.leadSource.findFirst({ where: { name: row.name }, select: { id: true } });
    if (exists) continue;
    await prisma.leadSource.create({ data: { ...row, is_active: true } });
    created.lead_sources++;
  }
  for (const row of ENTRANCE_EXAM_SEEDS) {
    const exists = await prisma.entranceExam.findUnique({ where: { code: row.code }, select: { id: true } });
    if (exists) continue;
    await prisma.entranceExam.create({ data: { ...row, is_active: true } });
    created.entrance_exams++;
  }

  await invalidateReferenceData();
  return created;
}

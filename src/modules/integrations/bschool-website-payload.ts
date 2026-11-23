import { normalizeLeadPhone } from "../../lib/phone";
import { UNVERIFIED } from "../admissions/lifecycle";
import { WEBSITE_SOURCE_ENQUIRY } from "./website-sources";

const BSCHOOL_SOURCES = new Set(["counseling_form", "visit_popup", "apply_click", "counseling_button"]);

const WORK_EXPERIENCE_MONTHS: Record<string, number | null> = {
  fresher: 0,
  "under 1 year": null,
  "1–2 years": 18,
  "1-2 years": 18,
  "2–3 years": 30,
  "2-3 years": 30,
  "3+ years": 36,
};

const BUDGET_BANDS: Record<string, { fee_min: number | null; fee_max: number | null }> = {
  "under ₹10 lakh": { fee_min: null, fee_max: 1_000_000 },
  "under rs 10 lakh": { fee_min: null, fee_max: 1_000_000 },
  "under rs. 10 lakh": { fee_min: null, fee_max: 1_000_000 },
  "₹10–15 lakh": { fee_min: 1_000_000, fee_max: 1_500_000 },
  "₹10-15 lakh": { fee_min: 1_000_000, fee_max: 1_500_000 },
  "rs 10–15 lakh": { fee_min: 1_000_000, fee_max: 1_500_000 },
  "₹15–25 lakh": { fee_min: 1_500_000, fee_max: 2_500_000 },
  "₹15-25 lakh": { fee_min: 1_500_000, fee_max: 2_500_000 },
  "above ₹25 lakh": { fee_min: 2_500_000, fee_max: null },
  "above rs 25 lakh": { fee_min: 2_500_000, fee_max: null },
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullableText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const t = String(value).trim();
  return t.toLowerCase() === "null" ? "" : t;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    const t = nullableText(v);
    if (t) return t.slice(0, 5000);
  }
  return "";
}

export type BschoolWebsiteLead = {
  website_id: string;
  created_at: string;
  full_name: string;
  phone: string;
  target_exam: string;
  percentile_text: string;
  source: string;
  status: string;
  notes: string;
  email: string;
  city: string;
  work_experience: string;
  academic_background: string;
  budget: string;
  specialization: string;
  college: string;
};

/** Prefer the Bschool Bridge website contract, then fall back to older alias keys. */
export function normalizeBschoolWebsiteLead(data: Record<string, unknown>): BschoolWebsiteLead {
  const first = firstNonEmpty(data.first_name, data.firstname, data.fname);
  const last = firstNonEmpty(data.last_name, data.lastname, data.lname);
  let fullName = firstNonEmpty(data.fullName, data.full_name, data.name, data.student_name, data.applicant_name);
  if (!fullName && first) fullName = `${first} ${last}`.trim();

  return {
    website_id: firstNonEmpty(data.id, data.website_lead_id, data.external_id),
    created_at: firstNonEmpty(data.createdAt, data.created_at),
    full_name: fullName,
    phone: normalizeLeadPhone(firstNonEmpty(data.phone, data.mobile, data.phone_number)),
    target_exam: firstNonEmpty(data.targetExam, data.target_exam, data.exam),
    percentile_text: firstNonEmpty(data.percentile, data.score_band, data.exam_percentile),
    source: firstNonEmpty(data.source, data.lead_source, data.form_type, data.form),
    status: firstNonEmpty(data.status, "new").toLowerCase(),
    notes: firstNonEmpty(data.notes, data.message, data.comments, data.remark),
    email: firstNonEmpty(data.email, data.email_address).toLowerCase(),
    city: firstNonEmpty(data.city),
    work_experience: firstNonEmpty(data.workExperience, data.work_experience),
    academic_background: firstNonEmpty(data.academicBackground, data.academic_background),
    budget: firstNonEmpty(data.budget),
    specialization: firstNonEmpty(data.specialization),
    college: firstNonEmpty(data.college, data.school_name, data.graduation_college),
  };
}

export function resolveBschoolSourceLabel(source: string): string {
  const token = source.trim().toLowerCase().replace(/\s+/g, "_");
  if (BSCHOOL_SOURCES.has(token) || BSCHOOL_SOURCES.has(source.trim().toLowerCase())) return WEBSITE_SOURCE_ENQUIRY;
  return WEBSITE_SOURCE_ENQUIRY;
}

export function isApplyClick(source: string): boolean {
  return source.trim().toLowerCase().replace(/\s+/g, "_") === "apply_click";
}

export function parseTargetExam(raw: string): { code: string; year: number | null; label: string } {
  const label = raw.trim();
  if (!label) return { code: "OTHER", year: null, label: "" };
  const yearMatch = label.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const upper = label.toUpperCase();
  // Longer tokens first so GMAT is not matched as MAT.
  const known: Array<{ match: RegExp; code: string }> = [
    { match: /\bMAH[\s_]?MBA[\s_]?CET\b/, code: "MAH_MBA_CET" },
    { match: /\bGMAT\b/, code: "GMAT" },
    { match: /\bNMAT\b/, code: "NMAT" },
    { match: /\bCMAT\b/, code: "CMAT" },
    { match: /\bSNAP\b/, code: "SNAP" },
    { match: /\bXAT\b/, code: "XAT" },
    { match: /\bCAT\b/, code: "CAT" },
    { match: /\bMAT\b/, code: "MAT" },
  ];
  for (const exam of known) {
    if (exam.match.test(upper)) return { code: exam.code, year, label };
  }
  return { code: "OTHER", year, label };
}

export function parsePercentileBand(raw: string): { numeric: number | null; text: string } {
  const text = raw.trim();
  if (!text) return { numeric: null, text: "" };
  const exact = text.match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/);
  if (exact) {
    const n = Number(exact[1]);
    return { numeric: Number.isFinite(n) && n >= 0 && n <= 100 ? n : null, text };
  }
  const range = text.match(/(\d{1,3}(?:\.\d+)?)\s*[-–]\s*(\d{1,3}(?:\.\d+)?)/);
  if (range) {
    const high = Number(range[2]);
    return { numeric: Number.isFinite(high) && high >= 0 && high <= 100 ? high : null, text };
  }
  return { numeric: null, text };
}

export function workExperienceMonths(label: string): number | null {
  if (!label) return null;
  const key = label.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WORK_EXPERIENCE_MONTHS, key) ? WORK_EXPERIENCE_MONTHS[key]! : null;
}

export function budgetFees(label: string): { fee_min: number | null; fee_max: number | null; notes: string } {
  if (!label) return { fee_min: null, fee_max: null, notes: "" };
  const key = label.trim().toLowerCase().replace(/rs\./g, "rs");
  const hit = BUDGET_BANDS[key];
  if (hit) return { ...hit, notes: label };
  return { fee_min: null, fee_max: null, notes: label };
}

export function websiteMetaNotes(lead: BschoolWebsiteLead): string[] {
  const lines: string[] = [];
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  if (lead.website_id) lines.push(`[Website lead id ${stamp}] ${lead.website_id}`);
  if (lead.created_at) lines.push(`[Website createdAt ${stamp}] ${lead.created_at}`);
  if (lead.source) lines.push(`[Website source ${stamp}] ${lead.source}`);
  if (lead.target_exam) lines.push(`[Target exam ${stamp}] ${lead.target_exam}`);
  if (lead.percentile_text) lines.push(`[Percentile/score ${stamp}] ${lead.percentile_text}`);
  if (lead.notes) lines.push(`[Website note ${stamp}] ${lead.notes}`);
  return lines;
}

export function parseWebsiteCreatedAt(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export { UNVERIFIED };

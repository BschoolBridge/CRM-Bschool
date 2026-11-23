import { readEnv } from "../../config/env";
import { logger } from "../../lib/logger";
import { placeholderLeadEmail } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { createLead, updateLead } from "../leads/lead.repository";
import { findLeadsByPhone } from "../leads/phone-lookup";
import {
  budgetFees,
  isApplyClick,
  normalizeBschoolWebsiteLead,
  parsePercentileBand,
  parseTargetExam,
  parseWebsiteCreatedAt,
  resolveBschoolSourceLabel,
  type BschoolWebsiteLead,
  UNVERIFIED,
  websiteMetaNotes,
  workExperienceMonths,
} from "./bschool-website-payload";
import { WEBSITE_SOURCE_CONTACTS, WEBSITE_SOURCE_ENQUIRY, WEBSITE_SOURCE_LEGACY, WEBSITE_WEBHOOK_SOURCE_DESCRIPTION } from "./website-sources";
import { safeEqual, verifyHmacHeader } from "./hmac";

export function leadWebhookConfig() {
  const enabledRaw = readEnv("CRM_WEBHOOK_ENABLED").toLowerCase();
  let enabled: boolean;
  if (["0", "false", "no", "off"].includes(enabledRaw)) enabled = false;
  else if (["1", "true", "yes", "on"].includes(enabledRaw)) enabled = true;
  else enabled = Boolean(readEnv("CRM_WEBHOOK_TOKEN") || readEnv("CRM_WEBHOOK_SECRET"));
  return {
    enabled,
    secret: readEnv("CRM_WEBHOOK_SECRET"),
    token: readEnv("CRM_WEBHOOK_TOKEN"),
    source_name: readEnv("CRM_WEBHOOK_SOURCE_NAME") || WEBSITE_SOURCE_ENQUIRY,
    // Website webhook always keeps one lead per phone (the latest). Opt out only with an explicit false.
    dedupe_by_phone: !["0", "false", "no", "off"].includes(readEnv("CRM_WEBHOOK_DEDUPE_PHONE").toLowerCase()),
    public_base_url: publicBaseUrl(),
  };
}

export function publicBaseUrl(): string {
  const explicit = readEnv("CRM_WEBHOOK_URL");
  if (explicit) {
    if (explicit.includes("/integrations/")) return explicit.split("/integrations/")[0]!.replace(/\/+$/, "");
    return explicit.replace(/\/+$/, "");
  }
  for (const key of ["SITE_URL", "DJANGO_SITE_URL", "CRM_PUBLIC_BASE_URL"]) {
    const val = readEnv(key);
    if (val) return val.includes("://") ? val.replace(/\/+$/, "") : `https://${val}`.replace(/\/+$/, "");
  }
  return "";
}

export interface HeaderSource {
  get(name: string): string | null | undefined;
  query?: { token?: unknown; api_key?: unknown };
}

function header(req: HeaderSource, name: string): string {
  return String(req.get(name) ?? "").trim();
}

export function authorizeLeadWebhook(raw: Buffer, req: HeaderSource): boolean {
  const cfg = leadWebhookConfig();
  if (!cfg.enabled) {
    logger.warn("Lead webhook rejected: disabled");
    return false;
  }
  if (cfg.secret) {
    const sig = header(req, "x-crm-webhook-signature") || header(req, "x-webhook-signature");
    if (verifyHmacHeader(raw, sig, cfg.secret)) return true;
  }
  if (cfg.token) {
    const auth = header(req, "authorization");
    if (auth.toLowerCase().startsWith("bearer ") && safeEqual(auth.slice(7).trim(), cfg.token)) return true;
    for (const name of ["x-crm-webhook-token", "x-webhook-token", "x-api-key"]) {
      const val = header(req, name);
      if (val && safeEqual(val, cfg.token)) return true;
    }
  }
  if (!cfg.secret && !cfg.token) logger.warn("Lead webhook rejected: set CRM_WEBHOOK_TOKEN or CRM_WEBHOOK_SECRET");
  return false;
}

/** Maps website form keys onto the CRM lead fields the webhook writes. */
export function normalizeLeadWebhookPayload(data: Record<string, unknown>): BschoolWebsiteLead {
  return normalizeBschoolWebsiteLead(data);
}

const CONTACT_TOKENS = new Set(["website contacts", "website contact", "contacts", "contact", "contact form", "contact us", "contact page"]);
const ENQUIRY_TOKENS = new Set(["website enquiry form", "website enquiry", "website inquiry", "website inquiry form", "enquiry form", "enquiry", "inquiry form", "inquiry", "website form"]);

function sourceToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSourceName(lead: BschoolWebsiteLead, cfg: ReturnType<typeof leadWebhookConfig>): string {
  if (lead.source) {
    const token = sourceToken(lead.source);
    if (CONTACT_TOKENS.has(token)) return WEBSITE_SOURCE_CONTACTS;
    if (
      ENQUIRY_TOKENS.has(token)
      || token === WEBSITE_SOURCE_ENQUIRY.toLowerCase()
      || token === WEBSITE_SOURCE_LEGACY.toLowerCase()
      || lead.source.includes("_")
    ) {
      return resolveBschoolSourceLabel(lead.source);
    }
  }
  return cfg.source_name || WEBSITE_SOURCE_ENQUIRY;
}

async function ensureSource(name: string) {
  const existing = await prisma.leadSource.findFirst({ where: { name: name.slice(0, 100) } });
  if (existing) return existing;
  return prisma.leadSource.create({ data: { name: name.slice(0, 100), description: WEBSITE_WEBHOOK_SOURCE_DESCRIPTION, is_active: true } });
}

async function attachAcademicProfile(leadId: number, lead: BschoolWebsiteLead) {
  if (!lead.work_experience && !lead.academic_background) return;
  const months = workExperienceMonths(lead.work_experience);
  await prisma.leadAcademicProfile.upsert({
    where: { lead_id: leadId },
    create: {
      lead_id: leadId,
      highest_qualification: lead.academic_background || null,
      employment_status: lead.work_experience || null,
      work_experience_months: months,
      professional_background: [lead.academic_background, lead.work_experience].filter(Boolean).join(" · ") || null,
    },
    update: {
      highest_qualification: lead.academic_background || undefined,
      employment_status: lead.work_experience || undefined,
      work_experience_months: months ?? undefined,
      professional_background: [lead.academic_background, lead.work_experience].filter(Boolean).join(" · ") || undefined,
    },
  });
}

async function attachPreference(leadId: number, lead: BschoolWebsiteLead) {
  if (!lead.budget && !lead.specialization && !lead.city) return;
  const fees = budgetFees(lead.budget);
  const preference = await prisma.leadPreference.upsert({
    where: { lead_id: leadId },
    create: {
      lead_id: leadId,
      fee_min: fees.fee_min,
      fee_max: fees.fee_max,
      notes: fees.notes || null,
    },
    update: {
      fee_min: fees.fee_min ?? undefined,
      fee_max: fees.fee_max ?? undefined,
      notes: fees.notes || undefined,
    },
  });
  if (lead.city) {
    const existingCity = await prisma.leadPreferenceLocation.findFirst({
      where: { preference_id: preference.id, location: lead.city.slice(0, 100) },
      select: { id: true },
    });
    if (!existingCity) {
      await prisma.leadPreferenceLocation.create({
        data: { preference_id: preference.id, location: lead.city.slice(0, 100) },
      });
    }
  }
  if (lead.specialization) {
    const existingSpec = await prisma.leadPreferenceSpecialization.findFirst({
      where: { preference_id: preference.id, name: lead.specialization.slice(0, 100) },
      select: { id: true },
    });
    if (!existingSpec) {
      await prisma.leadPreferenceSpecialization.create({
        data: { preference_id: preference.id, name: lead.specialization.slice(0, 100) },
      });
    }
  }
}

async function attachExamAttempt(leadId: number, lead: BschoolWebsiteLead) {
  if (!lead.target_exam && !lead.percentile_text) return;
  const parsed = parseTargetExam(lead.target_exam || "OTHER");
  const band = parsePercentileBand(lead.percentile_text);
  const scaledOnly = !band.numeric && /^\d{3,4}(?:\.\d+)?$/.test(band.text) ? Number(band.text) : null;
  const exam = await prisma.entranceExam.findUnique({ where: { code: parsed.code } });
  if (!exam) return;
  const existing = await prisma.leadExamAttempt.findFirst({
    where: {
      lead_id: leadId,
      exam_id: exam.id,
      ...(parsed.year ? { exam_year: parsed.year } : {}),
    },
    orderBy: { id: "desc" },
  });
  const verification_notes = [parsed.label || lead.target_exam, band.text ? `Band/score: ${band.text}` : ""]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 5000) || null;
  if (existing) {
    await prisma.leadExamAttempt.update({
      where: { id: existing.id },
      data: {
        percentile: band.numeric ?? existing.percentile,
        scaled_score: scaledOnly ?? existing.scaled_score,
        verification_notes: verification_notes ?? existing.verification_notes,
        verified: false,
      },
    });
    return;
  }
  await prisma.leadExamAttempt.create({
    data: {
      lead_id: leadId,
      exam_id: exam.id,
      exam_year: parsed.year,
      admission_cycle: parsed.year ? String(parsed.year) : null,
      percentile: band.numeric,
      scaled_score: scaledOnly,
      verification_notes,
      verified: false,
      result_status: band.text || parsed.label ? "REPORTED" : null,
    },
  });
}

async function attachCollegeShortlist(leadId: number, lead: BschoolWebsiteLead) {
  if (!lead.college || !isApplyClick(lead.source)) return;
  const name = lead.college.slice(0, 200);
  const existing = await prisma.collegeShortlistEntry.findFirst({
    where: { lead_id: leadId, college_name: name },
    select: { id: true },
  });
  if (existing) return;
  await prisma.collegeShortlistEntry.create({
    data: {
      lead_id: leadId,
      college_name: name,
      status: "CONSIDERING",
      verification_status: UNVERIFIED,
      preference_note: "Submitted from website Apply button",
      notes: lead.target_exam ? `Target exam: ${lead.target_exam}` : null,
    },
  });
}

async function attachWebsiteExtras(leadId: number, lead: BschoolWebsiteLead) {
  await Promise.all([
    attachAcademicProfile(leadId, lead),
    attachPreference(leadId, lead),
    attachExamAttempt(leadId, lead),
    attachCollegeShortlist(leadId, lead),
  ]);
}

async function upsertFromRow(lead: BschoolWebsiteLead, cfg: ReturnType<typeof leadWebhookConfig>) {
  const sourceName = resolveSourceName(lead, cfg);
  const source = await ensureSource(sourceName);
  let fullName = lead.full_name || "";
  if (!fullName) fullName = "Website Lead";
  const phone = lead.phone || "";
  if (!phone) throw new Error("phone is required");
  const [first = "Website", ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ").slice(0, 100);
  const email = lead.email || placeholderLeadEmail(phone).replace("lead.", "webform.");
  const websiteCreatedAt = parseWebsiteCreatedAt(lead.created_at);

  // Always resolve by phone so the website cannot create a second lead for the same number.
  const phoneMatches = cfg.dedupe_by_phone ? await findLeadsByPhone(phone) : [];
  let existing: { id: number; lead_id: string; phone: string; first_name: string; last_name: string } | null =
    phoneMatches[0] ?? null;
  if (!existing && email && !email.endsWith("@example.com")) {
    existing = await prisma.lead.findFirst({
      where: { email: { equals: email } },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: { id: true, lead_id: true, phone: true, first_name: true, last_name: true },
    });
  }

  const noteLines = websiteMetaNotes(lead);
  const course = [lead.specialization, lead.target_exam].filter(Boolean).join(" · ").slice(0, 200);
  const school = lead.college.slice(0, 200);
  const campaign = lead.source.slice(0, 150) || null;

  if (!existing) {
    const created = await createLead({
      first_name: first.slice(0, 100),
      last_name: lastName,
      email,
      phone,
      source_id: source.id,
      status: "NEW",
      school_name: school,
      course_interested: course,
      city: lead.city.slice(0, 100),
      source_campaign: campaign,
      notes: noteLines.join("\n"),
      ...(websiteCreatedAt ? { created_at: websiteCreatedAt } : {}),
    });
    await attachWebsiteExtras(created.id, lead);
    return { ok: true, created: true, lead_id: created.id, lead_code: created.lead_id, website_id: lead.website_id || null };
  }

  const current = await prisma.lead.findUniqueOrThrow({ where: { id: existing.id } });
  // Incoming website data replaces the contact fields so the kept row is the latest submission.
  const notes = noteLines.length
    ? (current.notes.trim() ? `${current.notes.trim()}\n${noteLines.join("\n")}` : noteLines.join("\n"))
    : current.notes;
  await updateLead(current.id, {
    first_name: first.slice(0, 100),
    last_name: lastName,
    email: lead.email ? email : current.email.endsWith("@example.com") ? email : undefined,
    phone,
    school_name: school || undefined,
    course_interested: course || undefined,
    city: lead.city ? lead.city.slice(0, 100) : undefined,
    source_campaign: campaign || undefined,
    notes,
  });
  await attachWebsiteExtras(current.id, lead);

  // Drop older same-phone leads so only the latest row remains.
  const olderIds = phoneMatches.slice(1).map((row) => row.id).filter((id) => id !== current.id);
  let removed = 0;
  if (olderIds.length) {
    const deleted = await prisma.lead.deleteMany({ where: { id: { in: olderIds } } });
    removed = deleted.count;
  }

  return {
    ok: true,
    created: false,
    lead_id: current.id,
    lead_code: current.lead_id,
    website_id: lead.website_id || null,
    duplicates_removed: removed,
  };
}

export function parseWebhookPayload(raw: Buffer, contentType: string): { records: Record<string, unknown>[] } | { error: string } {
  const type = contentType.toLowerCase();
  const text = raw.toString("utf8");
  const looksJson = type.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[");
  if (looksJson && text.trim()) {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) return { records: data.filter((x) => x && typeof x === "object") };
      if (data && typeof data === "object") {
        if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) return { records: [data.data] };
        if (data.lead && typeof data.lead === "object") return { records: [data.lead] };
        return { records: [data] };
      }
      return { error: "payload_must_be_object_or_array" };
    } catch (e) {
      return { error: `invalid_json: ${e instanceof Error ? e.message : e}` };
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    const obj: Record<string, unknown> = {};
    for (const [k, v] of params) obj[k] = v;
    return { records: [obj] };
  }
  return { records: [{}] };
}

export async function processLeadWebhook(raw: Buffer, req: HeaderSource) {
  const parsed = parseWebhookPayload(raw, req.get("content-type") ?? "");
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const cfg = leadWebhookConfig();
  const results = [];
  let created = 0, updated = 0, errors = 0;
  for (const item of parsed.records) {
    if (!item || typeof item !== "object") {
      errors += 1;
      results.push({ ok: false, error: "invalid_record" });
      continue;
    }
    try {
      const out = await upsertFromRow(normalizeLeadWebhookPayload(item as Record<string, unknown>), cfg);
      if (out.created) created += 1;
      else updated += 1;
      results.push(out);
    } catch (err) {
      errors += 1;
      logger.warn({ err }, "lead webhook row failed");
      results.push({ ok: false, error: err instanceof Error ? err.message : "error" });
    }
  }
  return { ok: errors === 0, created, updated, errors, results };
}

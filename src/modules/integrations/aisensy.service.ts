import { readEnv } from "../../config/env";
import { logger } from "../../lib/logger";
import { normalizeLeadPhone } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { createLead, updateLead } from "../leads/lead.repository";
import { findLeadByPhone } from "../leads/phone-lookup";
import { safeEqual, verifyHmacHeader } from "./hmac";

async function solo() {
  return prisma.aiSensyIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export async function effectiveAisensyConfig() {
  const s = await solo();
  return {
    enabled: Boolean(s.enabled),
    public_base_url: (s.public_base_url || "").replace(/\/+$/, ""),
    webhook_secret: readEnv("AISENSY_WEBHOOK_SECRET") || (s.webhook_secret || "").trim(),
    webhook_token: readEnv("AISENSY_WEBHOOK_TOKEN") || (s.webhook_token || "").trim(),
    row: s,
  };
}

export async function authorizeAisensy(
  raw: Buffer,
  req: { get(name: string): string | null | undefined },
): Promise<boolean> {
  const cfg = await effectiveAisensyConfig();
  if (!cfg.enabled) {
    logger.warn("AiSensy webhook rejected: integration disabled");
    return false;
  }
  if (cfg.webhook_secret) {
    const sig = String(req.get("x-aisensy-signature") ?? req.get("x-aisensy-webhook-signature") ?? req.get("x-webhook-signature") ?? "");
    return verifyHmacHeader(raw, sig, cfg.webhook_secret);
  }
  if (cfg.webhook_token) {
    const auth = String(req.get("authorization") ?? "").trim();
    if (auth.toLowerCase().startsWith("bearer ") && safeEqual(auth.slice(7).trim(), cfg.webhook_token)) return true;
    for (const name of ["x-aisensy-token", "x-aisensy-webhook-token", "x-api-key"]) {
      const val = String(req.get(name) ?? "").trim();
      if (val && safeEqual(val, cfg.webhook_token)) return true;
    }
    return false;
  }
  logger.error("AiSensy webhook auth rejected: no secret or token configured");
  return false;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function* candidates(payload: Record<string, unknown>): Generator<Record<string, unknown>> {
  yield payload;
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) yield payload.data as Record<string, unknown>;
  if (payload.message && typeof payload.message === "object" && !Array.isArray(payload.message)) yield payload.message as Record<string, unknown>;
  if (Array.isArray(payload.messages)) for (const m of payload.messages) if (m && typeof m === "object") yield m as Record<string, unknown>;
  if (Array.isArray(payload.events)) {
    for (const ev of payload.events) {
      if (!ev || typeof ev !== "object") continue;
      const rec = ev as Record<string, unknown>;
      yield rec;
      if (rec.message && typeof rec.message === "object") yield rec.message as Record<string, unknown>;
      if (rec.data && typeof rec.data === "object") yield rec.data as Record<string, unknown>;
    }
  }
}

function parseMessages(payload: Record<string, unknown>) {
  const records: Array<{ phone: string; name: string; email: string; text: string; message_id: string }> = [];
  for (const obj of candidates(payload)) {
    const direction = firstNonEmpty(obj.direction, obj.message_direction).toLowerCase();
    if (direction === "outgoing" || direction === "sent") continue;
    const contact = typeof obj.contact === "object" && obj.contact ? (obj.contact as Record<string, unknown>) : {};
    const sender = typeof obj.sender === "object" && obj.sender ? (obj.sender as Record<string, unknown>) : {};
    const phone = normalizeLeadPhone(
      firstNonEmpty(obj.phone, obj.phone_number, obj.mobile, obj.wa_id, obj.from, contact.phone, sender.phone, sender.wa_id),
    );
    if (!phone) continue;
    const content = typeof obj.content === "object" && obj.content ? (obj.content as Record<string, unknown>) : {};
    const nested = typeof obj.message === "object" && obj.message && !Array.isArray(obj.message) ? (obj.message as Record<string, unknown>) : {};
    const text = firstNonEmpty(typeof obj.message === "string" ? obj.message : "", obj.text, obj.body, content.text, nested.text);
    if (!text) continue;
    records.push({
      phone,
      name: firstNonEmpty(obj.name, obj.sender_name, contact.name, sender.name) || "WhatsApp User",
      email: firstNonEmpty(obj.email, contact.email, sender.email),
      text: text.slice(0, 2000),
      message_id: firstNonEmpty(obj.message_id, obj.id, obj.wamid).slice(0, 128),
    });
  }
  return records;
}

async function ensureSource() {
  const name = "AiSensy WhatsApp";
  return (
    (await prisma.leadSource.findFirst({ where: { name } })) ??
    (await prisma.leadSource.create({ data: { name, description: "Inbound leads from AiSensy webhook", is_active: true } }))
  );
}

async function upsert(record: { phone: string; name: string; email: string; text: string }) {
  const source = await ensureSource();
  const email = record.email.trim().toLowerCase();
  let found = await findLeadByPhone(record.phone);
  if (!found && email) {
    found = await prisma.lead.findFirst({
      where: { email: { equals: email } },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
      select: { id: true, lead_id: true, phone: true, first_name: true, last_name: true },
    });
  }
  const note = `[AiSensy] ${record.text}`;
  if (!found) {
    const [first, ...rest] = record.name.split(/\s+/).filter(Boolean);
    const created = await createLead({
      first_name: (first || "WhatsApp").slice(0, 100),
      last_name: (rest.join(" ") || "Lead").slice(0, 100),
      email: email || `aisensy.${record.phone.slice(0, 40)}@example.com`,
      phone: record.phone,
      source_id: source.id,
      status: "NEW",
      notes: note,
    });
    return { created: true, lead_id: created.id, lead_code: created.lead_id };
  }
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: found.id } });
  await updateLead(lead.id, {
    email: email && lead.email.endsWith("@example.com") ? email : undefined,
    notes: lead.notes.trim() ? `${lead.notes.trim()}\n${note}` : note,
  });
  return { created: false, lead_id: lead.id, lead_code: lead.lead_id };
}

export async function processAisensyWebhook(raw: Buffer) {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const records = parseMessages(payload);
  let created = 0, updated = 0, errors = 0;
  for (const record of records) {
    try {
      const out = await upsert(record);
      if (out.created) created += 1;
      else updated += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, phone: record.phone }, "AiSensy lead upsert failed");
    }
  }
  return { ok: true, records: records.length, created, updated, errors, processed: records.length - errors };
}

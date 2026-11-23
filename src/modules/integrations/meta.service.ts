import { readEnv } from "../../config/env";
import { logger } from "../../lib/logger";
import { normalizeLeadPhone } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { notifyAllAdmins } from "../notifications/notifications.service";
import { createLead, updateLead } from "../leads/lead.repository";
import { findLeadByPhone } from "../leads/phone-lookup";
import { hmacSha256Hex, safeEqual } from "./hmac";

const GRAPH = "v21.0";

async function soloMeta() {
  return prisma.metaIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1, access_token: "" }, update: {} });
}

export async function effectiveMetaConfig() {
  const s = await soloMeta();
  return {
    verify_token: readEnv("META_VERIFY_TOKEN") || s.verify_token,
    app_secret: readEnv("META_APP_SECRET") || s.app_secret,
    access_token: readEnv("META_ACCESS_TOKEN") || s.access_token,
    whatsapp_phone_number_id: readEnv("META_WHATSAPP_PHONE_NUMBER_ID") || s.whatsapp_phone_number_id,
    whatsapp_enabled: s.whatsapp_enabled,
    instagram_enabled: s.instagram_enabled,
    facebook_messenger_enabled: s.facebook_messenger_enabled,
    notify_admins: s.notify_admins_on_message,
    facebook_page_id: readEnv("META_FACEBOOK_PAGE_ID") || s.facebook_page_id || "",
    public_base_url: s.public_base_url,
    row: s,
  };
}

export function verifyMetaSubscribe(mode: string, token: string, challenge: string, verifyToken: string): string | null {
  if (mode === "subscribe" && token && verifyToken && token === verifyToken) return challenge;
  return null;
}

export function verifyMetaSignature(raw: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!appSecret.trim()) {
    logger.error("Meta webhook POST rejected: app secret not configured");
    return false;
  }
  if (!header?.startsWith("sha256=")) return false;
  return safeEqual(hmacSha256Hex(appSecret, raw), header.slice(7));
}

async function ensureSource(name: string) {
  return (
    (await prisma.leadSource.findFirst({ where: { name } })) ??
    (await prisma.leadSource.create({ data: { name, description: `Inbound from ${name}`, is_active: true } }))
  );
}

const CHANNEL_THREAD: Record<string, string> = { WhatsApp: "whatsapp", Instagram: "instagram", Facebook: "facebook" };

export async function ingestInboundMessage(opts: {
  channel: string;
  sender_id: string;
  sender_label: string;
  text: string;
  notify_admins: boolean;
  page_or_waba_id?: string;
  external_message_id?: string;
}) {
  const text = opts.text.trim();
  if (!text) return;
  const threadChannel = CHANNEL_THREAD[opts.channel] ?? "whatsapp";
  let phone = threadChannel === "whatsapp" ? normalizeLeadPhone(opts.sender_id) || normalizeLeadPhone(opts.sender_label) || "0" : "";
  if (threadChannel !== "whatsapp") {
    const d = String(opts.sender_id).replace(/\D/g, "");
    phone = (d.length > 15 ? d.slice(-15) : d) || String(opts.sender_id).slice(0, 15) || "0";
  }
  const source = await ensureSource(opts.channel);
  const snippet = text.slice(0, 2000);
  const note = `[${opts.channel}] ${snippet}`;
  const found = await findLeadByPhone(phone);
  let leadId: number;
  if (!found) {
    const label = (opts.sender_label || opts.channel).slice(0, 100);
    const parts = label.split(/\s+/, 2);
    const created = await createLead({
      first_name: (parts[0] || opts.channel).slice(0, 100),
      last_name: (parts[1] || "Chat").slice(0, 100),
      email: `${opts.channel.toLowerCase()}.${opts.sender_id.replace(/[^\w]/g, "").slice(0, 40) || "unknown"}@example.com`,
      phone,
      source_id: source.id,
      status: "NEW",
      notes: note,
    });
    leadId = created.id;
  } else {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: found.id } });
    await updateLead(lead.id, { notes: lead.notes.trim() ? `${lead.notes.trim()}\n${note}` : note });
    leadId = lead.id;
  }
  const pageKey = (opts.page_or_waba_id || "").slice(0, 128);
  const thread = await prisma.socialChatThread.upsert({
    where: {
      channel_external_user_id_page_or_waba_id: {
        channel: threadChannel,
        external_user_id: opts.sender_id.slice(0, 128),
        page_or_waba_id: pageKey,
      },
    },
    create: {
      channel: threadChannel,
      external_user_id: opts.sender_id.slice(0, 128),
      page_or_waba_id: pageKey,
      display_name: (opts.sender_label || "").slice(0, 200),
      lead_id: leadId,
      last_message_preview: snippet.slice(0, 300),
      last_message_at: new Date(),
    },
    update: {
      display_name: (opts.sender_label || "").slice(0, 200),
      lead_id: leadId,
      last_message_preview: snippet.slice(0, 300),
      last_message_at: new Date(),
    },
  });
  await prisma.socialChatMessage.create({
    data: {
      thread_id: thread.id,
      direction: "in",
      body: snippet,
      external_message_id: (opts.external_message_id || "").slice(0, 128),
    },
  });
  if (opts.notify_admins) {
    await notifyAllAdmins(`${opts.channel} (${opts.sender_label || phone}): ${text.slice(0, 400)}`.slice(0, 2000));
  }
}

export async function handleMetaWebhookJson(raw: Buffer, cfg: Awaited<ReturnType<typeof effectiveMetaConfig>>) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    logger.warn("Meta webhook JSON parse failed");
    return;
  }
  if (cfg.whatsapp_enabled && body.object === "whatsapp_business_account") {
    for (const entry of (body.entry as Array<Record<string, unknown>> | undefined) ?? []) {
      for (const change of (entry.changes as Array<Record<string, unknown>> | undefined) ?? []) {
        if (change.field !== "messages") continue;
        const value = (change.value ?? {}) as Record<string, unknown>;
        const contacts: Record<string, string> = {};
        for (const c of (value.contacts as Array<Record<string, unknown>> | undefined) ?? []) {
          const wid = String(c.wa_id ?? "");
          if (wid) contacts[wid] = String((c.profile as Record<string, unknown> | undefined)?.name ?? "");
        }
        for (const msg of (value.messages as Array<Record<string, unknown>> | undefined) ?? []) {
          if (msg.type !== "text") continue;
          const frm = String(msg.from ?? "");
          await ingestInboundMessage({
            channel: "WhatsApp",
            sender_id: frm,
            sender_label: contacts[frm] || "WhatsApp user",
            text: String((msg.text as Record<string, unknown> | undefined)?.body ?? ""),
            notify_admins: cfg.notify_admins,
            page_or_waba_id: String((value.metadata as Record<string, unknown> | undefined)?.phone_number_id ?? ""),
            external_message_id: String(msg.id ?? ""),
          });
        }
      }
    }
  }
  const messagingChannel = body.object === "instagram" ? "Instagram" : body.object === "page" ? "Facebook" : null;
  const enabled = body.object === "instagram" ? cfg.instagram_enabled : cfg.facebook_messenger_enabled;
  if (messagingChannel && enabled) {
    for (const entry of (body.entry as Array<Record<string, unknown>> | undefined) ?? []) {
      for (const ev of (entry.messaging as Array<Record<string, unknown>> | undefined) ?? []) {
        const message = (ev.message ?? {}) as Record<string, unknown>;
        if (!("text" in message)) continue;
        await ingestInboundMessage({
          channel: messagingChannel,
          sender_id: String((ev.sender as Record<string, unknown> | undefined)?.id ?? ""),
          sender_label: String((ev.sender as Record<string, unknown> | undefined)?.id ?? ""),
          text: String(message.text ?? ""),
          notify_admins: cfg.notify_admins,
          page_or_waba_id: String(entry.id ?? ""),
          external_message_id: String(message.mid ?? ""),
        });
      }
    }
  }
}

export async function sendThreadReply(thread: { channel: string; external_user_id: string; page_or_waba_id: string }, body: string): Promise<[boolean, string]> {
  const cfg = await effectiveMetaConfig();
  const text = body.trim();
  if (!text) return [false, "Empty message"];
  if (thread.channel === "whatsapp") {
    const token = cfg.access_token;
    const phoneId = cfg.whatsapp_phone_number_id;
    if (!token || !phoneId) return [false, "Missing access token or WhatsApp phone number ID"];
    const to = normalizeLeadPhone(thread.external_user_id);
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [false, (await res.text()).slice(0, 500)];
    return [true, "ok"];
  }
  if (thread.channel === "facebook" || thread.channel === "instagram") {
    const token = cfg.access_token;
    const pageId = (thread.page_or_waba_id || cfg.facebook_page_id || "").trim();
    if (!token) return [false, "Missing access token"];
    if (!pageId) return [false, "Missing Page ID (webhook entry id or Facebook Page ID in settings)"];
    const url = new URL(`https://graph.facebook.com/${GRAPH}/${pageId}/messages`);
    url.searchParams.set("access_token", token);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: thread.external_user_id }, messaging_type: "RESPONSE", message: { text: text.slice(0, 2000) } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [false, (await res.text()).slice(0, 500)];
    return [true, "ok"];
  }
  return [false, "Unsupported channel"];
}

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { config } from "../config/env";
import { prisma } from "../lib/prisma";
import type { ImportFailurePayload } from "../modules/leads/import.service";
import { baseCookieOptions } from "./cookies";

const COOKIE = "sessionid";
const TOUCH_MS = 60_000;

export type AppSession = {
  userId?: number;
  authHash?: string;
  adminLoginSince?: string | null;
  showWebsiteLeadsLoginAlert?: boolean;
  counsellor_my_leads_filters?: Record<string, string>;
  notifiedKeys?: Record<string, number>;
  leadImportFailures?: ImportFailurePayload | null;
  lastTouch?: number;
  cookie?: unknown;
};

function sign(value: string, secret: string): string {
  return `${value}.${crypto.createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, "")}`;
}

function unsign(signed: string, secret: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value, secret));
  const given = Buffer.from(signed);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return value;
}

function sidFromCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith("s:")) return null;
  return unsign(decoded.slice(2), config.secretKey);
}

function cookieValue(sid: string): string {
  return `s:${sign(sid, config.secretKey)}`;
}

const cookieOptions = baseCookieOptions();

export const readSession = cache(async (): Promise<{ sid: string | null; data: AppSession }> => {
  const jar = await cookies();
  const sid = sidFromCookie(jar.get(COOKIE)?.value);
  if (!sid) return { sid: null, data: {} };
  const row = await prisma.session.findUnique({ where: { sid } });
  if (!row || row.expires_at <= new Date()) return { sid: null, data: {} };
  let data: AppSession = {};
  try {
    data = JSON.parse(row.data) as AppSession;
  } catch {
    data = {};
  }
  const now = Date.now();
  if (!data.lastTouch || now - data.lastTouch >= TOUCH_MS) {
    data.lastTouch = now;
    await prisma.session.updateMany({
      where: { sid },
      data: {
        expires_at: new Date(now + config.sessionMaxAgeSeconds * 1000),
        data: JSON.stringify(data),
      },
    });
  }
  return { sid, data };
});

export async function updateSession(mutator: (data: AppSession) => void): Promise<void> {
  const { sid, data } = await readSession();
  if (!sid) return;
  mutator(data);
  await prisma.session.update({
    where: { sid },
    data: {
      data: JSON.stringify(data),
      expires_at: new Date(Date.now() + config.sessionMaxAgeSeconds * 1000),
    },
  });
}

export async function createSession(data: AppSession): Promise<void> {
  const current = await readSession();
  if (current.sid) await prisma.session.deleteMany({ where: { sid: current.sid } });
  const sid = crypto.randomBytes(24).toString("base64url");
  const payload: AppSession = { ...data, lastTouch: Date.now() };
  await prisma.session.create({
    data: {
      sid,
      data: JSON.stringify(payload),
      expires_at: new Date(Date.now() + config.sessionMaxAgeSeconds * 1000),
    },
  });
  const jar = await cookies();
  jar.set(COOKIE, cookieValue(sid), cookieOptions);
}

export async function destroySession(): Promise<void> {
  const { sid } = await readSession();
  if (sid) await prisma.session.deleteMany({ where: { sid } });
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function startSessionCleanup(): NodeJS.Timeout {
  const timer = setInterval(() => {
    prisma.session.deleteMany({ where: { expires_at: { lt: new Date() } } }).catch(() => undefined);
  }, 15 * 60_000);
  timer.unref();
  return timer;
}

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { config } from "../config/env";
import { prisma } from "../lib/prisma";
import type { ImportFailurePayload } from "../modules/leads/import.service";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionCookieValue,
  sidFromSessionCookie,
} from "./session-cookie";

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

export const readSession = cache(async (): Promise<{ sid: string | null; data: AppSession }> => {
  const jar = await cookies();
  const sid = sidFromSessionCookie(jar.get(SESSION_COOKIE)?.value);
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

/** Create DB session and return cookie name/value for the login redirect response. */
export async function createSession(data: AppSession): Promise<{ name: string; value: string }> {
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
  const value = sessionCookieValue(sid);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, value, sessionCookieOptions());
  return { name: SESSION_COOKIE, value };
}

export async function destroySession(): Promise<void> {
  const { sid } = await readSession();
  if (sid) await prisma.session.deleteMany({ where: { sid } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export function startSessionCleanup(): NodeJS.Timeout {
  const timer = setInterval(() => {
    prisma.session.deleteMany({ where: { expires_at: { lt: new Date() } } }).catch(() => undefined);
  }, 15 * 60_000);
  timer.unref();
  return timer;
}

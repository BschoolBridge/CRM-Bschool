import crypto from "node:crypto";
import { config } from "../config/env";
import { baseCookieOptions } from "./cookies";

export const SESSION_COOKIE = "sessionid";

function sign(value: string, secret: string): string {
  // base64url avoids +/ in cookies (some proxies turn + into space and break the signature).
  return `${value}.${crypto.createHmac("sha256", secret).update(value).digest("base64url")}`;
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

export function sidFromSessionCookie(raw: string | undefined): string | null {
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

export function sessionCookieValue(sid: string): string {
  return `s:${sign(sid, config.secretKey)}`;
}

/** Fresh options each call so Secure/maxAge track runtime env (not module-load stale values). */
export function sessionCookieOptions() {
  return baseCookieOptions(config.sessionMaxAgeSeconds);
}

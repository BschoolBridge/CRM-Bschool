import crypto from "node:crypto";
import { config } from "../../config/env";

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

interface TokenUser {
  id: number;
  password: string;
  email: string;
  last_login: Date | null;
}

/**
 * Stateless reset token in the spirit of Django's PasswordResetTokenGenerator:
 * it becomes invalid once the password changes or the user logs in again.
 */
function signature(user: TokenUser, timestamp: number): string {
  const lastLogin = user.last_login ? Math.floor(user.last_login.getTime() / 1000) : "";
  return crypto
    .createHmac("sha256", config.secretKey)
    .update(`password-reset:${user.id}:${user.password}:${lastLogin}:${user.email}:${timestamp}`)
    .digest("hex")
    .slice(0, 40);
}

export function makeResetToken(user: TokenUser, now = Date.now()): string {
  const ts = Math.floor(now / 1000);
  return `${ts.toString(36)}-${signature(user, ts)}`;
}

export function checkResetToken(user: TokenUser, token: string, now = Date.now()): boolean {
  const [tsPart, sig] = String(token ?? "").split("-");
  if (!tsPart || !sig) return false;
  const ts = Number.parseInt(tsPart, 36);
  if (!Number.isFinite(ts)) return false;
  if (Math.floor(now / 1000) - ts > TOKEN_TTL_SECONDS) return false;
  const expected = Buffer.from(signature(user, ts));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function encodeUid(id: number): string {
  return Buffer.from(String(id)).toString("base64url");
}

export function decodeUid(uidb64: string): number | null {
  try {
    const decoded = Buffer.from(uidb64, "base64url").toString("utf8");
    return /^\d+$/.test(decoded) ? Number(decoded) : null;
  } catch {
    return null;
  }
}

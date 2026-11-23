import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, raw: Buffer): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyHmacHeader(raw: Buffer, header: string, secret: string): boolean {
  if (!secret || !header) return false;
  let sig = header.trim();
  if (sig.toLowerCase().startsWith("sha256=")) sig = sig.slice(7);
  return safeEqual(hmacSha256Hex(secret, raw), sig);
}

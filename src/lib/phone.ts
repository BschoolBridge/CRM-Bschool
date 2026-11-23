/** Digits-only phone for storage and duplicate checks (handles +91 / leading 0). */
export function normalizeLeadPhone(phone: unknown): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 15) digits = digits.slice(-15);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(3);
  return digits;
}

/** Login phone cleanup (same +91 / leading-0 rules; kept for auth call sites and tests). */
export function extractCleanPhone(raw: string): string {
  return normalizeLeadPhone(raw);
}

export function placeholderLeadEmail(phone: unknown): string {
  const token = normalizeLeadPhone(phone) || "unknown";
  return `lead.${token.slice(0, 32)}@example.com`;
}

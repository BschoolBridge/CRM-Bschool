import { normalizeLeadPhone } from "../../lib/phone";
import { prisma, type Db } from "../../lib/prisma";

export interface PhoneMatch {
  id: number;
  lead_id: string;
  phone: string;
  first_name: string;
  last_name: string;
  updated_at?: Date;
}

const PHONE_SELECT = { id: true, lead_id: true, phone: true, first_name: true, last_name: true, updated_at: true } as const;

/** All leads whose normalised phone matches, newest first. */
export async function findLeadsByPhone(phone: unknown, excludeId?: number | null, db: Db = prisma): Promise<PhoneMatch[]> {
  const norm = normalizeLeadPhone(phone);
  if (!norm) return [];
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  const exact = await db.lead.findMany({
    where: { phone: norm, ...notSelf },
    select: PHONE_SELECT,
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
  });
  if (exact.length) return exact;

  const tail = norm.length >= 10 ? norm.slice(-10) : norm;
  const candidates = await db.lead.findMany({
    where: { phone: { endsWith: tail }, ...notSelf },
    select: PHONE_SELECT,
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
  });
  return candidates.filter((c) => normalizeLeadPhone(c.phone) === norm);
}

/** Latest lead with the same normalised phone, if any. */
export async function findLeadByPhone(phone: unknown, excludeId?: number | null, db: Db = prisma): Promise<PhoneMatch | null> {
  const matches = await findLeadsByPhone(phone, excludeId, db);
  return matches[0] ?? null;
}

export function duplicatePhoneMessage(existing: { lead_id: string; id: number }): string {
  return `A lead with this phone number already exists (Lead ID: ${existing.lead_id || existing.id}).`;
}

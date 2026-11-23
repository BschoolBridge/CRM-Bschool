import crypto from "node:crypto";
import { prisma, type Db } from "../../lib/prisma";
import { localNow } from "../../lib/time";

/** Highest numeric part of L-000123 style IDs. Numbers are never reused after deletes. */
export async function maxNumericLeadId(db: Db = prisma): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: bigint | number | null }>>`
    SELECT MAX(CAST(SUBSTRING(lead_id, 3) AS UNSIGNED)) AS n
    FROM leads
    WHERE lead_id REGEXP '^L-[0-9]+$'`;
  return Number(rows[0]?.n ?? 0);
}

export function formatLeadId(n: number): string {
  return `L-${String(n).padStart(6, "0")}`;
}

export async function allocateLeadIds(count: number, db: Db = prisma): Promise<string[]> {
  if (count <= 0) return [];
  const start = await maxNumericLeadId(db);
  return Array.from({ length: count }, (_, i) => formatLeadId(start + i + 1));
}

/** Used only if sequential allocation keeps colliding under heavy concurrency. */
export function fallbackLeadId(): string {
  return `L-${localNow().toFormat("yyMMdd")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

export function newBusinessId(): string {
  return `BUS-${localNow().toFormat("yyyyMMdd")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

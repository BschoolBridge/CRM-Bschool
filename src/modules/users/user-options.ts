import type { ModelOption } from "../../forms/fields";
import { prisma, type Prisma } from "../../lib/prisma";
import { fullName } from "../presenters";

/** Counsellor.__str__: "First Last (EMP001)". */
export function counsellorLabel(c: { employee_id: string; admin: { first_name: string; last_name: string } }): string {
  return `${c.admin.first_name} ${c.admin.last_name} (${c.employee_id})`;
}

export async function counsellorOptions(
  where: Prisma.CounsellorWhereInput = {},
  orderBy: Prisma.CounsellorOrderByWithRelationInput = { id: "asc" },
): Promise<ModelOption[]> {
  const rows = await prisma.counsellor.findMany({ where, orderBy, include: { admin: true } });
  return rows.map((c) => ({ id: c.id, label: counsellorLabel(c) }));
}

export async function adminUserOptions(): Promise<ModelOption[]> {
  const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return rows.map((u) => ({ id: u.id, label: fullName(u) || u.email }));
}

import { prisma } from "../../lib/prisma";
import { notifyLeadsAssigned, type AssignedLeadRef } from "../notifications/assignment-notifications";

export const ASSIGNMENT_METHODS = ["round_robin", "workload_balanced", "performance_based", "specialization_based"] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

/** "round_robin" → "Round Robin" (Python's str.title()). */
export function assignmentMethodLabel(method: string): string {
  return method.replace(/_/g, " ").replace(/[A-Za-z]+/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

interface AssignableLead extends AssignedLeadRef {
  industry: string;
}

type Picker = (leads: AssignableLead[], counsellorIds: number[]) => Promise<Map<number, number>>;

/** Distribute leads evenly in counsellor order. */
const roundRobin: Picker = async (leads, counsellorIds) =>
  new Map(leads.map((lead, i) => [lead.id, counsellorIds[i % counsellorIds.length]!]));

async function currentWorkload(counsellorIds: number[]) {
  const rows = await prisma.lead.groupBy({
    by: ["assigned_counsellor_id"],
    where: { assigned_counsellor_id: { in: counsellorIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.assigned_counsellor_id!, r._count._all]));
}

/** Each lead goes to whoever currently has the fewest leads (ties keep counsellor order). */
const workloadBalanced: Picker = async (leads, counsellorIds) => {
  const workload = await currentWorkload(counsellorIds);
  const pool = counsellorIds.map((id) => ({ id, count: workload.get(id) ?? 0 }));
  pool.sort((a, b) => a.count - b.count);
  const out = new Map<number, number>();
  for (const lead of leads) {
    const target = pool[0]!;
    out.set(lead.id, target.id);
    target.count++;
    pool.sort((a, b) => a.count - b.count);
  }
  return out;
};

/** Best conversion rate first; fewer leads breaks ties. */
const performanceBased: Picker = async (leads, counsellorIds) => {
  const rows = await prisma.lead.groupBy({
    by: ["assigned_counsellor_id", "status"],
    where: { assigned_counsellor_id: { in: counsellorIds } },
    _count: { _all: true },
  });
  const pool = counsellorIds.map((id) => {
    const mine = rows.filter((r) => r.assigned_counsellor_id === id);
    const total = mine.reduce((a, r) => a + r._count._all, 0);
    const won = mine.filter((r) => r.status === "CLOSED_WON").reduce((a, r) => a + r._count._all, 0);
    return { id, rate: total > 0 ? (won / total) * 100 : 0, total };
  });
  const order = (a: (typeof pool)[number], b: (typeof pool)[number]) => b.rate - a.rate || a.total - b.total;
  pool.sort(order);
  const out = new Map<number, number>();
  for (const lead of leads) {
    const target = pool[0]!;
    out.set(lead.id, target.id);
    target.total++;
    pool.sort(order);
  }
  return out;
};

/** Score = industry success ×100 + source success ×50 − 2 × current workload. */
const specializationBased: Picker = async (leads, counsellorIds) => {
  const history = await prisma.lead.findMany({
    where: { assigned_counsellor_id: { in: counsellorIds } },
    select: { assigned_counsellor_id: true, industry: true, source_id: true, status: true },
  });
  const profiles = counsellorIds.map((id) => {
    const mine = history.filter((l) => l.assigned_counsellor_id === id);
    const industry = new Map<string, { total: number; won: number }>();
    const source = new Map<number, { total: number; won: number }>();
    for (const l of mine) {
      if (l.industry) {
        const s = industry.get(l.industry) ?? { total: 0, won: 0 };
        s.total++;
        if (l.status === "CLOSED_WON") s.won++;
        industry.set(l.industry, s);
      }
      const s = source.get(l.source_id) ?? { total: 0, won: 0 };
      s.total++;
      if (l.status === "CLOSED_WON") s.won++;
      source.set(l.source_id, s);
    }
    return { id, industry, source, workload: mine.length };
  });

  const out = new Map<number, number>();
  for (const lead of leads) {
    let best: (typeof profiles)[number] | null = null;
    let bestScore = -1;
    for (const p of profiles) {
      let score = 0;
      const ind = lead.industry ? p.industry.get(lead.industry) : undefined;
      if (ind) score += (ind.total ? ind.won / ind.total : 0) * 100;
      const src = p.source.get(lead.source_id);
      if (src) score += (src.total ? src.won / src.total : 0) * 50;
      score -= p.workload * 2;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      out.set(lead.id, best.id);
      best.workload++;
    }
  }
  return out;
};

const PICKERS: Record<AssignmentMethod, Picker> = {
  round_robin: roundRobin,
  workload_balanced: workloadBalanced,
  performance_based: performanceBased,
  specialization_based: specializationBased,
};

/** One assign-unassigned request updates at most this many leads. The admin runs it again for the rest. */
export const UNASSIGNED_ASSIGN_BATCH = 200;

export function unassignedAssignmentMessage(assigned: number, remaining: number, method: string, scope: string): string {
  const base = `Successfully assigned ${assigned} leads using ${assignmentMethodLabel(method)} method${scope}!`;
  if (remaining <= 0) return base;
  return `${base} ${remaining} unassigned leads remain. Run assignment again to continue.`;
}

/**
 * Assign leads with the chosen strategy, persisting one UPDATE per counsellor,
 * then send each counsellor a single summary notification.
 */
export async function assignLeads(leadIds: number[], counsellorIds: number[], method: string): Promise<number> {
  if (!leadIds.length || !counsellorIds.length) return 0;
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    orderBy: { id: "asc" },
    select: { id: true, first_name: true, last_name: true, lead_id: true, source_id: true, assigned_counsellor_id: true, industry: true, source: { select: { name: true } } },
  });
  const picker = PICKERS[(ASSIGNMENT_METHODS as readonly string[]).includes(method) ? (method as AssignmentMethod) : "round_robin"];
  const plan = await picker(leads, counsellorIds);

  const byCounsellor = new Map<number, number[]>();
  for (const [leadId, counsellorId] of plan) {
    byCounsellor.set(counsellorId, [...(byCounsellor.get(counsellorId) ?? []), leadId]);
  }
  const entries = [...byCounsellor.entries()];
  if (!entries.length) return 0;
  const results = await prisma.$transaction(
    entries.map(([counsellorId, ids]) =>
      prisma.lead.updateMany({
        where: { id: { in: ids }, assigned_counsellor_id: null },
        data: { assigned_counsellor_id: counsellorId },
      }),
    ),
  );

  const confirmedIds = new Set<number>();
  for (const [index, [counsellorId, ids]] of entries.entries()) {
    const updated = results[index]?.count ?? 0;
    if (updated === 0) continue;
    if (updated === ids.length) {
      for (const id of ids) confirmedIds.add(id);
      continue;
    }
    const rows = await prisma.lead.findMany({
      where: { id: { in: ids }, assigned_counsellor_id: counsellorId },
      select: { id: true },
    });
    for (const row of rows) confirmedIds.add(row.id);
  }

  for (const lead of leads) {
    if (confirmedIds.has(lead.id)) lead.assigned_counsellor_id = plan.get(lead.id) ?? lead.assigned_counsellor_id;
  }
  await notifyLeadsAssigned(leads.filter((lead) => confirmedIds.has(lead.id)));
  return confirmedIds.size;
}

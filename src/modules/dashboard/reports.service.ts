import { percent, roundHalfEven } from "../../lib/numbers";
import { prisma } from "../../lib/prisma";
import { calendarDate, startOfLocalMonth, localNow } from "../../lib/time";
import { allActivityTypeChoices, DEFAULT_ACTIVITY_TYPES, referenceData, titleCaseCode } from "../reference/reference.service";

export interface StatusBreakdownRow {
  code: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

/** Rows for every configured status (in sort order), then any unknown codes found on leads. */
export async function statusBreakdown(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const { statuses } = await referenceData();
  const known = new Set<string>();
  const rows: StatusBreakdownRow[] = statuses.map((s) => {
    known.add(s.code);
    const count = counts[s.code] ?? 0;
    return { code: s.code, name: s.name, color: s.color, count, percent: percent(count, total) };
  });
  for (const code of Object.keys(counts).sort()) {
    if (known.has(code)) continue;
    rows.push({ code, name: titleCaseCode(code), color: "secondary", count: counts[code]!, percent: percent(counts[code]!, total) });
  }
  return { total, rows };
}

export async function counsellorLeadBreakdown(counsellorId: number) {
  const where = { assigned_counsellor_id: counsellorId };
  const [byStatus, bySourceStatus] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source_id", "status"], where, _count: { _all: true } }),
  ]);
  const statusCounts: Record<string, number> = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
  const { total, rows: overall } = await statusBreakdown(statusCounts);

  const perSource = new Map<number, Record<string, number>>();
  for (const r of bySourceStatus) {
    const bucket = perSource.get(r.source_id) ?? {};
    bucket[r.status] = r._count._all;
    perSource.set(r.source_id, bucket);
  }
  const names = new Map(
    (await prisma.leadSource.findMany({ where: { id: { in: [...perSource.keys()] } }, select: { id: true, name: true } })).map(
      (s) => [s.id, s.name],
    ),
  );

  const sourceRows = await Promise.all(
    [...perSource.entries()].map(async ([sourceId, counts]) => {
      const count = Object.values(counts).reduce((a, b) => a + b, 0);
      const { rows } = await statusBreakdown(counts);
      return {
        source_id: sourceId,
        source_name: names.get(sourceId) ?? "Unknown",
        count,
        percent: percent(count, total),
        status_breakdown: rows.filter((s) => s.count > 0),
        new_count: counts.NEW ?? 0,
        contacted_count: counts.CONTACTED ?? 0,
      };
    }),
  );
  sourceRows.sort((a, b) => b.count - a.count);
  return { total, sourceRows, statusRows: overall, statusCounts };
}

export async function counsellorActivityBreakdown(counsellorId: number) {
  const rows = await prisma.leadActivity.groupBy({
    by: ["activity_type", "is_completed"],
    where: { counsellor_id: counsellorId },
    _count: { _all: true },
  });
  const choices = (await prisma.activityType.count()) ? await allActivityTypeChoices() : DEFAULT_ACTIVITY_TYPES;
  const names = new Map(choices);

  const byType = new Map<string, { total: number; completed: number }>();
  for (const r of rows) {
    const t = byType.get(r.activity_type) ?? { total: 0, completed: 0 };
    t.total += r._count._all;
    if (r.is_completed) t.completed += r._count._all;
    byType.set(r.activity_type, t);
  }
  const total = [...byType.values()].reduce((a, b) => a + b.total, 0);
  const completed = [...byType.values()].reduce((a, b) => a + b.completed, 0);
  const breakdown = [...byType.entries()]
    .map(([code, t]) => ({
      code,
      name: names.get(code) ?? titleCaseCode(code),
      total: t.total,
      completed: t.completed,
      pending: t.total - t.completed,
      percent: percent(t.total, total),
    }))
    .sort((a, b) => b.total - a.total);
  return { total, completed, pending: Math.max(total - completed, 0), breakdown };
}

export async function leadSourceBreakdown(sourceId: number) {
  const rows = await prisma.lead.groupBy({ by: ["status"], where: { source_id: sourceId }, _count: { _all: true } });
  const counts: Record<string, number> = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const { total, rows: breakdown } = await statusBreakdown(counts);
  return { total, counts, breakdown };
}

const QUALIFIED_STATUSES = ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "CLOSED_WON"];

/**
 * Recompute this month's metrics for every active counsellor and persist the
 * monthly snapshot rows. Funnel counts use the whole assigned roster;
 * "converted this month" counts CLOSED_WON leads updated this month.
 */
export async function refreshCounsellorPerformance() {
  const monthStart = startOfLocalMonth();
  const monthKey = calendarDate(localNow().startOf("month").toISODate()!);
  const counsellors = await prisma.counsellor.findMany({ where: { is_active: true }, include: { admin: true }, orderBy: { id: "asc" } });

  const [statusRows, convertedRows] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id", "status"],
      where: { assigned_counsellor_id: { in: counsellors.map((c) => c.id) } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id"],
      where: { assigned_counsellor_id: { in: counsellors.map((c) => c.id) }, status: "CLOSED_WON", updated_at: { gte: monthStart } },
      _count: { _all: true },
    }),
  ]);
  const converted = new Map(convertedRows.map((r) => [r.assigned_counsellor_id, r._count._all]));

  const out = [];
  for (const c of counsellors) {
    const mine = statusRows.filter((r) => r.assigned_counsellor_id === c.id);
    const total = mine.reduce((a, r) => a + r._count._all, 0);
    const contacted = mine.filter((r) => r.status !== "NEW").reduce((a, r) => a + r._count._all, 0);
    const qualified = mine.filter((r) => QUALIFIED_STATUSES.includes(r.status)).reduce((a, r) => a + r._count._all, 0);
    const won = mine.filter((r) => r.status === "CLOSED_WON").reduce((a, r) => a + r._count._all, 0);
    const convertedThisMonth = converted.get(c.id) ?? 0;
    const conversionRate = total > 0 ? Math.min(roundHalfEven((won * 100) / total, 2), 100) : 0;

    const snapshot = await prisma.counsellorPerformance.upsert({
      where: { counsellor_id_month: { counsellor_id: c.id, month: monthKey } },
      create: {
        counsellor_id: c.id,
        month: monthKey,
        total_leads_assigned: total,
        total_leads_contacted: contacted,
        total_leads_qualified: qualified,
        total_business_generated: convertedThisMonth,
        conversion_rate: conversionRate,
      },
      update: {
        total_leads_assigned: total,
        total_leads_contacted: contacted,
        total_leads_qualified: qualified,
        total_business_generated: convertedThisMonth,
        conversion_rate: conversionRate,
      },
    });

    out.push({
      counsellor_id: c.id,
      first_name: c.admin.first_name ?? "",
      last_name: c.admin.last_name ?? "",
      employee_id: c.employee_id,
      total_leads_assigned: total,
      total_leads_contacted: contacted,
      total_leads_qualified: qualified,
      converted_leads: convertedThisMonth,
      average_response_time: snapshot.average_response_time,
      conversion_rate: conversionRate,
    });
  }
  return out;
}

import { config } from "../../config/env";
import { cache } from "../../lib/cache";
import { roundHalfEven } from "../../lib/numbers";
import { isUniqueViolation, prisma, type Db, type Prisma } from "../../lib/prisma";
import { calendarDate, localDayBounds, localNow, localToday, startOfLocalMonth } from "../../lib/time";
import { counsellorSnapshotKey, ACTIVITY_BOARD_CACHE_KEY } from "./cache-keys";

/**
 * One target row per calendar date. A concurrent insert loses the unique-key race
 * and reads the row that won, so a progress view cannot create a second default.
 */
export async function findOrCreateDailyTarget(
  db: Db,
  targetDate: Date,
  defaults: { target_count: number; created_by_id?: number | null },
) {
  const existing = await db.dailyTarget.findFirst({
    where: { target_date: targetDate },
    orderBy: { id: "asc" },
  });
  if (existing) return existing;
  try {
    return await db.dailyTarget.create({
      data: {
        target_date: targetDate,
        target_count: defaults.target_count,
        created_by_id: defaults.created_by_id ?? null,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const winner = await db.dailyTarget.findFirst({
      where: { target_date: targetDate },
      orderBy: { id: "asc" },
    });
    if (!winner) throw err;
    return winner;
  }
}

/** Today's daily target for a counsellor, creating the default (100) when none is set. */
async function todaysAssignment(counsellorId: number) {
  const today = calendarDate(localToday());
  const target = await findOrCreateDailyTarget(prisma, today, { target_count: 100 });
  return prisma.dailyTargetAssignment.upsert({
    where: { target_id_counsellor_id: { target_id: target.id, counsellor_id: counsellorId } },
    create: { target_id: target.id, counsellor_id: counsellorId },
    update: {},
    include: { target: true },
  });
}

/** Admin set-target: keep the single row for that date and attach the selected counsellors. */
export async function setDailyTarget(input: {
  targetDate: Date;
  targetCount: number;
  createdById: number;
  counsellorIds: number[];
}) {
  return prisma.$transaction(async (tx) => {
    const ensured = await findOrCreateDailyTarget(tx, input.targetDate, {
      target_count: input.targetCount,
      created_by_id: input.createdById,
    });
    const target =
      ensured.target_count === input.targetCount
        ? ensured
        : await tx.dailyTarget.update({ where: { id: ensured.id }, data: { target_count: input.targetCount } });
    for (const counsellor_id of [...new Set(input.counsellorIds)]) {
      await tx.dailyTargetAssignment.upsert({
        where: { target_id_counsellor_id: { target_id: target.id, counsellor_id } },
        create: { target_id: target.id, counsellor_id },
        update: {},
      });
    }
    return target;
  });
}

/** Activities that count toward today's target (lead transfer logs excluded). */
export function towardTargetWhere(counsellorId: number): Prisma.LeadActivityWhereInput {
  const { start, end } = localDayBounds(localToday());
  return {
    counsellor_id: counsellorId,
    is_completed: true,
    activity_type: { not: "TRANSFER" },
    OR: [{ completed_date: { gte: start, lt: end } }, { scheduled_date: { lt: end } }],
  };
}

export async function dailyTargetProgress(counsellorId: number) {
  const assignment = await todaysAssignment(counsellorId);
  const targetCount = assignment.target.target_count;
  const byType = await prisma.leadActivity.groupBy({
    by: ["activity_type"],
    where: towardTargetWhere(counsellorId),
    _count: { _all: true },
  });
  const towardTargetByType = Object.fromEntries(byType.map((r) => [r.activity_type, r._count._all]));
  const completed = byType.reduce((sum, r) => sum + r._count._all, 0);
  return {
    assignment,
    daily_target: targetCount,
    completed_toward_target: completed,
    target_remaining: Math.max(0, targetCount - completed),
    target_progress_pct: targetCount > 0 ? Math.min(100, roundHalfEven((100 * completed) / targetCount)) : 0,
    toward_target_by_type: towardTargetByType as Record<string, number>,
  };
}

export type ActivitySnapshot = Awaited<ReturnType<typeof computeSnapshot>>;

async function computeSnapshot(counsellorId: number) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = localDayBounds(localNow().toISODate()!);
  const monthStart = startOfLocalMonth(now);
  const progress = await dailyTargetProgress(counsellorId);
  const tt = progress.toward_target_by_type;
  const mine = { assigned_counsellor_id: counsellorId };

  const [
    statusRows, visitsScheduled, visitsToday, visitsOverdue, activitiesCompletedMonth,
    leadsAssignedThisMonth, visitActivitiesMonth, pendingActivities, newLeadsToday,
    leadsWorkedToday, contactedUpdatesToday,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: mine, _count: { _all: true } }),
    prisma.lead.count({ where: { ...mine, next_follow_up: { not: null } } }),
    prisma.lead.count({ where: { ...mine, next_follow_up: { gte: todayStart, lt: todayEnd } } }),
    prisma.lead.count({ where: { ...mine, next_follow_up: { lt: now } } }),
    prisma.leadActivity.count({ where: { counsellor_id: counsellorId, is_completed: true, completed_date: { gte: monthStart } } }),
    prisma.lead.count({ where: { ...mine, created_at: { gte: monthStart } } }),
    prisma.leadActivity.count({
      where: { counsellor_id: counsellorId, is_completed: true, activity_type: "FOLLOW_UP", completed_date: { gte: monthStart } },
    }),
    prisma.leadActivity.count({ where: { counsellor_id: counsellorId, is_completed: false } }),
    prisma.lead.count({ where: { ...mine, created_at: { gte: todayStart, lt: todayEnd } } }),
    prisma.lead.count({ where: { ...mine, last_contact_date: { gte: todayStart, lt: todayEnd } } }),
    prisma.lead.count({ where: { ...mine, status: "CONTACTED", last_contact_date: { gte: todayStart, lt: todayEnd } } }),
  ]);
  const statusCounts: Record<string, number> = Object.fromEntries(statusRows.map((r) => [r.status, r._count._all]));

  return {
    new: statusCounts.NEW ?? 0,
    contacted: statusCounts.CONTACTED ?? 0,
    qualified: statusCounts.QUALIFIED ?? 0,
    closed_won: statusCounts.CLOSED_WON ?? 0,
    closed_lost: statusCounts.CLOSED_LOST ?? 0,
    visits_scheduled: visitsScheduled,
    visits_today: visitsToday,
    visits_overdue: visitsOverdue,
    activities_completed_month: activitiesCompletedMonth,
    leads_assigned_this_month: leadsAssignedThisMonth,
    visit_activities_month: visitActivitiesMonth,
    pending_activities: pendingActivities,
    status_counts: statusCounts,
    new_leads_today: newLeadsToday,
    contact_touchpoints_today: (tt.CALL ?? 0) + (tt.EMAIL ?? 0) + (tt.MEETING ?? 0),
    follow_up_activities_today: tt.FOLLOW_UP ?? 0,
    note_activities_today: tt.NOTE ?? 0,
    transfer_activities_today: tt.TRANSFER ?? 0,
    total_activities_today: progress.completed_toward_target,
    leads_worked_today: leadsWorkedToday,
    contacted_updates_today: contactedUpdatesToday,
    activities_today_by_type: tt,
    daily_target: progress.daily_target,
    completed_toward_target: progress.completed_toward_target,
    target_remaining: progress.target_remaining,
    target_progress_pct: progress.target_progress_pct,
  };
}

/** Dashboard numbers for a counsellor; cached briefly (COUNSELLOR_SNAPSHOT_CACHE_SECONDS). */
export function counsellorActivitySnapshot(counsellorId: number) {
  return cache.remember(counsellorSnapshotKey(counsellorId), config.cache.counsellorSnapshotSeconds, () =>
    computeSnapshot(counsellorId),
  );
}

export interface CounsellorProgress {
  counsellor_id: number;
  daily_target: number;
  completed_toward_target: number;
  target_progress_pct: number;
  pending_activities: number;
  visits_overdue: number;
  visits_scheduled: number;
  visits_today: number;
  contact_touchpoints_today: number;
  follow_up_activities_today: number;
  new_leads_today: number;
  leads_worked_today: number;
  contacted_updates_today: number;
}

function sameIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function countByCounsellor(rows: Array<{ assigned_counsellor_id: number | null; _count: { _all: number } }>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.assigned_counsellor_id != null) counts.set(row.assigned_counsellor_id, row._count._all);
  }
  return counts;
}

/** Today's default target once, then one assignment row per counsellor that does not have one yet. */
async function ensureTodayAssignments(counsellorIds: number[]): Promise<number> {
  const target = await findOrCreateDailyTarget(prisma, calendarDate(localToday()), { target_count: 100 });
  const existing = await prisma.dailyTargetAssignment.findMany({
    where: { target_id: target.id, counsellor_id: { in: counsellorIds } },
    select: { counsellor_id: true },
  });
  const have = new Set(existing.map((row) => row.counsellor_id));
  const missing = counsellorIds.filter((id) => !have.has(id));
  if (missing.length) {
    await prisma.dailyTargetAssignment.createMany({
      data: missing.map((counsellor_id) => ({ target_id: target.id, counsellor_id })),
      skipDuplicates: true,
    });
  }
  return target.target_count;
}

/**
 * Activity-progress numbers for every requested counsellor.
 * Grouped counts replace one snapshot query burst per counsellor.
 */
export async function computeCounsellorProgressBoard(counsellorIds: number[]): Promise<CounsellorProgress[]> {
  const ids = [...new Set(counsellorIds)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  if (!ids.length) return [];
  const now = new Date();
  const { start: todayStart, end: todayEnd } = localDayBounds(localToday());
  const dailyTarget = await ensureTodayAssignments(ids);
  const assigned = { assigned_counsellor_id: { in: ids } };

  const [towardRows, pendingRows, visitsScheduled, visitsToday, visitsOverdue, newLeads, worked, contacted] = await Promise.all([
    prisma.leadActivity.groupBy({
      by: ["counsellor_id", "activity_type"],
      where: {
        counsellor_id: { in: ids },
        is_completed: true,
        activity_type: { not: "TRANSFER" },
        OR: [{ completed_date: { gte: todayStart, lt: todayEnd } }, { scheduled_date: { lt: todayEnd } }],
      },
      _count: { _all: true },
    }),
    prisma.leadActivity.groupBy({
      by: ["counsellor_id"],
      where: { counsellor_id: { in: ids }, is_completed: false },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({ by: ["assigned_counsellor_id"], where: { ...assigned, next_follow_up: { not: null } }, _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id"],
      where: { ...assigned, next_follow_up: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({ by: ["assigned_counsellor_id"], where: { ...assigned, next_follow_up: { lt: now } }, _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id"],
      where: { ...assigned, created_at: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id"],
      where: { ...assigned, last_contact_date: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assigned_counsellor_id"],
      where: { ...assigned, status: "CONTACTED", last_contact_date: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
  ]);

  const pending = new Map(pendingRows.map((row) => [row.counsellor_id, row._count._all]));
  const scheduled = countByCounsellor(visitsScheduled);
  const todayVisits = countByCounsellor(visitsToday);
  const overdue = countByCounsellor(visitsOverdue);
  const createdToday = countByCounsellor(newLeads);
  const workedToday = countByCounsellor(worked);
  const contactedToday = countByCounsellor(contacted);
  const byCounsellor = new Map<number, { completed: number; contact: number; followUp: number }>();
  for (const row of towardRows) {
    const current = byCounsellor.get(row.counsellor_id) ?? { completed: 0, contact: 0, followUp: 0 };
    current.completed += row._count._all;
    if (row.activity_type === "CALL" || row.activity_type === "EMAIL" || row.activity_type === "MEETING") current.contact += row._count._all;
    if (row.activity_type === "FOLLOW_UP") current.followUp += row._count._all;
    byCounsellor.set(row.counsellor_id, current);
  }

  return ids.map((counsellorId) => {
    const toward = byCounsellor.get(counsellorId) ?? { completed: 0, contact: 0, followUp: 0 };
    return {
      counsellor_id: counsellorId,
      daily_target: dailyTarget,
      completed_toward_target: toward.completed,
      target_progress_pct: dailyTarget > 0 ? Math.min(100, roundHalfEven((100 * toward.completed) / dailyTarget)) : 0,
      pending_activities: pending.get(counsellorId) ?? 0,
      visits_overdue: overdue.get(counsellorId) ?? 0,
      visits_scheduled: scheduled.get(counsellorId) ?? 0,
      visits_today: todayVisits.get(counsellorId) ?? 0,
      contact_touchpoints_today: toward.contact,
      follow_up_activities_today: toward.followUp,
      new_leads_today: createdToday.get(counsellorId) ?? 0,
      leads_worked_today: workedToday.get(counsellorId) ?? 0,
      contacted_updates_today: contactedToday.get(counsellorId) ?? 0,
    };
  });
}

/** Cached activity-progress board. A different counsellor set, or an invalidation, recomputes it. */
export async function counsellorProgressBoard(counsellorIds: number[]): Promise<CounsellorProgress[]> {
  const ids = [...new Set(counsellorIds)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  if (!ids.length) return [];
  const cached = await cache.get<{ ids: number[]; rows: CounsellorProgress[] }>(ACTIVITY_BOARD_CACHE_KEY);
  if (cached && sameIds(cached.ids, ids)) return cached.rows;
  const rows = await computeCounsellorProgressBoard(ids);
  await cache.set(ACTIVITY_BOARD_CACHE_KEY, { ids, rows }, config.cache.counsellorSnapshotSeconds);
  return rows;
}

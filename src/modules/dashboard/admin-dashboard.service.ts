import { DateTime } from "luxon";
import { config } from "../../config/env";
import { reverse } from "../../http/urls";
import { cache } from "../../lib/cache";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { formatLocal, localNow } from "../../lib/time";
import { websiteLeadSourceLabel, websiteLeadSourceNames } from "../integrations/website-sources";
import { presentActivity } from "../presenters";
import { ADMIN_HOME_CACHE_KEY } from "./cache-keys";

interface MonthlyRow {
  ym: string;
  n: number | bigint | null;
}

const EMPTY_PAYLOAD = {
  total_counsellors: 0,
  total_leads: 0,
  total_business: 0,
  new_leads: 0,
  contacted_leads: 0,
  qualified_leads: 0,
  closed_won: 0,
  closed_lost: 0,
  monthly_leads: 0,
  monthly_business: 0,
  lead_sources: [] as Array<{ name: string; lead_count: number }>,
  monthly_trend: [] as Array<{ month: string; leads: number; business: number }>,
};

/** MariaDB offset string for the configured zone, so month buckets follow local time. */
function sqlOffset(): string {
  return localNow().toFormat("ZZ");
}

async function computePayload(): Promise<typeof EMPTY_PAYLOAD> {
  const monthStart = localNow().startOf("month");
  const sixMonthsAgo = monthStart.minus({ months: 5 });
  const offset = sqlOffset();

  const [totalCounsellors, totalLeads, statusRows, monthlyLeads, monthlyBusiness, sources, leadsByMonth, businessByMonth] =
    await Promise.all([
      prisma.counsellor.count({ where: { is_active: true } }),
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.lead.count({ where: { created_at: { gte: monthStart.toJSDate() } } }),
      prisma.lead.count({ where: { status: "CLOSED_WON", created_at: { gte: monthStart.toJSDate() } } }),
      prisma.leadSource.findMany({ select: { name: true, _count: { select: { leads: true } } }, orderBy: { id: "asc" } }),
      prisma.$queryRaw<MonthlyRow[]>`
        SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', ${offset}), '%Y-%m') AS ym, COUNT(*) AS n
        FROM leads WHERE created_at >= ${sixMonthsAgo.toJSDate()} GROUP BY ym`,
      prisma.$queryRaw<MonthlyRow[]>`
        SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', ${offset}), '%Y-%m') AS ym, SUM(value) AS n
        FROM businesses WHERE created_at >= ${sixMonthsAgo.toJSDate()} AND status = 'ACTIVE' GROUP BY ym`,
    ]);

  const byStatus: Record<string, number> = Object.fromEntries(statusRows.map((r) => [r.status, r._count._all]));
  const leadMap = new Map(leadsByMonth.map((r) => [r.ym, Number(r.n ?? 0)]));
  const bizMap = new Map(businessByMonth.map((r) => [r.ym, Number(r.n ?? 0)]));

  const monthly_trend = Array.from({ length: 6 }, (_, i) => {
    const m = sixMonthsAgo.plus({ months: i });
    const key = m.toFormat("yyyy-MM");
    return { month: m.toFormat("LLLL yyyy"), leads: leadMap.get(key) ?? 0, business: bizMap.get(key) ?? 0 };
  });

  return {
    total_counsellors: totalCounsellors,
    total_leads: totalLeads,
    total_business: byStatus.CLOSED_WON ?? 0,
    new_leads: byStatus.NEW ?? 0,
    contacted_leads: byStatus.CONTACTED ?? 0,
    qualified_leads: byStatus.QUALIFIED ?? 0,
    closed_won: byStatus.CLOSED_WON ?? 0,
    closed_lost: byStatus.CLOSED_LOST ?? 0,
    monthly_leads: monthlyLeads,
    monthly_business: monthlyBusiness,
    lead_sources: sources.map((s) => ({ name: s.name, lead_count: s._count.leads })),
    monthly_trend,
  };
}

export async function adminDashboardPayload() {
  try {
    return await cache.remember(ADMIN_HOME_CACHE_KEY, Math.max(config.cache.adminDashboardSeconds, 0), computePayload);
  } catch (err) {
    logger.error({ err }, "admin dashboard aggregates failed");
    return EMPTY_PAYLOAD;
  }
}

export async function recentActivities(limit = 10) {
  const rows = await prisma.leadActivity.findMany({
    where: { activity_type: { not: "TRANSFER" } },
    include: { lead: true, counsellor: { include: { admin: true } } },
    orderBy: { completed_date: "desc" },
    take: limit,
  });
  return rows.map((a) => presentActivity(a));
}

/**
 * Once per admin login: website-form leads received since the previous login
 * (or the last 7 days on a first login). Also drops a copy in the admin inbox.
 */
export async function websiteLeadsSinceLogin(
  userId: number,
  flags: { show?: boolean; since?: string | null },
) {
  if (!flags.show) return null;
  const sinceRaw = flags.since;
  const firstLogin = sinceRaw === null || sinceRaw === undefined;
  const parsed = sinceRaw ? new Date(sinceRaw) : null;
  const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : DateTime.now().minus({ days: 7 }).toJSDate();

  const count = await prisma.lead.count({
    where: { source: { name: { in: websiteLeadSourceNames() } }, created_at: { gt: since } },
  });
  const sourceName = websiteLeadSourceLabel();

  if (count > 0) {
    await prisma.notificationAdmin.create({
      data: {
        admin_id: userId,
        message: firstLogin
          ? `${count} website lead(s) from ${sourceName} in the last 7 days (first login).`
          : `${count} new website lead(s) from ${sourceName} since your last login.`,
      },
    });
  }

  return {
    count,
    source_name: sourceName,
    manage_leads_url: reverse("manage_leads"),
    first_login: firstLogin,
    since_display: formatLocal(since, "dd LLL yyyy, hh:mm a"),
  };
}


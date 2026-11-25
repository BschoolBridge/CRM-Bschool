import { prisma } from "../../lib/prisma";
import { localDayBounds, localToday } from "../../lib/time";

const TERMINAL = ["CLOSED_WON", "CLOSED_LOST", "TRANSFERRED"] as const;

export type CallQueueBucket = "overdue" | "due_today" | "new_leads";

export interface CallQueueItem {
  key: string;
  bucket: CallQueueBucket;
  lead: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    status: string;
    priority: string;
  };
  reason: string;
  when: Date | null;
  activityId: number | null;
}

function leadLabel(lead: { first_name: string; last_name: string }) {
  return `${lead.first_name} ${lead.last_name}`.trim() || "Lead";
}

/**
 * Counsellor work queue for today: overdue follow-ups, due today, then new untouched leads.
 * Dedupes by lead so the most urgent bucket wins.
 */
export async function loadCallQueue(counsellorId: number): Promise<{
  overdue: CallQueueItem[];
  dueToday: CallQueueItem[];
  newLeads: CallQueueItem[];
  total: number;
}> {
  const { start: todayStart, end: todayEnd } = localDayBounds(localToday());
  const seen = new Set<number>();

  const [overdueActivities, dueActivities, visitLeads, freshLeads] = await Promise.all([
    prisma.leadActivity.findMany({
      where: {
        counsellor_id: counsellorId,
        is_completed: false,
        scheduled_date: { lt: todayStart },
        lead: { assigned_counsellor_id: counsellorId, status: { notIn: [...TERMINAL] } },
      },
      include: { lead: { select: { id: true, first_name: true, last_name: true, phone: true, status: true, priority: true } } },
      orderBy: { scheduled_date: "asc" },
      take: 40,
    }),
    prisma.leadActivity.findMany({
      where: {
        counsellor_id: counsellorId,
        is_completed: false,
        scheduled_date: { gte: todayStart, lt: todayEnd },
        lead: { assigned_counsellor_id: counsellorId, status: { notIn: [...TERMINAL] } },
      },
      include: { lead: { select: { id: true, first_name: true, last_name: true, phone: true, status: true, priority: true } } },
      orderBy: { scheduled_date: "asc" },
      take: 40,
    }),
    prisma.lead.findMany({
      where: {
        assigned_counsellor_id: counsellorId,
        status: { notIn: [...TERMINAL] },
        next_follow_up: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true, first_name: true, last_name: true, phone: true, status: true, priority: true, next_follow_up: true },
      orderBy: { next_follow_up: "asc" },
      take: 40,
    }),
    prisma.lead.findMany({
      where: {
        assigned_counsellor_id: counsellorId,
        status: "NEW",
      },
      select: { id: true, first_name: true, last_name: true, phone: true, status: true, priority: true, created_at: true },
      orderBy: [{ priority: "desc" }, { created_at: "desc" }],
      take: 40,
    }),
  ]);

  const overdue: CallQueueItem[] = [];
  for (const activity of overdueActivities) {
    if (seen.has(activity.lead.id)) continue;
    seen.add(activity.lead.id);
    overdue.push({
      key: `activity-${activity.id}`,
      bucket: "overdue",
      lead: activity.lead,
      reason: activity.subject || "Overdue follow-up",
      when: activity.scheduled_date,
      activityId: activity.id,
    });
  }

  const dueToday: CallQueueItem[] = [];
  for (const activity of dueActivities) {
    if (seen.has(activity.lead.id)) continue;
    seen.add(activity.lead.id);
    dueToday.push({
      key: `activity-${activity.id}`,
      bucket: "due_today",
      lead: activity.lead,
      reason: activity.subject || "Follow-up due today",
      when: activity.scheduled_date,
      activityId: activity.id,
    });
  }
  for (const lead of visitLeads) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    dueToday.push({
      key: `visit-${lead.id}`,
      bucket: "due_today",
      lead,
      reason: `Visit / follow-up with ${leadLabel(lead)}`,
      when: lead.next_follow_up,
      activityId: null,
    });
  }

  const newLeads: CallQueueItem[] = [];
  for (const lead of freshLeads) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    newLeads.push({
      key: `new-${lead.id}`,
      bucket: "new_leads",
      lead,
      reason: "New lead — first contact",
      when: lead.created_at,
      activityId: null,
    });
  }

  return {
    overdue,
    dueToday,
    newLeads,
    total: overdue.length + dueToday.length + newLeads.length,
  };
}

export async function callQueueCount(counsellorId: number): Promise<number> {
  const queue = await loadCallQueue(counsellorId);
  return queue.total;
}

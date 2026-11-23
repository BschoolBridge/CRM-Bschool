import { prisma } from "@/lib/prisma";
import { addMinutes } from "@/lib/time";
import { assignmentNotificationsForPopup } from "@/modules/notifications/assignment-notifications";
import { activityTypeLabel } from "@/modules/reference/reference.service";
import { currentCounsellor, requireCounsellor } from "@/server/actor";
import { readSession, updateSession } from "@/server/session";

export const dynamic = "force-dynamic";

const NOTIFY_KEY_TTL_MS = 10 * 60_000;

type Popup = { scheduled_time?: string; [key: string]: unknown };

export async function GET() {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  const now = new Date();
  const from = addMinutes(now, -1);
  const to = addMinutes(now, 1);

  const session = await readSession();
  const seen = { ...(session.data.notifiedKeys ?? {}) };
  let changed = false;
  for (const [key, at] of Object.entries(seen)) {
    if (now.getTime() - at > NOTIFY_KEY_TTL_MS) {
      delete seen[key];
      changed = true;
    }
  }
  const keyFor = (prefix: string, id: number, at: Date) => `${prefix}_notified_${id}_${Math.floor(at.getTime() / 60_000)}`;

  const notifications: Popup[] = (await assignmentNotificationsForPopup(counsellor.id)).map((p) => ({ ...p }) as Popup);

  const [activities, followups] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { counsellor_id: counsellor.id, scheduled_date: { gte: from, lte: to } },
      include: { lead: true },
      orderBy: { scheduled_date: "asc" },
    }),
    prisma.lead.findMany({ where: { assigned_counsellor_id: counsellor.id, next_follow_up: { gte: from, lte: to } } }),
  ]);

  for (const activity of activities) {
    const at = activity.scheduled_date;
    if (!at || Math.abs(at.getTime() - now.getTime()) > 60_000) continue;
    const key = keyFor("activity", activity.id, at);
    if (seen[key]) continue;
    const typeName = await activityTypeLabel(activity.activity_type);
    const leadName = `${activity.lead.first_name} ${activity.lead.last_name}`;
    notifications.push({
      type: "activity",
      id: activity.id,
      title: `${typeName}: ${activity.subject}`,
      message: `You have a scheduled ${typeName.toLowerCase()} with ${leadName}`,
      lead_id: activity.lead.id,
      lead_name: leadName,
      scheduled_time: at.toISOString(),
      description: activity.description || "No description",
      notification_key: key,
      unique_id: `activity_${activity.id}_${at.getTime() / 1000}`,
    });
    seen[key] = now.getTime();
    changed = true;
  }

  for (const lead of followups) {
    const at = lead.next_follow_up;
    if (!at || Math.abs(at.getTime() - now.getTime()) > 60_000) continue;
    const key = keyFor("followup", lead.id, at);
    if (seen[key]) continue;
    const leadName = `${lead.first_name} ${lead.last_name}`;
    notifications.push({
      type: "followup",
      id: lead.id,
      title: `Visit: ${leadName}`,
      message: `You have a visit scheduled with ${leadName}`,
      lead_id: lead.id,
      lead_name: leadName,
      scheduled_time: at.toISOString(),
      course_interested: lead.course_interested || "N/A",
      notification_key: key,
      unique_id: `followup_${lead.id}_${at.getTime() / 1000}`,
    });
    seen[key] = now.getTime();
    changed = true;
  }

  if (changed) {
    await updateSession((data) => {
      data.notifiedKeys = seen;
    });
  }

  const grouped: Record<string, unknown[]> = {};
  for (const note of notifications) if (note.scheduled_time) (grouped[note.scheduled_time] ??= []).push(note);
  return Response.json({ notifications, grouped, count: notifications.length });
}

import { addMinutes, parseIsoTimestamp, toLocal } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { allActivityTypeChoices } from "@/modules/reference/reference.service";
import { currentCounsellor, requireCounsellor } from "@/server/actor";

export const dynamic = "force-dynamic";

function calendarRange(start: unknown, end: unknown) {
  const from = parseIsoTimestamp(start);
  const to = parseIsoTimestamp(end);
  return from && to ? { from, to } : null;
}

export async function GET(request: Request) {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  const url = new URL(request.url);
  const range = calendarRange(url.searchParams.get("start"), url.searchParams.get("end"));
  const [activities, followups, typeChoices] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { counsellor_id: counsellor.id, scheduled_date: range ? { gte: range.from, lte: range.to } : { not: null } },
      include: { lead: true },
    }),
    prisma.lead.findMany({
      where: { assigned_counsellor_id: counsellor.id, next_follow_up: range ? { gte: range.from, lte: range.to } : { not: null } },
      include: { source: true },
    }),
    allActivityTypeChoices(),
  ]);
  const typeNames = new Map(typeChoices);
  const events: unknown[] = activities.map((activity) => {
    const start = activity.scheduled_date!;
    return {
      id: `activity_${activity.id}`,
      title: `${typeNames.get(activity.activity_type) ?? activity.activity_type}: ${activity.subject}`,
      start: start.toISOString(),
      end: addMinutes(start, activity.duration || 60).toISOString(),
      color: "#007bff",
      textColor: "#ffffff",
      extendedProps: {
        type: "activity",
        lead_name: `${activity.lead.first_name} ${activity.lead.last_name}`,
        description: activity.description || "No description",
        activity_id: activity.id,
        lead_id: activity.lead.id,
      },
    };
  });
  for (const lead of followups) {
    events.push({
      id: `followup_${lead.id}`,
      title: `Visit: ${lead.first_name} ${lead.last_name}`,
      start: toLocal(lead.next_follow_up!).toISODate(),
      allDay: true,
      color: "#28a745",
      textColor: "#ffffff",
      extendedProps: {
        type: "followup",
        lead_name: `${lead.first_name} ${lead.last_name}`,
        lead_id: lead.id,
        course_interested: lead.course_interested || "N/A",
        school_name: lead.school_name || "N/A",
      },
    });
  }
  return Response.json(events);
}

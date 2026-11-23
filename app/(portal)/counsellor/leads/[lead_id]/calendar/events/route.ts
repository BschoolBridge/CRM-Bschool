import { addMinutes, parseIsoTimestamp, toLocal } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { allActivityTypeChoices } from "@/modules/reference/reference.service";
import { requiredId } from "@/server/request";
import { ownedLead } from "../../../../_lib/owned";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await context.params;
  const { counsellor, lead } = await ownedLead(requiredId(lead_id));
  const url = new URL(request.url);
  const from = parseIsoTimestamp(url.searchParams.get("start"));
  const to = parseIsoTimestamp(url.searchParams.get("end"));
  const [activities, typeChoices] = await Promise.all([
    prisma.leadActivity.findMany({
      where: {
        lead_id: lead.id,
        counsellor_id: counsellor.id,
        scheduled_date: from && to ? { gte: from, lte: to } : { not: null },
      },
      orderBy: { scheduled_date: "asc" },
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
      color: activity.is_completed ? "#28a745" : "#ffc107",
      textColor: "#ffffff",
      extendedProps: {
        type: "activity",
        activity_id: activity.id,
        description: activity.description || "No description",
        outcome: activity.outcome || "N/A",
        is_completed: activity.is_completed,
        status: activity.is_completed ? "Completed" : "Pending",
        duration: activity.duration || 60,
      },
    };
  });
  if (lead.next_follow_up) {
    const day = toLocal(lead.next_follow_up).toISODate()!;
    const include = !from || !to || (lead.next_follow_up >= from && lead.next_follow_up <= to);
    if (include) {
      events.push({
        id: `followup_${lead.id}`,
        title: `Visit: ${lead.first_name} ${lead.last_name}`,
        start: day,
        allDay: true,
        color: "#007bff",
        textColor: "#ffffff",
        extendedProps: {
          type: "followup",
          lead_id: lead.id,
          course_interested: lead.course_interested || "N/A",
          school_name: lead.school_name || "N/A",
        },
      });
    }
  }
  return Response.json(events);
}

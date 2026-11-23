import { prisma } from "@/lib/prisma";
import { currentCounsellor, requireCounsellor } from "@/server/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  try {
    const statusRows = await prisma.lead.groupBy({
      by: ["status"],
      where: { assigned_counsellor_id: counsellor.id },
      _count: { _all: true },
    });
    const monthly_activities = [];
    const start = new Date();
    start.setUTCDate(1);
    for (let i = 0; i < 6; i++) {
      const from = new Date(start.getTime() - 30 * i * 86_400_000);
      const to = new Date(from.getTime() + 30 * 86_400_000);
      monthly_activities.push({
        month: from.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
        activities: await prisma.leadActivity.count({
          where: { counsellor_id: counsellor.id, completed_date: { gte: from, lt: to } },
        }),
      });
    }
    return Response.json({
      status_data: statusRows.map((row) => ({ status: row.status, count: row._count._all })),
      monthly_activities,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "error" }, { status: 400 });
  }
}

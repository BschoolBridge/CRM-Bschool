import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const statusRows = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
  const monthly = [];
  const start = new Date();
  start.setUTCDate(1);
  for (let i = 0; i < 6; i++) {
    const from = new Date(start.getTime() - 30 * i * 86_400_000);
    const to = new Date(from.getTime() + 30 * 86_400_000);
    const leads = await prisma.lead.count({ where: { created_at: { gte: from, lt: to } } });
    monthly.push({ month: from.toLocaleString("en-US", { month: "long", timeZone: "UTC" }), leads });
  }
  return Response.json({
    status_data: statusRows.map((row) => ({ status: row.status, count: row._count._all })),
    monthly_data: monthly,
  });
}

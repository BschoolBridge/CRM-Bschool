import { refreshCounsellorPerformance } from "@/modules/dashboard/reports.service";
import { requirePermission } from "@/server/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  await requirePermission("performance");
  try {
    return Response.json({ updated_at: new Date().toISOString(), rows: await refreshCounsellorPerformance() });
  } catch {
    return Response.json({ error: "Unable to load performance data." }, { status: 500 });
  }
}

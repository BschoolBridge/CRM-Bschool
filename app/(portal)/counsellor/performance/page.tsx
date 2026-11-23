import { PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { refreshCounsellorPerformance } from "@/modules/dashboard/reports.service";
import { requirePermission } from "@/server/actor";
import { PerformanceLive } from "./live";

export const metadata = { title: "Counsellor Performance" };

export default async function CounsellorPerformancePage() {
  await requirePermission("performance");
  const rows = await refreshCounsellorPerformance();
  return (
    <>
      <PageHeader title="Counsellor Performance" />
      <style>{`
        .performance-card { border-radius: 15px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin-bottom: 20px; transition: all 0.3s ease; }
        .performance-card:hover { box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2); transform: translateY(-2px); }
        .performance-header { background: linear-gradient(45deg, #007bff, #6610f2); color: white; padding: 20px; border-radius: 15px 15px 0 0; }
        .performance-body { padding: 20px; }
        .metric-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
        .metric-item:last-child { border-bottom: none; }
        .metric-label { font-weight: 600; color: #555; }
        .metric-value { font-size: 1.1rem; font-weight: 700; color: #007bff; }
        .conversion-rate { font-size: 1.5rem; font-weight: 700; text-align: center; padding: 20px; background: linear-gradient(45deg, #28a745, #20c997); color: white; border-radius: 10px; margin-top: 15px; }
      `}</style>
      <section className="content">
        <div className="container-fluid">
          <PerformanceLive initialRows={rows} pollUrl={reverse("counsellor_performance_data")} />
        </div>
      </section>
    </>
  );
}

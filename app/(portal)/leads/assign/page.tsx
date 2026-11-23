import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { roundHalfEven } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";
import { fullName, presentAll, presentCounsellor } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { assignUnassigned } from "../mutations";

export const metadata = { title: "Assign Leads to Counsellors" };

const METHODS = [
  {
    method: "round_robin",
    title: "Round-Robin Assignment",
    points: ["Leads are distributed in sequence", "Each counsellor gets leads in rotation", "Best for fair and equal distribution"],
    button: "btn-primary",
    label: "Round-Robin Assignment",
  },
  {
    method: "workload_balanced",
    title: "Workload Balanced",
    points: ["Considers current lead count per counsellor", "Balances workload across the team", "Best for maintaining equal workload"],
    button: "btn-success",
    label: "Workload Balanced",
  },
  {
    method: "performance_based",
    title: "Performance Based",
    points: ["Based on conversion rates", "Rewards high performers", "Best for maximizing success rates"],
    button: "btn-warning",
    label: "Performance Based",
  },
  {
    method: "specialization_based",
    title: "Specialization Based",
    points: ["Considers graduation status and source expertise", "Matches leads to counsellor strengths", "Best for specialized teams"],
    button: "btn-info",
    label: "Specialization Based",
  },
] as const;

export default async function AssignLeadsPage() {
  await requireAdmin();
  const [unassignedCount, activeCount, assignedTotal, oldest, workload] = await Promise.all([
    prisma.lead.count({ where: { assigned_counsellor_id: null } }),
    prisma.counsellor.count({ where: { is_active: true } }),
    prisma.lead.count({ where: { assigned_counsellor_id: { not: null } } }),
    prisma.lead.findFirst({ where: { assigned_counsellor_id: null }, orderBy: { created_at: "asc" }, select: { created_at: true } }),
    prisma.counsellor.findMany({
      where: { is_active: true },
      include: { admin: true, _count: { select: { leads: true } } },
      orderBy: [{ admin: { first_name: "asc" } }, { admin: { last_name: "asc" } }],
    }),
  ]);
  const counsellorWorkload = workload.map((counsellor) => {
    const n = counsellor._count.leads;
    const [capacity, status] = n <= 10 ? ["Low (≤10 leads)", "LOW"] : n <= 25 ? ["Medium (11-25 leads)", "MEDIUM"] : ["High (26+ leads)", "HIGH"];
    return { id: counsellor.id, admin: counsellor.admin, department: counsellor.department, lead_count: n, capacity, workload_status: status };
  });
  const counsellors = presentAll(workload, (counsellor) => presentCounsellor(counsellor));
  const oldestDays = oldest ? Math.floor((Date.now() - oldest.created_at.getTime()) / 86_400_000) : 0;
  const average = activeCount ? roundHalfEven(assignedTotal / activeCount, 1) : 0;

  return (
    <>
      <PageHeader
        title="Assign Leads to Counsellors"
        subtitle="Distribute unassigned aspirants across your counselling team using automated allocation rules"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Top 4 KPI Metrics */}
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Unassigned Leads</div>
                <div className="admin-stat-num" style={{ color: unassignedCount > 0 ? "#d97706" : "#059669" }}>
                  {unassignedCount.toLocaleString()}
                </div>
                <p className="admin-stat-meta">
                  {oldestDays > 0 ? `Oldest waiting ${oldestDays} day(s)` : "Queue updated today"}
                </p>
              </div>
              <div
                className="admin-stat-icon"
                style={{
                  background: unassignedCount > 0 ? "#fffbeb" : "#ecfdf5",
                  color: unassignedCount > 0 ? "#d97706" : "#059669",
                }}
              >
                <i className="fas fa-inbox" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Active Counsellors</div>
                <div className="admin-stat-num">{activeCount.toLocaleString()}</div>
                <p className="admin-stat-meta">Available for assignment</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-user-tie" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Average Workload</div>
                <div className="admin-stat-num">{average}</div>
                <p className="admin-stat-meta">Leads per counsellor</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-chart-pie" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Assigned Leads</div>
                <div className="admin-stat-num">{assignedTotal.toLocaleString()}</div>
                <p className="admin-stat-meta">Active candidate files</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#f0fdfa", color: "#0d9488" }}>
                <i className="fas fa-check-circle" />
              </div>
            </div>
          </div>

          {/* Allocation Methods */}
          <div className="card shadow-none mb-4">
            <div className="card-header">
              <h3 className="card-title font-weight-bold" style={{ fontSize: "1.05rem" }}>
                <i className="fas fa-shuffle text-primary mr-2" /> Select Allocation Method
              </h3>
              <p className="text-muted small m-0 mt-1">
                Choose an automated rule to distribute currently unassigned leads.
              </p>
            </div>
            <div className="card-body">
              <div className="row">
                {METHODS.map((item) => {
                  const borderTopColor =
                    item.method === "round_robin"
                      ? "#3157E8"
                      : item.method === "workload_balanced"
                      ? "#059669"
                      : item.method === "performance_based"
                      ? "#d97706"
                      : "#4f46e5";

                  return (
                    <div className="col-lg-6 mb-3" key={item.method}>
                      <div className="method-card" style={{ borderTopColor }}>
                        <div>
                          <div className="method-card-title">
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: "#f1f5f9",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.85rem",
                                color: borderTopColor,
                              }}
                            >
                              <i className="fas fa-layer-group" />
                            </span>
                            {item.title}
                          </div>
                          <ul className="method-card-list">
                            {item.points.map((point) => (
                              <li key={point}>
                                <i className="fas fa-check-circle" /> {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <form action={assignUnassigned}>
                          <input type="hidden" name="assignment_method" value={item.method} />
                          <div className="form-group mb-3">
                            <label className="small font-weight-bold text-muted">
                              Scope: Select Specific Counsellors (Optional)
                            </label>
                            <div
                              style={{
                                maxHeight: 130,
                                overflowY: "auto",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                padding: "0.6rem 0.75rem",
                                background: "#f8fafc",
                              }}
                            >
                              {counsellors.map((counsellor) => (
                                <div className="custom-control custom-checkbox mb-1" key={`${item.method}-${counsellor.id}`}>
                                  <input
                                    className="custom-control-input"
                                    type="checkbox"
                                    name="selected_counsellor_ids"
                                    value={counsellor.id}
                                    id={`${item.method}_c_${counsellor.id}`}
                                  />
                                  <label className="custom-control-label small" htmlFor={`${item.method}_c_${counsellor.id}`}>
                                    {fullName(counsellor.admin)}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <small className="form-text text-muted">
                              Leave all unchecked to apply across all active counsellors.
                            </small>
                          </div>
                          <button
                            type="submit"
                            className={`btn ${item.button} btn-block font-weight-bold`}
                            disabled={unassignedCount === 0}
                          >
                            <i className="fas fa-play mr-1" /> Run {item.label}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Counsellor Workload Distribution Table */}
          <Card
            title="Team Workload Status"
            subtitle="Current active lead count and capacity band for each counsellor"
            tools={
              <Link href={reverse("manage_leads")} className="btn btn-outline-secondary btn-sm">
                <i className="fas fa-table-list mr-1" /> Lead Directory
              </Link>
            }
          >
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0">
                <thead>
                  <tr>
                    <th>Counsellor</th>
                    <th>Department</th>
                    <th>Current Leads</th>
                    <th>Capacity Band</th>
                    <th>Workload Status</th>
                  </tr>
                </thead>
                <tbody>
                  {counsellorWorkload.map((counsellor) => (
                    <tr key={counsellor.id}>
                      <td className="font-weight-600 text-dark">
                        <i className="fas fa-user-circle text-muted mr-2" />
                        {fullName(counsellor.admin)}
                      </td>
                      <td>{counsellor.department || "General"}</td>
                      <td>
                        <strong>{counsellor.lead_count}</strong> leads
                      </td>
                      <td>{counsellor.capacity}</td>
                      <td>
                        <span
                          className={`badge badge-${
                            counsellor.workload_status === "LOW"
                              ? "success"
                              : counsellor.workload_status === "MEDIUM"
                              ? "warning"
                              : "danger"
                          }`}
                        >
                          {counsellor.workload_status === "LOW"
                            ? "Low"
                            : counsellor.workload_status === "MEDIUM"
                            ? "Balanced"
                            : "Heavy"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

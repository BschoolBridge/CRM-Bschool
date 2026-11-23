import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { calendarDateToIso, formatDjango } from "@/lib/time";
import { presentCounsellor, presentUser } from "@/modules/presenters";
import { requireAdmin, requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";

export const metadata = { title: "Daily Targets" };

async function updateTarget(fd: FormData): Promise<void> {
  "use server";
  await requireAdmin();
  const target = await prisma.dailyTarget.findUnique({ where: { id: requiredId(String(fd.get("target_id") ?? "")) } });
  if (!target) notFound();
  const raw = String(fd.get("target_count") ?? "").trim() || String(target.target_count);
  const count = Number(raw);
  if (!/^[+-]?\d+$/.test(raw)) {
    await flash("error", `Invalid value: invalid literal for int() with base 10: '${raw}'`);
  } else if (count < 1) {
    await flash("error", "Invalid value: Must be at least 1");
  } else {
    await prisma.dailyTarget.update({ where: { id: target.id }, data: { target_count: count } });
    await flash("success", `Target updated to ${count} tasks for ${calendarDateToIso(target.target_date)}.`);
  }
  redirect(reverse("manage_daily_targets"));
}

async function deleteTarget(id: number): Promise<void> {
  "use server";
  await requirePermission("delete");
  const target = await prisma.dailyTarget.findUnique({ where: { id } });
  if (!target) notFound();
  await prisma.dailyTarget.delete({ where: { id: target.id } });
  await flash("success", "Daily target deleted.");
  redirect(reverse("manage_daily_targets"));
}

export default async function ManageDailyTargetsPage() {
  await requireAdmin();
  const targets = await prisma.dailyTarget.findMany({
    include: { created_by: true, assignments: { include: { counsellor: { include: { admin: true } } } } },
    orderBy: { target_date: "desc" },
  });
  for (const target of targets) {
    presentUser(target.created_by);
    target.assignments.forEach((assignment) => presentCounsellor(assignment.counsellor));
  }

  const activeCounsellorsCount = await prisma.counsellor.count({ where: { is_active: true } });
  const totalAssignments = targets.reduce((sum, t) => sum + t.assignments.length, 0);

  return (
    <>
      <PageHeader
        title="Daily Targets"
        subtitle="Manage daily call, follow-up, and task completion goals across the counselling team"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Top Metric Cards */}
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Target Schedules</div>
                <div className="admin-stat-num">{targets.length}</div>
                <p className="admin-stat-meta">Active scheduled days</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-bullseye" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Active Counsellors</div>
                <div className="admin-stat-num">{activeCounsellorsCount}</div>
                <p className="admin-stat-meta">Receiving daily goals</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-user-check" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Target Allocations</div>
                <div className="admin-stat-num">{totalAssignments}</div>
                <p className="admin-stat-meta">Total assigned goal instances</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-tasks" />
              </div>
            </div>
          </div>

          <div className="alert alert-info border-0 mb-3" style={{ background: "#eff6ff", color: "#1e40af", borderRadius: "8px" }}>
            <div className="d-flex align-items-center" style={{ gap: "0.75rem" }}>
              <i className="fas fa-info-circle text-primary" style={{ fontSize: "1.1rem" }} />
              <div>
                <strong>Auto-Target Policy:</strong> A default target of <strong>100 tasks</strong> is automatically scheduled daily for active counsellors. You can customize target counts below.
              </div>
            </div>
          </div>

          <Card
            title="Scheduled Daily Targets"
            tools={
              <Link href={reverse("create_daily_target")} className="btn btn-sm btn-primary font-weight-bold">
                <i className="fas fa-plus mr-1" /> New Target
              </Link>
            }
          >
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0">
                <thead>
                  <tr>
                    <th>Target Date</th>
                    <th>Required Tasks</th>
                    <th>Assigned Counsellors</th>
                    <th>Team Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.id}>
                      <td className="font-weight-600 text-dark">
                        <i className="far fa-calendar-alt text-muted mr-2" />
                        {formatDjango(target.target_date, "M d, Y")}
                      </td>
                      <td>
                        <form action={updateTarget} className="d-inline-flex align-items-center">
                          <input type="hidden" name="target_id" value={target.id} />
                          <input
                            type="number"
                            name="target_count"
                            defaultValue={target.target_count}
                            min={1}
                            className="form-control form-control-sm text-center font-weight-bold"
                            style={{ width: 85, borderRadius: 4 }}
                          />
                          <button
                            type="submit"
                            className="btn btn-sm btn-outline-success ml-1"
                            title="Save Target Count"
                            style={{ padding: "0.25rem 0.5rem" }}
                          >
                            <i className="fas fa-check" />
                          </button>
                        </form>
                      </td>
                      <td>
                        {target.assignments.length === 0 ? (
                          <span className="text-muted small">None assigned</span>
                        ) : (
                          <div className="d-flex flex-wrap" style={{ gap: "0.3rem" }}>
                            {target.assignments.map((assignment) => (
                              <span className="badge badge-light border" key={assignment.id}>
                                {assignment.counsellor.admin.first_name} {assignment.counsellor.admin.last_name || ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: 200 }}>
                        {target.assignments.length === 0 ? (
                          <span className="text-muted small">—</span>
                        ) : (
                          target.assignments.map((assignment) => {
                            const pct = Math.min(
                              Math.round((assignment.completed_count / Math.max(target.target_count, 1)) * 100),
                              100
                            );
                            return (
                              <div key={assignment.id} className="mb-1">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="small text-dark font-weight-500">
                                    {assignment.counsellor.admin.first_name}:
                                  </span>
                                  <span className="small text-muted font-weight-bold">
                                    {assignment.completed_count}/{target.target_count} ({pct}%)
                                  </span>
                                </div>
                                <div className="progress" style={{ height: "4px", backgroundColor: "#f1f5f9" }}>
                                  <div
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: pct >= 100 ? "#059669" : "#3157E8",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </td>
                      <td>
                        <PostButton
                          action={deleteTarget.bind(null, target.id)}
                          className="btn-table-action btn-outline-danger"
                          confirm="Are you sure you want to delete this target?"
                          title="Delete Target"
                        >
                          <i className="fas fa-trash" />
                        </PostButton>
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

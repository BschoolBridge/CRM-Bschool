import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Empty, PageHeader, Pager, StatusBadge } from "@/components/ui";
import { reverse, withQuery } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { fullName, presentActivity, presentAll, presentCounsellor, presentUser } from "@/modules/presenters";
import { counsellorActivityBreakdown, counsellorLeadBreakdown } from "@/modules/dashboard/reports.service";
import { counsellorActivitySnapshot } from "@/modules/dashboard/targets.service";
import { templateLookups } from "@/modules/reference/reference.service";
import { requireAdmin } from "@/server/actor";
import { readSearch, requiredId, type SearchParams } from "@/server/request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Counsellor" };

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark", "pink"]);

function badgeColor(value: string): string {
  const color = value.trim().toLowerCase();
  return BADGE_COLORS.has(color) ? color : "secondary";
}

function iconClass(value: string): string {
  const icon = value.trim();
  return icon && /^[a-zA-Z0-9\s\-_]+$/.test(icon) && !icon.includes("..") ? icon : "fas fa-tasks";
}

function truncateChars(value: string | null | undefined, length: number): string {
  const text = value ?? "";
  if (!text) return "—";
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}…`;
}

function loggerName(activity: object): string {
  const name = (activity as { admin_logger_name?: string }).admin_logger_name;
  return name || "—";
}

export default async function CounsellorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ counsellor_id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdmin();
  const { counsellor_id } = await params;
  const id = requiredId(counsellor_id);
  const search = await readSearch(searchParams);
  const row = await prisma.counsellor.findUnique({ where: { id }, include: { admin: true } });
  if (!row) notFound();
  const counsellor = presentCounsellor(row);

  const recentWhere = { counsellor_id: id, activity_type: { not: "TRANSFER" } };
  const [leads, activities, touched, snapshot, recent, activeFreeze, freezeLogs, lookups] = await Promise.all([
    counsellorLeadBreakdown(id),
    counsellorActivityBreakdown(id),
    prisma.lead.count({ where: { assigned_counsellor_id: id, last_contact_date: { not: null } } }),
    counsellorActivitySnapshot(id),
    paginate(
      search.page,
      25,
      () => prisma.leadActivity.count({ where: recentWhere }),
      (skip, take) =>
        prisma.leadActivity.findMany({
          where: recentWhere,
          include: { lead: { include: { source: true } }, logged_by_admin: true },
          orderBy: [{ completed_date: "desc" }, { id: "desc" }],
          skip,
          take,
        }),
    ),
    prisma.counsellorActivityFreezeLog.findFirst({
      where: { counsellor_id: id, is_active: true },
      include: { unfrozen_by: true },
      orderBy: { frozen_at: "desc" },
    }),
    prisma.counsellorActivityFreezeLog.findMany({
      where: { counsellor_id: id },
      include: { unfrozen_by: true },
      orderBy: { frozen_at: "desc" },
      take: 20,
    }),
    templateLookups(),
  ]);
  presentAll(recent, (activity) => presentActivity(activity));
  freezeLogs.forEach((log) => presentUser(log.unfrozen_by));

  const pagerQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key !== "page" && value) pagerQuery[key] = value;
  }
  const superadmin = Boolean(user.admin_profile?.is_superadmin);
  const name = fullName(counsellor.admin);
  const types = lookups.activity_type_map;

  return (
    <>
      <PageHeader title={`Counsellor: ${name}`} />
      <section className="content">
        <div className="container-fluid pb-3">
          <style>{`
            .counsellor-stat-tile { border: 1px solid #dee2e6; border-radius: 4px; background: #fff; padding: .65rem .5rem; text-align: center; height: 100%; min-height: 4.5rem; }
            .counsellor-stat-tile .stat-value { font-size: 1.35rem; font-weight: 700; line-height: 1.2; }
            .counsellor-stat-tile .stat-label { font-size: .75rem; color: #495057; font-weight: 500; margin-top: .15rem; }
            .breakdown-progress { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
            .breakdown-progress-bar { height: 100%; background: #17a2b8; }
            .target-progress-wrap { background: #e9ecef; border-radius: 4px; height: 10px; overflow: hidden; }
            .target-progress-bar { background: #28a745; height: 100%; }
          `}</style>
          <div className="mb-3">
            <Link className="btn btn-secondary btn-sm" href={reverse("manage_counsellors")}>
              <i className="fas fa-arrow-left" /> Back to Counsellors
            </Link>
            <Link className="btn btn-primary btn-sm ml-1" href={withQuery(reverse("manage_leads"), { counsellor: id })}>
              <i className="fas fa-list" /> Assigned leads
            </Link>
            {superadmin ? (
              <Link className="btn btn-warning btn-sm ml-1" href={withQuery(reverse("counsellor_work_view"), { counsellor: id })}>
                <i className="fas fa-briefcase" /> Work log
              </Link>
            ) : null}
            <Link className="btn btn-info btn-sm ml-1" href={reverse("edit_counsellor", counsellor.id)}>
              <i className="fas fa-edit" /> Edit
            </Link>
          </div>

          <div className="row">
            <div className="col-lg-3 col-md-4 mb-3">
              <Card
                title={name}
                tools={
                  counsellor.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-danger">Inactive</span>
                  )
                }
              >
                <p className="mb-1">
                  <strong>Employee ID:</strong> {counsellor.employee_id}
                </p>
                <p className="mb-1">
                  <strong>Email:</strong> <span className="text-break">{counsellor.admin.email}</span>
                </p>
                <p className="mb-1">
                  <strong>Phone:</strong> {counsellor.admin.phone || "—"}
                </p>
                <p className="mb-1">
                  <strong>Department:</strong> {counsellor.department || "—"}
                </p>
                <p className="mb-0 text-muted small">Joined {formatDjango(counsellor.joining_date, "M d, Y")}</p>
              </Card>
              <Card
                title="Activity add freeze"
                tools={
                  activeFreeze ? <span className="badge badge-danger">Frozen</span> : <span className="badge badge-success">OK</span>
                }
              >
                {activeFreeze ? (
                  <>
                    <p className="mb-2 small">
                      Frozen since {formatDjango(activeFreeze.frozen_at, "M d, Y H:i")} ({activeFreeze.activities_in_window} activities in{" "}
                      {activeFreeze.window_seconds}s).
                    </p>
                    <form method="post" action={reverse("unfreeze_counsellor_activity_add", counsellor.id)}>
                      <button type="submit" className="btn btn-sm btn-success">
                        <i className="fas fa-unlock" /> Unfreeze activity add
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="mb-0 text-muted small">Counsellor can add activities normally.</p>
                )}
                {freezeLogs.length > 0 ? (
                  <>
                    <hr className="my-2" />
                    <p className="mb-1 small font-weight-bold">History</p>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead>
                          <tr>
                            <th>Frozen at</th>
                            <th>Count / window</th>
                            <th>Status</th>
                            <th>Unfrozen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {freezeLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{formatDjango(log.frozen_at, "M d, Y H:i")}</td>
                              <td>
                                {log.activities_in_window} / {log.window_seconds}s
                              </td>
                              <td>
                                {log.is_active ? (
                                  <span className="badge badge-danger">Active</span>
                                ) : (
                                  <span className="badge badge-secondary">Released</span>
                                )}
                              </td>
                              <td>
                                {log.unfrozen_at ? (
                                  <>
                                    {formatDjango(log.unfrozen_at, "M d, Y H:i")}
                                    {log.unfrozen_by ? (
                                      <>
                                        <br />
                                        <span className="text-muted small text-break">{log.unfrozen_by.email}</span>
                                      </>
                                    ) : null}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </Card>
            </div>

            <div className="col-lg-9 col-md-8 mb-3">
              <Card title="Overview">
                <div className="row">
                  {(
                    [
                      ["Assigned leads", leads.total, "text-primary"],
                      ["New", leads.statusCounts.NEW ?? 0, "text-warning"],
                      ["Contacted", leads.statusCounts.CONTACTED ?? 0, "text-info"],
                      ["Not contacted", Math.max(leads.total - touched, 0), "text-secondary"],
                      ["Reached", touched, "text-success"],
                    ] as Array<[string, number, string]>
                  ).map(([label, value, color]) => (
                    <div className="col-6 col-lg-3 mb-2" key={label}>
                      <div className="counsellor-stat-tile">
                        <div className={`stat-value ${color}`}>{value}</div>
                        <div className="stat-label">{label}</div>
                      </div>
                    </div>
                  ))}
                  <div className="col-6 col-lg-3 mb-2">
                    <div className="counsellor-stat-tile">
                      <div className="stat-value">
                        <span className="text-success">{leads.statusCounts.CLOSED_WON ?? 0}</span>
                        <span className="text-muted">/</span>
                        <span className="text-danger">{leads.statusCounts.CLOSED_LOST ?? 0}</span>
                      </div>
                      <div className="stat-label">Won / Lost</div>
                    </div>
                  </div>
                  {(
                    [
                      ["Activities", activities.total, "text-success"],
                      ["Pending tasks", activities.pending, "text-warning"],
                    ] as Array<[string, number, string]>
                  ).map(([label, value, color]) => (
                    <div className="col-6 col-lg-3 mb-2" key={label}>
                      <div className="counsellor-stat-tile">
                        <div className={`stat-value ${color}`}>{value}</div>
                        <div className="stat-label">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <hr className="my-2" />
                <div className="row align-items-center">
                  <div className="col-md-5 mb-2 mb-md-0">
                    <p className="small mb-1 font-weight-bold text-dark">Today&apos;s target</p>
                    <p className="small mb-1">
                      {snapshot.completed_toward_target} / {snapshot.daily_target} ({snapshot.target_progress_pct}%)
                    </p>
                    <div className="target-progress-wrap">
                      <div className="target-progress-bar" style={{ width: `${snapshot.target_progress_pct}%` }} />
                    </div>
                  </div>
                  <div className="col-md-7">
                    <div className="row small text-center">
                      <div className="col-4 col-md-3 mb-1">
                        <span className="d-block font-weight-bold text-primary">{snapshot.visits_today}</span>
                        <span className="text-muted">Visits today</span>
                      </div>
                      <div className="col-4 col-md-3 mb-1">
                        <span className="d-block font-weight-bold text-danger">{snapshot.visits_overdue}</span>
                        <span className="text-muted">Overdue</span>
                      </div>
                      <div className="col-4 col-md-3 mb-1">
                        <span className="d-block font-weight-bold">{snapshot.activities_completed_month}</span>
                        <span className="text-muted">This month</span>
                      </div>
                      <div className="col-12 col-md-3 mb-1">
                        <span className="d-block font-weight-bold">{snapshot.new_leads_today}</span>
                        <span className="text-muted">New leads today</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-6 mb-3">
              <Card
                title={
                  <>
                    Leads by source
                    <p className="text-muted small mb-0 mt-1">
                      Click <strong>Status breakdown</strong> to see New, Contacted, and other statuses for each source.
                    </p>
                  </>
                }
              >
                {leads.sourceRows.length === 0 ? (
                  <div className="text-center py-3">
                    <Empty text="No leads assigned yet." />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th className="text-center">Leads</th>
                          <th className="text-center">%</th>
                          <th className="text-nowrap">Quick</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.sourceRows.map((source) => (
                          <Fragment key={source.source_id}>
                            <tr>
                              <td>
                                <strong>{source.source_name}</strong>
                                {source.new_count || source.contacted_count ? (
                                  <>
                                    <br />
                                    <small className="text-muted">
                                      {source.new_count ? <span className="badge badge-light border">New {source.new_count}</span> : null}
                                      {source.contacted_count ? (
                                        <span className="badge badge-light border ml-1">Contacted {source.contacted_count}</span>
                                      ) : null}
                                    </small>
                                  </>
                                ) : null}
                              </td>
                              <td className="text-center">
                                <strong>{source.count}</strong>
                              </td>
                              <td className="text-center">{source.percent}%</td>
                              <td className="text-nowrap">
                                {source.status_breakdown.length > 0 ? (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-info btn-sm"
                                    data-toggle="collapse"
                                    data-target={`#source-status-${source.source_id}`}
                                    aria-expanded="false"
                                  >
                                    <i className="fas fa-chart-bar" /> Status breakdown
                                  </button>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="text-right text-nowrap">
                                {source.count ? (
                                  <>
                                    <Link
                                      className="btn btn-xs btn-outline-secondary btn-sm"
                                      href={reverse("lead_source_detail", source.source_id)}
                                      title="Source stats (all counsellors)"
                                    >
                                      <i className="fas fa-globe" />
                                    </Link>{" "}
                                    <Link
                                      className="btn btn-xs btn-outline-primary btn-sm"
                                      href={withQuery(reverse("manage_leads"), { counsellor: id, source: source.source_id })}
                                    >
                                      Leads
                                    </Link>
                                  </>
                                ) : null}
                              </td>
                            </tr>
                            {source.status_breakdown.length > 0 ? (
                              <tr className="collapse" id={`source-status-${source.source_id}`}>
                                <td colSpan={5} className="bg-light py-2 px-3">
                                  <p className="small font-weight-bold mb-2 text-dark">
                                    {source.source_name} — {source.count} lead{source.count === 1 ? "" : "s"} (this counsellor)
                                  </p>
                                  <div className="table-responsive">
                                    <table className="table table-sm table-bordered bg-white mb-0">
                                      <thead className="thead-light">
                                        <tr>
                                          <th>Status</th>
                                          <th className="text-center">Count</th>
                                          <th className="text-center">%</th>
                                          <th>Of this source</th>
                                          <th />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {source.status_breakdown.map((status) => (
                                          <tr key={status.code}>
                                            <td>
                                              <span className={`badge badge-${badgeColor(status.color)}`}>{status.name}</span>
                                            </td>
                                            <td className="text-center">
                                              <strong>{status.count}</strong>
                                            </td>
                                            <td className="text-center">{status.percent}%</td>
                                            <td>
                                              <div className="breakdown-progress">
                                                <div className="breakdown-progress-bar" style={{ width: `${status.percent}%` }} />
                                              </div>
                                            </td>
                                            <td className="text-right">
                                              <Link
                                                className="btn btn-xs btn-outline-primary btn-sm"
                                                href={withQuery(reverse("manage_leads"), {
                                                  counsellor: id,
                                                  source: source.source_id,
                                                  status: status.code,
                                                })}
                                              >
                                                View
                                              </Link>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                      <tfoot className="bg-light">
                        <tr>
                          <th>Total</th>
                          <th className="text-center">{leads.total}</th>
                          <th colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6 mb-3">
              <Card title="Leads by status">
                {leads.statusRows.some((status) => status.count > 0) ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th className="text-center">Leads</th>
                          <th className="text-center">%</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {leads.statusRows
                          .filter((status) => status.count > 0)
                          .map((status) => (
                            <tr key={status.code}>
                              <td>
                                <StatusBadge code={status.code} />
                              </td>
                              <td className="text-center">
                                <strong>{status.count}</strong>
                              </td>
                              <td className="text-center">{status.percent}%</td>
                              <td className="text-right">
                                <Link
                                  className="btn btn-xs btn-outline-primary btn-sm"
                                  href={withQuery(reverse("manage_leads"), { counsellor: id, status: status.code })}
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <Empty text="No leads assigned yet." />
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-6 mb-3">
              <Card
                title="Activities by type"
                tools={
                  <>
                    <span className="badge badge-success">{activities.completed} completed</span>
                    <span className="badge badge-warning ml-1">{activities.pending} pending</span>
                  </>
                }
              >
                {activities.breakdown.length === 0 ? (
                  <div className="text-center py-3">
                    <Empty text="No activities logged yet." />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th className="text-center">Total</th>
                          <th className="text-center">Done</th>
                          <th className="text-center">Pending</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.breakdown.map((row) => {
                          const type = types[row.code];
                          return (
                            <tr key={row.code}>
                              <td>
                                {type ? (
                                  <span className={`badge badge-${badgeColor(type.color)}`}>
                                    <i className={`${iconClass(type.icon)} mr-1`} />
                                    {type.name}
                                  </span>
                                ) : (
                                  <span className="badge badge-info">{row.code}</span>
                                )}
                              </td>
                              <td className="text-center">
                                <strong>{row.total}</strong>
                              </td>
                              <td className="text-center text-success">{row.completed}</td>
                              <td className="text-center text-warning">{row.pending}</td>
                              <td>
                                <div className="breakdown-progress">
                                  <div className="breakdown-progress-bar" style={{ width: `${row.percent}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-light">
                        <tr>
                          <th>Total</th>
                          <th className="text-center">{activities.total}</th>
                          <th className="text-center">{activities.completed}</th>
                          <th className="text-center">{activities.pending}</th>
                          <th />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6 mb-3">
              <Card title="Recent activities">
                {recent.length === 0 ? (
                  <div className="text-center py-3">
                    <Empty text="No activities yet." />
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Logged</th>
                            <th>Updated</th>
                            <th>Lead</th>
                            <th>Source</th>
                            <th>Type</th>
                            <th>Subject</th>
                            <th>Admin</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.map((activity) => {
                            const type = types[activity.activity_type];
                            return (
                              <tr key={activity.id}>
                                <td className="text-nowrap">{formatDjango(activity.completed_date, "M d, Y H:i")}</td>
                                <td className="text-nowrap">{activity.edited_at ? formatDjango(activity.edited_at, "M d, Y H:i") : "—"}</td>
                                <td>
                                  <Link href={reverse("admin_view_lead", activity.lead.id)}>
                                    {activity.lead.first_name} {activity.lead.last_name}
                                  </Link>
                                </td>
                                <td>{activity.lead.source.name}</td>
                                <td>
                                  {type ? (
                                    <span className={`badge badge-${badgeColor(type.color)}`}>
                                      <i className={`${iconClass(type.icon)} mr-1`} />
                                      {type.name}
                                    </span>
                                  ) : (
                                    <span className="badge badge-info">{activity.activity_type}</span>
                                  )}
                                </td>
                                <td>{truncateChars(activity.subject, 50)}</td>
                                <td>{loggerName(activity)}</td>
                                <td>
                                  {activity.is_completed ? (
                                    <span className="badge badge-success">Done</span>
                                  ) : (
                                    <span className="badge badge-warning">Pending</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="pt-3">
                      <Pager page={recent} path={reverse("counsellor_detail", id)} query={pagerQuery} />
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

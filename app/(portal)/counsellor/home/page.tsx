import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDjango, formatHumanDateTime, localDayBounds, localNow, localToday, startOfLocalMonth } from "@/lib/time";
import { counsellorActivitySnapshot } from "@/modules/dashboard/targets.service";
import { presentActivity, presentAll, presentCounsellor, presentLead } from "@/modules/presenters";
import { reverse } from "@/http/urls";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";
import { CrmCalendar } from "../_components/crm-calendar";

export const metadata = { title: "My Dashboard | Bschool Bridge" };

function activityIconAndColor(type: string): { icon: string; bg: string; color: string } {
  const t = (type || "").toUpperCase();
  if (t.includes("CALL") || t.includes("PHONE")) {
    return { icon: "fas fa-phone-alt", bg: "#eff6ff", color: "#2563eb" };
  }
  if (t.includes("WHATSAPP") || t.includes("CHAT") || t.includes("MESSAGE")) {
    return { icon: "fab fa-whatsapp", bg: "#ecfdf5", color: "#059669" };
  }
  if (t.includes("MEET") || t.includes("COUNSEL") || t.includes("VISIT")) {
    return { icon: "fas fa-handshake", bg: "#f5f3ff", color: "#7c3aed" };
  }
  if (t.includes("EMAIL") || t.includes("MAIL")) {
    return { icon: "fas fa-envelope", bg: "#f0fdfa", color: "#0d9488" };
  }
  if (t.includes("NOTE") || t.includes("REMARK")) {
    return { icon: "fas fa-sticky-note", bg: "#fffbeb", color: "#d97706" };
  }
  return { icon: "fas fa-clipboard-check", bg: "#f1f5f9", color: "#475569" };
}

export default async function CounsellorHomePage() {
  const { counsellor: sessionCounsellor } = await counsellorContext();
  const counsellor = presentCounsellor(
    await prisma.counsellor.findUniqueOrThrow({ where: { id: sessionCounsellor.id }, include: { admin: true } }),
  );
  const mine = { assigned_counsellor_id: counsellor.id };
  const { start: todayStart, end: todayEnd } = localDayBounds(localToday());
  const monthStart = startOfLocalMonth(new Date());
  const [statusRows, totalLeads, convertedThisMonth, todaysActivities, recentActivities, upcomingFollowups, incomplete, monthlyLeads, progress] =
    await Promise.all([
      prisma.lead.groupBy({ by: ["status"], where: mine, _count: { _all: true } }),
      prisma.lead.count({ where: mine }),
      prisma.lead.count({ where: { ...mine, status: "CLOSED_WON", created_at: { gte: monthStart } } }),
      prisma.leadActivity.findMany({
        where: { counsellor_id: counsellor.id, scheduled_date: { gte: todayStart, lt: todayEnd } },
        include: { lead: { include: { source: true } } },
        orderBy: { scheduled_date: "asc" },
      }),
      prisma.leadActivity.findMany({
        where: { counsellor_id: counsellor.id, activity_type: { not: "TRANSFER" } },
        include: { lead: { include: { source: true } } },
        orderBy: { completed_date: "desc" },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { ...mine, next_follow_up: { gte: todayStart, lt: todayEnd } },
        include: { source: true },
        orderBy: { next_follow_up: "asc" },
      }),
      prisma.leadActivity.count({ where: { counsellor_id: counsellor.id, is_completed: false } }),
      prisma.lead.count({ where: { ...mine, created_at: { gte: monthStart } } }),
      counsellorActivitySnapshot(counsellor.id),
    ]);
  const counts = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
  const newLeads = counts.NEW ?? 0;
  const contacted = counts.CONTACTED ?? 0;
  const qualified = counts.QUALIFIED ?? 0;
  const closedWon = counts.CLOSED_WON ?? 0;
  const closedLost = counts.CLOSED_LOST ?? 0;
  const activePipeline = contacted + qualified;
  const conversionRate = totalLeads > 0 ? ((closedWon / totalLeads) * 100).toFixed(1) : "0.0";
  const todayActivities = presentAll(todaysActivities, (activity) => presentActivity(activity));
  const recent = presentAll(recentActivities, (activity) => presentActivity(activity));
  const visits = presentAll(upcomingFollowups, (lead) => presentLead(lead));
  const counsellorName = counsellor.admin.first_name
    ? `${counsellor.admin.first_name} ${counsellor.admin.last_name}`.trim()
    : counsellor.admin.email.split("@")[0];
  const todayFormatted = localNow().toFormat("cccc, d LLLL yyyy");

  const pipelineStages = [
    {
      id: "NEW",
      name: "New",
      count: newLeads,
      badge: "Fresh",
      cls: "crm-stage-new",
      href: `${reverse("my_leads")}?status=NEW`,
    },
    {
      id: "CONTACTED",
      name: "Contacted",
      count: contacted,
      badge: "Outreach",
      cls: "crm-stage-contacted",
      href: `${reverse("my_leads")}?status=CONTACTED`,
    },
    {
      id: "QUALIFIED",
      name: "Qualified",
      count: qualified,
      badge: "In Review",
      cls: "crm-stage-qualified",
      href: `${reverse("my_leads")}?status=QUALIFIED`,
    },
    {
      id: "CLOSED_WON",
      name: "Admitted",
      count: closedWon,
      badge: "Won",
      cls: "crm-stage-won",
      href: `${reverse("my_leads")}?status=CLOSED_WON`,
    },
    {
      id: "CLOSED_LOST",
      name: "Closed Lost",
      count: closedLost,
      badge: "Archived",
      cls: "crm-stage-lost",
      href: `${reverse("my_leads")}?status=CLOSED_LOST`,
    },
  ];

  return (
    <div className="crm-dashboard-container">
      <section className="crm-hero" aria-label="Welcome and Quick Actions">
        <div className="crm-hero-content">
          <div>
            <h1 className="crm-hero-title">
              Welcome back, {counsellorName}
              <span
                className="badge badge-light"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  background: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  marginLeft: "0.5rem",
                }}
              >
                Counsellor
              </span>
            </h1>
            <p className="crm-hero-subtitle">Your assigned leads, follow-ups, and daily counselling targets</p>
            <div className="crm-hero-meta">
              <span className="crm-hero-badge">
                <i className="far fa-calendar-alt" /> {todayFormatted}
              </span>
              <span className="crm-hero-badge">
                <i className="fas fa-bullseye" /> {progress.completed_toward_target}/{progress.daily_target} target
              </span>
              {incomplete > 0 ? (
                <span className="crm-hero-badge">
                  <i className="fas fa-clipboard-list" /> {incomplete} pending
                </span>
              ) : null}
              {progress.visits_overdue > 0 ? (
                <span className="crm-hero-badge">
                  <i className="fas fa-exclamation-triangle" /> {progress.visits_overdue} overdue
                </span>
              ) : null}
            </div>
          </div>
          <div className="crm-hero-actions">
            <Link href={reverse("counsellor_call_queue")} className="crm-btn-hero-primary">
              <i className="fas fa-headset" /> Today&apos;s Call Queue
            </Link>
            <Link href={reverse("counsellor_add_lead")} className="crm-btn-hero-secondary">
              <i className="fas fa-user-plus" /> Add Lead
            </Link>
            <Link href={reverse("my_leads")} className="crm-btn-hero-secondary">
              <i className="fas fa-users" /> My Leads
            </Link>
            <Link href={reverse("my_daily_target")} className="crm-btn-hero-secondary">
              <i className="fas fa-bullseye" /> Today&apos;s Target
            </Link>
          </div>
        </div>
      </section>

      <div className="crm-kpi-grid">
        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">My Leads</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-blue">
              <i className="fas fa-users" />
            </div>
          </div>
          <div className="crm-kpi-value">{totalLeads.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-blue">
              <i className="fas fa-arrow-trend-up" /> +{monthlyLeads} this month
            </span>
            <span>assigned to you</span>
          </div>
        </div>

        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Active Pipeline</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-violet">
              <i className="fas fa-filter" />
            </div>
          </div>
          <div className="crm-kpi-value">{activePipeline.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-violet">{contacted} contacted</span>
            <span>{qualified} qualified</span>
          </div>
        </div>

        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Admissions Won</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-emerald">
              <i className="fas fa-award" />
            </div>
          </div>
          <div className="crm-kpi-value">{closedWon.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-emerald">
              <i className="fas fa-check" /> {conversionRate}% rate
            </span>
            <span>{convertedThisMonth} won this month</span>
          </div>
        </div>

        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Visits Today</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-amber">
              <i className="fas fa-clock" />
            </div>
          </div>
          <div className="crm-kpi-value">{visits.length.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-teal">
              <i className="fas fa-star" /> {newLeads} new
            </span>
            <span>{incomplete} open tasks</span>
          </div>
        </div>
      </div>

      <section className="crm-pipeline-card" aria-label="My lead pipeline">
        <div className="crm-pipeline-header">
          <div className="crm-pipeline-title-group">
            <h2>My Conversion Pipeline</h2>
            <p>Your assigned leads by admissions stage</p>
          </div>
          <div>
            <Link
              href={reverse("my_leads")}
              className="btn btn-sm btn-outline-primary"
              style={{ borderRadius: "8px", fontWeight: 600 }}
            >
              View My Leads <i className="fas fa-chevron-right ml-1" />
            </Link>
          </div>
        </div>
        <div className="crm-pipeline-steps">
          {pipelineStages.map((st) => {
            const pct = totalLeads > 0 ? ((st.count / totalLeads) * 100).toFixed(0) : "0";
            return (
              <Link href={st.href} key={st.id} className={`crm-pipeline-step ${st.cls}`}>
                <div className="crm-pipeline-step-top">
                  <span className="crm-pipeline-badge">{st.badge}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>{pct}%</span>
                </div>
                <div className="crm-pipeline-step-count">{st.count}</div>
                <div className="crm-pipeline-step-name">{st.name}</div>
                <div className="crm-pipeline-bar-bg">
                  <div
                    className="crm-pipeline-bar-fill"
                    style={{ width: `${Math.max(Number(pct), st.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="row">
        <div className="col-lg-8">
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-bullseye crm-card-title-icon" /> Today&apos;s Target
              </h3>
              <Link
                href={reverse("my_daily_target")}
                style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
              >
                Open targets
              </Link>
            </div>
            <div className="crm-card-body">
              <p className="mb-2" style={{ fontSize: "0.95rem", color: "#334155" }}>
                <strong>{progress.completed_toward_target}</strong> of <strong>{progress.daily_target}</strong> completed
                <span className="text-muted"> · {progress.target_remaining} left</span>
              </p>
              <div className="progress mb-3" style={{ height: "10px", borderRadius: "9999px", background: "#f1f5f9" }}>
                <div
                  className="progress-bar"
                  style={{
                    width: `${progress.target_progress_pct}%`,
                    background: "#35C7A5",
                    borderRadius: "9999px",
                  }}
                />
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: "0.85rem" }}>
                  <tbody>
                    <tr>
                      <td>Calls / email / meeting</td>
                      <td className="font-weight-bold">{progress.contact_touchpoints_today}</td>
                      <td>Visit / follow-up</td>
                      <td className="font-weight-bold">{progress.follow_up_activities_today}</td>
                    </tr>
                    <tr>
                      <td>Notes</td>
                      <td className="font-weight-bold">{progress.note_activities_today}</td>
                      <td>Transfer</td>
                      <td className="font-weight-bold">{progress.transfer_activities_today}</td>
                    </tr>
                    <tr>
                      <td>New</td>
                      <td className="font-weight-bold">{progress.new}</td>
                      <td>Contacted</td>
                      <td className="font-weight-bold">{progress.contacted}</td>
                    </tr>
                    <tr>
                      <td>Qualified</td>
                      <td className="font-weight-bold">{progress.qualified}</td>
                      <td>Won</td>
                      <td className="font-weight-bold">{progress.closed_won}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-bolt crm-card-title-icon" /> Quick Actions
              </h3>
              <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px", color: "#64748b" }}>
                Fast Navigation
              </span>
            </div>
            <div className="crm-card-body">
              <div className="crm-actions-grid">
                <Link href={reverse("my_leads")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-blue">
                    <i className="fas fa-users" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">My Leads</div>
                    <div className="crm-action-desc">Search and work your queue</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
                <Link href={reverse("pending_tasks")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-amber">
                    <i className="fas fa-clipboard-list" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">My Tasks</div>
                    <div className="crm-action-desc">Incomplete and next actions</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
                <Link href={reverse("my_activities")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-violet">
                    <i className="fas fa-history" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Follow-ups</div>
                    <div className="crm-action-desc">Activity history and logs</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
                <Link href={reverse("my_businesses")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-emerald">
                    <i className="fas fa-briefcase" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">My Businesses</div>
                    <div className="crm-action-desc">Won admissions records</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
                <a href={reverse("get_my_analytics")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-teal">
                    <i className="fas fa-chart-line" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Performance</div>
                    <div className="crm-action-desc">Your counselling analytics</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </a>
                <Link href={reverse("counsellor_view_profile")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-amber">
                    <i className="fas fa-user" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">My Profile</div>
                    <div className="crm-action-desc">Account and preferences</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
              </div>
            </div>
          </div>

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-calendar-day crm-card-title-icon" /> Today&apos;s Activities
              </h3>
              <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px" }}>
                {todayActivities.length}
              </span>
            </div>
            <div className="crm-card-body">
              {todayActivities.length === 0 ? (
                <div className="crm-empty-state">
                  <div className="crm-empty-icon">
                    <i className="far fa-calendar" />
                  </div>
                  <div className="crm-empty-title">Nothing scheduled today</div>
                  <p className="crm-empty-desc">Scheduled calls and follow-ups for today will show up here.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ color: "#64748b" }}>
                        <th>When</th>
                        <th>Lead</th>
                        <th>Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayActivities.map((activity) => (
                        <tr key={activity.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td>{activity.scheduled_date ? formatDjango(activity.scheduled_date, "H:i") : "—"}</td>
                          <td>
                            <Link href={reverse("lead_detail", activity.lead.id)}>
                              {activity.lead.first_name} {activity.lead.last_name}
                            </Link>
                          </td>
                          <td>{activity.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-clock-rotate-left crm-card-title-icon" /> Recent Activity
              </h3>
              <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px" }}>
                Latest {recent.length}
              </span>
            </div>
            <div className="crm-card-body">
              {recent.length === 0 ? (
                <div className="crm-empty-state">
                  <div className="crm-empty-icon">
                    <i className="far fa-clipboard" />
                  </div>
                  <div className="crm-empty-title">No counselling activities yet</div>
                  <p className="crm-empty-desc">Calls, notes, and follow-ups you log will appear here.</p>
                </div>
              ) : (
                <div className="crm-activity-list crm-activity-list--scroll">
                  {recent.map((activity) => {
                    const style = activityIconAndColor(String(shown(activity, "get_activity_type_display") || activity.activity_type));
                    const leadName = `${activity.lead.first_name} ${activity.lead.last_name}`.trim();
                    const formattedDate = activity.completed_date
                      ? formatHumanDateTime(activity.completed_date)
                      : "Recently";
                    return (
                      <div key={activity.id} className="crm-activity-item">
                        <div className="crm-activity-icon" style={{ background: style.bg, color: style.color }}>
                          <i className={style.icon} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: "0.5rem" }}>
                            <Link href={reverse("lead_detail", activity.lead.id)} className="crm-activity-lead">
                              {leadName}
                            </Link>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>{formattedDate}</span>
                          </div>
                          <div className="crm-activity-subject">
                            <span className="badge badge-light mr-1" style={{ fontSize: "0.72rem", border: "1px solid #e2e8f0" }}>
                              {shown(activity, "get_activity_type_display")}
                            </span>
                            {activity.subject}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-layer-group crm-card-title-icon" /> Lead Status
              </h3>
            </div>
            <div className="crm-card-body" style={{ padding: "1rem 1.5rem" }}>
              {(
                [
                  { label: "New", count: newLeads, href: `${reverse("my_leads")}?status=NEW` },
                  { label: "Contacted", count: contacted, href: `${reverse("my_leads")}?status=CONTACTED` },
                  { label: "Qualified", count: qualified, href: `${reverse("my_leads")}?status=QUALIFIED` },
                  { label: "Won", count: closedWon, href: `${reverse("my_leads")}?status=CLOSED_WON` },
                ] as const
              ).map((row) => (
                <Link key={row.label} href={row.href} className="crm-source-item" style={{ textDecoration: "none" }}>
                  <div className="crm-source-info">
                    <div className="crm-source-icon">
                      <i className="fas fa-flag" />
                    </div>
                    <div className="crm-source-name">{row.label}</div>
                  </div>
                  <span className="crm-source-count">{row.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-map-marker-alt crm-card-title-icon" /> Visits Today
              </h3>
              <Link
                href={reverse("pending_tasks")}
                style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
              >
                Tasks
              </Link>
            </div>
            <div className="crm-card-body">
              {visits.length === 0 ? (
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                  No visits scheduled for today.
                </p>
              ) : (
                <div className="crm-activity-list">
                  {visits.map((lead) => (
                    <div key={lead.id} className="crm-activity-item">
                      <div className="crm-activity-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                        <i className="fas fa-user" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={reverse("lead_detail", lead.id)} className="crm-activity-lead">
                          {lead.first_name} {lead.last_name}
                        </Link>
                        <div className="crm-activity-meta">
                          {lead.next_follow_up ? formatDjango(lead.next_follow_up, "H:i") : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-calendar-alt crm-card-title-icon" /> Calendar
              </h3>
            </div>
            <div className="crm-card-body">
              <CrmCalendar eventsUrl={reverse("get_calendar_events")} variant="dashboard" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

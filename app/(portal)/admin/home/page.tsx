import Link from "next/link";
import { requireAdmin } from "../../../../src/server/actor";
import { readSession, updateSession } from "../../../../src/server/session";
import {
  adminDashboardPayload,
  recentActivities,
  websiteLeadsSinceLogin,
} from "../../../../src/modules/dashboard/admin-dashboard.service";
import { adminCan } from "../../../../src/server/auth";
import { reverse } from "../../../../src/http/urls";
import { formatHumanDateTime, localNow } from "../../../../src/lib/time";

export const metadata = { title: "Overview | Bschool Bridge" };

function activityIconAndColor(type: string): { icon: string; bg: string; color: string } {
  const t = (type || "").toUpperCase();
  if (t.includes("CALL") || t.includes("PHONE")) {
    return { icon: "fas fa-phone-alt", bg: "#eff6ff", color: "#2563eb" };
  }
  if (t.includes("WHATSAPP") || t.includes("CHAT") || t.includes("MESSAGE")) {
    return { icon: "fab fa-whatsapp", bg: "#ecfdf5", color: "#059669" };
  }
  if (t.includes("MEET") || t.includes("COUNSEL")) {
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

export default async function AdminHomePage() {
  const user = await requireAdmin();
  const session = await readSession();
  const [payload, recent, website] = await Promise.all([
    adminDashboardPayload(),
    recentActivities(),
    websiteLeadsSinceLogin(user.id, {
      show: session.data.showWebsiteLeadsLoginAlert,
      since: session.data.adminLoginSince,
    }),
  ]);

  if (session.data.showWebsiteLeadsLoginAlert) {
    await updateSession((data) => {
      delete data.showWebsiteLeadsLoginAlert;
      delete data.adminLoginSince;
    });
  }

  const profile = user.admin_profile;
  const superadmin = Boolean(profile?.is_superadmin);
  const adminName = user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.email.split("@")[0];
  const todayFormatted = localNow().toFormat("cccc, d LLLL yyyy");

  // Computed metrics
  const activePipeline = payload.contacted_leads + payload.qualified_leads;
  const conversionRate =
    payload.total_leads > 0 ? ((payload.closed_won / payload.total_leads) * 100).toFixed(1) : "0.0";
  const maxTrendLeads = Math.max(...payload.monthly_trend.map((m) => m.leads), 1);
  const peakMonth = payload.monthly_trend.reduce(
    (max, cur) => (cur.leads > max.leads ? cur : max),
    payload.monthly_trend[0] || { month: "—", leads: 0, business: 0 }
  );
  const totalSourcesCount = payload.lead_sources.reduce((sum, s) => sum + s.lead_count, 0) || payload.total_leads || 1;

  // Funnel stage definitions
  const pipelineStages = [
    {
      id: "NEW",
      name: "New Inquiries",
      count: payload.new_leads,
      badge: "Fresh",
      cls: "crm-stage-new",
      href: `${reverse("manage_leads")}?status=NEW`,
    },
    {
      id: "CONTACTED",
      name: "Contacted",
      count: payload.contacted_leads,
      badge: "Outreach",
      cls: "crm-stage-contacted",
      href: `${reverse("manage_leads")}?status=CONTACTED`,
    },
    {
      id: "QUALIFIED",
      name: "Qualified",
      count: payload.qualified_leads,
      badge: "In Review",
      cls: "crm-stage-qualified",
      href: `${reverse("manage_leads")}?status=QUALIFIED`,
    },
    {
      id: "CLOSED_WON",
      name: "Admitted",
      count: payload.closed_won,
      badge: "Enrolled",
      cls: "crm-stage-won",
      href: `${reverse("manage_leads")}?status=CLOSED_WON`,
    },
    {
      id: "CLOSED_LOST",
      name: "Closed Lost",
      count: payload.closed_lost,
      badge: "Archived",
      cls: "crm-stage-lost",
      href: `${reverse("manage_leads")}?status=CLOSED_LOST`,
    },
  ];

  return (
    <div className="crm-dashboard-container">
      {/* Hero Welcome Banner */}
      <section className="crm-hero" aria-label="Welcome and Quick Actions">
        <div className="crm-hero-content">
          <div>
            <h1 className="crm-hero-title">
              Welcome back, {adminName}
              <span className="badge badge-light" style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.5rem", borderRadius: "4px", background: "rgba(255,255,255,0.15)", color: "#ffffff", marginLeft: "0.5rem" }}>
                {superadmin ? "Super Admin" : "Admissions Admin"}
              </span>
            </h1>
            <p className="crm-hero-subtitle">
              Bschool Bridge Admissions Counselling & Operations Hub
            </p>
            <div className="crm-hero-meta">
              <span className="crm-hero-badge">
                <i className="far fa-calendar-alt" /> {todayFormatted}
              </span>
              <span className="crm-hero-badge">
                <i className="fas fa-shield-alt mr-1" /> Active Session
              </span>
            </div>
          </div>
          <div className="crm-hero-actions">
            <Link href={reverse("add_lead")} className="crm-btn-hero-primary">
              <i className="fas fa-user-plus" /> Add Lead
            </Link>
            <Link href={reverse("import_leads")} className="crm-btn-hero-secondary">
              <i className="fas fa-file-arrow-up" /> Import CSV
            </Link>
            <Link href={reverse("manage_leads")} className="crm-btn-hero-secondary">
              <i className="fas fa-table-list" /> View All Leads
            </Link>
          </div>
        </div>
      </section>

      {/* Website Leads Notification Alert */}
      {website && website.count > 0 ? (
        <div
          className="alert alert-dismissible fade show mb-4"
          role="alert"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            color: "#1e3a8a",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: "1rem" }}>
            <div className="d-flex align-items-center" style={{ gap: "1rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                <i className="fas fa-globe" />
              </div>
              <div>
                <h5 className="mb-1" style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1e3a8a" }}>
                  {website.count} new website enquiry{website.count === 1 ? "" : "s"} received
                </h5>
                <p className="mb-0" style={{ fontSize: "0.88rem", color: "#3b82f6" }}>
                  {website.first_login
                    ? `${website.count} lead(s) came from ${website.source_name} in the last 7 days.`
                    : `${website.count} lead(s) received from ${website.source_name} since your last login (${website.since_display}).`}
                </p>
              </div>
            </div>
            <Link href={website.manage_leads_url} className="btn btn-primary" style={{ borderRadius: "10px", fontWeight: 600 }}>
              Review Inquiries <i className="fas fa-arrow-right ml-1" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Top 4 Executive KPI Metric Cards */}
      <div className="crm-kpi-grid">
        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Total Leads</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-blue">
              <i className="fas fa-users" />
            </div>
          </div>
          <div className="crm-kpi-value">{payload.total_leads.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-blue">
              <i className="fas fa-arrow-trend-up" /> +{payload.monthly_leads} this month
            </span>
            <span>total applicant pool</span>
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
            <span className="crm-kpi-pill crm-kpi-pill-violet">
              {payload.contacted_leads} contacted
            </span>
            <span>{payload.qualified_leads} qualified</span>
          </div>
        </div>

        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Admissions Won</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-emerald">
              <i className="fas fa-award" />
            </div>
          </div>
          <div className="crm-kpi-value">{payload.closed_won.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-emerald">
              <i className="fas fa-check" /> {conversionRate}% rate
            </span>
            <span>enrolled students</span>
          </div>
        </div>

        <div className="crm-kpi-card">
          <div className="crm-kpi-header">
            <span className="crm-kpi-label">Active Counsellors</span>
            <div className="crm-kpi-icon-box crm-kpi-icon-teal">
              <i className="fas fa-user-tie" />
            </div>
          </div>
          <div className="crm-kpi-value">{payload.total_counsellors.toLocaleString()}</div>
          <div className="crm-kpi-footer">
            <span className="crm-kpi-pill crm-kpi-pill-teal">
              <i className="fas fa-circle-check" /> Team active
            </span>
            <span>ready for assignments</span>
          </div>
        </div>
      </div>

      {/* Admissions Pipeline Conversion Flow */}
      <section className="crm-pipeline-card" aria-label="Admissions Pipeline Overview">
        <div className="crm-pipeline-header">
          <div className="crm-pipeline-title-group">
            <h2>Admissions Conversion Pipeline</h2>
            <p>Interactive stage distribution from initial enquiry to final admission</p>
          </div>
          <div>
            <Link
              href={reverse("manage_leads")}
              className="btn btn-sm btn-outline-primary"
              style={{ borderRadius: "8px", fontWeight: 600 }}
            >
              Manage Pipeline <i className="fas fa-chevron-right ml-1" />
            </Link>
          </div>
        </div>

        <div className="crm-pipeline-steps">
          {pipelineStages.map((st) => {
            const pct = payload.total_leads > 0 ? ((st.count / payload.total_leads) * 100).toFixed(0) : "0";
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

      {/* 2-Column Main Section */}
      <div className="row">
        {/* Left Column (8 cols): Organized Quick Actions & Activity Feed */}
        <div className="col-lg-8">
          {/* Quick Actions Hub */}
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-bolt crm-card-title-icon" /> Quick Actions Hub
              </h3>
              <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px", color: "#64748b" }}>
                Fast Navigation
              </span>
            </div>
            <div className="crm-card-body">
              {/* Group 1: Lead Operations */}
              <div className="crm-action-group-title">
                <i className="fas fa-users mr-1" /> Candidate & Lead Operations
              </div>
              <div className="crm-actions-grid mb-3">
                <Link href={reverse("add_lead")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-blue">
                    <i className="fas fa-user-plus" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Add New Lead</div>
                    <div className="crm-action-desc">Direct candidate registration</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>

                <Link href={reverse("import_leads")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-emerald">
                    <i className="fas fa-file-arrow-up" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Import Leads</div>
                    <div className="crm-action-desc">Upload bulk Excel / CSV files</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>

                <Link href={reverse("manage_leads")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-violet">
                    <i className="fas fa-table-list" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Manage Leads</div>
                    <div className="crm-action-desc">Search, filter & stage updates</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>

                <Link href={reverse("assign_leads_to_counsellors")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-amber">
                    <i className="fas fa-share-nodes" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Assign Leads</div>
                    <div className="crm-action-desc">Distribute candidates to team</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>
              </div>

              {/* Group 2: Counselling Team & Goals */}
              <div className="crm-action-group-title">
                <i className="fas fa-user-tie mr-1" /> Counselling Team & Goals
              </div>
              <div className="crm-actions-grid mb-3">
                <Link href={reverse("manage_counsellors")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-teal">
                    <i className="fas fa-id-badge" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Counsellors</div>
                    <div className="crm-action-desc">Team roster & allocations</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>

                <Link href={reverse("manage_daily_targets")} className="crm-action-tile">
                  <div className="crm-action-icon crm-kpi-icon-rose">
                    <i className="fas fa-bullseye" />
                  </div>
                  <div className="crm-action-info">
                    <div className="crm-action-title">Daily Targets</div>
                    <div className="crm-action-desc">Call, follow-up & lead targets</div>
                  </div>
                  <i className="fas fa-chevron-right crm-action-arrow" />
                </Link>

                {superadmin ? (
                  <>
                    <Link href={reverse("counsellor_activity_progress_report")} className="crm-action-tile">
                      <div className="crm-action-icon crm-kpi-icon-blue">
                        <i className="fas fa-chart-pie" />
                      </div>
                      <div className="crm-action-info">
                        <div className="crm-action-title">Activity Progress</div>
                        <div className="crm-action-desc">Daily team completion status</div>
                      </div>
                      <i className="fas fa-chevron-right crm-action-arrow" />
                    </Link>

                    <Link href={reverse("counsellor_work_view")} className="crm-action-tile">
                      <div className="crm-action-icon crm-kpi-icon-emerald">
                        <i className="fas fa-clock-rotate-left" />
                      </div>
                      <div className="crm-action-info">
                        <div className="crm-action-title">View Activities</div>
                        <div className="crm-action-desc">Detailed counselling log audit</div>
                      </div>
                      <i className="fas fa-chevron-right crm-action-arrow" />
                    </Link>
                  </>
                ) : null}

                {adminCan(profile, "performance") ? (
                  <Link href={reverse("counsellor_performance")} className="crm-action-tile">
                    <div className="crm-action-icon crm-kpi-icon-violet">
                      <i className="fas fa-chart-line" />
                    </div>
                    <div className="crm-action-info">
                      <div className="crm-action-title">Performance</div>
                      <div className="crm-action-desc">Conversion metrics & leaderboards</div>
                    </div>
                    <i className="fas fa-chevron-right crm-action-arrow" />
                  </Link>
                ) : null}
              </div>

              {/* Group 3: Platform Settings & Administration */}
              {(superadmin || adminCan(profile, "settings")) && (
                <>
                  <div className="crm-action-group-title">
                    <i className="fas fa-sliders mr-1" /> Administration & Channels
                  </div>
                  <div className="crm-actions-grid">
                    {superadmin ? (
                      <Link href={reverse("manage_admins")} className="crm-action-tile">
                        <div className="crm-action-icon crm-kpi-icon-blue">
                          <i className="fas fa-user-shield" />
                        </div>
                        <div className="crm-action-info">
                          <div className="crm-action-title">Manage Admins</div>
                          <div className="crm-action-desc">User permissions & access</div>
                        </div>
                        <i className="fas fa-chevron-right crm-action-arrow" />
                      </Link>
                    ) : null}

                    {adminCan(profile, "settings") ? (
                      <>
                        <Link href={reverse("manage_lead_sources")} className="crm-action-tile">
                          <div className="crm-action-icon crm-kpi-icon-amber">
                            <i className="fas fa-tags" />
                          </div>
                          <div className="crm-action-info">
                            <div className="crm-action-title">Lead Sources</div>
                            <div className="crm-action-desc">Acquisition channel config</div>
                          </div>
                          <i className="fas fa-chevron-right crm-action-arrow" />
                        </Link>

                        <Link href={reverse("manage_meta_integration")} className="crm-action-tile">
                          <div className="crm-action-icon crm-kpi-icon-emerald">
                            <i className="fab fa-whatsapp" />
                          </div>
                          <div className="crm-action-info">
                            <div className="crm-action-title">Meta & WhatsApp</div>
                            <div className="crm-action-desc">Campaign ads & webhooks</div>
                          </div>
                          <i className="fas fa-chevron-right crm-action-arrow" />
                        </Link>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Activity Timeline Stream */}
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-clock-rotate-left crm-card-title-icon" /> Live Counselling Feed
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
                  <div className="crm-empty-title">No counselling activities logged yet</div>
                  <p className="crm-empty-desc">
                    When counsellors make calls, schedule visits, or log notes, they will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="crm-activity-list">
                  {recent.map((activity) => {
                    const style = activityIconAndColor(activity.activity_type);
                    const leadName = activity.lead
                      ? `${activity.lead.first_name} ${activity.lead.last_name}`.trim()
                      : "Unassigned Lead";
                    const counsellorName =
                      activity.counsellor?.admin?.first_name ||
                      (activity as unknown as { admin_logger_name?: string }).admin_logger_name ||
                      activity.counsellor?.employee_id ||
                      "Counsellor";
                    const formattedDate = activity.completed_date
                      ? formatHumanDateTime(activity.completed_date)
                      : "Recently";

                    return (
                      <div key={activity.id} className="crm-activity-item">
                        <div
                          className="crm-activity-icon"
                          style={{ background: style.bg, color: style.color }}
                        >
                          <i className={style.icon} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: "0.5rem" }}>
                            {activity.lead?.id ? (
                              <Link
                                href={`${reverse("manage_leads")}?search=${encodeURIComponent(leadName)}`}
                                className="crm-activity-lead"
                              >
                                {leadName}
                              </Link>
                            ) : (
                              <span className="crm-activity-lead">{leadName}</span>
                            )}
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
                              {formattedDate}
                            </span>
                          </div>
                          <div className="crm-activity-subject">
                            <span className="badge badge-light mr-1" style={{ fontSize: "0.72rem", border: "1px solid #e2e8f0" }}>
                              {activity.activity_type}
                            </span>
                            {activity.subject}
                          </div>
                          <div className="crm-activity-meta">
                            <span>
                              <i className="fas fa-user-check mr-1" style={{ color: "#10b981" }} />
                              Logged by <strong>{counsellorName}</strong>
                            </span>
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

        {/* Right Column (4 cols): 6-Month Trend & Sources */}
        <div className="col-lg-4">
          {/* 6-Month Trend Card */}
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-chart-simple crm-card-title-icon" /> 6-Month Admissions Trend
              </h3>
              <span className="badge badge-success" style={{ borderRadius: "8px", padding: "0.25rem 0.55rem" }}>
                Active
              </span>
            </div>
            <div className="crm-card-body">
              {/* Visual Bar Chart */}
              <div className="crm-chart-container">
                <div className="crm-bars-wrap">
                  {payload.monthly_trend.map((row) => {
                    const isPeak = row.month === peakMonth.month && row.leads > 0;
                    const heightPct = Math.max(Math.round((row.leads / maxTrendLeads) * 100), row.leads > 0 ? 12 : 6);
                    const shortMonth = row.month.split(" ")[0]?.slice(0, 3) ?? row.month;

                    return (
                      <div key={row.month} className="crm-bar-col" title={`${row.month}: ${row.leads} leads`}>
                        <span className="crm-bar-val">{row.leads}</span>
                        <div
                          className={`crm-bar-fill ${isPeak ? "crm-bar-peak" : ""}`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="crm-bar-label">{shortMonth}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Table Breakdown */}
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Monthly Breakdown
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Total: {payload.monthly_trend.reduce((a, b) => a + b.leads, 0)} leads
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{ fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ color: "#64748b", borderTop: "none" }}>
                        <th style={{ fontWeight: 600 }}>Month</th>
                        <th style={{ fontWeight: 600, textAlign: "right" }}>Leads</th>
                        <th style={{ fontWeight: 600, textAlign: "right" }}>Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.monthly_trend.map((row) => (
                        <tr key={row.month} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ color: "#334155", fontWeight: 500 }}>{row.month}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{row.leads}</td>
                          <td style={{ textAlign: "right", color: "#059669", fontWeight: 600 }}>{row.business}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Lead Sources Distribution */}
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-layer-group crm-card-title-icon" /> Acquisition Sources
              </h3>
              <Link
                href={reverse("manage_lead_sources")}
                style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
              >
                Configure
              </Link>
            </div>
            <div className="crm-card-body" style={{ padding: "1rem 1.5rem" }}>
              {payload.lead_sources.length === 0 ? (
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                  No lead sources configured.
                </p>
              ) : (
                payload.lead_sources.map((src) => {
                  const sharePct = ((src.lead_count / totalSourcesCount) * 100).toFixed(0);
                  const isMeta = src.name.toLowerCase().includes("meta") || src.name.toLowerCase().includes("facebook");
                  const isWeb = src.name.toLowerCase().includes("web") || src.name.toLowerCase().includes("site");
                  const isChat = src.name.toLowerCase().includes("aisensy") || src.name.toLowerCase().includes("whatsapp");

                  const iconClass = isMeta
                    ? "fab fa-facebook"
                    : isWeb
                    ? "fas fa-globe"
                    : isChat
                    ? "fab fa-whatsapp"
                    : "fas fa-tag";

                  return (
                    <div key={src.name} className="crm-source-item">
                      <div className="crm-source-info">
                        <div className="crm-source-icon">
                          <i className={iconClass} />
                        </div>
                        <div>
                          <div className="crm-source-name">{src.name}</div>
                          <div style={{ width: "90px", height: "4px", background: "#f1f5f9", borderRadius: "9999px", marginTop: "4px" }}>
                            <div
                              style={{
                                width: `${Math.max(Number(sharePct), src.lead_count > 0 ? 8 : 0)}%`,
                                height: "100%",
                                background: "#3b82f6",
                                borderRadius: "9999px",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="crm-source-count">{src.lead_count}</span>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "2px" }}>{sharePct}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

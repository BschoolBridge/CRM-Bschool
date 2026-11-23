import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDjango, localDayBounds, localToday, startOfLocalMonth } from "@/lib/time";
import { counsellorActivitySnapshot } from "@/modules/dashboard/targets.service";
import { presentActivity, presentAll, presentCounsellor, presentLead } from "@/modules/presenters";
import { reverse } from "@/http/urls";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";
import { CrmCalendar } from "../_components/crm-calendar";

export const metadata = { title: "My Dashboard" };

function Stat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="col-12 col-sm-6 col-md-3">
      <div className="info-box">
        <span className={`info-box-icon bg-${color}`}>
          <i className={icon} />
        </span>
        <div className="info-box-content">
          <span className="info-box-text">{label}</span>
          <span className="info-box-number">{value}</span>
        </div>
      </div>
    </div>
  );
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
  const todayActivities = presentAll(todaysActivities, (activity) => presentActivity(activity));
  const recent = presentAll(recentActivities, (activity) => presentActivity(activity));
  const visits = presentAll(upcomingFollowups, (lead) => presentLead(lead));

  return (
    <>
      <PageHeader title="My Dashboard">
        <Link className="btn btn-sm btn-default mr-1" href={reverse("my_leads")}>My leads</Link>
        <Link className="btn btn-sm btn-primary" href={reverse("my_daily_target")}>Today&apos;s target</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Welcome back, ${counsellor.admin.first_name}`}>
            <p className="mb-2">
              <span className="badge badge-light border mr-1">
                {progress.completed_toward_target}/{progress.daily_target} target
              </span>
              {incomplete > 0 ? <span className="badge badge-warning mr-1">{incomplete} pending</span> : null}
              {visits.length > 0 ? <span className="badge badge-info mr-1">{visits.length} visits today</span> : null}
              {progress.visits_overdue > 0 ? <span className="badge badge-danger">{progress.visits_overdue} overdue</span> : null}
            </p>
            <p className="text-muted mb-0">
              {monthlyLeads} leads this month · {convertedThisMonth} won this month · {closedWon} closed won
            </p>
          </Card>
          <div className="row">
            <Stat label="Total Leads" value={totalLeads} icon="fas fa-users" color="info" />
            <Stat label="Converted Leads" value={closedWon} icon="fas fa-check-circle" color="success" />
            <Stat label="Pending Visits" value={visits.length} icon="fas fa-clock" color="warning" />
            <Stat label="New" value={newLeads} icon="fas fa-star" color="primary" />
          </div>
          <div className="row">
            <div className="col-lg-8">
              <Card title="Today's target">
                <p>
                  <strong>{progress.completed_toward_target}</strong> of <strong>{progress.daily_target}</strong> completed
                  <span className="text-muted"> · {progress.target_remaining} left</span>
                </p>
                <div className="progress mb-3">
                  <div className="progress-bar bg-success" style={{ width: `${progress.target_progress_pct}%` }}>
                    {progress.target_progress_pct}%
                  </div>
                </div>
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td>Calls / email / meeting</td><td>{progress.contact_touchpoints_today}</td><td>Visit / follow-up</td><td>{progress.follow_up_activities_today}</td></tr>
                    <tr><td>Notes</td><td>{progress.note_activities_today}</td><td>Transfer</td><td>{progress.transfer_activities_today}</td></tr>
                    <tr><td>New</td><td>{progress.new}</td><td>Contacted</td><td>{progress.contacted}</td></tr>
                    <tr><td>Qualified</td><td>{progress.qualified}</td><td>Won</td><td>{progress.closed_won}</td></tr>
                  </tbody>
                </table>
              </Card>
              <Card title="Today's activities">
                {todayActivities.length === 0 ? <Empty text="Nothing scheduled today." /> : (
                  <table className="table table-sm mb-0">
                    <thead><tr><th>When</th><th>Lead</th><th>Subject</th></tr></thead>
                    <tbody>
                      {todayActivities.map((activity) => (
                        <tr key={activity.id}>
                          <td>{activity.scheduled_date ? formatDjango(activity.scheduled_date, "H:i") : "—"}</td>
                          <td><Link href={reverse("lead_detail", activity.lead.id)}>{activity.lead.first_name} {activity.lead.last_name}</Link></td>
                          <td>{activity.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card title="Recent activity">
                {recent.length === 0 ? <Empty text="No activity yet." /> : (
                  <table className="table table-sm mb-0">
                    <thead><tr><th>When</th><th>Lead</th><th>Type</th><th>Subject</th></tr></thead>
                    <tbody>
                      {recent.map((activity) => (
                        <tr key={activity.id}>
                          <td>{activity.completed_date ? formatDjango(activity.completed_date, "M d, Y H:i") : "—"}</td>
                          <td>{activity.lead.first_name} {activity.lead.last_name}</td>
                          <td>{shown(activity, "get_activity_type_display")}</td>
                          <td>{activity.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title="Lead status">
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex justify-content-between">New <StatusBadge code="NEW" /> {newLeads}</li>
                  <li className="list-group-item d-flex justify-content-between">Contacted {contacted}</li>
                  <li className="list-group-item d-flex justify-content-between">Qualified {qualified}</li>
                  <li className="list-group-item d-flex justify-content-between">Won {closedWon}</li>
                </ul>
              </Card>
              <Card title="Visits today">
                {visits.length === 0 ? <Empty text="No visits today." /> : (
                  <ul className="list-group list-group-flush">
                    {visits.map((lead) => (
                      <li key={lead.id} className="list-group-item">
                        <Link href={reverse("lead_detail", lead.id)}>{lead.first_name} {lead.last_name}</Link>
                        <div className="small text-muted">{lead.next_follow_up ? formatDjango(lead.next_follow_up, "H:i") : ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Calendar">
                <CrmCalendar eventsUrl={reverse("get_calendar_events")} variant="dashboard" />
              </Card>
            </div>
          </div>
          <Card title="Quick actions">
            <div className="row">
              {[
                ["View My Leads", reverse("my_leads"), "btn-primary"],
                ["My Businesses", reverse("my_businesses"), "btn-success"],
                ["My Activities", reverse("my_activities"), "btn-info"],
              ].map(([label, href, cls]) => (
                <div className="col-md-3 mb-2" key={href}>
                  <Link className={`btn ${cls} btn-block`} href={href}>{label}</Link>
                </div>
              ))}
              <div className="col-md-3 mb-2">
                <a className="btn btn-warning btn-block" href={reverse("get_my_analytics")}>Performance Analytics</a>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDjango, localDayBounds, localToday } from "@/lib/time";
import { dailyTargetProgress } from "@/modules/dashboard/targets.service";
import { presentActivity, presentAll, presentLead } from "@/modules/presenters";
import { reverse } from "@/http/urls";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";

export const metadata = { title: "Daily Targets" };

export default async function DailyTargetPage() {
  const { counsellor } = await counsellorContext();
  const progress = await dailyTargetProgress(counsellor.id);
  await prisma.dailyTargetAssignment.update({
    where: { id: progress.assignment.id },
    data: { completed_count: progress.completed_toward_target },
  });
  const today = localToday();
  let remaining = progress.assignment.target.target_count;

  const visitRows = await prisma.lead.findMany({
    where: { assigned_counsellor_id: counsellor.id, next_follow_up: { lt: localDayBounds(today).end } },
    include: { source: true },
    orderBy: { next_follow_up: "asc" },
    take: remaining,
  });
  remaining -= visitRows.length;

  const activityRows = remaining > 0
    ? await prisma.leadActivity.findMany({
        where: { counsellor_id: counsellor.id, is_completed: false },
        include: { lead: true },
        orderBy: { scheduled_date: "asc" },
        take: remaining,
      })
    : [];
  remaining -= activityRows.length;

  const statusLeads: Array<{
    status: { code: string; name: string };
    leads: Awaited<ReturnType<typeof prisma.lead.findMany<{ include: { source: true } }>>>;
  }> = [];
  if (remaining > 0) {
    const statuses = await prisma.leadStatus.findMany({
      where: { is_active: true, NOT: { code: { in: ["NEW", "CLOSED_WON", "CLOSED_LOST", "TRANSFERRED"] } } },
      orderBy: { sort_order: "asc" },
    });
    for (const status of statuses) {
      if (remaining <= 0) break;
      const chunk = await prisma.lead.findMany({
        where: { assigned_counsellor_id: counsellor.id, status: status.code },
        include: { source: true },
        orderBy: [{ last_contact_date: { sort: "asc", nulls: "first" } }, { created_at: "desc" }],
        take: remaining,
      });
      if (chunk.length) {
        statusLeads.push({ status, leads: presentAll(chunk, (lead) => presentLead(lead)) });
        remaining -= chunk.length;
      }
    }
  }
  const newLeadRows = remaining > 0
    ? await prisma.lead.findMany({
        where: { assigned_counsellor_id: counsellor.id, status: "NEW" },
        include: { source: true },
        orderBy: [{ last_contact_date: { sort: "asc", nulls: "first" } }, { created_at: "desc" }],
        take: remaining,
      })
    : [];
  const visits = presentAll(visitRows, (lead) => presentLead(lead));
  const activities = presentAll(activityRows, (activity) => presentActivity(activity));
  const newLeads = presentAll(newLeadRows, (lead) => presentLead(lead));
  const totalItems = visits.length + activities.length + statusLeads.reduce((sum, section) => sum + section.leads.length, 0) + newLeads.length;

  return (
    <>
      <PageHeader title="Daily Targets" />
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-3"><Card title="Target"><p className="h3 mb-0">{progress.assignment.target.target_count}</p></Card></div>
            <div className="col-md-3"><Card title="Completed"><p className="h3 mb-0">{progress.completed_toward_target}</p></Card></div>
            <div className="col-md-3"><Card title="Remaining"><p className="h3 mb-0">{progress.target_remaining}</p></Card></div>
            <div className="col-md-3"><Card title="Queue"><p className="h3 mb-0">{totalItems}</p></Card></div>
          </div>
          <Card title="Progress">
            <p>{progress.completed_toward_target} / {progress.daily_target} done · {progress.target_progress_pct}%</p>
            <div className="progress"><div className="progress-bar bg-success" style={{ width: `${progress.target_progress_pct}%` }} /></div>
          </Card>
          <Card title={`Today's visits (${visits.length})`}>
            {visits.length === 0 ? <Empty text="No visits in the queue." /> : (
              <table className="table table-sm mb-0">
                <thead><tr><th>Lead</th><th>Visit</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {visits.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.first_name} {lead.last_name}</td>
                      <td>{lead.next_follow_up ? formatDjango(lead.next_follow_up, "M d, h:i A") : "—"}</td>
                      <td><StatusBadge code={lead.status} /></td>
                      <td><Link className="btn btn-xs btn-info" href={reverse("lead_detail", lead.id)}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title={`Pending activities (${activities.length})`}>
            {activities.length === 0 ? <Empty text="No pending activities in the queue." /> : (
              <table className="table table-sm mb-0">
                <thead><tr><th>Lead</th><th>Type</th><th>Scheduled</th><th>Subject</th><th></th></tr></thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>{activity.lead.first_name} {activity.lead.last_name}</td>
                      <td>{shown(activity, "get_activity_type_display")}</td>
                      <td>{activity.scheduled_date ? formatDjango(activity.scheduled_date, "M d, Y") : "—"}</td>
                      <td>{activity.subject}</td>
                      <td><Link className="btn btn-xs btn-info" href={reverse("lead_detail", activity.lead.id)}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {statusLeads.map((section) => (
            <Card key={section.status.code} title={`${section.status.name} (${section.leads.length})`}>
              <table className="table table-sm mb-0">
                <thead><tr><th>Lead</th><th>Source</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {section.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.first_name} {lead.last_name}</td>
                      <td>{lead.source?.name || "—"}</td>
                      <td>{formatDjango(lead.created_at, "M d")}</td>
                      <td><Link className="btn btn-xs btn-info" href={reverse("lead_detail", lead.id)}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
          <Card title={`New leads (${newLeads.length})`}>
            {newLeads.length === 0 ? <Empty text="No new leads left in the queue." /> : (
              <table className="table table-sm mb-0">
                <thead><tr><th>Lead</th><th>Source</th><th></th></tr></thead>
                <tbody>
                  {newLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.first_name} {lead.last_name}</td>
                      <td>{lead.source?.name || "—"}</td>
                      <td><Link className="btn btn-xs btn-info" href={reverse("lead_detail", lead.id)}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

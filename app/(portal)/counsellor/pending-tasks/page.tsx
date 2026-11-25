import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { admittedDueWhere } from "@/modules/admission/admission.service";
import { presentActivity, presentAll, presentLead, presentStudent } from "@/modules/presenters";
import { nextActionChoices } from "@/modules/reference/reference.service";
import { reverse } from "@/http/urls";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { PostButton } from "@/components/client-form";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";
import { deleteLeadActivity, markActivityComplete } from "../_lib/lead-actions";

export const metadata = { title: "My Tasks" };

export default async function PendingTasksPage() {
  const { counsellor } = await counsellorContext();
  const incomplete = await prisma.leadActivity.findMany({
    where: { counsellor_id: counsellor.id, is_completed: false },
    include: { lead: true },
    orderBy: { scheduled_date: "asc" },
  });
  const withNext = await prisma.leadActivity.findMany({
    where: { counsellor_id: counsellor.id, is_completed: true, NOT: { next_action: "" } },
    include: { lead: true },
    orderBy: { completed_date: "desc" },
  });
  const trulyPending = [];
  for (const activity of withNext) {
    // Follow-ups are created as incomplete rows (mapped activity_type), not as
    // activity_type === next_action code.
    const hasFollowup = await prisma.leadActivity.findFirst({
      where: {
        lead_id: activity.lead_id,
        counsellor_id: counsellor.id,
        OR: [
          { is_completed: false, scheduled_date: { gte: activity.completed_date } },
          { completed_date: { gt: activity.completed_date }, subject: { startsWith: "Scheduled visit" } },
        ],
      },
      select: { id: true },
    });
    if (!hasFollowup) trulyPending.push(activity);
  }
  const upcoming = await prisma.lead.findMany({
    where: { assigned_counsellor_id: counsellor.id, next_follow_up: { gte: new Date() } },
    include: { source: true },
    orderBy: { next_follow_up: "asc" },
  });
  const naMap = Object.fromEntries((await nextActionChoices()).filter(([code]) => code));
  const admissionOverdue = counsellor.can_handle_admission_followup
    ? presentAll(
        await prisma.admittedStudent.findMany({
          where: { assigned_counsellor_id: counsellor.id, call_status: { not: "COMPLETED" }, ...admittedDueWhere() },
          orderBy: { next_follow_up: "asc" },
        }),
        (student) => presentStudent(student),
      )
    : [];
  const incompleteRows = presentAll(incomplete, (activity) => presentActivity(activity));
  const pendingNext = presentAll(trulyPending, (activity) => presentActivity(activity));
  const visits = presentAll(upcoming, (lead) => presentLead(lead));

  return (
    <>
      <PageHeader title="My Tasks" />
      <section className="content">
        <div className="container-fluid">
          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Incomplete</div>
                <div className="admin-stat-num">{incompleteRows.length}</div>
                <p className="admin-stat-meta">Open activities to finish</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
                <i className="fas fa-tasks" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Next actions</div>
                <div className="admin-stat-num">{pendingNext.length}</div>
                <p className="admin-stat-meta">Follow-ups still due</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-forward" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Upcoming visits</div>
                <div className="admin-stat-num">{visits.length}</div>
                <p className="admin-stat-meta">Scheduled follow-up visits</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-calendar" />
              </div>
            </div>
          </div>
          <Card title="Incomplete activities">
            {incompleteRows.length === 0 ? <Empty text="All activities are completed!" /> : (
              <table className="table table-bordered table-striped">
                <thead><tr><th>Scheduled</th><th>Lead</th><th>Type</th><th>Subject</th><th>Next Action</th><th></th></tr></thead>
                <tbody>
                  {incompleteRows.map((activity) => (
                    <tr key={activity.id}>
                      <td>{activity.scheduled_date ? formatDjango(activity.scheduled_date, "M d, Y H:i") : "Not scheduled"}</td>
                      <td><Link href={reverse("lead_detail", activity.lead.id)}>{activity.lead.first_name} {activity.lead.last_name}</Link></td>
                      <td>{shown(activity, "get_activity_type_display")}</td>
                      <td>{activity.subject}</td>
                      <td>{activity.next_action ? (naMap[activity.next_action] ?? activity.next_action) : "—"}</td>
                      <td className="text-nowrap">
                        <PostButton className="btn btn-sm btn-success mr-1" action={markActivityComplete.bind(null, activity.lead.id, activity.id)}>Complete</PostButton>
                        <Link className="btn btn-sm btn-warning mr-1" href={reverse("edit_lead_activity", activity.lead.id, activity.id)}>Edit</Link>
                        <PostButton className="btn btn-sm btn-danger" confirm="Delete this activity?" action={deleteLeadActivity.bind(null, activity.lead.id, activity.id)}>Delete</PostButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Pending next actions">
            {pendingNext.length === 0 ? <Empty text="No pending next actions." /> : (
              <table className="table table-sm table-striped">
                <thead><tr><th>Completed</th><th>Lead</th><th>Subject</th><th>Next action</th></tr></thead>
                <tbody>
                  {pendingNext.map((activity) => (
                    <tr key={activity.id}>
                      <td>{activity.completed_date ? formatDjango(activity.completed_date, "M d, Y H:i") : "—"}</td>
                      <td><Link href={reverse("lead_detail", activity.lead.id)}>{activity.lead.first_name} {activity.lead.last_name}</Link></td>
                      <td>{activity.subject}</td>
                      <td>{naMap[activity.next_action] ?? activity.next_action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Upcoming visits">
            {visits.length === 0 ? <Empty text="No upcoming visits." /> : (
              <table className="table table-sm">
                <thead><tr><th>When</th><th>Lead</th><th>Status</th></tr></thead>
                <tbody>
                  {visits.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.next_follow_up ? formatDjango(lead.next_follow_up, "M d, Y H:i") : "—"}</td>
                      <td><Link href={reverse("lead_detail", lead.id)}>{lead.first_name} {lead.last_name}</Link></td>
                      <td><StatusBadge code={lead.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {counsellor.can_handle_admission_followup ? (
            <Card title="Admission calls overdue">
              {admissionOverdue.length === 0 ? <Empty text="No overdue admission calls." /> : (
                <table className="table table-sm">
                  <thead><tr><th>Student</th><th>Phone</th><th>Status</th><th>Next call</th></tr></thead>
                  <tbody>
                    {admissionOverdue.map((student) => (
                      <tr key={student.id}>
                        <td><Link href={reverse("counsellor_update_admission_followup", student.id)}>{student.name}</Link></td>
                        <td>{student.phone}</td>
                        <td>{shown(student, "get_call_status_display")}</td>
                        <td>{student.next_follow_up ? formatDjango(student.next_follow_up, "M d, Y H:i") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ) : null}
        </div>
      </section>
    </>
  );
}

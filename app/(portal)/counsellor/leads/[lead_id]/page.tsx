import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { reverse } from "@/http/urls";
import { logDataAccess, maybeAlertLeadViewBurst } from "@/modules/leads/audit";
import { statusHistory } from "@/modules/leads/status-history";
import { presentActivity, presentAll, presentLead } from "@/modules/presenters";
import { leadStatusChoices, nextActionChoices } from "@/modules/reference/reference.service";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, Empty, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";
import { ClientForm, PostButton } from "@/components/client-form";
import { fail, accessActor, shown } from "../../../_lib/access";
import { AlternatePhoneForm } from "../../_lib/alternate-phone-form";
import { ownedLead } from "../../_lib/owned";
import {
  deleteLeadActivity,
  evaluateLeadScore,
  markActivityComplete,
  markFollowupComplete,
  scheduleFollowUp,
  updateLeadStatus,
} from "../../_lib/lead-actions";
import { ActivityViews } from "../../_components/activity-views";
import { RevealPhoneButton } from "../../_components/reveal-phone";

export const metadata = { title: "Lead" };

function masked(phone: string) {
  return `****${phone.slice(-3)}`;
}

async function addAlternatePhone(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead } = await ownedLead(leadId);
  const form = AlternatePhoneForm.create(await formInput(fd));
  if (!(await form.isValid())) {
    await flash("error", "Please provide a valid alternate phone.");
    redirect(reverse("lead_detail", lead.id));
  }
  try {
    await prisma.leadAlternatePhone.create({
      data: { lead_id: lead.id, created_by_id: counsellor.id, phone: form.cleaned_data.phone, label: form.cleaned_data.label ?? "" },
    });
    await flash("success", "Alternate phone added successfully.");
  } catch (err) {
    await flash("error", fail(err, "Could not save alternate phone"));
  }
  redirect(reverse("lead_detail", lead.id));
}

export default async function LeadDetailPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const { user, counsellor, lead: raw } = await ownedLead(requiredId(lead_id));
  const profile = await prisma.counsellor.findUniqueOrThrow({ where: { id: counsellor.id }, include: { admin: true } });
  const activities = presentAll(
    await prisma.leadActivity.findMany({
      where: { lead_id: raw.id },
      include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
      orderBy: [{ completed_date: "desc" }, { id: "desc" }],
    }),
    (activity) => presentActivity(activity),
  );
  await logDataAccess(await accessActor(user.id), "view_lead_detail", { counsellorId: counsellor.id, leadId: raw.id });
  await maybeAlertLeadViewBurst(profile);
  const lead = presentLead(raw);
  const history = await statusHistory(lead.id);
  const statuses = await leadStatusChoices();
  const nextNames = Object.fromEntries(await nextActionChoices());
  const blankPhone = AlternatePhoneForm.create();

  return (
    <>
      <PageHeader title={`Lead: ${lead.first_name} ${lead.last_name}`}>
        <Link className="btn btn-sm btn-default mr-1" href={reverse("my_leads")}>My leads</Link>
        <Link className="btn btn-sm btn-info" href={reverse("edit_my_lead", lead.id)}>Edit</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-8">
              <Card title="Information">
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Lead ID:</strong> {lead.lead_id}</p>
                    <p><strong>Name:</strong> {lead.first_name} {lead.last_name}</p>
                    <p><strong>Email:</strong> {lead.email}</p>
                    <p>
                      <strong>Phone:</strong>{" "}
                      {lead.phone ? <RevealPhoneButton url={reverse("reveal_phone", lead.id)} masked={masked(lead.phone)} /> : <span className="text-muted">Not provided</span>}
                    </p>
                    <p>
                      <strong>Alternate phone:</strong>{" "}
                      {lead.alternate_phone ? (
                        <RevealPhoneButton url={reverse("reveal_alternate_phone", lead.id)} masked={masked(lead.alternate_phone)} which="primary" />
                      ) : <span className="text-muted">Not provided</span>}
                    </p>
                    {lead.alternate_phones.length ? (
                      <ul className="list-unstyled">
                        {lead.alternate_phones.map((alt) => (
                          <li key={alt.id}>
                            <RevealPhoneButton url={reverse("reveal_alternate_phone", lead.id)} masked={masked(alt.phone)} which={String(alt.id)} />
                            {alt.label ? <span className="text-muted"> ({alt.label})</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <ClientForm action={addAlternatePhone.bind(null, lead.id)} markup={formMarkup(blankPhone)} submitLabel="Add Alternate" />
                    <p><strong>City:</strong> {lead.city || "Not provided"}</p>
                    <p><strong>College:</strong> {lead.school_name || "Not provided"}</p>
                    <p><strong>Course / Exam:</strong> {lead.course_interested || "Not provided"}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Status:</strong> <StatusBadge code={lead.status} /></p>
                    {history[0] ? (
                      <p className="small text-muted">Previous: {history[0].from_label} → {history[0].to_label} on {history[0].changed_at ? formatDjango(history[0].changed_at, "M d, Y H:i") : ""}</p>
                    ) : null}
                    <p><strong>Priority:</strong> <PriorityBadge code={lead.priority} /></p>
                    <p><strong>Conversion score:</strong> {lead.conversion_score ?? "Not evaluated"}</p>
                    <p><strong>Source:</strong> {lead.source?.name}</p>
                    <p><strong>Address:</strong> {[lead.address, lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "Not provided"}</p>
                    <p><strong>Postal code:</strong> {lead.postal_code || "Not provided"}</p>
                    <p><strong>Last contact:</strong> {lead.last_contact_date ? formatDjango(lead.last_contact_date, "M d, Y H:i") : "Never"}</p>
                    <p><strong>Next visit:</strong> {lead.next_follow_up ? formatDjango(lead.next_follow_up, "M d, Y H:i") : "Not scheduled"}</p>
                  </div>
                </div>
                <p className="mb-0"><strong>Notes:</strong> {lead.notes || "No notes available"}</p>
              </Card>
              <Card title="Status history">
                {history.length === 0 ? <Empty text="No status changes yet." /> : (
                  <ul className="list-unstyled mb-0">
                    {history.map((row, index) => (
                      <li key={index} className="mb-2">
                        {row.from_label} → {row.to_label}
                        <span className="text-muted"> · {row.changed_at ? formatDjango(row.changed_at, "M d, Y H:i") : ""} {row.changed_by ? `· ${row.changed_by}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Activities" tools={<Link className="btn btn-primary btn-sm" href={reverse("add_lead_activity", lead.id)}>Add Activity</Link>}>
                <ActivityViews eventsUrl={reverse("get_lead_calendar_events", lead.id)}>
                  {activities.length === 0 ? <Empty text="No activities logged yet." /> : (
                    <div className="timeline">
                      {activities.map((activity) => (
                        <div key={activity.id} className="mb-3 border-bottom pb-2">
                          <div>
                            <strong>{shown(activity, "get_activity_type_display")}</strong> · {activity.subject}
                            {activity.is_completed ? <span className="badge badge-success ml-2">Completed</span> : <span className="badge badge-warning ml-2">Pending</span>}
                          </div>
                          <div>{activity.description}</div>
                          <small className="text-muted">
                            Duration: {activity.duration} min
                            {activity.completed_date ? ` · ${formatDjango(activity.completed_date, "M d, Y H:i")}` : ""}
                            {activity.outcome ? ` · Outcome: ${activity.outcome}` : ""}
                            {activity.next_action ? ` · Next: ${nextNames[activity.next_action] ?? activity.next_action}` : ""}
                            {shown(activity, "admin_logger_name") ? ` · Logged by admin: ${shown(activity, "admin_logger_name")}` : ""}
                          </small>
                          <div className="mt-1">
                            {!activity.is_completed ? (
                              <PostButton className="btn btn-sm btn-success mr-1" action={markActivityComplete.bind(null, lead.id, activity.id)}>Mark Complete</PostButton>
                            ) : null}
                            {activity.counsellor_id === profile.id ? (
                              <>
                                <Link className="btn btn-sm btn-info mr-1" href={reverse("edit_lead_activity", lead.id, activity.id)}>Edit</Link>
                                <PostButton className="btn btn-sm btn-danger" confirm="Delete this activity?" action={deleteLeadActivity.bind(null, lead.id, activity.id)}>Delete</PostButton>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ActivityViews>
              </Card>
            </div>
            <div className="col-md-4">
              {lead.next_follow_up ? (
                <Card title="Next visit">
                  <p>{formatDjango(lead.next_follow_up, "M d, Y")} at {formatDjango(lead.next_follow_up, "H:i")}</p>
                  <PostButton className="btn btn-success btn-block" confirm="Mark this visit as completed?" action={markFollowupComplete.bind(null, lead.id)}>
                    Mark Visit as Complete
                  </PostButton>
                </Card>
              ) : null}
              <Card title="Quick actions">
                <Link className="btn btn-success btn-block mb-2" href={reverse("add_lead_activity", lead.id)}>Add Activity</Link>
                <PostButton className="btn btn-outline-primary btn-block mb-2" action={evaluateLeadScore.bind(null, lead.id)}>Evaluate Conversion Score</PostButton>
                {lead.status === "QUALIFIED" ? (
                  <Link className="btn btn-primary btn-block mb-2" href={reverse("create_business", lead.id)}>Create Business</Link>
                ) : null}
                <Link className="btn btn-secondary btn-block mb-2" href={reverse("request_lead_transfer", lead.id)}>Request Transfer</Link>
                <Link className="btn btn-danger btn-block" href={reverse("mark_lead_lost", lead.id)}>Mark as Lost</Link>
              </Card>
              <Card title="Update status">
                <form action={updateLeadStatus.bind(null, lead.id)}>
                  <div className="form-group">
                    <select className="form-control" name="status" defaultValue={lead.status} required>
                      {statuses.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-block" type="submit">Update</button>
                </form>
              </Card>
              <Card title={lead.next_follow_up ? "Reschedule visit" : "Schedule visit"}>
                <form action={scheduleFollowUp.bind(null, lead.id)}>
                  <div className="form-group">
                    <label htmlFor="follow_up_date">Visit date and time</label>
                    <input className="form-control" id="follow_up_date" name="follow_up_date" type="datetime-local" required />
                  </div>
                  <button className="btn btn-primary btn-block" type="submit">Save</button>
                </form>
              </Card>
              <Card title="Timeline">
                <p className="mb-1">Created {formatDjango(lead.created_at, "M d, Y")}</p>
                {lead.assigned_counsellor ? <p className="mb-0">Assigned to {lead.assigned_counsellor.admin.first_name} {lead.assigned_counsellor.admin.last_name}</p> : null}
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

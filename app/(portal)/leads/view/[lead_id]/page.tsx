import Link from "next/link";
import { notFound } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { parseLeadNoteMeta } from "@/modules/leads/lead.forms";
import { statusHistory } from "@/modules/leads/status-history";
import { fullName, presentActivity, presentAll, presentBusiness, presentLead } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { requiredId } from "@/server/request";
import { formatDay, formatStamp, presentedString, routeLabel, truncateChars } from "../../format";
import { deleteLeadActivity, manualRoute } from "../../mutations";

export const metadata = { title: "Lead Details" };

function businessBadge(status: string) {
  const color = status === "ACTIVE" ? "success" : status === "COMPLETED" ? "primary" : status === "CANCELLED" ? "danger" : "secondary";
  const label = status === "ACTIVE" ? "Active" : status === "COMPLETED" ? "Completed" : status === "CANCELLED" ? "Cancelled" : status;
  return <span className={`badge badge-${color}`}>{label}</span>;
}

export default async function ViewLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  const user = await requireAdmin();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { assigned_counsellor: { include: { admin: true } }, source: true },
  });
  if (!lead) notFound();
  const [activities, business, history] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { lead_id: leadId },
      include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
      orderBy: [{ completed_date: "desc" }, { id: "desc" }],
    }),
    prisma.business.findFirst({ where: { lead_id: leadId }, orderBy: { id: "asc" } }),
    statusHistory(leadId),
  ]);
  presentLead(lead);
  presentAll(activities, (activity) => presentActivity(activity));
  const shownBusiness = presentBusiness(business);
  const superadmin = Boolean(user.admin_profile?.is_superadmin);
  const latest = history[0];
  const noteParts = parseLeadNoteMeta(lead.notes ?? "");
  const courseParts = String(lead.course_interested ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const specialization = courseParts[0] ?? lead.course_interested ?? "";
  const targetExam = noteParts.meta.target_exam || courseParts[1] || "";

  return (
    <>
      <PageHeader title={`Lead Details - ${lead.first_name} ${lead.last_name}`} />
      <section className="content">
        <div className="container-fluid">
          <Card
            title="Lead Information"
            tools={
              <div className="btn-group">
                {lead.assigned_counsellor ? (
                  <form action={reverse("admin_run_ai_workflow", lead.id)} method="post" className="d-inline">
                    <button className="btn btn-info btn-sm" type="submit">Run AI Workflow</button>
                  </form>
                ) : (
                  <button className="btn btn-info btn-sm" type="button" disabled title="Lead must be assigned to a counsellor to run AI workflow">
                    Run AI Workflow
                  </button>
                )}
                <a href="#manual-route" className="btn btn-primary btn-sm">Manual Route</a>
                <Link href={reverse("edit_lead", lead.id)} className="btn btn-warning btn-sm">Edit Lead</Link>
                <Link href={reverse("manage_leads")} className="btn btn-secondary btn-sm">Back to Leads</Link>
              </div>
            }
          >
            {lead.assigned_counsellor ? null : (
              <div className="alert alert-warning">
                This lead is not assigned to any counsellor. AI Workflow requires a counsellor assignment to function properly.
              </div>
            )}
            <div className="row">
              <div className="col-md-6">
                <h5>Basic Information</h5>
                <table className="table table-borderless">
                  <tbody>
                    <tr><td><strong>Lead ID:</strong></td><td>{lead.lead_id}</td></tr>
                    <tr><td><strong>Name:</strong></td><td>{lead.first_name} {lead.last_name}</td></tr>
                    <tr><td><strong>Email:</strong></td><td>{lead.email}</td></tr>
                    <tr>
                      <td><strong>Phone:</strong></td>
                      <td>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : <span className="text-muted">Not provided</span>}</td>
                    </tr>
                    <tr>
                      <td><strong>Alternate Phone:</strong></td>
                      <td>{lead.alternate_phone ? <a href={`tel:${lead.alternate_phone}`}>{lead.alternate_phone}</a> : <span className="text-muted">Not provided</span>}</td>
                    </tr>
                    <tr><td><strong>City:</strong></td><td>{lead.city || "Not provided"}</td></tr>
                    <tr><td><strong>College:</strong></td><td>{lead.school_name || "Not provided"}</td></tr>
                    <tr><td><strong>Specialization:</strong></td><td>{specialization || "Not provided"}</td></tr>
                    <tr><td><strong>Target Exam:</strong></td><td>{targetExam || "Not provided"}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="col-md-6">
                <h5>Profile Details</h5>
                <table className="table table-borderless">
                  <tbody>
                    <tr><td><strong>Percentile / Score:</strong></td><td>{noteParts.meta.percentile || "Not provided"}</td></tr>
                    <tr><td><strong>Work Experience:</strong></td><td>{noteParts.meta.work_experience || "Not provided"}</td></tr>
                    <tr><td><strong>Academic Background:</strong></td><td>{noteParts.meta.academic_background || "Not provided"}</td></tr>
                    <tr><td><strong>Budget:</strong></td><td>{noteParts.meta.budget || "Not provided"}</td></tr>
                    <tr><td><strong>Campaign / Form:</strong></td><td>{lead.source_campaign || "Not provided"}</td></tr>
                    <tr><td><strong>Address:</strong></td><td>{lead.address || "Not provided"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-md-6">
                <h5>Lead Status</h5>
                <table className="table table-borderless">
                  <tbody>
                    <tr>
                      <td><strong>Status:</strong></td>
                      <td>
                        <StatusBadge code={lead.status} />
                        {latest ? (
                          <div className="small text-muted mt-1">
                            Previous: <strong>{latest.from_label}</strong> → {latest.to_label} on {formatStamp(latest.changed_at)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    <tr><td><strong>Priority:</strong></td><td><PriorityBadge code={lead.priority} /></td></tr>
                    <tr><td><strong>Conversion Score:</strong></td><td>{lead.conversion_score ?? 0}%</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="col-md-6">
                <h5>Assignment & Source</h5>
                <table className="table table-borderless">
                  <tbody>
                    <tr>
                      <td><strong>Assigned Counsellor:</strong></td>
                      <td>{lead.assigned_counsellor ? fullName(lead.assigned_counsellor.admin) : <span className="text-muted">Not assigned</span>}</td>
                    </tr>
                    <tr><td><strong>Lead Source:</strong></td><td>{lead.source.name}</td></tr>
                    <tr><td><strong>Created:</strong></td><td>{formatStamp(lead.created_at)}</td></tr>
                    <tr><td><strong>Last Updated:</strong></td><td>{formatStamp(lead.updated_at)}</td></tr>
                    <tr>
                      <td><strong>Last Contact:</strong></td>
                      <td>{lead.last_contact_date ? formatStamp(lead.last_contact_date) : <span className="text-muted">Never</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {lead.routed_to ? (
              <div className="alert alert-info mt-3">
                <div className="row">
                  <div className="col-md-6"><strong>Routed To:</strong> <span className="badge badge-primary">{routeLabel(lead.routed_to)}</span></div>
                  <div className="col-md-6"><strong>Routing Reason:</strong> {lead.routing_reason || "No reason provided"}</div>
                </div>
              </div>
            ) : null}
            <div className="mt-3">
              <h5>Notes</h5>
              {noteParts.freeform ? (
                <div className="alert alert-info mb-0" style={{ whiteSpace: "pre-wrap" }}>{noteParts.freeform}</div>
              ) : (
                <p className="text-muted mb-0">No counsellor notes. Exam and profile details are listed above.</p>
              )}
            </div>
          </Card>

          <Card title="Status history">
            {history.length === 0 ? (
              <Empty text="No status changes recorded yet. After you update this lead’s status, previous and new values will appear here with the date and time of each change." />
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0">
                  <thead>
                    <tr>
                      <th>Date & time</th>
                      <th>Previous status</th>
                      <th />
                      <th>New status</th>
                      <th>Changed by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, index) => (
                      <tr key={`${row.activity.id}-${index}`}>
                        <td className="text-nowrap">{formatStamp(row.changed_at)}</td>
                        <td>{row.from_code ? <StatusBadge code={row.from_code} /> : <span className="text-muted">{row.from_label}</span>}</td>
                        <td className="text-center text-muted">→</td>
                        <td>{row.to_code ? <StatusBadge code={row.to_code} /> : <span className="badge badge-secondary">{row.to_label}</span>}</td>
                        <td>{row.changed_by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Counsellor Activities"
            tools={
              superadmin && lead.assigned_counsellor ? (
                <Link href={reverse("admin_add_lead_activity", lead.id)} className="btn btn-success btn-sm">Add Activity</Link>
              ) : superadmin ? (
                <span className="text-muted small">Assign a counsellor to add activities</span>
              ) : null
            }
          >
            {activities.length === 0 ? (
              <Empty text="No activities recorded for this lead yet." />
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Logged</th>
                      <th>Updated</th>
                      <th>Type</th>
                      <th>Subject</th>
                      <th>Description</th>
                      <th>Outcome</th>
                      <th>Status</th>
                      <th>Counsellor</th>
                      <th>Logged by admin</th>
                      {superadmin ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => {
                      const loggerName = presentedString(activity, "admin_logger_name");
                      return (
                        <tr key={activity.id}>
                          <td className="text-nowrap">{formatStamp(activity.completed_date)}</td>
                          <td className="text-nowrap">{activity.edited_at ? formatStamp(activity.edited_at) : "—"}</td>
                          <td><span className="badge badge-primary">{presentedString(activity, "get_activity_type_display")}</span></td>
                          <td>{activity.subject || "—"}</td>
                          <td>{truncateChars(activity.description, 80)}</td>
                          <td>{activity.outcome ? <span className="badge badge-success">{activity.outcome}</span> : <span className="text-muted">—</span>}</td>
                          <td>{activity.is_completed ? <span className="badge badge-success">Done</span> : <span className="badge badge-warning">Pending</span>}</td>
                          <td>{fullName(activity.counsellor.admin)}</td>
                          <td>{loggerName || "—"}</td>
                          {superadmin ? (
                            <td className="text-nowrap">
                              <Link href={reverse("admin_edit_lead_activity", lead.id, activity.id)} className="btn btn-info btn-sm mr-1">Edit</Link>
                              <PostButton
                                action={deleteLeadActivity.bind(null, lead.id, activity.id)}
                                className="btn btn-danger btn-sm"
                                confirm="Delete this activity?"
                              >
                                Delete
                              </PostButton>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {shownBusiness ? (
            <Card title="Business Information">
              <div className="row">
                <div className="col-md-6">
                  <table className="table table-borderless">
                    <tbody>
                      <tr><td><strong>Business ID:</strong></td><td>{shownBusiness.business_id}</td></tr>
                      <tr><td><strong>Title:</strong></td><td>{shownBusiness.title}</td></tr>
                      <tr><td><strong>Value:</strong></td><td>${String(shownBusiness.value)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-md-6">
                  <table className="table table-borderless">
                    <tbody>
                      <tr><td><strong>Status:</strong></td><td>{businessBadge(shownBusiness.status)}</td></tr>
                      <tr><td><strong>Start Date:</strong></td><td>{formatDay(shownBusiness.start_date)}</td></tr>
                      <tr><td><strong>End Date:</strong></td><td>{shownBusiness.end_date ? formatDay(shownBusiness.end_date) : <span className="text-muted">Ongoing</span>}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ) : null}

          <Card title="Manual Student Routing">
            <form id="manual-route" action={manualRoute.bind(null, lead.id)}>
              <div className="form-group">
                <label htmlFor="route_to">Route Student To:</label>
                <select className="form-control" id="route_to" name="route_to" required defaultValue="">
                  <option value="">Select routing option...</option>
                  <option value="undergraduate_counselor">Undergraduate Counselor</option>
                  <option value="graduate_counselor">Graduate Counselor</option>
                  <option value="specialized_department">Specialized Department</option>
                  <option value="senior_counselor">Senior Counselor</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="custom_reason">Custom Reason (Optional):</label>
                <textarea className="form-control" id="custom_reason" name="custom_reason" rows={3} placeholder="Enter custom routing reason..." />
              </div>
              <div className="alert alert-info">
                <strong>Routing Effects:</strong>
                <ul className="mb-0 mt-2">
                  <li><strong>Undergraduate Counselor:</strong> Status → Qualified, Priority → Medium</li>
                  <li><strong>Graduate Counselor:</strong> Status → Qualified, Priority → High</li>
                  <li><strong>Specialized Department:</strong> Status → Proposal Sent, Priority → High</li>
                  <li><strong>Senior Counselor:</strong> Status → Negotiation, Priority → Urgent</li>
                </ul>
              </div>
              <button type="submit" className="btn btn-primary">Route Student</button>
            </form>
          </Card>
        </div>
      </section>
    </>
  );
}

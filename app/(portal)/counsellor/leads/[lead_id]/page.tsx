import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { reverse } from "@/http/urls";
import { logDataAccess, maybeAlertLeadViewBurst } from "@/modules/leads/audit";
import { profileEditHistory } from "@/modules/leads/field-history";
import { parseLeadNoteMeta } from "@/modules/leads/lead.forms";
import { statusHistory } from "@/modules/leads/status-history";
import { presentActivity, presentAll, presentLead } from "@/modules/presenters";
import { LEAD_PRIORITIES, leadStatusChoices, nextActionChoices } from "@/modules/reference/reference.service";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { readSearch, requiredId, type SearchParams } from "@/server/request";
import { PriorityBadge, StatusBadge } from "@/components/ui";
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
  updateLeadPriority,
  updateLeadStatus,
} from "../../_lib/lead-actions";

const BUSINESS_READY = new Set([
  "QUALIFIED",
  "COUNSELLING_COMPLETED",
  "APPLICATION_IN_PROGRESS",
  "APPLICATION_SUBMITTED",
  "ADMISSION_OFFERED",
  "CONVERTED",
]);

function whatsappHref(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}
import { ActivityViews } from "../../_components/activity-views";
import { LeadNotesEditButton, LeadNotesEditor } from "../../_components/lead-notes-editor";
import { QuickOutcomeForm } from "../../_components/quick-outcome-form";
import { RevealPhoneButton } from "../../_components/reveal-phone";

export const metadata = { title: "Lead | Bschool Bridge" };

function masked(phone: string) {
  return `****${phone.slice(-3)}`;
}

function activityIconAndColor(type: string): { icon: string; bg: string; color: string } {
  const t = (type || "").toUpperCase();
  if (t.includes("CALL") || t.includes("PHONE")) {
    return { icon: "fas fa-phone-alt", bg: "#eff6ff", color: "#2563eb" };
  }
  if (t.includes("WHATSAPP") || t.includes("CHAT") || t.includes("MESSAGE")) {
    return { icon: "fab fa-whatsapp", bg: "#ecfdf5", color: "#059669" };
  }
  if (t.includes("MEET") || t.includes("COUNSEL") || t.includes("VISIT") || t.includes("FOLLOW")) {
    return { icon: "fas fa-handshake", bg: "#f5f3ff", color: "#7c3aed" };
  }
  if (t.includes("EMAIL") || t.includes("MAIL")) {
    return { icon: "fas fa-envelope", bg: "#f0fdfa", color: "#0d9488" };
  }
  if (t.includes("NOTE") || t.includes("REMARK")) {
    return { icon: "fas fa-sticky-note", bg: "#fffbeb", color: "#d97706" };
  }
  if (t.includes("TRANSFER")) {
    return { icon: "fas fa-share", bg: "#f1f5f9", color: "#475569" };
  }
  return { icon: "fas fa-clipboard-check", bg: "#f1f5f9", color: "#475569" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="crm-field">
      <span className="crm-field-label">{label}</span>
      <div className="crm-field-value">{children}</div>
    </div>
  );
}

function valueOrMuted(value: string | null | undefined, empty = "Not provided") {
  const text = (value ?? "").trim();
  return text ? text : <span className="text-muted">{empty}</span>;
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

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lead_id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lead_id } = await params;
  const query = await readSearch(searchParams);
  const editingNotes = query.edit_notes === "1";
  const { user, counsellor, lead: raw } = await ownedLead(requiredId(lead_id));
  const profile = await prisma.counsellor.findUniqueOrThrow({ where: { id: counsellor.id }, include: { admin: true } });
  const activities = presentAll(
    await prisma.leadActivity.findMany({
      where: {
        lead_id: raw.id,
        activity_type: { notIn: ["STATUS_CHANGE", "PROFILE_EDIT"] },
      },
      include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
      orderBy: [{ completed_date: "desc" }, { id: "desc" }],
    }),
    (activity) => presentActivity(activity),
  );
  await logDataAccess(await accessActor(user.id), "view_lead_detail", { counsellorId: counsellor.id, leadId: raw.id });
  await maybeAlertLeadViewBurst(profile);
  const lead = presentLead(raw);
  const [history, profileEdits, statuses, nextActionRows] = await Promise.all([
    statusHistory(lead.id),
    profileEditHistory(lead.id),
    leadStatusChoices(),
    nextActionChoices(),
  ]);
  const nextNames = Object.fromEntries(nextActionRows);
  const blankPhone = AlternatePhoneForm.create();
  const fullName = `${lead.first_name} ${lead.last_name}`.trim();
  const addressLine = [lead.address, lead.city, lead.state, lead.country, lead.postal_code].filter(Boolean).join(", ");
  const noteParts = parseLeadNoteMeta(lead.notes ?? "");
  const courseParts = String(lead.course_interested ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const specialization = courseParts[0] ?? "";
  const targetExam = noteParts.meta.target_exam || courseParts[1] || "";
  const statusLabel = statuses.find(([code]) => code === lead.status)?.[1] ?? lead.status;
  const waLink = whatsappHref(lead.whatsapp_phone || lead.phone);
  const canCreateBusiness = BUSINESS_READY.has(lead.status);

  return (
    <div className="crm-lead-page">
      <header className="crm-lead-header">
        <div className="crm-lead-header-top">
          <div>
            <div className="crm-lead-id">{lead.lead_id}</div>
            <h1>{fullName}</h1>
            <div className="crm-lead-header-meta">
              <StatusBadge code={lead.status} />
              <PriorityBadge code={lead.priority} />
              {lead.source?.name ? (
                <span className="badge badge-light" style={{ background: "rgba(255,255,255,0.12)", color: "#e2e8f0" }}>
                  {lead.source.name}
                </span>
              ) : null}
              {lead.conversion_score != null ? (
                <span className="badge badge-light" style={{ background: "rgba(255,255,255,0.12)", color: "#e2e8f0" }}>
                  Score {lead.conversion_score}%
                </span>
              ) : null}
            </div>
          </div>
          <div className="crm-lead-actions">
            <Link className="btn btn-light btn-sm" href={reverse("my_leads")}>
              <i className="fas fa-arrow-left" /> My leads
            </Link>
            {lead.phone ? (
              <a className="btn btn-success btn-sm" href={`tel:${lead.phone}`}>
                <i className="fas fa-phone" /> Call
              </a>
            ) : null}
            {waLink ? (
              <a className="btn btn-success btn-sm" href={waLink} target="_blank" rel="noreferrer">
                <i className="fab fa-whatsapp" /> WhatsApp
              </a>
            ) : null}
            <Link className="btn btn-primary btn-sm" href={reverse("add_lead_activity", lead.id)}>
              <i className="fas fa-plus" /> Add activity
            </Link>
            <Link className="btn btn-warning btn-sm" href={reverse("edit_my_lead", lead.id)}>
              <i className="fas fa-pen" /> Edit profile
            </Link>
          </div>
        </div>
      </header>

      <section className="crm-lead-status-panel" aria-label="Lead status options">
        <p className="crm-lead-status-panel-title">Lead status · current: {statusLabel}</p>
        <div className="crm-status-chip-row">
          {statuses.map(([code, name]) => (
            <form key={code} action={updateLeadStatus.bind(null, lead.id)}>
              <input type="hidden" name="status" value={code} />
              <button
                type="submit"
                className={`crm-status-chip${lead.status === code ? " is-active" : ""}`}
                disabled={lead.status === code}
                title={lead.status === code ? "Current status" : `Set status to ${name}`}
              >
                {name}
              </button>
            </form>
          ))}
        </div>
      </section>

      <div className="row">
        <div className="col-lg-8">
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-user crm-card-title-icon" /> Lead profile
              </h3>
              <Link
                href={reverse("edit_my_lead", lead.id)}
                className="btn btn-sm btn-outline-primary"
                style={{ borderRadius: "8px", fontWeight: 600 }}
              >
                Edit all fields
              </Link>
            </div>
            <div className="crm-card-body">
              <h4 className="crm-section-title">Contact</h4>
              <div className="crm-field-grid mb-4">
                <Field label="Email">{valueOrMuted(lead.email)}</Field>
                <Field label="Phone">
                  {lead.phone ? (
                    <RevealPhoneButton url={reverse("reveal_phone", lead.id)} masked={masked(lead.phone)} />
                  ) : (
                    <span className="text-muted">Not provided</span>
                  )}
                </Field>
                <Field label="Alternate phone">
                  {lead.alternate_phone ? (
                    <RevealPhoneButton
                      url={reverse("reveal_alternate_phone", lead.id)}
                      masked={masked(lead.alternate_phone)}
                      which="primary"
                    />
                  ) : (
                    <span className="text-muted">Not provided</span>
                  )}
                </Field>
                <Field label="WhatsApp">{valueOrMuted(lead.whatsapp_phone)}</Field>
                <Field label="Preferred language">{valueOrMuted(lead.preferred_language)}</Field>
                <Field label="City">{valueOrMuted(lead.city)}</Field>
              </div>

              {lead.alternate_phones.length > 0 ? (
                <>
                  <h4 className="crm-section-title">Extra phone numbers</h4>
                  <ul className="crm-alt-phone-list mb-4">
                    {lead.alternate_phones.map((alt) => (
                      <li key={alt.id}>
                        <RevealPhoneButton
                          url={reverse("reveal_alternate_phone", lead.id)}
                          masked={masked(alt.phone)}
                          which={String(alt.id)}
                        />
                        {alt.label ? <span className="text-muted">({alt.label})</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h4 className="crm-section-title">Add alternate phone</h4>
              <div className="mb-4">
                <ClientForm action={addAlternatePhone.bind(null, lead.id)} markup={formMarkup(blankPhone)} submitLabel="Add phone" />
              </div>

              <h4 className="crm-section-title">Academic & interest</h4>
              <div className="crm-field-grid mb-4">
                <Field label="College / school">{valueOrMuted(lead.school_name)}</Field>
                <Field label="Specialization">{valueOrMuted(specialization || lead.course_interested)}</Field>
                <Field label="Target exam">{valueOrMuted(targetExam)}</Field>
                <Field label="Percentile / score">{valueOrMuted(noteParts.meta.percentile)}</Field>
                <Field label="Work experience">{valueOrMuted(noteParts.meta.work_experience)}</Field>
                <Field label="Academic background">{valueOrMuted(noteParts.meta.academic_background)}</Field>
                <Field label="Budget">{valueOrMuted(noteParts.meta.budget)}</Field>
                <Field label="Graduated?">{valueOrMuted(shown(lead, "get_graduation_status_display") || lead.graduation_status)}</Field>
                <Field label="Graduation course">
                  {valueOrMuted(
                    ["Not Specified", "Not Applicable"].includes(lead.graduation_course) ? "" : lead.graduation_course,
                  )}
                </Field>
                <Field label="Graduation year">
                  {lead.graduation_year ? lead.graduation_year : <span className="text-muted">Not provided</span>}
                </Field>
                <Field label="Graduation college">
                  {valueOrMuted(
                    ["Not Specified", "Not Applicable"].includes(lead.graduation_college) ? "" : lead.graduation_college,
                  )}
                </Field>
              </div>

              <h4 className="crm-section-title">Career & value</h4>
              <div className="crm-field-grid mb-4">
                <Field label="Current role / position">{valueOrMuted(lead.position)}</Field>
                <Field label="Industry">{valueOrMuted(lead.industry)}</Field>
                <Field label="Website">{valueOrMuted(lead.website)}</Field>
                <Field label="LinkedIn">{valueOrMuted(lead.linkedin)}</Field>
                <Field label="Expected fee / value">
                  {lead.expected_value && String(lead.expected_value) !== "0"
                    ? String(lead.expected_value)
                    : <span className="text-muted">Not provided</span>}
                </Field>
                <Field label="Conversion score">
                  {lead.conversion_score != null ? `${lead.conversion_score}%` : <span className="text-muted">Not evaluated</span>}
                </Field>
              </div>

              <h4 className="crm-section-title">Source & location</h4>
              <div className="crm-field-grid">
                <Field label="Lead source">{valueOrMuted(lead.source?.name)}</Field>
                <Field label="Campaign / form">{valueOrMuted(lead.source_campaign)}</Field>
                <Field label="Lead status"><StatusBadge code={lead.status} /></Field>
                <Field label="Priority"><PriorityBadge code={lead.priority} /></Field>
                <Field label="Address">{valueOrMuted(addressLine)}</Field>
                <Field label="Postal code">{valueOrMuted(lead.postal_code)}</Field>
                <Field label="Last contact">
                  {lead.last_contact_date ? formatDjango(lead.last_contact_date, "M d, Y H:i") : <span className="text-muted">Never</span>}
                </Field>
                <Field label="Next visit">
                  {lead.next_follow_up ? formatDjango(lead.next_follow_up, "M d, Y H:i") : <span className="text-muted">Not scheduled</span>}
                </Field>
              </div>

              {history[0] ? (
                <p className="small text-muted mb-0 mt-3">
                  Latest status change: {history[0].from_label} → {history[0].to_label}
                  {history[0].changed_at ? ` on ${formatDjango(history[0].changed_at, "M d, Y H:i")}` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <LeadNotesEditor
            leadId={lead.id}
            freeform={noteParts.freeform}
            initiallyEditing={editingNotes}
          />

          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-clock-rotate-left crm-card-title-icon" /> Status history
              </h3>
            </div>
            <div className="crm-card-body">
              {history.length === 0 ? (
                <div className="crm-empty-state">
                  <div className="crm-empty-icon">
                    <i className="fas fa-flag" />
                  </div>
                  <div className="crm-empty-title">No status changes yet</div>
                  <p className="crm-empty-desc">Updates you make will appear here with date and actor.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ color: "#64748b" }}>
                        <th>When</th>
                        <th>From</th>
                        <th />
                        <th>To</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className="text-nowrap">{row.changed_at ? formatDjango(row.changed_at, "M d, Y H:i") : "—"}</td>
                          <td>{row.from_code ? <StatusBadge code={row.from_code} /> : row.from_label}</td>
                          <td className="text-muted text-center">→</td>
                          <td>{row.to_code ? <StatusBadge code={row.to_code} /> : row.to_label}</td>
                          <td>{row.changed_by || "—"}</td>
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
                <i className="fas fa-user-edit crm-card-title-icon" /> Profile change log
              </h3>
              <Link
                href={reverse("edit_my_lead", lead.id)}
                className="btn btn-sm btn-outline-primary"
                style={{ borderRadius: "8px", fontWeight: 600 }}
              >
                Edit details
              </Link>
            </div>
            <div className="crm-card-body">
              {profileEdits.length === 0 ? (
                <div className="crm-empty-state">
                  <div className="crm-empty-icon">
                    <i className="fas fa-user-edit" />
                  </div>
                  <div className="crm-empty-title">No profile edits yet</div>
                  <p className="crm-empty-desc">When you edit this lead&apos;s details, each change set is listed here.</p>
                </div>
              ) : (
                <div className="crm-activity-list">
                  {profileEdits.map((row) => (
                    <div key={row.activity.id} className="crm-activity-item">
                      <div className="crm-activity-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                        <i className="fas fa-user-edit" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: "0.5rem" }}>
                          <span className="crm-activity-lead" style={{ cursor: "default" }}>
                            {row.subject}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
                            {row.changed_at ? formatDjango(row.changed_at, "M d, Y H:i") : "—"}
                          </span>
                        </div>
                        <div className="crm-activity-meta">
                          Edited by <strong>{row.changed_by || "Counsellor"}</strong>
                        </div>
                        {row.changes.length > 0 ? (
                          <ul className="mb-0 mt-2 pl-3" style={{ fontSize: "0.82rem", color: "#334155" }}>
                            {row.changes.map((change) => (
                              <li key={change}>{change}</li>
                            ))}
                          </ul>
                        ) : null}
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
                <i className="fas fa-history crm-card-title-icon" /> Activities
              </h3>
              <Link className="btn btn-primary btn-sm" href={reverse("add_lead_activity", lead.id)} style={{ borderRadius: "8px", fontWeight: 600 }}>
                Add activity
              </Link>
            </div>
            <div className="crm-card-body">
              <ActivityViews eventsUrl={reverse("get_lead_calendar_events", lead.id)}>
                {activities.length === 0 ? (
                  <div className="crm-empty-state">
                    <div className="crm-empty-icon">
                      <i className="far fa-clipboard" />
                    </div>
                    <div className="crm-empty-title">No activities logged yet</div>
                    <p className="crm-empty-desc">Log calls, meetings, and notes to build this lead&apos;s counselling timeline.</p>
                  </div>
                ) : (
                  <div className="crm-activity-list crm-activity-list--scroll">
                    {activities.map((activity) => {
                      const typeLabel = String(shown(activity, "get_activity_type_display") || activity.activity_type);
                      const style = activityIconAndColor(typeLabel);
                      return (
                        <div key={activity.id} className="crm-activity-item">
                          <div className="crm-activity-icon" style={{ background: style.bg, color: style.color }}>
                            <i className={style.icon} />
                          </div>
                          <div className="crm-activity-item-main">
                            <div className="crm-activity-item-top">
                              <div style={{ minWidth: 0 }}>
                                <div className="d-flex align-items-center flex-wrap" style={{ gap: "0.35rem" }}>
                                  <span className="crm-activity-lead" style={{ cursor: "default" }}>
                                    {typeLabel}
                                  </span>
                                  <span className={`badge ${activity.is_completed ? "badge-success" : "badge-warning"}`}>
                                    {activity.is_completed ? "Done" : "Pending"}
                                  </span>
                                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>
                                    {activity.completed_date ? formatDjango(activity.completed_date, "M d, Y H:i") : "—"}
                                  </span>
                                </div>
                                <div className="crm-activity-subject" title={activity.subject}>{activity.subject}</div>
                              </div>
                              <div className="crm-activity-actions">
                                {!activity.is_completed ? (
                                  <PostButton
                                    className="btn btn-sm btn-success"
                                    action={markActivityComplete.bind(null, lead.id, activity.id)}
                                  >
                                    Complete
                                  </PostButton>
                                ) : null}
                                {activity.counsellor_id === profile.id ? (
                                  <>
                                    <Link
                                      className="btn btn-sm btn-outline-primary"
                                      href={reverse("edit_lead_activity", lead.id, activity.id)}
                                    >
                                      Edit
                                    </Link>
                                    <PostButton
                                      className="btn btn-sm btn-outline-danger"
                                      confirm="Delete this activity?"
                                      action={deleteLeadActivity.bind(null, lead.id, activity.id)}
                                    >
                                      Delete
                                    </PostButton>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {activity.description ? (
                              <div className="crm-activity-meta crm-activity-meta--clamp" title={activity.description}>
                                {activity.description}
                              </div>
                            ) : null}
                            <div className="crm-activity-meta">
                              <span>{activity.duration} min</span>
                              {activity.outcome ? <span>· {activity.outcome}</span> : null}
                              {activity.next_action ? (
                                <span>· Next: {nextNames[activity.next_action] ?? activity.next_action}</span>
                              ) : null}
                              {shown(activity, "admin_logger_name") ? (
                                <span>· Admin: {shown(activity, "admin_logger_name")}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ActivityViews>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="crm-side-stack">
            {lead.next_follow_up ? (
              <div className="crm-card">
                <div className="crm-card-header">
                  <h3 className="crm-card-title">
                    <i className="fas fa-calendar-check crm-card-title-icon" /> Next visit
                  </h3>
                </div>
                <div className="crm-card-body">
                  <p className="mb-3" style={{ fontSize: "1.05rem", fontWeight: 600, color: "#0f172a" }}>
                    {formatDjango(lead.next_follow_up, "M d, Y")} at {formatDjango(lead.next_follow_up, "H:i")}
                  </p>
                  <PostButton
                    className="btn btn-success btn-block"
                    confirm="Mark this visit as completed?"
                    action={markFollowupComplete.bind(null, lead.id)}
                  >
                    Mark visit complete
                  </PostButton>
                </div>
              </div>
            ) : null}

            <div className="crm-card">
              <div className="crm-card-header">
                <h3 className="crm-card-title">
                  <i className="fas fa-bolt crm-card-title-icon" /> Quick actions
                </h3>
              </div>
              <div className="crm-card-body">
                <div className="mb-3">
                  <QuickOutcomeForm
                    leadId={lead.id}
                    nextActionChoices={nextActionRows.filter(([code]) => code) as Array<[string, string]>}
                    returnTo="lead"
                  />
                </div>
                <div className="crm-side-actions">
                  {lead.phone ? (
                    <a className="btn btn-outline-success" href={`tel:${lead.phone}`}>
                      <i className="fas fa-phone" /> Call lead
                    </a>
                  ) : null}
                  {waLink ? (
                    <a className="btn btn-outline-success" href={waLink} target="_blank" rel="noreferrer">
                      <i className="fab fa-whatsapp" /> WhatsApp
                    </a>
                  ) : null}
                  <Link className="btn btn-outline-success" href={reverse("add_lead_activity", lead.id)}>
                    <i className="fas fa-plus" /> Log call / activity
                  </Link>
                  <LeadNotesEditButton className="btn btn-outline-primary" />
                  <PostButton className="btn btn-outline-primary" action={evaluateLeadScore.bind(null, lead.id)}>
                    <i className="fas fa-chart-line" /> Evaluate conversion score
                  </PostButton>
                  {canCreateBusiness ? (
                    <Link className="btn btn-outline-primary" href={reverse("create_business", lead.id)}>
                      <i className="fas fa-briefcase" /> Create business / admission
                    </Link>
                  ) : null}
                  <Link className="btn btn-outline-secondary" href={reverse("edit_my_lead", lead.id)}>
                    <i className="fas fa-user-edit" /> Edit full profile
                  </Link>
                  <Link className="btn btn-outline-secondary" href={reverse("request_lead_transfer", lead.id)}>
                    <i className="fas fa-share" /> Request transfer
                  </Link>
                  <Link className="btn btn-outline-danger" href={reverse("mark_lead_lost", lead.id)}>
                    <i className="fas fa-times" /> Mark as lost
                  </Link>
                </div>
              </div>
            </div>

            <div className="crm-card">
              <div className="crm-card-header">
                <h3 className="crm-card-title">
                  <i className="fas fa-flag crm-card-title-icon" /> Status & priority
                </h3>
              </div>
              <div className="crm-card-body">
                <form action={updateLeadStatus.bind(null, lead.id)} className="mb-3">
                  <div className="form-group mb-2">
                    <label htmlFor="lead_status" className="crm-field-label">
                      Lead status
                    </label>
                    <select className="form-control" id="lead_status" name="status" defaultValue={lead.status} required>
                      {statuses.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-block" type="submit" style={{ borderRadius: "8px", fontWeight: 600 }}>
                    Update status
                  </button>
                </form>
                <form action={updateLeadPriority.bind(null, lead.id)}>
                  <div className="form-group mb-2">
                    <label htmlFor="lead_priority" className="crm-field-label">
                      Priority
                    </label>
                    <select className="form-control" id="lead_priority" name="priority" defaultValue={lead.priority} required>
                      {LEAD_PRIORITIES.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-outline-primary btn-block" type="submit" style={{ borderRadius: "8px", fontWeight: 600 }}>
                    Update priority
                  </button>
                </form>
              </div>
            </div>

            <div className="crm-card">
              <div className="crm-card-header">
                <h3 className="crm-card-title">
                  <i className="fas fa-calendar-alt crm-card-title-icon" />
                  {lead.next_follow_up ? "Reschedule visit" : "Schedule visit"}
                </h3>
              </div>
              <div className="crm-card-body">
                <form action={scheduleFollowUp.bind(null, lead.id)}>
                  <div className="form-group mb-3">
                    <label htmlFor="follow_up_date" className="crm-field-label">
                      Visit date and time
                    </label>
                    <input
                      className="form-control"
                      id="follow_up_date"
                      name="follow_up_date"
                      type="datetime-local"
                      required
                    />
                  </div>
                  <button className="btn btn-primary btn-block" type="submit" style={{ borderRadius: "8px", fontWeight: 600 }}>
                    Save visit
                  </button>
                </form>
              </div>
            </div>

            <div className="crm-card">
              <div className="crm-card-header">
                <h3 className="crm-card-title">
                  <i className="fas fa-info-circle crm-card-title-icon" /> Timeline
                </h3>
              </div>
              <div className="crm-card-body">
                <div className="crm-field-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <Field label="Created">{formatDjango(lead.created_at, "M d, Y")}</Field>
                  <Field label="Last updated">{formatDjango(lead.updated_at, "M d, Y H:i")}</Field>
                  {lead.assigned_counsellor ? (
                    <Field label="Assigned to">
                      {lead.assigned_counsellor.admin.first_name} {lead.assigned_counsellor.admin.last_name}
                    </Field>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { logDataAccess } from "@/modules/leads/audit";
import { logLeadProfileChanges } from "@/modules/leads/field-history";
import { LeadForm } from "@/modules/leads/lead.forms";
import { updateLead } from "@/modules/leads/lead.repository";
import { logStatusChange } from "@/modules/leads/status-history";
import { presentLead } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { ClientForm } from "@/components/client-form";
import { accessActor, fail } from "../../../../_lib/access";
import { ownedLead } from "../../../_lib/owned";

export const metadata = { title: "Edit Lead | Bschool Bridge" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { user, counsellor, lead } = await ownedLead(leadId);
  const form = await LeadForm.create("counsellor-edit", { ...(await formInput(fd)), instance: lead });
  if (!(await form.isValid())) {
    await flash("error", "Please correct the errors below.");
    return { markup: formMarkup(form) };
  }
  try {
    const oldStatus = lead.status;
    await updateLead(lead.id, form.leadData() as never);
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    await Promise.all([
      logStatusChange(lead, oldStatus, updated.status, { counsellorId: counsellor.id }),
      logLeadProfileChanges(lead, updated, { counsellorId: counsellor.id }),
      logDataAccess(await accessActor(user.id), "edit_lead", { counsellorId: counsellor.id, leadId: lead.id }),
    ]);
  } catch (err) {
    await flash("error", fail(err, "Could not update lead"));
    return { markup: formMarkup(form) };
  }
  await flash("success", "Lead details updated successfully.");
  redirect(reverse("lead_detail", lead.id));
}

export default async function EditLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const { lead: raw } = await ownedLead(requiredId(lead_id));
  const lead = presentLead(raw);
  const blank = await LeadForm.create("counsellor-edit", { instance: lead });
  return (
    <div className="crm-lead-page">
      <header className="crm-lead-header">
        <div className="crm-lead-header-top">
          <div>
            <div className="crm-lead-id">{lead.lead_id}</div>
            <h1>Edit lead profile</h1>
            <div className="crm-lead-header-meta">
              <span className="badge badge-light" style={{ background: "rgba(255,255,255,0.12)", color: "#e2e8f0" }}>
                {lead.first_name} {lead.last_name}
              </span>
            </div>
          </div>
          <div className="crm-lead-actions">
            <Link className="btn btn-light btn-sm" href={reverse("lead_detail", lead.id)}>
              <i className="fas fa-arrow-left" /> Back to lead
            </Link>
          </div>
        </div>
      </header>
      <div className="crm-card">
        <div className="crm-card-header">
          <h3 className="crm-card-title">
            <i className="fas fa-user-edit crm-card-title-icon" /> Full lead details
          </h3>
          <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px", color: "#64748b" }}>
            Changes are logged
          </span>
        </div>
        <div className="crm-card-body">
          <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
            Update contact, academic, and counselling fields for this assigned lead. Every save is recorded in the profile change log.
          </p>
          <ClientForm action={save.bind(null, lead.id)} markup={formMarkup(blank)} submitLabel="Save lead details" />
        </div>
      </div>
    </div>
  );
}

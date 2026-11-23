import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "@/modules/leads/lead.forms";
import { updateLead } from "@/modules/leads/lead.repository";
import { logStatusChange } from "@/modules/leads/status-history";
import { presentLead } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { fail } from "../../../../_lib/access";
import { ownedLead } from "../../../_lib/owned";

export const metadata = { title: "Edit Lead" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead } = await ownedLead(leadId);
  const form = await LeadForm.create("counsellor-edit", { ...(await formInput(fd)), instance: lead });
  if (!(await form.isValid())) {
    await flash("error", "Please correct the errors below.");
    return { markup: formMarkup(form) };
  }
  try {
    const oldStatus = lead.status;
    await updateLead(lead.id, form.leadData() as never);
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    await logStatusChange(lead, oldStatus, updated.status, { counsellorId: counsellor.id });
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
    <>
      <PageHeader title={`Edit Lead: ${lead.first_name} ${lead.last_name}`} />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Lead: ${lead.first_name} ${lead.last_name}`}>
            <ClientForm action={save.bind(null, lead.id)} markup={formMarkup(blank)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

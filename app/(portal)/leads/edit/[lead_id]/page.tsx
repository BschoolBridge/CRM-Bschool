import Link from "next/link";
import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "@/modules/leads/lead.forms";
import { updateLead } from "@/modules/leads/lead.repository";
import { logStatusChange } from "@/modules/leads/status-history";
import { presentLead } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";
import { failureText } from "../../format";

export const metadata = { title: "Edit Lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  await requireAdmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();
  presentLead(lead);

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    const user = await requireAdmin();
    const current = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!current) notFound();
    const form = await LeadForm.create("admin", { ...(await formInput(fd)), instance: current });
    if (!(await form.isValid())) {
      await flash("error", "Please fill the form properly!");
      return { markup: formMarkup(form) };
    }
    try {
      const updated = await updateLead(current.id, form.leadData() as never);
      await logStatusChange(updated, current.status, form.cleaned_data.status || current.status, {
        counsellorId: updated.assigned_counsellor_id,
        loggedByAdminId: user.id,
      });
      await flash("success", "Lead updated successfully!");
      redirect(reverse("manage_leads"));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", failureText("Could not update lead", err));
      return { markup: formMarkup(form) };
    }
  }

  const form = await LeadForm.create("admin", { instance: lead });
  return (
    <>
      <PageHeader title="Edit Lead" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Lead: ${lead.first_name} ${lead.last_name}`}>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Update Lead" />
            <Link href={reverse("manage_leads")} className="btn btn-secondary mt-3">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

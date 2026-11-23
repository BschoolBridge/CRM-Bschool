import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadTransferForm } from "@/modules/leads/transfer-import.forms";
import { presentLead } from "@/modules/presenters";
import { formInput, formMarkup, recordFromFormData, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { fail } from "../../../../../_lib/access";
import { myLeadsRedirectPath } from "../../../../../_lib/my-leads-filters";
import { ownedLead } from "../../../../_lib/owned";

export const metadata = { title: "Request Lead Transfer" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead } = await ownedLead(leadId);
  const input = await formInput(fd);
  const form = await LeadTransferForm.create(input);
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.leadTransfer.create({
      data: {
        lead_id: lead.id,
        from_counsellor_id: counsellor.id,
        to_counsellor_id: form.cleaned_data.to_counsellor,
        reason: form.cleaned_data.reason,
      },
    });
  } catch (err) {
    await flash("error", fail(err, "Could not submit transfer request"));
    return { markup: formMarkup(form) };
  }
  await flash("success", "Transfer request submitted successfully!");
  redirect(await myLeadsRedirectPath(recordFromFormData(fd)));
}

export default async function RequestTransferPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const { lead: raw } = await ownedLead(requiredId(lead_id));
  const lead = presentLead(raw);
  const blank = await LeadTransferForm.create();
  return (
    <>
      <PageHeader title="Request Lead Transfer">
        <Link className="btn btn-sm btn-secondary" href={reverse("lead_detail", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Transfer ${lead.first_name} ${lead.last_name}`}>
            <ClientForm action={save.bind(null, lead.id)} markup={formMarkup(blank)} submitLabel="Submit" />
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { BusinessForm } from "@/modules/leads/business.form";
import { newBusinessId } from "@/modules/leads/lead-ids";
import { updateLead } from "@/modules/leads/lead.repository";
import { logStatusChange } from "@/modules/leads/status-history";
import { presentLead } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { fail } from "../../../../../_lib/access";
import { ownedLead } from "../../../../_lib/owned";

export const metadata = { title: "Create Business" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead } = await ownedLead(leadId);
  const form = BusinessForm.create(await formInput(fd));
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  let businessId = "";
  try {
    const cleaned = form.cleaned_data;
    businessId = newBusinessId();
    await prisma.business.create({
      data: {
        lead_id: lead.id,
        counsellor_id: counsellor.id,
        business_id: businessId,
        title: cleaned.title,
        description: cleaned.description ?? "",
        value: cleaned.value,
        status: cleaned.status,
        start_date: cleaned.start_date,
        end_date: cleaned.end_date,
        payment_terms: cleaned.payment_terms ?? "",
        notes: cleaned.notes ?? "",
      },
    });
    const oldStatus = lead.status;
    await updateLead(lead.id, { status: "CLOSED_WON", actual_value: cleaned.value });
    await logStatusChange(lead, oldStatus, "CLOSED_WON", { counsellorId: counsellor.id, note: `Business created: ${businessId}` });
  } catch (err) {
    await flash("error", fail(err, "Could not create business"));
    return { markup: formMarkup(form) };
  }
  await flash("success", `Business created successfully! Business ID: ${businessId}`);
  redirect(reverse("my_businesses"));
}

export default async function CreateBusinessPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const { lead: raw } = await ownedLead(requiredId(lead_id));
  const lead = presentLead(raw);
  const blank = BusinessForm.create();
  return (
    <>
      <PageHeader title="Create Business">
        <Link className="btn btn-sm btn-secondary" href={reverse("lead_detail", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Create business — ${lead.first_name} ${lead.last_name}`}>
            <ClientForm action={save.bind(null, lead.id)} markup={formMarkup(blank)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

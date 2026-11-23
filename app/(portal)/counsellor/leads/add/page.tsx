import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { LeadForm } from "@/modules/leads/lead.forms";
import { createLead } from "@/modules/leads/lead.repository";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { fail } from "../../../_lib/access";
import { counsellorContext } from "../../_lib/owned";

export const metadata = { title: "Add Lead" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor } = await counsellorContext();
  const form = await LeadForm.create("counsellor-create", await formInput(fd));
  if (!(await form.isValid())) {
    await flash("error", "Please correct the errors below.");
    return { markup: formMarkup(form) };
  }
  let createdId = 0;
  let createdLeadId = "";
  try {
    const created = await createLead({
      ...(form.leadData() as Record<string, unknown>),
      assigned_counsellor_id: counsellor.id,
    } as Parameters<typeof createLead>[0]);
    createdId = created.id;
    createdLeadId = created.lead_id;
  } catch (err) {
    await flash("error", fail(err, "Could not create lead"));
    return { markup: formMarkup(form) };
  }
  await flash("success", `Lead created successfully. Lead ID: ${createdLeadId}`);
  redirect(reverse("lead_detail", createdId));
}

export default async function AddLeadPage() {
  await counsellorContext();
  const blank = await LeadForm.create("counsellor-create");
  return (
    <>
      <PageHeader title="Add Lead" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add Lead">
            <ClientForm action={save} markup={formMarkup(blank)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

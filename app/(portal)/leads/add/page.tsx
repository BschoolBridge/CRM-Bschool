import Link from "next/link";
import { unstable_rethrow, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { createLead } from "@/modules/leads/lead.repository";
import { LeadForm } from "@/modules/leads/lead.forms";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { failureText } from "../format";

export const metadata = { title: "Add Lead" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requireAdmin();
  const form = await LeadForm.create("admin", await formInput(fd));
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    const lead = await createLead(form.leadData() as never);
    await flash("success", `Lead added successfully! Lead ID: ${lead.lead_id}`);
    redirect(reverse("manage_leads"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Could not add lead", err));
    return { markup: formMarkup(form) };
  }
}

export default async function AddLeadPage() {
  await requireAdmin();
  const form = await LeadForm.create("admin");
  return (
    <>
      <PageHeader title="Add Lead" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Lead">
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Add Lead" />
            <Link href={reverse("manage_leads")} className="btn btn-secondary mt-3">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

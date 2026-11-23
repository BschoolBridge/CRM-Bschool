import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadSourceForm } from "@/modules/reference/reference.forms";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const metadata = { title: "Add Lead Source" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const form = new LeadSourceForm(await formInput(fd));
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.leadSource.create({ data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not add lead source: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Lead source added successfully!");
  redirect(reverse("manage_lead_sources"));
}

export default async function AddLeadSourcePage() {
  await requirePermission("settings");
  return (
    <>
      <PageHeader title="Add Lead Source" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Lead Source">
            <ClientForm action={save} markup={formMarkup(new LeadSourceForm({ data: null }))} submitLabel="Add Lead Source" />
            <Link href={reverse("manage_lead_sources")} className="btn btn-secondary mt-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

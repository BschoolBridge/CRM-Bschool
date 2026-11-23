import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { requiredId } from "@/server/request";

export const metadata = { title: "Edit Lead Source" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

async function save(sourceId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const source = await prisma.leadSource.findUnique({ where: { id: sourceId } });
  if (!source) notFound();
  const form = new LeadSourceForm(await formInput(fd), source);
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.leadSource.update({ where: { id: source.id }, data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not update lead source: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Lead source updated successfully!");
  redirect(reverse("manage_lead_sources"));
}

export default async function EditLeadSourcePage({ params }: { params: Promise<{ source_id: string }> }) {
  await requirePermission("settings");
  const source = await prisma.leadSource.findUnique({ where: { id: requiredId((await params).source_id) } });
  if (!source) notFound();
  return (
    <>
      <PageHeader title="Edit Lead Source" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Lead Source: ${source.name}`}>
            <ClientForm
              action={save.bind(null, source.id)}
              markup={formMarkup(new LeadSourceForm({ data: null }, source))}
              submitLabel="Update Lead Source"
            />
            <Link href={reverse("manage_lead_sources")} className="btn btn-secondary mt-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

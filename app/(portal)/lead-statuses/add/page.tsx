import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadStatusForm } from "@/modules/reference/reference.forms";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const metadata = { title: "Add Lead Status" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

const statusCodeExists = (excludeId?: number) => async (code: string) =>
  Boolean(
    await prisma.leadStatus.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    }),
  );

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const form = new LeadStatusForm(await formInput(fd), null, statusCodeExists());
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.leadStatus.create({ data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not add lead status: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Lead status added successfully!");
  redirect(reverse("manage_lead_statuses"));
}

export default async function AddLeadStatusPage() {
  await requirePermission("settings");
  return (
    <>
      <PageHeader title="Add Lead Status" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Lead Status">
            <ClientForm
              action={save}
              markup={formMarkup(new LeadStatusForm({ data: null }, null, statusCodeExists()))}
              submitLabel="Add Lead Status"
            />
            <Link href={reverse("manage_lead_statuses")} className="btn btn-secondary mt-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

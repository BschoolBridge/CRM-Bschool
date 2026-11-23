import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { requiredId } from "@/server/request";

export const metadata = { title: "Edit Lead Status" };

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

async function save(statusId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const status = await prisma.leadStatus.findUnique({ where: { id: statusId } });
  if (!status) notFound();
  const form = new LeadStatusForm(await formInput(fd), status, statusCodeExists(status.id));
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.leadStatus.update({ where: { id: status.id }, data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not update lead status: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Lead status updated successfully!");
  redirect(reverse("manage_lead_statuses"));
}

export default async function EditLeadStatusPage({ params }: { params: Promise<{ status_id: string }> }) {
  await requirePermission("settings");
  const status = await prisma.leadStatus.findUnique({ where: { id: requiredId((await params).status_id) } });
  if (!status) notFound();
  return (
    <>
      <PageHeader title="Edit Lead Status" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Lead Status: ${status.name}`}>
            <ClientForm
              action={save.bind(null, status.id)}
              markup={formMarkup(new LeadStatusForm({ data: null }, status, statusCodeExists(status.id)))}
              submitLabel="Update Lead Status"
              extra={
                status.is_system ? (
                  <div className="callout callout-warning">
                    <h5>
                      <i className="fas fa-lock" /> System Status
                    </h5>
                    <p>This is a system status and cannot be deleted. You can edit its name, color, and other properties.</p>
                  </div>
                ) : null
              }
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

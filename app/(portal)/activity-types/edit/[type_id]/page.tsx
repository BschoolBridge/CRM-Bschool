import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { ActivityTypeForm } from "@/modules/reference/reference.forms";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";

export const metadata = { title: "Edit Activity Type" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

const activityCodeExists = (excludeId?: number) => async (code: string) =>
  Boolean(
    await prisma.activityType.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    }),
  );

async function save(typeId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const type = await prisma.activityType.findUnique({ where: { id: typeId } });
  if (!type) notFound();
  const form = new ActivityTypeForm(await formInput(fd), type, activityCodeExists(type.id));
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.activityType.update({ where: { id: type.id }, data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not update activity type: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Activity type updated successfully!");
  redirect(reverse("manage_activity_types"));
}

export default async function EditActivityTypePage({ params }: { params: Promise<{ type_id: string }> }) {
  await requirePermission("settings");
  const type = await prisma.activityType.findUnique({ where: { id: requiredId((await params).type_id) } });
  if (!type) notFound();
  return (
    <>
      <PageHeader title="Edit Activity Type" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Activity Type: ${type.name}`}>
            <ClientForm
              action={save.bind(null, type.id)}
              markup={formMarkup(new ActivityTypeForm({ data: null }, type, activityCodeExists(type.id)))}
              submitLabel="Update Activity Type"
              extra={
                type.is_system ? (
                  <div className="callout callout-warning">
                    <h5>
                      <i className="fas fa-lock" /> System Activity Type
                    </h5>
                    <p>This is a system type and cannot be deleted. You can edit its name, icon, color, and other properties.</p>
                  </div>
                ) : null
              }
            />
            <Link href={reverse("manage_activity_types")} className="btn btn-secondary mt-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

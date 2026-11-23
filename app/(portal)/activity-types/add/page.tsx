import Link from "next/link";
import { redirect } from "next/navigation";
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

export const metadata = { title: "Add Activity Type" };

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

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const form = new ActivityTypeForm(await formInput(fd), null, activityCodeExists());
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.activityType.create({ data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not add activity type: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Activity type added successfully!");
  redirect(reverse("manage_activity_types"));
}

export default async function AddActivityTypePage() {
  await requirePermission("settings");
  return (
    <>
      <PageHeader title="Add Activity Type" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Activity Type">
            <ClientForm
              action={save}
              markup={formMarkup(new ActivityTypeForm({ data: null }, null, activityCodeExists()))}
              submitLabel="Add Activity Type"
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

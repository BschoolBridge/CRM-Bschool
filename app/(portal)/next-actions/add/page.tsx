import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { NextActionForm } from "@/modules/reference/reference.forms";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const metadata = { title: "Add Next Action" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

const actionCodeExists = (excludeId?: number) => async (code: string) =>
  Boolean(
    await prisma.nextAction.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    }),
  );

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const form = new NextActionForm(await formInput(fd), null, actionCodeExists());
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.nextAction.create({ data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not add next action: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Next action added successfully!");
  redirect(reverse("manage_next_actions"));
}

export default async function AddNextActionPage() {
  await requirePermission("settings");
  return (
    <>
      <PageHeader title="Add Next Action" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Next Action">
            <ClientForm
              action={save}
              markup={formMarkup(new NextActionForm({ data: null }, null, actionCodeExists()))}
              submitLabel="Add Next Action"
            />
            <Link href={reverse("manage_next_actions")} className="btn btn-secondary mt-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

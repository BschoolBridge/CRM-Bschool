import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { requiredId } from "@/server/request";

export const metadata = { title: "Edit Next Action" };

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

async function save(actionId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const action = await prisma.nextAction.findUnique({ where: { id: actionId } });
  if (!action) notFound();
  const form = new NextActionForm(await formInput(fd), action, actionCodeExists(action.id));
  if (!(await form.isValid())) {
    form.addError(null, "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  try {
    await prisma.nextAction.update({ where: { id: action.id }, data: form.cleaned_data });
    await invalidateReferenceData();
  } catch (err) {
    form.addError(null, `Could not update next action: ${detail(err)}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", "Next action updated successfully!");
  redirect(reverse("manage_next_actions"));
}

export default async function EditNextActionPage({ params }: { params: Promise<{ action_id: string }> }) {
  await requirePermission("settings");
  const action = await prisma.nextAction.findUnique({ where: { id: requiredId((await params).action_id) } });
  if (!action) notFound();
  return (
    <>
      <PageHeader title="Edit Next Action" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Next Action: ${action.name}`}>
            <ClientForm
              action={save.bind(null, action.id)}
              markup={formMarkup(new NextActionForm({ data: null }, action, actionCodeExists(action.id)))}
              submitLabel="Update Next Action"
              extra={
                action.is_system ? (
                  <div className="callout callout-warning">
                    <h5>
                      <i className="fas fa-lock" /> System Action
                    </h5>
                    <p>This is a system action and cannot be deleted. You can edit its name and other properties.</p>
                  </div>
                ) : null
              }
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

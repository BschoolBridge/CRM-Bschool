import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { isUniqueViolation } from "@/lib/prisma";
import { UserForm } from "@/modules/users/user.forms";
import { createCounsellor } from "@/modules/users/user.service";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Counsellor" };

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

export default async function AddCounsellorPage() {
  await requireAdmin();
  const form = new UserForm("counsellor-create");

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    await requireAdmin();
    const bound = new UserForm("counsellor-create", await formInput(fd));
    if (!(await bound.isValid())) {
      await flash("error", "Please fill the form properly!");
      return { markup: formMarkup(bound) };
    }
    try {
      await createCounsellor(bound);
      await flash("success", "Counsellor added successfully!");
      redirect(reverse("manage_counsellors"));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", `Could not add counsellor: ${errorDetail(err)}`);
      return { markup: formMarkup(bound) };
    }
  }

  return (
    <>
      <PageHeader title="Add Counsellor" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add New Counsellor">
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Add Counsellor" />
            <Link className="btn btn-secondary mt-3" href={reverse("manage_counsellors")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

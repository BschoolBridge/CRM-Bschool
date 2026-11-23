import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { isUniqueViolation, prisma } from "@/lib/prisma";
import { fullName } from "@/modules/presenters";
import { UserForm } from "@/modules/users/user.forms";
import { updateCounsellor } from "@/modules/users/user.service";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Counsellor" };

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

export default async function EditCounsellorPage({ params }: { params: Promise<{ counsellor_id: string }> }) {
  await requireAdmin();
  const { counsellor_id } = await params;
  const id = requiredId(counsellor_id);
  const counsellor = await prisma.counsellor.findUnique({ where: { id }, include: { admin: true } });
  if (!counsellor) notFound();
  const form = new UserForm("counsellor-edit", { user: counsellor.admin, counsellor });

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    await requireAdmin();
    const row = await prisma.counsellor.findUnique({ where: { id }, include: { admin: true } });
    if (!row) notFound();
    const bound = new UserForm("counsellor-edit", { ...(await formInput(fd)), user: row.admin, counsellor: row });
    if (!(await bound.isValid())) {
      await flash("error", "Please fill the form properly!");
      return { markup: formMarkup(bound) };
    }
    try {
      await updateCounsellor(row.id, row.admin_id, row.admin.profile_pic, bound);
      await flash("success", "Counsellor updated successfully!");
      redirect(reverse("manage_counsellors"));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", `Could not update counsellor: ${errorDetail(err)}`);
      return { markup: formMarkup(bound) };
    }
  }

  return (
    <>
      <PageHeader title="Edit Counsellor" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit Counsellor: ${fullName(counsellor.admin)}`}>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Update Counsellor" />
            <Link className="btn btn-secondary mt-3" href={reverse("manage_counsellors")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

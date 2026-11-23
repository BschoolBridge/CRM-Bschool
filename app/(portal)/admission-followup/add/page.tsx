import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { AdmittedStudentForm } from "@/modules/admission/admission.forms";
import { notifyAdmissionAssignment } from "@/modules/admission/admission.service";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requireAdmin } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "After Admission — Add Student" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const form = await AdmittedStudentForm.create(await formInput(fd));
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const student = await prisma.admittedStudent.create({
    data: { ...form.studentData(), created_by_id: user.id },
  });
  await notifyAdmissionAssignment(student, student.assigned_counsellor_id);
  await flash("success", "Admitted student added.");
  redirect(reverse("manage_admitted_students"));
}

export default async function AddAdmittedStudentPage() {
  await requireAdmin();
  const blank = await AdmittedStudentForm.create();
  return (
    <>
      <PageHeader title="After Admission — Add Student" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Add student">
            <ClientForm action={save} markup={formMarkup(blank)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

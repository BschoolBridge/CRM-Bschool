import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { AdmittedStudentForm, AdmittedStudentRemarkForm } from "@/modules/admission/admission.forms";
import { addStudentRemark, notifyAdmissionAssignment } from "@/modules/admission/admission.service";
import { presentStudent, presentUser } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { requireAdmin } from "@/server/actor";
import { Card, Empty, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "Edit Student" };

async function save(studentId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requireAdmin();
  const student = await prisma.admittedStudent.findUnique({ where: { id: studentId } });
  if (!student) notFound();
  const oldCounsellor = student.assigned_counsellor_id;
  const form = await AdmittedStudentForm.create({ ...(await formInput(fd)), instance: student });
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const updated = await prisma.admittedStudent.update({ where: { id: student.id }, data: form.studentData() });
  if (updated.assigned_counsellor_id && updated.assigned_counsellor_id !== oldCounsellor) {
    await notifyAdmissionAssignment(updated, updated.assigned_counsellor_id);
  }
  await flash("success", "Admitted student updated.");
  redirect(reverse("manage_admitted_students"));
}

async function addRemark(studentId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const student = await prisma.admittedStudent.findUnique({ where: { id: studentId } });
  if (!student) notFound();
  const form = AdmittedStudentRemarkForm.create(await formInput(fd));
  if (await form.isValid()) {
    await addStudentRemark(student.id, form.cleaned_data.remark, user.id);
    await flash("success", "Remark added.");
  } else {
    await flash("error", "Could not add remark. Please enter text.");
  }
  redirect(reverse("edit_admitted_student", student.id));
}

export default async function EditAdmittedStudentPage({ params }: { params: Promise<{ student_id: string }> }) {
  await requireAdmin();
  const { student_id } = await params;
  const row = await prisma.admittedStudent.findUnique({ where: { id: requiredId(student_id) } });
  if (!row) notFound();
  const form = await AdmittedStudentForm.create({ instance: row });
  const remarks = await prisma.admittedStudentRemark.findMany({
    where: { student_id: row.id },
    include: { created_by: true },
    orderBy: { created_at: "desc" },
  });
  for (const remark of remarks) presentUser(remark.created_by);
  const student = presentStudent(row);
  return (
    <>
      <PageHeader title={`Edit — ${student.name}`}>
        <Link className="btn btn-sm btn-secondary" href={reverse("manage_admitted_students")}>Back</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit — ${student.name}`}>
            <ClientForm action={save.bind(null, student.id)} markup={formMarkup(form)} submitLabel="Save" />
          </Card>
          <Card title="Remarks">
            {remarks.length === 0 ? <Empty text="No remarks yet." /> : (
              <ul className="list-unstyled">
                {remarks.map((remark) => (
                  <li key={remark.id} className="mb-2">
                    {remark.remark}
                    <div className="small text-muted">{formatDjango(remark.created_at, "M d, Y H:i")} {remark.created_by ? (remark.created_by as { get_full_name?: string }).get_full_name : ""}</div>
                  </li>
                ))}
              </ul>
            )}
            <ClientForm action={addRemark.bind(null, student.id)} markup={formMarkup(AdmittedStudentRemarkForm.create())} submitLabel="Add remark" />
          </Card>
        </div>
      </section>
    </>
  );
}

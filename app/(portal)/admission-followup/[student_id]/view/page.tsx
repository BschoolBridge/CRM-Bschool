import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { AdmittedStudentRemarkForm } from "@/modules/admission/admission.forms";
import { addStudentRemark, studentTimeline } from "@/modules/admission/admission.service";
import { presentStudent } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { requireAdmin } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { shown } from "../../../_lib/access";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "View Student" };

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
  redirect(reverse("view_admitted_student", student.id));
}

export default async function ViewAdmittedStudentPage({ params }: { params: Promise<{ student_id: string }> }) {
  await requireAdmin();
  const { student_id } = await params;
  const row = await prisma.admittedStudent.findUnique({
    where: { id: requiredId(student_id) },
    include: { assigned_counsellor: { include: { admin: true } }, lead: true, created_by: true },
  });
  if (!row) notFound();
  const student = presentStudent(row);
  const timeline = await studentTimeline(student.id, true, student.created_at);
  const blank = AdmittedStudentRemarkForm.create();
  return (
    <>
      <PageHeader title={`View — ${student.name}`}>
        <Link className="btn btn-sm btn-secondary mr-1" href={reverse("manage_admitted_students")}>Back</Link>
        <Link className="btn btn-sm btn-info" href={reverse("edit_admitted_student", student.id)}>Edit</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={student.name}>
            <p><strong>Phone:</strong> <a href={`tel:${student.phone}`}>{student.phone}</a></p>
            <p><strong>Course:</strong> {student.course}</p>
            <p><strong>Status:</strong> {shown(student, "get_call_status_display")}</p>
            <p><strong>Assigned:</strong> {student.assigned_counsellor ? `${student.assigned_counsellor.admin.first_name} ${student.assigned_counsellor.admin.last_name}` : "Not assigned"}</p>
            <p><strong>Next call:</strong> {student.next_follow_up ? formatDjango(student.next_follow_up, "M d, Y H:i") : "—"}</p>
            <p><strong>Fee due:</strong> {student.fee_due_date ? formatDjango(student.fee_due_date, "M d, Y") : "—"}</p>
            <p><strong>Documents due:</strong> {student.documents_due_date ? formatDjango(student.documents_due_date, "M d, Y") : "—"}</p>
            <p className="mb-0"><strong>Notes:</strong> {student.notes || "—"}</p>
          </Card>
          <Card title="Timeline">
            <ul className="list-unstyled mb-0">
              {timeline.map((event, index) => (
                <li key={index} className="mb-2">
                  <span className="text-muted">{formatDjango(event.at, "M d, Y H:i")}</span>
                  {event.kind === "added" ? " Added" : null}
                  {event.kind === "remark" ? ` Remark: ${(event.remark as { remark: string }).remark}` : null}
                  {event.kind === "call" ? ` ${(event.activity as { get_activity_type_display?: string; subject?: string }).get_activity_type_display ?? "Call"} — ${(event.activity as { subject?: string }).subject ?? ""}` : null}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Add remark">
            <ClientForm action={addRemark.bind(null, student.id)} markup={formMarkup(blank)} submitLabel="Add remark" />
          </Card>
        </div>
      </section>
    </>
  );
}

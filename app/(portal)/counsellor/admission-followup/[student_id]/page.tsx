import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { AdmittedStudentCallLogForm, AdmittedStudentRemarkForm } from "@/modules/admission/admission.forms";
import { addStudentRemark, logAdmittedStudentCall, studentTimeline } from "@/modules/admission/admission.service";
import { presentStudent } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { shown } from "../../../_lib/access";
import { requireAdmissionCounsellor } from "../../_lib/admission-gate";

export const metadata = { title: "Log Call" };

async function save(studentId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { user, counsellor } = await requireAdmissionCounsellor();
  const student = await prisma.admittedStudent.findFirst({
    where: { id: studentId, assigned_counsellor_id: counsellor.id },
  });
  if (!student) notFound();
  const callForm = AdmittedStudentCallLogForm.create({ ...(await formInput(fd)), student });
  if (!(await callForm.isValid())) {
    await flash("error", "Could not log call. Please check the form.");
    return { markup: formMarkup(callForm) };
  }
  const cleaned = callForm.cleaned_data;
  await logAdmittedStudentCall({
    studentId: student.id,
    counsellorId: counsellor.id,
    userId: user.id,
    notes: cleaned.call_notes || "",
    callStatus: cleaned.call_status || null,
    nextFollowUp: "resolved_next_follow_up" in cleaned ? (cleaned.resolved_next_follow_up ?? null) : undefined,
    feeDueDate: "resolved_fee_due_date" in cleaned ? (cleaned.resolved_fee_due_date ?? null) : undefined,
    documentsDueDate: "resolved_documents_due_date" in cleaned ? (cleaned.resolved_documents_due_date ?? null) : undefined,
  });
  await flash("success", "Call logged successfully.");
  redirect(reverse("counsellor_update_admission_followup", student.id));
}

async function addRemark(studentId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { user, counsellor } = await requireAdmissionCounsellor();
  const student = await prisma.admittedStudent.findFirst({
    where: { id: studentId, assigned_counsellor_id: counsellor.id },
  });
  if (!student) notFound();
  const form = AdmittedStudentRemarkForm.create(await formInput(fd));
  if (await form.isValid()) {
    await addStudentRemark(student.id, form.cleaned_data.remark, user.id);
    await flash("success", "Remark added.");
  } else {
    await flash("error", "Could not add remark. Please enter text.");
  }
  redirect(reverse("counsellor_update_admission_followup", student.id));
}

export default async function CounsellorLogCallPage({ params }: { params: Promise<{ student_id: string }> }) {
  const { counsellor } = await requireAdmissionCounsellor();
  const { student_id } = await params;
  const row = await prisma.admittedStudent.findFirst({
    where: { id: requiredId(student_id), assigned_counsellor_id: counsellor.id },
  });
  if (!row) notFound();
  const student = presentStudent(row);
  const callForm = AdmittedStudentCallLogForm.create({ student: row });
  const timeline = await studentTimeline(student.id, true, student.created_at);
  return (
    <>
      <PageHeader title={`Log Call — ${student.name}`}>
        <Link className="btn btn-sm btn-secondary mr-1" href={reverse("counsellor_admission_followup")}>Back</Link>
        <Link className="btn btn-sm btn-info" href={reverse("counsellor_view_admitted_student", student.id)}>View</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Log call — ${student.name}`}>
            <p className="text-muted">Status: {shown(student, "get_call_status_display")}. Next call: {student.next_follow_up ? formatDjango(student.next_follow_up, "M d, Y H:i") : "—"}</p>
            <ClientForm action={save.bind(null, student.id)} markup={formMarkup(callForm)} submitLabel="Log call" />
          </Card>
          <Card title="Timeline">
            <ul className="list-unstyled mb-0">
              {timeline.map((event, index) => (
                <li key={index} className="mb-2">
                  <span className="text-muted">{formatDjango(event.at, "M d, Y H:i")}</span>
                  {event.kind === "added" ? " Added" : null}
                  {event.kind === "remark" ? ` Remark: ${(event.remark as { remark: string }).remark}` : null}
                  {event.kind === "call" ? ` ${(event.activity as { subject?: string }).subject ?? "Call"}` : null}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Add remark">
            <ClientForm action={addRemark.bind(null, student.id)} markup={formMarkup(AdmittedStudentRemarkForm.create())} submitLabel="Add remark" />
          </Card>
        </div>
      </section>
    </>
  );
}

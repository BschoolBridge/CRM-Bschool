import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { AdmittedStudentForm } from "@/modules/admission/admission.forms";
import { notifyAdmissionAssignment } from "@/modules/admission/admission.service";
import { presentLead } from "@/modules/presenters";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { requireAdmin } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "Add to After Admission" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { assigned_counsellor: true } });
  if (!lead) notFound();
  const existing = await prisma.admittedStudent.findFirst({ where: { lead_id: lead.id } });
  if (existing) {
    await flash("warning", "This lead is already on the After Admission list.");
    redirect(reverse("admin_view_lead", lead.id));
  }
  const form = await AdmittedStudentForm.create(await formInput(fd));
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const student = await prisma.admittedStudent.create({
    data: { ...form.studentData(), lead_id: lead.id, created_by_id: user.id },
  });
  await notifyAdmissionAssignment(student, student.assigned_counsellor_id);
  await flash("success", "Lead added to After Admission.");
  redirect(reverse("manage_admitted_students"));
}

export default async function PromoteLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  await requireAdmin();
  const { lead_id } = await params;
  const row = await prisma.lead.findUnique({ where: { id: requiredId(lead_id) }, include: { assigned_counsellor: true } });
  if (!row) notFound();
  const lead = presentLead(row);
  const existing = await prisma.admittedStudent.findFirst({ where: { lead_id: lead.id } });
  if (existing) {
    await flash("warning", "This lead is already on the After Admission list.");
    redirect(reverse("admin_view_lead", lead.id));
  }
  const initial: Record<string, unknown> = {
    name: `${lead.first_name} ${lead.last_name}`.trim(),
    phone: lead.phone,
    course: lead.course_interested || "",
  };
  if (lead.assigned_counsellor_id && lead.assigned_counsellor?.can_handle_admission_followup) {
    initial.assigned_counsellor = lead.assigned_counsellor_id;
  }
  const form = await AdmittedStudentForm.create();
  for (const [key, value] of Object.entries(initial)) form.setInitial(key, value);
  return (
    <>
      <PageHeader title={`Add to After Admission — ${lead.first_name} ${lead.last_name}`.trim()}>
        <Link className="btn btn-sm btn-secondary" href={reverse("admin_view_lead", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Add to After Admission — ${`${lead.first_name} ${lead.last_name}`.trim()}`}>
            <ClientForm action={save.bind(null, lead.id)} markup={formMarkup(form)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

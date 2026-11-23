import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { normalizeLeadPhone } from "@/lib/phone";
import { isBlankCell, readSpreadsheet } from "@/lib/spreadsheet";
import { AdmittedStudentImportForm } from "@/modules/admission/admission.forms";
import { addStudentRemark, notifyAdmissionAssignment } from "@/modules/admission/admission.service";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requireAdmin } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "Import Excel — After Admission" };

function rowValue(row: Record<string, unknown>, ...keys: string[]): string {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key) normalized[key.trim().toLowerCase()] = value;
  }
  for (const key of keys) {
    const val = normalized[key.toLowerCase()];
    if (isBlankCell(val)) continue;
    if (typeof val === "number" && Number.isInteger(val)) return String(val);
    if (typeof val === "number" && val === Math.trunc(val)) return String(Math.trunc(val));
    return String(val).trim();
  }
  return "";
}

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const form = await AdmittedStudentImportForm.create(await formInput(fd));
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const file = form.cleaned_data.file;
  const counsellorId = form.cleaned_data.assigned_counsellor;
  let success = 0;
  let errors = 0;
  const messagesBuf: string[] = [];
  const phones = new Set<string>();
  for (const [rowNum, row] of await readSpreadsheet(file.buffer, file.originalname)) {
    try {
      const name = rowValue(row, "name", "student name", "student_name", "full name", "full_name");
      const phoneRaw = rowValue(row, "phone", "phone no", "phone_no", "phone number", "mobile", "mobile no", "contact");
      const course = rowValue(row, "course", "course name", "course_interested");
      const remark = rowValue(row, "notes", "remark", "remarks");
      if (!name) throw new Error("Name is required");
      const phone = normalizeLeadPhone(phoneRaw) || phoneRaw;
      if (!phone) throw new Error("Phone is required");
      if (phones.has(phone)) throw new Error("Duplicate phone in this file");
      phones.add(phone);
      if (!course) throw new Error("Course is required");
      const student = await prisma.admittedStudent.create({
        data: {
          name,
          phone,
          course,
          assigned_counsellor_id: counsellorId,
          created_by_id: user.id,
          notes: "",
        },
      });
      if (counsellorId) await notifyAdmissionAssignment(student, counsellorId);
      if (remark) await addStudentRemark(student.id, remark, user.id);
      success += 1;
    } catch (err) {
      errors += 1;
      if (messagesBuf.length < 25) messagesBuf.push(`Row ${rowNum}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (success) await flash("success", `Imported ${success} student(s) into After Admission.`);
  if (errors) await flash("warning", `${errors} row(s) skipped. ${messagesBuf.join(" ")}`);
  if (success) redirect(reverse("manage_admitted_students"));
  return { markup: formMarkup(form) };
}

export default async function ImportAdmittedStudentsPage() {
  await requireAdmin();
  const blank = await AdmittedStudentImportForm.create();
  return (
    <>
      <PageHeader title="Import Excel — After Admission">
        <a className="btn btn-sm btn-outline-secondary mr-1" href={reverse("download_admitted_import_template")}>Download template</a>
        <Link className="btn btn-sm btn-secondary" href={reverse("manage_admitted_students")}>Back</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title="Import Excel">
            <ClientForm action={save} markup={formMarkup(blank)} submitLabel="Import" />
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { field, fieldList, idList } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { normalizeLeadPhone } from "@/lib/phone";
import { admissionFollowupCounsellors, notifyAdmissionAssignment } from "@/modules/admission/admission.service";
import { presentAll, presentLead } from "@/modules/presenters";
import { recordFromFormData } from "@/server/form";
import { flash } from "@/server/flash";
import { requireAdmin } from "@/server/actor";
import { Card, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Import Closed Won → After Admission" };

async function save(fd: FormData) {
  "use server";
  const user = await requireAdmin();
  const body = recordFromFormData(fd);
  const ids = idList(fieldList(body, "lead_ids"));
  const counsellorRaw = field(body, "assigned_counsellor");
  let counsellorId: number | null = null;
  if (/^\d+$/.test(counsellorRaw)) {
    const counsellor = await prisma.counsellor.findFirst({ where: { id: Number(counsellorRaw), can_handle_admission_followup: true } });
    if (!counsellor) notFound();
    counsellorId = counsellor.id;
  }
  let created = 0;
  for (const lid of ids) {
    const lead = await prisma.lead.findFirst({ where: { id: lid, status: "CLOSED_WON" } });
    if (!lead || (await prisma.admittedStudent.findFirst({ where: { lead_id: lead.id } }))) continue;
    const student = await prisma.admittedStudent.create({
      data: {
        name: `${lead.first_name} ${lead.last_name}`.trim(),
        phone: normalizeLeadPhone(lead.phone) || lead.phone,
        course: lead.course_interested || "Not specified",
        lead_id: lead.id,
        assigned_counsellor_id: counsellorId,
        created_by_id: user.id,
        notes: "",
      },
    });
    if (counsellorId) await notifyAdmissionAssignment(student, counsellorId);
    created += 1;
  }
  await flash("success", `Added ${created} student(s) to After Admission.`);
  redirect(reverse("manage_admitted_students"));
}

export default async function ImportWonLeadsPage() {
  await requireAdmin();
  const existing = await prisma.admittedStudent.findMany({ where: { lead_id: { not: null } }, select: { lead_id: true } });
  const exclude = existing.map((row) => row.lead_id!).filter(Boolean);
  const leads = presentAll(
    await prisma.lead.findMany({
      where: { status: "CLOSED_WON", id: { notIn: exclude } },
      include: { assigned_counsellor: { include: { admin: true } }, source: true },
      orderBy: { updated_at: "desc" },
      take: 200,
    }),
    (lead) => presentLead(lead),
  );
  const counsellors = await admissionFollowupCounsellors();
  return (
    <>
      <PageHeader title="Import Closed Won → After Admission">
        <Link className="btn btn-sm btn-secondary" href={reverse("manage_admitted_students")}>Back</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title="Closed won leads">
            {leads.length === 0 ? <Empty text="No closed-won leads left to import." /> : (
              <form action={save}>
                <div className="form-group">
                  <label htmlFor="assigned_counsellor">Assign to counsellor</label>
                  <select className="form-control" id="assigned_counsellor" name="assigned_counsellor" defaultValue="">
                    <option value="">— Unassigned —</option>
                    {counsellors.map((counsellor) => (
                      <option key={counsellor.id} value={counsellor.id}>{counsellor.admin.first_name} {counsellor.admin.last_name}</option>
                    ))}
                  </select>
                </div>
                <table className="table table-sm">
                  <thead><tr><th></th><th>Lead</th><th>Phone</th><th>Course</th><th>Source</th></tr></thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td><input type="checkbox" name="lead_ids" value={lead.id} /></td>
                        <td>{lead.first_name} {lead.last_name}</td>
                        <td>{lead.phone}</td>
                        <td>{lead.course_interested}</td>
                        <td>{lead.source?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn-primary" type="submit">Add selected</button>
              </form>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

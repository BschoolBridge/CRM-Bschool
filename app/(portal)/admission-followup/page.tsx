import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { admissionFollowupCounsellors, filterAdmittedStudents } from "@/modules/admission/admission.service";
import { ADMISSION_CALL_STATUS, presentAll, presentStudent } from "@/modules/presenters";
import { readSearch, requiredId, type SearchParams } from "@/server/request";
import { flash } from "@/server/flash";
import { requireAdmin } from "@/server/actor";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { shown } from "../_lib/access";
import { PostButton } from "@/components/client-form";

export const metadata = { title: "After Admission" };

async function removeStudent(studentId: number) {
  "use server";
  await requireAdmin();
  const student = await prisma.admittedStudent.findUnique({ where: { id: studentId } });
  if (!student) notFound();
  await prisma.admittedStudent.delete({ where: { id: studentId } });
  await flash("success", "Admitted student removed.");
  redirect(reverse("manage_admitted_students"));
}

export default async function ManageAdmittedStudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const query = await readSearch(searchParams);
  const search = field(query, "search");
  const status = field(query, "status");
  const counsellorId = field(query, "counsellor");
  const where = filterAdmittedStudents({ search, status, counsellorId });
  const students = await paginate(
    query.page,
    25,
    () => prisma.admittedStudent.count({ where }),
    (skip, take) =>
      prisma.admittedStudent.findMany({
        where,
        include: { assigned_counsellor: { include: { admin: true } }, lead: true },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
  );
  presentAll(students, (student) => presentStudent(student));
  const counsellors = await admissionFollowupCounsellors();
  const pagerQuery: Record<string, string> = {};
  if (search) pagerQuery.search = search;
  if (status) pagerQuery.status = status;
  if (counsellorId) pagerQuery.counsellor = counsellorId;

  return (
    <>
      <PageHeader title="After Admission">
        <Link className="btn btn-primary btn-sm mr-1" href={reverse("add_admitted_student")}>Add Student</Link>
        <Link className="btn btn-success btn-sm mr-1" href={reverse("import_admitted_students_excel")}>Import Excel</Link>
        <Link className="btn btn-warning btn-sm" href={reverse("import_won_leads_to_admission")}>Import Closed Won</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title="After Admission">
            <form method="get" action={reverse("manage_admitted_students")} className="mb-3">
              <div className="form-row">
                <div className="col-md-3 mb-2"><input className="form-control" name="search" placeholder="Name, phone, course…" defaultValue={search} /></div>
                <div className="col-md-3 mb-2">
                  <select className="form-control" name="status" defaultValue={status}>
                    <option value="">All admission statuses</option>
                    {ADMISSION_CALL_STATUS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </div>
                <div className="col-md-3 mb-2">
                  <select className="form-control" name="counsellor" defaultValue={counsellorId}>
                    <option value="">All Counsellors</option>
                    <option value="none">Not assigned</option>
                    {counsellors.map((counsellor) => (
                      <option key={counsellor.id} value={counsellor.id}>{counsellor.admin.first_name} {counsellor.admin.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 mb-2"><button className="btn btn-primary" type="submit">Filter</button></div>
              </div>
              {search || status || counsellorId ? <Link href={reverse("manage_admitted_students")}>Clear filters</Link> : null}
            </form>
            {students.length === 0 ? <Empty text="No admitted students." /> : (
              <table className="table table-bordered table-striped">
                <thead><tr><th>Name</th><th>Phone</th><th>Course</th><th>Assigned To</th><th>Status</th><th>Next Call</th><th></th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td><a href={`tel:${student.phone}`}>{student.phone}</a></td>
                      <td>{student.course}</td>
                      <td>{student.assigned_counsellor ? `${student.assigned_counsellor.admin.first_name} ${student.assigned_counsellor.admin.last_name}` : "Not assigned"}</td>
                      <td>{shown(student, "get_call_status_display")}</td>
                      <td>{student.next_follow_up ? formatDjango(student.next_follow_up, "M d, Y H:i") : "—"}</td>
                      <td className="text-nowrap">
                        <Link className="btn btn-primary btn-sm mr-1" href={reverse("view_admitted_student", student.id)}>View</Link>
                        <Link className="btn btn-info btn-sm mr-1" href={reverse("edit_admitted_student", student.id)}>Edit</Link>
                        <PostButton className="btn btn-danger btn-sm" confirm="Remove this student?" action={removeStudent.bind(null, student.id)}>Delete</PostButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={students} path={reverse("manage_admitted_students")} query={pagerQuery} />
          </Card>
        </div>
      </section>
    </>
  );
}

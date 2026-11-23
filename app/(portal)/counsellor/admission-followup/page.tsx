import Link from "next/link";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { filterAdmittedStudents } from "@/modules/admission/admission.service";
import { ADMISSION_CALL_STATUS, presentAll, presentStudent } from "@/modules/presenters";
import { readSearch, type SearchParams } from "@/server/request";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { flag, shown } from "../../_lib/access";
import { requireAdmissionCounsellor } from "../_lib/admission-gate";

export const metadata = { title: "Our Student" };

export default async function CounsellorAdmissionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { counsellor } = await requireAdmissionCounsellor();
  const query = await readSearch(searchParams);
  const status = field(query, "status");
  const search = field(query, "search");
  const due = field(query, "due");
  const where = filterAdmittedStudents({ search, status, due: due === "1", assignedCounsellorId: counsellor.id });
  const students = await paginate(
    query.page,
    25,
    () => prisma.admittedStudent.count({ where }),
    (skip, take) =>
      prisma.admittedStudent.findMany({
        where,
        orderBy: [{ next_follow_up: { sort: "asc", nulls: "last" } }, { created_at: "desc" }],
        skip,
        take,
      }),
  );
  presentAll(students, (student) => presentStudent(student));
  const pagerQuery: Record<string, string> = {};
  if (search) pagerQuery.search = search;
  if (status) pagerQuery.status = status;
  if (due) pagerQuery.due = due;

  return (
    <>
      <PageHeader title="Our Student" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Calling list">
            <form method="get" action={reverse("counsellor_admission_followup")} className="mb-3">
              <div className="form-row">
                <div className="col-md-3 mb-2"><input className="form-control" name="search" placeholder="Name, phone, course…" defaultValue={search} /></div>
                <div className="col-md-3 mb-2">
                  <select className="form-control" name="status" defaultValue={status}>
                    <option value="">All admission statuses</option>
                    {ADMISSION_CALL_STATUS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </div>
                <div className="col-md-3 mb-2">
                  <select className="form-control" name="due" defaultValue={due}>
                    <option value="">All students</option>
                    <option value="1">Due for call</option>
                  </select>
                </div>
                <div className="col-md-2 mb-2"><button className="btn btn-primary" type="submit">Filter</button></div>
              </div>
            </form>
            {students.length === 0 ? <Empty text="No students assigned." /> : (
              <table className="table table-bordered table-striped">
                <thead><tr><th>Name</th><th>Phone</th><th>Course</th><th>Status</th><th>Last called</th><th>Next call</th><th></th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td><a href={`tel:${student.phone}`}>{student.phone}</a></td>
                      <td>{student.course}</td>
                      <td>{shown(student, "get_call_status_display")}{flag(student, "is_follow_up_overdue") ? <span className="badge badge-danger ml-1">Overdue</span> : null}</td>
                      <td>{student.last_called_at ? formatDjango(student.last_called_at, "M d, Y H:i") : "—"}</td>
                      <td>{student.next_follow_up ? formatDjango(student.next_follow_up, "M d, Y H:i") : "—"}</td>
                      <td className="text-nowrap">
                        <Link className="btn btn-sm btn-primary mr-1" href={reverse("counsellor_view_admitted_student", student.id)}>View</Link>
                        <Link className="btn btn-sm btn-info" href={reverse("counsellor_update_admission_followup", student.id)}>Log call</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={students} path={reverse("counsellor_admission_followup")} query={pagerQuery} />
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { field } from "@/http/params";
import { reverse, withQuery } from "@/http/urls";
import { paginate, type Page } from "@/lib/pagination";
import { prisma, type Prisma } from "@/lib/prisma";
import { formatDjango, localDayBounds, parseIsoDate } from "@/lib/time";
import { ADMISSION_ACTIVITY_TYPES, presentActivity, presentAll, presentStudentActivity } from "@/modules/presenters";
import { activityTypeChoices, nextActionChoices } from "@/modules/reference/reference.service";
import { readSearch, type SearchParams } from "@/server/request";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { PostButton } from "@/components/client-form";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";
import { deleteLeadActivity, markActivityComplete } from "../_lib/lead-actions";

export const metadata = { title: "Follow-ups" };

function activityWhere(counsellorId: number, q: Record<string, string>): Prisma.LeadActivityWhereInput {
  const and: Prisma.LeadActivityWhereInput[] = [{ counsellor_id: counsellorId }];
  const search = field(q, "search");
  if (search) {
    const contains = { contains: search };
    and.push({
      OR: [
        { subject: contains },
        { outcome: contains },
        { description: contains },
        { lead: { is: { first_name: contains } } },
        { lead: { is: { last_name: contains } } },
        { lead: { is: { lead_id: contains } } },
        { lead: { is: { email: contains } } },
        { lead: { is: { phone: contains } } },
        { lead: { is: { school_name: contains } } },
      ],
    });
  }
  const type = field(q, "activity_type");
  if (type) and.push({ activity_type: type });
  const completed = field(q, "completed").toLowerCase();
  if (completed === "yes" || completed === "true" || completed === "1") and.push({ is_completed: true });
  else if (completed === "no" || completed === "false" || completed === "0") and.push({ is_completed: false });
  const next = field(q, "next_action");
  if (next) and.push({ next_action: next });
  const from = parseIsoDate(field(q, "date_from"));
  if (from) and.push({ completed_date: { gte: localDayBounds(from).start } });
  const to = parseIsoDate(field(q, "date_to"));
  if (to) and.push({ completed_date: { lt: localDayBounds(to).end } });
  return { AND: and };
}

function studentActivityWhere(counsellorId: number, q: Record<string, string>): Prisma.AdmittedStudentActivityWhereInput {
  const and: Prisma.AdmittedStudentActivityWhereInput[] = [{ counsellor_id: counsellorId }];
  const search = field(q, "s_search");
  if (search) {
    const contains = { contains: search };
    and.push({
      OR: [
        { subject: contains },
        { description: contains },
        { student: { is: { name: contains } } },
        { student: { is: { phone: contains } } },
        { student: { is: { course: contains } } },
      ],
    });
  }
  const type = field(q, "s_activity_type");
  if (type) and.push({ activity_type: type });
  const completed = field(q, "s_completed").toLowerCase();
  if (completed === "yes" || completed === "true" || completed === "1") and.push({ is_completed: true });
  else if (completed === "no" || completed === "false" || completed === "0") and.push({ is_completed: false });
  const from = parseIsoDate(field(q, "s_date_from"));
  if (from) and.push({ completed_date: { gte: localDayBounds(from).start } });
  const to = parseIsoDate(field(q, "s_date_to"));
  if (to) and.push({ completed_date: { lt: localDayBounds(to).end } });
  return { AND: and };
}

function Spager<T>({ page, path, query }: { page: Page<T>; path: string; query: Record<string, string> }) {
  if (!page.has_other_pages) return null;
  const href = (n: number) => withQuery(path, { ...query, spage: n });
  return (
    <nav aria-label="Student pagination">
      <ul className="pagination pagination-sm m-0">
        <li className={`page-item${page.has_previous ? "" : " disabled"}`}>
          {page.has_previous ? <Link className="page-link" href={href(page.previous_page_number)}>Previous</Link> : <span className="page-link">Previous</span>}
        </li>
        <li className="page-item active"><span className="page-link">{page.number}</span></li>
        <li className={`page-item${page.has_next ? "" : " disabled"}`}>
          {page.has_next ? <Link className="page-link" href={href(page.next_page_number)}>Next</Link> : <span className="page-link">Next</span>}
        </li>
      </ul>
    </nav>
  );
}

export default async function MyActivitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await readSearch(searchParams);
  const { counsellor } = await counsellorContext();
  const canAdmission = counsellor.can_handle_admission_followup;
  let activeTab = field(query, "tab") || "leads";
  if (!canAdmission || (activeTab !== "leads" && activeTab !== "students")) activeTab = "leads";
  const leadWhere = activityWhere(counsellor.id, query);
  const leadActivities = await paginate(
    query.page,
    25,
    () => prisma.leadActivity.count({ where: leadWhere }),
    (skip, take) =>
      prisma.leadActivity.findMany({
        where: leadWhere,
        include: { lead: { include: { source: true } } },
        orderBy: { completed_date: "desc" },
        skip,
        take,
      }),
  );
  presentAll(leadActivities, (activity) => presentActivity(activity));

  let studentActivities = null;
  if (canAdmission) {
    const sWhere = studentActivityWhere(counsellor.id, query);
    studentActivities = await paginate(
      query.spage,
      25,
      () => prisma.admittedStudentActivity.count({ where: sWhere }),
      (skip, take) =>
        prisma.admittedStudentActivity.findMany({
          where: sWhere,
          include: { student: true },
          orderBy: [{ completed_date: "desc" }, { created_at: "desc" }],
          skip,
          take,
        }),
    );
    presentAll(studentActivities, (activity) => presentStudentActivity(activity));
  }

  const shared: Record<string, string> = {};
  for (const key of ["search", "activity_type", "completed", "next_action", "date_from", "date_to", "s_search", "s_activity_type", "s_completed", "s_date_from", "s_date_to"]) {
    if (query[key]) shared[key] = query[key];
  }
  const leadQuery = canAdmission ? { ...shared, tab: "leads" } : shared;
  const studentQuery = { ...shared, tab: "students" };
  const types = await activityTypeChoices();
  const nextChoices = [["", "All next actions"], ...(await nextActionChoices()).filter(([code]) => code)] as Array<[string, string]>;

  return (
    <>
      <PageHeader title="Follow-ups" />
      <section className="content">
        <div className="container-fluid">
          {canAdmission ? (
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item"><Link className={`nav-link${activeTab === "leads" ? " active" : ""}`} href={withQuery(reverse("my_activities"), leadQuery)}>Leads</Link></li>
              <li className="nav-item"><Link className={`nav-link${activeTab === "students" ? " active" : ""}`} href={withQuery(reverse("my_activities"), studentQuery)}>Students</Link></li>
            </ul>
          ) : null}
          {activeTab === "leads" ? (
            <Card title="Lead activities">
              <form method="get" action={reverse("my_activities")} className="mb-3">
                {canAdmission ? <input type="hidden" name="tab" value="leads" /> : null}
                <div className="form-row">
                  <div className="col-md-3 mb-2"><input className="form-control" name="search" placeholder="Search" defaultValue={field(query, "search")} /></div>
                  <div className="col-md-2 mb-2">
                    <select className="form-control" name="activity_type" defaultValue={field(query, "activity_type")}>
                      <option value="">All types</option>
                      {types.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2 mb-2">
                    <select className="form-control" name="completed" defaultValue={field(query, "completed")}>
                      <option value="">Any</option>
                      <option value="yes">Completed</option>
                      <option value="no">Pending</option>
                    </select>
                  </div>
                  <div className="col-md-2 mb-2">
                    <select className="form-control" name="next_action" defaultValue={field(query, "next_action")}>
                      {nextChoices.map(([code, name]) => <option key={code || "all"} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-1 mb-2"><input className="form-control" type="date" name="date_from" defaultValue={field(query, "date_from")} /></div>
                  <div className="col-md-1 mb-2"><input className="form-control" type="date" name="date_to" defaultValue={field(query, "date_to")} /></div>
                  <div className="col-md-1 mb-2"><button className="btn btn-primary btn-block" type="submit">Filter</button></div>
                </div>
              </form>
              {leadActivities.length === 0 ? <Empty text="No activities." /> : (
                <div className="table-responsive">
                  <table className="table table-sm table-striped">
                    <thead><tr><th>When</th><th>Lead</th><th>Type</th><th>Subject</th><th>Outcome</th><th>Next</th><th>Duration</th><th></th></tr></thead>
                    <tbody>
                      {leadActivities.map((activity) => (
                        <tr key={activity.id}>
                          <td>{activity.completed_date ? formatDjango(activity.completed_date, "M d, Y H:i") : "—"}</td>
                          <td>{activity.lead.first_name} {activity.lead.last_name}</td>
                          <td>{shown(activity, "get_activity_type_display")}</td>
                          <td>{activity.subject}</td>
                          <td>{activity.outcome || "—"}</td>
                          <td>{activity.next_action ? (nextChoices.find(([code]) => code === activity.next_action)?.[1] ?? activity.next_action) : "—"}</td>
                          <td>{activity.duration} min</td>
                          <td className="text-nowrap">
                            <Link className="btn btn-sm btn-info mr-1" href={reverse("lead_detail", activity.lead.id)}>View</Link>
                            {!activity.is_completed ? <PostButton className="btn btn-sm btn-success mr-1" action={markActivityComplete.bind(null, activity.lead.id, activity.id)}>Complete</PostButton> : <span className="badge badge-success mr-1">Completed</span>}
                            <Link className="btn btn-sm btn-warning mr-1" href={reverse("edit_lead_activity", activity.lead.id, activity.id)}>Edit</Link>
                            <PostButton className="btn btn-sm btn-danger" confirm="Delete this activity?" action={deleteLeadActivity.bind(null, activity.lead.id, activity.id)}>Delete</PostButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pager page={leadActivities} path={reverse("my_activities")} query={leadQuery} />
            </Card>
          ) : null}
          {activeTab === "students" && studentActivities ? (
            <Card title="Student activities">
              <form method="get" action={reverse("my_activities")} className="mb-3">
                <input type="hidden" name="tab" value="students" />
                <div className="form-row">
                  <div className="col-md-3 mb-2"><input className="form-control" name="s_search" placeholder="Search" defaultValue={field(query, "s_search")} /></div>
                  <div className="col-md-3 mb-2">
                    <select className="form-control" name="s_activity_type" defaultValue={field(query, "s_activity_type")}>
                      <option value="">All types</option>
                      {ADMISSION_ACTIVITY_TYPES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2 mb-2">
                    <select className="form-control" name="s_completed" defaultValue={field(query, "s_completed")}>
                      <option value="">Any</option>
                      <option value="yes">Completed</option>
                      <option value="no">Pending</option>
                    </select>
                  </div>
                  <div className="col-md-2 mb-2"><input className="form-control" type="date" name="s_date_from" defaultValue={field(query, "s_date_from")} /></div>
                  <div className="col-md-2 mb-2"><input className="form-control" type="date" name="s_date_to" defaultValue={field(query, "s_date_to")} /></div>
                </div>
                <button className="btn btn-primary" type="submit">Filter</button>
              </form>
              {studentActivities.length === 0 ? <Empty text="No student activities." /> : (
                <table className="table table-sm table-striped">
                  <thead><tr><th>When</th><th>Student</th><th>Type</th><th>Subject</th><th></th></tr></thead>
                  <tbody>
                    {studentActivities.map((activity) => (
                      <tr key={activity.id}>
                        <td>{activity.completed_date ? formatDjango(activity.completed_date, "M d, Y H:i") : "—"}</td>
                        <td><Link href={reverse("counsellor_view_admitted_student", activity.student.id)}>{activity.student.name}</Link></td>
                        <td>{shown(activity, "get_activity_type_display")}</td>
                        <td>{activity.subject}</td>
                        <td>{activity.is_completed ? <span className="badge badge-success">Completed</span> : <span className="badge badge-warning">Pending</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Spager page={studentActivities} path={reverse("my_activities")} query={studentQuery} />
            </Card>
          ) : null}
        </div>
      </section>
    </>
  );
}

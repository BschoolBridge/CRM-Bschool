import Link from "next/link";
import { encodeQuery, field } from "@/http/params";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { ACTIVITY_OUTCOME_CHOICES, OTHER_OUTCOME } from "@/modules/activities/activity.form";
import { logDataAccess } from "@/modules/leads/audit";
import { counsellorQueueOrder, myLeadsWhere } from "@/modules/leads/lead.queries";
import { presentActivity, presentLead } from "@/modules/presenters";
import { LEAD_PRIORITIES, allLeadStatusChoices, leadStatusChoices } from "@/modules/reference/reference.service";
import { readSearch, type SearchParams } from "@/server/request";
import { Card, Empty, PageHeader, Pager, PriorityBadge, StatusBadge } from "@/components/ui";
import { accessActor } from "../../_lib/access";
import { myLeadFiltersFrom, persistMyLeadFilters } from "../../_lib/my-leads-filters";
import { counsellorContext } from "../_lib/owned";
import { RevealPhoneButton } from "../_components/reveal-phone";

export const metadata = { title: "My Leads" };

const OUTCOME_FILTER_CHOICES = [
  ["__awaiting__", "Not answered / awaiting reply"] as const,
  ...ACTIVITY_OUTCOME_CHOICES.filter(([code]) => code && code !== OTHER_OUTCOME),
  ["__other__", "Other (custom outcome)"] as const,
];

function masked(phone: string) {
  return `****${phone.slice(-3)}`;
}

export default async function MyLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await readSearch(searchParams);
  await persistMyLeadFilters(query);
  const { user, counsellor } = await counsellorContext();
  const filters = myLeadFiltersFrom(query);
  const where = await myLeadsWhere(counsellor.id, filters);
  const [leads, totalAssigned, sources, statusChoices, allStatuses] = await Promise.all([
    paginate(
      query.page,
      50,
      () => prisma.lead.count({ where }),
      (skip, take) =>
        prisma.lead.findMany({
          where,
          include: { source: true },
          orderBy: counsellorQueueOrder,
          skip,
          take,
        }),
    ),
    prisma.lead.count({ where: { assigned_counsellor_id: counsellor.id } }),
    prisma.leadSource.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
    leadStatusChoices(),
    allLeadStatusChoices(),
  ]);
  const latest = leads.length
    ? await prisma.leadActivity.findMany({
        where: {
          counsellor_id: counsellor.id,
          is_completed: true,
          activity_type: { not: "TRANSFER" },
          lead_id: { in: leads.map((lead) => lead.id) },
        },
        orderBy: [{ completed_date: "desc" }, { id: "desc" }],
      })
    : [];
  const firstByLead = new Map<number, (typeof latest)[number]>();
  for (const activity of latest) if (!firstByLead.has(activity.lead_id)) firstByLead.set(activity.lead_id, activity);
  const rows = leads.map((lead) => {
    const activity = firstByLead.get(lead.id);
    const presented = presentLead(lead);
    return { lead: presented, recent: activity ? presentActivity(activity) : null };
  });
  await logDataAccess(await accessActor(user.id), "list_my_leads", { counsellorId: counsellor.id });

  const outcomeFilter = filters.outcome ?? "";
  const filtersActive = Object.keys(filters).some((key) => key !== "page");
  const queryWithoutPage = encodeQuery({ ...filters, page: undefined });
  const pagerQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) if (key !== "page" && value) pagerQuery[key] = value;
  const statusDisplay = filters.status ? (new Map(allStatuses).get(filters.status) ?? filters.status) : "";
  const priorityDisplay = filters.priority ? (new Map(LEAD_PRIORITIES).get(filters.priority) ?? filters.priority) : "";
  const sourceName = /^\d+$/.test(filters.source ?? "") ? (sources.find((source) => source.id === Number(filters.source))?.name ?? "") : "";
  const outcomeDisplay = new Map(OUTCOME_FILTER_CHOICES).get(outcomeFilter as (typeof OUTCOME_FILTER_CHOICES)[number][0]) ?? outcomeFilter;

  return (
    <>
      <PageHeader title="My Leads" subtitle="Search, filter, and work your assigned applicant queue">
        <Link className="btn btn-primary btn-sm" href={reverse("counsellor_add_lead")}>Add Lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Assigned to me</div>
                <div className="admin-stat-num">{totalAssigned.toLocaleString()}</div>
                <p className="admin-stat-meta">Total leads in your queue</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-users" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Filtered view</div>
                <div className="admin-stat-num">{leads.paginator.count.toLocaleString()}</div>
                <p className="admin-stat-meta">
                  {filtersActive ? "Matching current filters" : "All assigned leads"}
                </p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-filter" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">On this page</div>
                <div className="admin-stat-num">{rows.length.toLocaleString()}</div>
                <p className="admin-stat-meta">Showing up to 50 per page</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-table-list" />
              </div>
            </div>
          </div>
          <Card
            title={<>My Assigned Leads <span className="badge badge-primary ml-2">{totalAssigned} leads</span></>}
            tools={<Link className="btn btn-primary btn-sm" href={reverse("counsellor_add_lead")}>Add Lead</Link>}
          >
            <form method="get" action={reverse("my_leads")} className="mb-3">
              <div className="row">
                <div className="col-lg-3 col-md-6">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_search">Search</label>
                    <input className="form-control form-control-sm" id="ml_search" name="search" defaultValue={field(query, "search")} placeholder="Name, email, phone, school, course…" />
                  </div>
                </div>
                <div className="col-lg-2 col-md-4">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_status">Status</label>
                    <select className="form-control form-control-sm" id="ml_status" name="status" defaultValue={filters.status ?? ""}>
                      <option value="">All statuses</option>
                      {statusChoices.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-4">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_priority">Priority</label>
                    <select className="form-control form-control-sm" id="ml_priority" name="priority" defaultValue={filters.priority ?? ""}>
                      <option value="">All priorities</option>
                      {LEAD_PRIORITIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-4">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_source">Source</label>
                    <select className="form-control form-control-sm" id="ml_source" name="source" defaultValue={filters.source ?? ""}>
                      <option value="">All sources</option>
                      {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-4">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_follow_up">Next visit</label>
                    <select className="form-control form-control-sm" id="ml_follow_up" name="follow_up" defaultValue={filters.follow_up ?? ""}>
                      <option value="">Any</option>
                      <option value="yes">Scheduled</option>
                      <option value="no">Not scheduled</option>
                    </select>
                  </div>
                </div>
                <div className="col-lg-1 col-md-4">
                  <div className="form-group mb-2">
                    <label>&nbsp;</label>
                    <button className="btn btn-primary btn-sm btn-block" type="submit">Filter</button>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-lg-3">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_outcome">Latest activity outcome</label>
                    <select className="form-control form-control-sm" id="ml_outcome" name="outcome" defaultValue={outcomeFilter}>
                      <option value="">All outcomes</option>
                      {OUTCOME_FILTER_CHOICES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_created_from">Lead created from</label>
                    <input className="form-control form-control-sm" id="ml_created_from" type="date" name="created_from" defaultValue={filters.created_from ?? ""} />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-group mb-2">
                    <label htmlFor="ml_created_to">Lead created to</label>
                    <input className="form-control form-control-sm" id="ml_created_to" type="date" name="created_to" defaultValue={filters.created_to ?? ""} />
                  </div>
                </div>
              </div>
              {filtersActive ? (
                <p className="mb-2">
                  <Link className="btn btn-sm btn-secondary mr-2" href={reverse("my_leads")}>Clear filters</Link>
                  <strong>{leads.paginator.count}</strong> leads match
                  {totalAssigned !== leads.paginator.count ? <span className="text-muted"> (of {totalAssigned} assigned to you)</span> : null}
                  {field(query, "search") ? <span className="badge badge-light border ml-1">Search: {field(query, "search")}</span> : null}
                  {statusDisplay ? <span className="badge badge-light border ml-1">Status: {statusDisplay}</span> : null}
                  {priorityDisplay ? <span className="badge badge-light border ml-1">{priorityDisplay}</span> : null}
                  {sourceName ? <span className="badge badge-light border ml-1">{sourceName}</span> : null}
                  {outcomeDisplay && outcomeFilter ? <span className="badge badge-light border ml-1">Outcome: {outcomeDisplay}</span> : null}
                </p>
              ) : null}
            </form>
            <Pager page={leads} path={reverse("my_leads")} query={pagerQuery} />
            {rows.length === 0 ? <Empty text="No leads match." /> : (
              <div className="table-responsive">
                <table className="table table-bordered table-striped">
                  <thead>
                    <tr>
                      <th>Lead ID</th><th>Name</th><th>Course / Exam</th><th>Email</th><th>Phone</th><th>Source</th>
                      <th>Status</th><th>Priority</th><th>Last Contact</th><th>Next Visit</th><th>Recent Activity</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ lead, recent }) => (
                      <tr key={lead.id}>
                        <td>{lead.lead_id}</td>
                        <td>{lead.first_name} {lead.last_name}</td>
                        <td>{lead.course_interested || "—"}</td>
                        <td>{lead.email}</td>
                        <td>
                          {lead.phone ? (
                            <RevealPhoneButton url={reverse("reveal_phone", lead.id)} masked={masked(lead.phone)} />
                          ) : <span className="text-muted">Not provided</span>}
                        </td>
                        <td>{lead.source?.name}</td>
                        <td><StatusBadge code={lead.status} /></td>
                        <td><PriorityBadge code={lead.priority} /></td>
                        <td>{lead.last_contact_date ? formatDjango(lead.last_contact_date, "M d, Y") : "Never"}</td>
                        <td>{lead.next_follow_up ? formatDjango(lead.next_follow_up, "M d, Y") : "Not scheduled"}</td>
                        <td>{recent ? recent.subject.slice(0, 70) : "—"}</td>
                        <td>
                          <Link className="btn btn-sm btn-info mr-1" href={reverse("lead_detail", lead.id)}>View</Link>
                          <Link className="btn btn-sm btn-success" href={`${reverse("add_lead_activity", lead.id)}${queryWithoutPage ? `?${queryWithoutPage}` : ""}`}>Activity</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={leads} path={reverse("my_leads")} query={pagerQuery} />
          </Card>
        </div>
      </section>
    </>
  );
}

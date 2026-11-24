import Link from "next/link";
import { Card, Empty, PageHeader, Pager, StatusBadge } from "@/components/ui";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma, type Prisma } from "@/lib/prisma";
import { formatDjango, localDayBounds, localToday, parseIsoDate } from "@/lib/time";
import { presentActivity, presentAll, presentLead } from "@/modules/presenters";
import {
  activityTypeChoices,
  DEFAULT_ACTIVITY_TYPES,
  DEFAULT_LEAD_STATUSES,
  LEAD_PRIORITIES,
  leadStatusChoices,
  templateLookups,
} from "@/modules/reference/reference.service";
import { requireSuperadmin } from "@/server/actor";
import { readSearch, type SearchParams } from "@/server/request";

export const metadata = { title: "Counsellor Work View" };

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark", "pink"]);

function badgeColor(value: string): string {
  const color = value.trim().toLowerCase();
  return BADGE_COLORS.has(color) ? color : "secondary";
}

function safeIcon(value: string): string {
  const icon = value.trim();
  return icon && /^[a-zA-Z0-9\s\-_]+$/.test(icon) && !icon.includes("..") ? icon : "fas fa-tasks";
}

function truncateWords(value: string, count: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.length > count ? `${words.slice(0, count).join(" ")} …` : words.join(" ");
}

export default async function CounsellorWorkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSuperadmin();
  const search = await readSearch(searchParams);
  const counsellorId = search.counsellor ?? "";
  const legacyDate = search.selected_date ?? "";
  let dateFrom = search.date_from || legacyDate;
  let dateTo = search.date_to || legacyDate;
  const activityType = search.activity_type ?? "";
  const activityStatus = search.activity_status ?? "";
  const leadStatus = search.lead_status ?? "";
  const leadSource = search.lead_source ?? "";
  const leadPriority = search.lead_priority ?? "";

  const today = localToday();
  dateFrom = parseIsoDate(dateFrom) ?? today;
  dateTo = parseIsoDate(dateTo || dateFrom) ?? dateFrom;
  if (dateTo < dateFrom) dateTo = dateFrom;
  const rangeStart = localDayBounds(dateFrom).start;
  const rangeEnd = new Date(localDayBounds(dateTo).end.getTime() - 1);

  const allCounsellors = await prisma.counsellor.findMany({
    where: { is_active: true },
    include: { admin: true },
    orderBy: { admin: { first_name: "asc" } },
  });

  const activityWhere: Prisma.LeadActivityWhereInput[] = [
    {
      OR: [
        { scheduled_date: { gte: rangeStart, lte: rangeEnd } },
        { completed_date: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
  ];
  const followupWhere: Prisma.LeadWhereInput[] = [{ next_follow_up: { gte: rangeStart, lte: rangeEnd } }];

  let selectedCounsellor: (typeof allCounsellors)[number] | null = null;
  if (/^\d+$/.test(counsellorId)) {
    selectedCounsellor = allCounsellors.find((counsellor) => counsellor.id === Number(counsellorId)) ?? null;
    if (selectedCounsellor) {
      activityWhere.push({ counsellor_id: selectedCounsellor.id });
      followupWhere.push({ assigned_counsellor_id: selectedCounsellor.id });
    }
  }
  if (activityType) activityWhere.push({ activity_type: activityType });
  if (activityStatus === "completed") activityWhere.push({ is_completed: true });
  else if (activityStatus === "pending") activityWhere.push({ is_completed: false });
  if (leadStatus) {
    activityWhere.push({ lead: { status: leadStatus } });
    followupWhere.push({ status: leadStatus });
  }
  if (/^-?\d+$/.test(leadSource)) {
    activityWhere.push({ lead: { source_id: Number(leadSource) } });
    followupWhere.push({ source_id: Number(leadSource) });
  }
  if (leadPriority) {
    activityWhere.push({ lead: { priority: leadPriority } });
    followupWhere.push({ priority: leadPriority });
  }

  const aWhere = { AND: activityWhere };
  const fWhere = { AND: followupWhere };
  const [completed, pending, totalFollowups, followups, activities, leadSources, typeChoices, statusChoices, lookups] =
    await Promise.all([
      prisma.leadActivity.count({ where: { AND: [...activityWhere, { is_completed: true }] } }),
      prisma.leadActivity.count({ where: { AND: [...activityWhere, { is_completed: false }] } }),
      prisma.lead.count({ where: fWhere }),
      prisma.lead.findMany({
        where: fWhere,
        include: { assigned_counsellor: { include: { admin: true } }, source: true },
        orderBy: { next_follow_up: "asc" },
        take: 100,
      }),
      paginate(
        search.page,
        50,
        () => prisma.leadActivity.count({ where: aWhere }),
        (skip, take) =>
          prisma.leadActivity.findMany({
            where: aWhere,
            include: { lead: { include: { source: true } }, counsellor: { include: { admin: true } } },
            orderBy: [{ scheduled_date: { sort: "desc", nulls: "last" } }, { completed_date: "desc" }],
            skip,
            take,
          }),
      ),
      prisma.leadSource.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
      activityTypeChoices(),
      leadStatusChoices(),
      templateLookups(),
    ]);

  presentAll(activities, (activity) => presentActivity(activity));
  presentAll(followups, (lead) => presentLead(lead));
  const activityTypes = typeChoices.length ? typeChoices : DEFAULT_ACTIVITY_TYPES;
  const statuses = statusChoices.length ? statusChoices : DEFAULT_LEAD_STATUSES;
  const selectedSourceName = /^\d+$/.test(leadSource) ? (leadSources.find((source) => source.id === Number(leadSource))?.name ?? "") : "";
  const filters = {
    counsellor: counsellorId,
    date_from: dateFrom,
    date_to: dateTo,
    activity_type: activityType,
    activity_status: activityStatus,
    lead_status: leadStatus,
    lead_source: leadSource,
    lead_priority: leadPriority,
  };

  return (
    <>
      <PageHeader title="Counsellor Work View" />
      <style>{`
        .stats-card { border-left: 4px solid #007bff; padding: 15px; margin-bottom: 20px; }
        .stats-card.success { border-left-color: #28a745; }
        .stats-card.warning { border-left-color: #ffc107; }
        .stats-card.info { border-left-color: #17a2b8; }
      `}</style>
      <section className="content">
        <div className="container-fluid">
          <Card
            title={
              <>
                <i className="fas fa-user-tie" /> Counsellor Work View
              </>
            }
            tools={
              <Link href={reverse("admin_home")} className="btn btn-sm btn-secondary">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            }
          >
            <form method="get" action={reverse("counsellor_work_view")} className="mb-4">
              <div className="row align-items-end">
                <div className="col-lg-4 col-md-6">
                  <div className="form-group">
                    <label htmlFor="counsellor">Counsellor</label>
                    <select className="form-control" id="counsellor" name="counsellor" defaultValue={counsellorId}>
                      <option value="">All Counsellors</option>
                      {allCounsellors.map((counsellor) => (
                        <option value={counsellor.id} key={counsellor.id}>
                          {counsellor.admin.first_name} {counsellor.admin.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-6">
                  <div className="form-group">
                    <label htmlFor="date_from">From date</label>
                    <input type="date" className="form-control" id="date_from" name="date_from" defaultValue={dateFrom} />
                  </div>
                </div>
                <div className="col-lg-2 col-md-6">
                  <div className="form-group">
                    <label htmlFor="date_to">To date</label>
                    <input type="date" className="form-control" id="date_to" name="date_to" defaultValue={dateTo} />
                  </div>
                </div>
                <div className="col-lg-4 col-md-12">
                  <div className="form-group mb-lg-0">
                    <label className="d-none d-lg-block">&nbsp;</label>
                    <div className="d-flex flex-wrap" style={{ gap: "0.5rem" }}>
                      <button type="submit" className="btn btn-primary flex-grow-1 flex-lg-grow-0">
                        <i className="fas fa-filter" /> Apply filters
                      </button>
                      <Link href={reverse("counsellor_work_view")} className="btn btn-secondary flex-grow-1 flex-lg-grow-0">
                        <i className="fas fa-times" /> Clear
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label htmlFor="activity_type">Activity type</label>
                    <select className="form-control" id="activity_type" name="activity_type" defaultValue={activityType}>
                      <option value="">All types</option>
                      {activityTypes.map(([code, label]) => (
                        <option value={code} key={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-6">
                  <div className="form-group">
                    <label htmlFor="activity_status">Activity status</label>
                    <select className="form-control" id="activity_status" name="activity_status" defaultValue={activityStatus}>
                      <option value="">All</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-6">
                  <div className="form-group">
                    <label htmlFor="lead_status">Lead status</label>
                    <select className="form-control" id="lead_status" name="lead_status" defaultValue={leadStatus}>
                      <option value="">All statuses</option>
                      {statuses.map(([code, label]) => (
                        <option value={code} key={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-lg-2 col-md-6">
                  <div className="form-group">
                    <label htmlFor="lead_source">Lead source</label>
                    <select className="form-control" id="lead_source" name="lead_source" defaultValue={leadSource}>
                      <option value="">All sources</option>
                      {leadSources.map((source) => (
                        <option value={source.id} key={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label htmlFor="lead_priority">Lead priority</label>
                    <select className="form-control" id="lead_priority" name="lead_priority" defaultValue={leadPriority}>
                      <option value="">All priorities</option>
                      {LEAD_PRIORITIES.map(([code, label]) => (
                        <option value={code} key={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="row mt-2">
                <div className="col-12">
                  <small className="text-muted d-flex flex-wrap align-items-center" style={{ gap: "0.35rem" }}>
                    <span className="badge badge-secondary">
                      Period: {dateFrom} → {dateTo}
                    </span>
                    {selectedCounsellor ? (
                      <span className="badge badge-info">
                        Counsellor: {selectedCounsellor.admin.first_name} {selectedCounsellor.admin.last_name}
                      </span>
                    ) : null}
                    {activityType ? <span className="badge badge-primary">Type: {activityType}</span> : null}
                    {activityStatus ? <span className="badge badge-primary">Activity: {activityStatus}</span> : null}
                    {leadStatus ? <span className="badge badge-primary">Lead status: {leadStatus}</span> : null}
                    {leadSource ? <span className="badge badge-primary">Source: {selectedSourceName || leadSource}</span> : null}
                    {leadPriority ? <span className="badge badge-primary">Priority: {leadPriority}</span> : null}
                  </small>
                </div>
              </div>
            </form>

            <div className="row mb-4">
              {[
                ["info", "Total Activities", activities.paginator.count],
                ["success", "Completed", completed],
                ["warning", "Pending", pending],
                ["", "Visit Dates", totalFollowups],
              ].map(([tone, label, value]) => (
                <div className="col-md-3" key={String(label)}>
                  <div className={`card stats-card ${tone}`}>
                    <div className="card-body">
                      <h5 className="card-title">{label}</h5>
                      <h3 className="mb-0">{value}</h3>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Card
              title={
                <>
                  <i className="fas fa-tasks" /> Activities
                </>
              }
            >
              {activities.paginator.count === 0 ? (
                <Empty text="No activities found for the selected filters." />
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-bordered table-striped">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Counsellor</th>
                          <th>Lead</th>
                          <th>Activity Type</th>
                          <th>Subject</th>
                          <th>Description</th>
                          <th>Status</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((activity) => {
                          const type = lookups.activity_type_map[activity.activity_type];
                          const when = activity.scheduled_date ?? activity.completed_date;
                          return (
                            <tr key={activity.id}>
                              <td>{formatDjango(when, "M d, Y H:i")}</td>
                              <td>
                                {activity.counsellor ? (
                                  `${activity.counsellor.admin.first_name} ${activity.counsellor.admin.last_name}`
                                ) : (
                                  <span className="text-muted">Unassigned</span>
                                )}
                              </td>
                              <td>
                                <Link href={reverse("admin_view_lead", activity.lead.id)}>
                                  {activity.lead.first_name} {activity.lead.last_name}
                                </Link>
                              </td>
                              <td>
                                {type ? (
                                  <span className={`badge badge-${badgeColor(type.color)}`}>
                                    <i className={`${safeIcon(type.icon)} mr-1`} />
                                    {type.name}
                                  </span>
                                ) : (
                                  <span className="badge badge-info">{activity.activity_type}</span>
                                )}
                              </td>
                              <td>{activity.subject}</td>
                              <td>{truncateWords(activity.description, 10) || "-"}</td>
                              <td>
                                {activity.is_completed ? (
                                  <span className="badge badge-success">Completed</span>
                                ) : (
                                  <span className="badge badge-warning">Pending</span>
                                )}
                              </td>
                              <td>{activity.duration} min</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3">
                    <Pager page={activities} path={reverse("counsellor_work_view")} query={filters} />
                  </div>
                </>
              )}
            </Card>

            <div className="mt-4">
              <Card
                title={
                  <>
                    <i className="fas fa-calendar" /> Visit Dates <small className="text-muted">(up to 100 in range)</small>
                  </>
                }
              >
                {followups.length === 0 ? (
                  <Empty text="No visit dates in this period for the selected filters." />
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-striped">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Counsellor</th>
                          <th>Lead</th>
                          <th>Course / Exam</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {followups.map((lead) => (
                          <tr key={lead.id}>
                            <td>{formatDjango(lead.next_follow_up, "M d, Y H:i")}</td>
                            <td>
                              {lead.assigned_counsellor ? (
                                `${lead.assigned_counsellor.admin.first_name} ${lead.assigned_counsellor.admin.last_name}`
                              ) : (
                                <span className="text-muted">Unassigned</span>
                              )}
                            </td>
                            <td>
                              <Link href={reverse("admin_view_lead", lead.id)}>
                                {lead.first_name} {lead.last_name}
                              </Link>
                            </td>
                            <td>{lead.course_interested || "-"}</td>
                            <td>
                              <StatusBadge code={lead.status} />
                            </td>
                            <td>
                              <Link href={reverse("admin_view_lead", lead.id)} className="btn btn-sm btn-info">
                                <i className="fas fa-eye" /> View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

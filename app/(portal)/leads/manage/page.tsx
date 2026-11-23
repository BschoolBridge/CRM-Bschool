import Link from "next/link";
import { Card, Empty, PageHeader, Pager, PriorityBadge, StatusBadge } from "@/components/ui";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { extractManageLeadFilters, leadListInclude, manageLeadsWhere, UNASSIGNED } from "@/modules/leads/lead.queries";
import { fullName, presentAll, presentCounsellor, presentLead } from "@/modules/presenters";
import { activeLeadStatusChoices, allLeadStatusChoices, LEAD_PRIORITIES } from "@/modules/reference/reference.service";
import { requireAdmin } from "@/server/actor";
import { adminCan } from "@/server/auth";
import { readSearch, type SearchParams } from "@/server/request";
import { DELETE_ALL_CONFIRM_PHRASE } from "../format";
import { ConfirmButton, SelectAll } from "./controls";
import { bulkDeleteLeads, deleteAllLeads, deleteListedLead, openBulkTransfer } from "../mutations";

export const metadata = { title: "Manage Leads" };

function rowNumber(total: number, startIndex: number, index0: number): number {
  if (![total, startIndex, index0].every(Number.isFinite)) return 1;
  return Math.max(total - startIndex - index0 + 1, 1);
}

export default async function ManageLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAdmin();
  const search = await readSearch(searchParams);
  const filters = extractManageLeadFilters(search);
  const where = await manageLeadsWhere(search);
  const canDelete = adminCan(user.admin_profile, "delete");

  const [leads, totalInSystem, unassignedCount, counsellors, sources, statusChoices, allStatuses] = await Promise.all([
    paginate(
      search.page,
      50,
      () => prisma.lead.count({ where }),
      (skip, take) => prisma.lead.findMany({ where, include: leadListInclude, orderBy: { id: "desc" }, skip, take }),
    ),
    prisma.lead.count(),
    prisma.lead.count({ where: { assigned_counsellor_id: null } }),
    prisma.counsellor.findMany({ where: { is_active: true }, include: { admin: true }, orderBy: { admin: { first_name: "asc" } } }),
    prisma.leadSource.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
    activeLeadStatusChoices(),
    allLeadStatusChoices(),
  ]);
  presentAll(leads, (lead) => presentLead(lead));
  const counsellorRows = presentAll(counsellors, (counsellor) => presentCounsellor(counsellor));

  let selectedCounsellorName = "";
  if (filters.counsellor === UNASSIGNED) selectedCounsellorName = "Not assigned";
  else if (filters.counsellor && /^\d+$/.test(filters.counsellor)) {
    const counsellor = await prisma.counsellor.findUnique({ where: { id: Number(filters.counsellor) }, include: { admin: true } });
    if (counsellor) selectedCounsellorName = `${counsellor.admin.first_name} ${counsellor.admin.last_name}`;
  }
  let selectedSourceName = "";
  if (filters.source && /^\d+$/.test(filters.source)) {
    selectedSourceName = (await prisma.leadSource.findUnique({ where: { id: Number(filters.source) } }))?.name ?? "";
  }

  const statusDisplay = filters.status ? (new Map(allStatuses).get(filters.status) ?? filters.status) : "";
  const priorityDisplay = filters.priority ? (new Map(LEAD_PRIORITIES).get(filters.priority) ?? filters.priority) : "";
  const filtersActive = Object.keys(filters).length > 0;
  const filteredCount = leads.paginator.count;

  return (
    <>
      <PageHeader
        title="Manage Leads"
        subtitle="Search, filter, assign, and manage aspirants across all counselling stages"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Top Metric Cards */}
          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total in CRM</div>
                <div className="admin-stat-num">{totalInSystem.toLocaleString()}</div>
                <p className="admin-stat-meta">Total applicant pool</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-users" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Filtered View</div>
                <div className="admin-stat-num">{filteredCount.toLocaleString()}</div>
                <p className="admin-stat-meta">
                  {filtersActive ? "Matching current filter" : "All records in current view"}
                </p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-filter" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Unassigned Leads</div>
                <div className="admin-stat-num">{unassignedCount.toLocaleString()}</div>
                <p className="admin-stat-meta">
                  {unassignedCount > 0 ? "Awaiting counsellor assignment" : "All leads assigned"}
                </p>
              </div>
              <div
                className="admin-stat-icon"
                style={{
                  background: unassignedCount > 0 ? "#fffbeb" : "#ecfdf5",
                  color: unassignedCount > 0 ? "#d97706" : "#059669",
                }}
              >
                <i className="fas fa-user-clock" />
              </div>
            </div>
          </div>

          <Card
            title="Leads Directory"
            tools={
              <div className="d-flex align-items-center flex-wrap" style={{ gap: "0.5rem" }}>
                <Link href={reverse("add_lead")} className="btn btn-primary btn-sm font-weight-bold">
                  <i className="fas fa-user-plus mr-1" /> Add Lead
                </Link>
                <Link href={reverse("import_leads")} className="btn btn-outline-secondary btn-sm font-weight-500">
                  <i className="fas fa-file-arrow-up mr-1" /> Import CSV
                </Link>
                <Link href={reverse("assign_leads_to_counsellors")} className="btn btn-outline-warning btn-sm font-weight-500">
                  <i className="fas fa-share-nodes mr-1" /> Assign Leads
                </Link>
                {canDelete && totalInSystem > 0 ? (
                  <button type="button" className="btn btn-outline-danger btn-sm" data-toggle="modal" data-target="#deleteAllLeadsModal">
                    <i className="fas fa-trash-alt mr-1" /> Delete all
                  </button>
                ) : null}
              </div>
            }
          >
            <form method="get" action={reverse("manage_leads")} className="mb-3">
              <div className="row">
                <div className="col-md-3">
                  <div className="form-group">
                    <label htmlFor="search">Search</label>
                    <input
                      type="text"
                      className="form-control"
                      id="search"
                      name="search"
                      placeholder="Name (first, last, or full), phone, email, school…"
                      defaultValue={filters.search ?? ""}
                    />
                    <small className="form-text text-muted">Searches the full lead list. Press Enter or click Filter.</small>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select className="form-control" id="status" name="status" defaultValue={filters.status ?? ""}>
                      <option value="">All Statuses</option>
                      {statusChoices.map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="form-group">
                    <label htmlFor="priority">Priority</label>
                    <select className="form-control" id="priority" name="priority" defaultValue={filters.priority ?? ""}>
                      <option value="">All Priorities</option>
                      {LEAD_PRIORITIES.map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="form-group">
                    <label htmlFor="counsellor">Counsellor</label>
                    <select className="form-control" id="counsellor" name="counsellor" defaultValue={filters.counsellor ?? ""}>
                      <option value="">All Counsellors</option>
                      <option value={UNASSIGNED}>Not assigned</option>
                      {counsellorRows.map((counsellor) => (
                        <option key={counsellor.id} value={String(counsellor.id)}>{fullName(counsellor.admin)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="form-group">
                    <label htmlFor="source">Source</label>
                    <select className="form-control" id="source" name="source" defaultValue={filters.source ?? ""}>
                      <option value="">All Sources</option>
                      {sources.map((source) => (
                        <option key={source.id} value={String(source.id)}>{source.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-1">
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button type="submit" className="btn btn-primary btn-block">Filter</button>
                  </div>
                </div>
              </div>
              {filtersActive ? (
                <div className="mb-2">
                  <Link href={reverse("manage_leads")} className="btn btn-sm btn-secondary">Clear Filters</Link>
                  <span className="ml-2">
                    {filters.search ? <span className="badge badge-info mr-1">Search: {filters.search}</span> : null}
                    {filters.status ? <span className="badge badge-info mr-1">Status: {statusDisplay}</span> : null}
                    {filters.priority ? <span className="badge badge-info mr-1">Priority: {priorityDisplay}</span> : null}
                    {filters.counsellor ? <span className="badge badge-info mr-1">Counsellor: {selectedCounsellorName}</span> : null}
                    {filters.source ? <span className="badge badge-info mr-1">Source: {selectedSourceName}</span> : null}
                  </span>
                </div>
              ) : null}
            </form>

            {filtersActive ? (
              <div className="d-flex align-items-center justify-content-between flex-wrap border rounded px-3 py-2 mb-3">
                <div>
                  <strong>{filteredCount}</strong> lead{filteredCount === 1 ? "" : "s"} match{filteredCount === 1 ? "es" : ""} your filters
                  {totalInSystem !== filteredCount ? <span className="text-muted ml-1">(of {totalInSystem} total in CRM)</span> : null}
                </div>
                <form action={openBulkTransfer} className="mt-2 mt-md-0">
                  <input type="hidden" name="transfer_scope" value="filtered" />
                  <input type="hidden" name="search" value={filters.search ?? ""} />
                  <input type="hidden" name="status" value={filters.status ?? ""} />
                  <input type="hidden" name="priority" value={filters.priority ?? ""} />
                  <input type="hidden" name="counsellor" value={filters.counsellor ?? ""} />
                  <input type="hidden" name="source" value={filters.source ?? ""} />
                  <ConfirmButton className="btn btn-sm btn-warning" confirm={`Transfer all ${filteredCount} lead(s) matching your current filters?`}>
                    Transfer all {filteredCount} matching
                  </ConfirmButton>
                </form>
              </div>
            ) : null}

            <Pager page={leads} path={reverse("manage_leads")} query={filters} />

            <form action={bulkDeleteLeads} className="mt-3">
              <input type="hidden" name="transfer_scope" value="selected" />
              <div className="table-responsive">
                <table className="table table-bordered table-striped">
                  <thead>
                    <tr>
                      <th><SelectAll /></th>
                      <th>#</th>
                      <th>Lead ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Course Interested In</th>
                      <th>School Name</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Counsellor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={12}><Empty text="No leads found." /></td>
                      </tr>
                    ) : (
                      leads.map((lead, index) => (
                        <tr key={lead.id}>
                          <td>
                            <input type="checkbox" className="lead-checkbox" name="lead_ids" value={lead.id} />
                          </td>
                          <td>{rowNumber(filteredCount, leads.start_index, index)}</td>
                          <td><code>{lead.lead_id || "—"}</code></td>
                          <td>{lead.first_name} {lead.last_name}</td>
                          <td>
                            {lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : <span className="text-muted">Not provided</span>}
                          </td>
                          <td>{lead.course_interested || "-"}</td>
                          <td>{lead.school_name || "-"}</td>
                          <td>{lead.source.name}</td>
                          <td><StatusBadge code={lead.status} /></td>
                          <td><PriorityBadge code={lead.priority} /></td>
                          <td>
                            {lead.assigned_counsellor ? fullName(lead.assigned_counsellor.admin) : <span className="text-muted">Not assigned</span>}
                          </td>
                          <td className="text-nowrap">
                            <div className="table-actions-group">
                              <Link href={reverse("admin_view_lead", lead.id)} className="btn-table-action btn-outline-primary" title="View Lead Profile">
                                <i className="fas fa-eye" /> View
                              </Link>
                              <Link href={reverse("edit_lead", lead.id)} className="btn-table-action btn-outline-secondary" title="Edit Lead">
                                <i className="fas fa-pen" /> Edit
                              </Link>
                              <Link href={reverse("transfer_lead", lead.id)} className="btn-table-action btn-outline-warning" title="Transfer Lead">
                                <i className="fas fa-share" /> Transfer
                              </Link>
                              {canDelete ? (
                                <ConfirmButton
                                  formAction={deleteListedLead}
                                  name="lead_id"
                                  value={String(lead.id)}
                                  className="btn-table-action btn-outline-danger"
                                  confirm="Are you sure you want to delete this lead?"
                                  title="Delete Lead"
                                >
                                  <i className="fas fa-trash" />
                                </ConfirmButton>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <ConfirmButton formAction={openBulkTransfer} className="btn btn-warning mt-2 mr-2">
                Transfer Selected
              </ConfirmButton>
              <ConfirmButton className="btn btn-danger mt-2" confirm="Are you sure you want to delete the selected leads?">
                Delete Selected
              </ConfirmButton>
            </form>
            <div className="mt-3">
              <Pager page={leads} path={reverse("manage_leads")} query={filters} />
            </div>
          </Card>
        </div>
      </section>
      {canDelete && totalInSystem > 0 ? (
        <div className="modal fade" id="deleteAllLeadsModal" tabIndex={-1} role="dialog" aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Delete all leads</h5>
                <button type="button" className="close text-white" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <form action={deleteAllLeads}>
                <div className="modal-body">
                  <p className="font-weight-bold">This will permanently delete all {totalInSystem} lead(s) in the database.</p>
                  <p className="text-muted small">This is not limited to the current page or filters.</p>
                  <p>
                    Type <code>{DELETE_ALL_CONFIRM_PHRASE}</code> to confirm.
                  </p>
                  <div className="form-group">
                    <label htmlFor="confirm_text">Confirmation</label>
                    <input type="text" className="form-control" id="confirm_text" name="confirm_text" autoComplete="off" placeholder={DELETE_ALL_CONFIRM_PHRASE} required />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-danger">Delete every lead</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

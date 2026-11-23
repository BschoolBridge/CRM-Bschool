import Link from "next/link";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { reverse, withQuery } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { presentCounsellor } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { adminCan } from "@/server/auth";
import { readSearch, type SearchParams } from "@/server/request";
import { deleteCounsellorById } from "@/modules/users/delete-counsellor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Counsellors" };

async function remove(id: number) {
  "use server";
  await deleteCounsellorById(id);
}

export default async function ManageCounsellorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAdmin();
  const search = await readSearch(searchParams);
  const [counsellors, activeCounsellorsCount, totalAssignedCount] = await Promise.all([
    paginate(
      search.page,
      10,
      () => prisma.counsellor.count(),
      (skip, take) =>
        prisma.counsellor.findMany({
          include: { admin: true, _count: { select: { leads: true } } },
          orderBy: [{ joining_date: "desc" }, { id: "desc" }],
          skip,
          take,
        }),
    ),
    prisma.counsellor.count({ where: { is_active: true } }),
    prisma.lead.count({ where: { assigned_counsellor_id: { not: null } } }),
  ]);

  for (const counsellor of counsellors) {
    Object.assign(presentCounsellor(counsellor), { assigned_lead_count: counsellor._count.leads });
  }
  const superadmin = Boolean(user.admin_profile?.is_superadmin);
  const canDelete = adminCan(user.admin_profile, "delete");

  return (
    <>
      <PageHeader
        title="Manage Counsellors"
        subtitle="View counselling team roster, workloads, and performance tracking"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Team Metric Cards */}
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total Counsellors</div>
                <div className="admin-stat-num">{counsellors.paginator.count}</div>
                <p className="admin-stat-meta">Team members registered</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-users" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Active Team</div>
                <div className="admin-stat-num">{activeCounsellorsCount}</div>
                <p className="admin-stat-meta">Available for lead distribution</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-user-check" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total Assigned Leads</div>
                <div className="admin-stat-num">{totalAssignedCount.toLocaleString()}</div>
                <p className="admin-stat-meta">Active candidate portfolios</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-folder-open" />
              </div>
            </div>
          </div>

          <Card
            title="Counsellor Roster"
            tools={
              <Link className="btn btn-primary btn-sm font-weight-bold" href={reverse("add_counsellor")}>
                <i className="fas fa-user-plus mr-1" /> Add Counsellor
              </Link>
            }
          >
            {counsellors.length === 0 ? (
              <Empty text="No counsellors yet." />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover table-striped">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Department</th>
                        <th>Leads</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {counsellors.map((counsellor) => {
                        const leads = counsellor._count.leads;
                        return (
                          <tr key={counsellor.id}>
                            <td>{counsellor.id}</td>
                            <td>
                              <span className="badge badge-light border text-monospace">{counsellor.employee_id}</span>
                            </td>
                            <td className="font-weight-600 text-dark">
                              {counsellor.admin.first_name} {counsellor.admin.last_name}
                            </td>
                            <td>{counsellor.admin.email}</td>
                            <td>{counsellor.admin.phone || "-"}</td>
                            <td>{counsellor.department || "General"}</td>
                            <td>
                              <span className="badge badge-info">
                                {leads} lead{leads === 1 ? "" : "s"}
                              </span>
                            </td>
                            <td>
                              {counsellor.is_active ? (
                                <span className="badge badge-success">Active</span>
                              ) : (
                                <span className="badge badge-danger">Inactive</span>
                              )}
                            </td>
                            <td className="text-nowrap">
                              <div className="table-actions-group">
                                <Link
                                  className="btn-table-action btn-outline-primary"
                                  href={reverse("counsellor_detail", counsellor.id)}
                                  title="View Details"
                                >
                                  <i className="fas fa-chart-pie" /> Details
                                </Link>
                                <Link
                                  className="btn-table-action btn-outline-warning"
                                  href={withQuery(reverse("manage_leads"), { counsellor: counsellor.id })}
                                  title="Assigned Leads"
                                >
                                  <i className="fas fa-list" /> Leads
                                </Link>
                                {superadmin ? (
                                  <Link
                                    className="btn-table-action btn-outline-secondary"
                                    href={withQuery(reverse("counsellor_work_view"), { counsellor: counsellor.id })}
                                    title="Activity Work Log"
                                  >
                                    <i className="fas fa-briefcase" /> Work log
                                  </Link>
                                ) : null}
                                <Link
                                  className="btn-table-action btn-outline-secondary"
                                  href={reverse("edit_counsellor", counsellor.id)}
                                  title="Edit Counsellor"
                                >
                                  <i className="fas fa-edit" /> Edit
                                </Link>
                                {canDelete ? (
                                  <PostButton
                                    action={remove.bind(null, counsellor.id)}
                                    className="btn-table-action btn-outline-danger"
                                    confirm="Are you sure you want to delete this counsellor?"
                                    title="Delete Counsellor"
                                  >
                                    <i className="fas fa-trash" />
                                  </PostButton>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager page={counsellors} path={reverse("manage_counsellors")} />
              </>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

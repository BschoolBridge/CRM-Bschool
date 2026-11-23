import Link from "next/link";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { reverse } from "@/http/urls";
import { LIST_PAGE_SIZE, paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { presentUser } from "@/modules/presenters";
import { requireSuperadmin } from "@/server/actor";
import { USER_TYPE_ADMIN } from "@/server/auth";
import { readSearch, type SearchParams } from "@/server/request";
import { deleteAdminById } from "@/modules/users/delete-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Admin Users" };

async function remove(id: number) {
  "use server";
  await deleteAdminById(id);
}

export default async function ManageAdminsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireSuperadmin();
  const search = await readSearch(searchParams);
  const admins = await paginate(
    search.page,
    LIST_PAGE_SIZE,
    () => prisma.admin.count(),
    (skip, take) =>
      prisma.admin.findMany({
        include: { admin: true },
        orderBy: { admin: { date_joined: "desc" } },
        skip,
        take,
      }),
  );
  const superadminCount = admins.filter((a) => a.is_superadmin).length;
  const activeAdminsCount = admins.filter((a) => a.admin.is_active).length;

  return (
    <>
      <PageHeader
        title="Manage Admin Users"
        subtitle="Manage administrative accounts, role permissions, and system access"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Top Metric Cards */}
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total Administrators</div>
                <div className="admin-stat-num">{admins.paginator.count}</div>
                <p className="admin-stat-meta">Platform administrative users</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-user-shield" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Super Administrators</div>
                <div className="admin-stat-num">{superadminCount}</div>
                <p className="admin-stat-meta">Full root access enabled</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-crown" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Active Accounts</div>
                <div className="admin-stat-num">{activeAdminsCount}</div>
                <p className="admin-stat-meta">Authorized to log in</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-shield-halved" />
              </div>
            </div>
          </div>

          <Card
            title="Administrator Accounts"
            tools={
              <Link className="btn btn-primary btn-sm font-weight-bold" href={reverse("add_admin")}>
                <i className="fas fa-user-plus mr-1" /> Add Admin User
              </Link>
            }
          >
            {admins.length === 0 ? (
              <Empty text="No admin users yet." />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Gender</th>
                      <th>Status</th>
                      <th>Date Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id}>
                        <td>{admin.id}</td>
                        <td className="font-weight-600 text-dark">
                          <i className="fas fa-user-tie text-muted mr-2" />
                          {admin.admin.first_name} {admin.admin.last_name}
                        </td>
                        <td>{admin.admin.email}</td>
                        <td>{admin.admin.phone || "-"}</td>
                        <td>
                          {admin.admin.gender === "M" ? (
                            <span className="badge badge-light border">Male</span>
                          ) : admin.admin.gender === "F" ? (
                            <span className="badge badge-light border">Female</span>
                          ) : (
                            <span className="badge badge-light border">-</span>
                          )}
                        </td>
                        <td>
                          {admin.admin.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-danger">Inactive</span>
                          )}
                        </td>
                        <td>{formatDjango(admin.admin.date_joined, "M d, Y")}</td>
                        <td className="text-nowrap">
                          <div className="table-actions-group">
                            <Link
                              className="btn-table-action btn-outline-secondary"
                              href={reverse("edit_admin", admin.id)}
                              title="Edit Admin"
                            >
                              <i className="fas fa-edit" /> Edit
                            </Link>
                            {admin.admin_id === user.id ? (
                              <span className="badge badge-light border ml-1">Current User</span>
                            ) : (
                              <PostButton
                                action={remove.bind(null, admin.id)}
                                className="btn-table-action btn-outline-danger"
                                confirm="Are you sure you want to delete this admin user?"
                                title="Delete Admin"
                              >
                                <i className="fas fa-trash" />
                              </PostButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={admins} path={reverse("manage_admins")} />
          </Card>
        </div>
      </section>
    </>
  );
}

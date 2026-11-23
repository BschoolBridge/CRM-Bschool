import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader } from "@/components/ui";
import { config } from "@/config/env";
import { reverse, withQuery } from "@/http/urls";
import { isForeignKeyViolation, prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { requirePermission } from "@/server/actor";
import { adminCan } from "@/server/auth";
import { flash } from "@/server/flash";

export const metadata = { title: "Manage Lead Sources" };

function detail(err: unknown): string {
  return config.debug && err instanceof Error ? err.message : "please try again.";
}

async function deleteSource(id: number): Promise<void> {
  "use server";
  await requirePermission("delete");
  const source = await prisma.leadSource.findUnique({ where: { id } });
  if (!source) notFound();
  try {
    await prisma.leadSource.delete({ where: { id: source.id } });
    await flash("success", "Lead source deleted successfully!");
  } catch (err) {
    await flash(
      "error",
      isForeignKeyViolation(err)
        ? "Could not delete lead source: it is still used by existing leads."
        : `Could not delete lead source: ${detail(err)}`,
    );
  }
  redirect(reverse("manage_lead_sources"));
}

export default async function ManageLeadSourcesPage() {
  const user = await requirePermission("settings");
  const canDelete = adminCan(user.admin_profile, "delete");
  const rows = await prisma.leadSource.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });
  const sources = rows.map((source) => ({ ...source, lead_count: source._count.leads }));

  const activeSources = sources.filter((s) => s.is_active).length;
  const totalLeadsFromSources = sources.reduce((a, b) => a + b.lead_count, 0);

  return (
    <>
      <PageHeader
        title="Manage Lead Sources"
        subtitle="Configure lead acquisition channels, tracking parameters, and campaign sources"
      />
      <section className="content">
        <div className="container-fluid">
          {/* Top Metric Cards */}
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total Lead Sources</div>
                <div className="admin-stat-num">{sources.length}</div>
                <p className="admin-stat-meta">Configured channels</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-tags" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Active Channels</div>
                <div className="admin-stat-num">{activeSources}</div>
                <p className="admin-stat-meta">Currently receiving incoming leads</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-tower-broadcast" />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Total Leads Captured</div>
                <div className="admin-stat-num">{totalLeadsFromSources.toLocaleString()}</div>
                <p className="admin-stat-meta">Cumulative aspirants attributed</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                <i className="fas fa-users" />
              </div>
            </div>
          </div>

          <Card
            title="Lead Sources & Acquisition Channels"
            tools={
              <Link href={reverse("add_lead_source")} className="btn btn-primary btn-sm font-weight-bold">
                <i className="fas fa-plus mr-1" /> Add Lead Source
              </Link>
            }
          >
            {sources.length === 0 ? (
              <div className="text-center py-4">
                <Empty text="No lead sources found." />
                <Link href={reverse("add_lead_source")}>Add your first lead source</Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Source Name</th>
                      <th>Description</th>
                      <th>Total Leads</th>
                      <th>Status</th>
                      <th>Created Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.id}>
                        <td>{source.id}</td>
                        <td className="font-weight-600 text-dark">
                          <i className="fas fa-tag text-muted mr-2" />
                          {source.name}
                        </td>
                        <td>{source.description || "—"}</td>
                        <td>
                          <span className="badge badge-info">
                            {source.lead_count} lead{source.lead_count === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td>
                          {source.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-danger">Inactive</span>
                          )}
                        </td>
                        <td>{formatDjango(source.created_at, "M d, Y")}</td>
                        <td className="text-nowrap">
                          <div className="table-actions-group">
                            <Link
                              href={reverse("lead_source_detail", source.id)}
                              className="btn-table-action btn-outline-primary"
                              title="Status Breakdown"
                            >
                              <i className="fas fa-chart-pie" /> Details
                            </Link>
                            <Link
                              href={withQuery(reverse("manage_leads"), { source: source.id })}
                              className="btn-table-action btn-outline-warning"
                              title="View Leads"
                            >
                              <i className="fas fa-list" /> Leads
                            </Link>
                            <Link
                              href={reverse("edit_lead_source", source.id)}
                              className="btn-table-action btn-outline-secondary"
                              title="Edit Source"
                            >
                              <i className="fas fa-edit" /> Edit
                            </Link>
                            {canDelete ? (
                              <PostButton
                                action={deleteSource.bind(null, source.id)}
                                className="btn-table-action btn-outline-danger"
                                confirm="Are you sure you want to delete this lead source?"
                                title="Delete Source"
                              >
                                <i className="fas fa-trash" />
                              </PostButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

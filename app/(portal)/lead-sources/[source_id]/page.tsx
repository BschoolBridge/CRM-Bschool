import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse, withQuery } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { leadSourceBreakdown } from "@/modules/dashboard/reports.service";
import { requirePermission } from "@/server/actor";
import { requiredId } from "@/server/request";

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark", "pink"]);

function badgeColor(value: string): string {
  const color = value.trim().toLowerCase();
  return BADGE_COLORS.has(color) ? color : "secondary";
}

export async function generateMetadata({ params }: { params: Promise<{ source_id: string }> }) {
  const source = await prisma.leadSource.findUnique({ where: { id: requiredId((await params).source_id) } });
  return { title: `${source ? `Lead Source: ${source.name}` : "Lead Source"}` };
}

export default async function LeadSourceDetailPage({ params }: { params: Promise<{ source_id: string }> }) {
  await requirePermission("settings");
  const source = await prisma.leadSource.findUnique({ where: { id: requiredId((await params).source_id) } });
  if (!source) notFound();
  const [{ total, counts, breakdown }, touched] = await Promise.all([
    leadSourceBreakdown(source.id),
    prisma.lead.count({ where: { source_id: source.id, last_contact_date: { not: null } } }),
  ]);
  const contacted = counts.CONTACTED ?? 0;
  const fresh = counts.NEW ?? 0;
  const won = counts.CLOSED_WON ?? 0;
  const lost = counts.CLOSED_LOST ?? 0;
  const uncontacted = Math.max(total - touched, 0);
  const leadsUrl = withQuery(reverse("manage_leads"), { source: source.id });

  return (
    <>
      <PageHeader title={`Lead Source: ${source.name}`} />
      <style>{`
        .source-stat-card { border: 1px solid #dee2e6; border-radius: 4px; background: #fff; }
        .source-stat-card .stat-value { font-size: 1.75rem; font-weight: 700; color: #212529; line-height: 1.2; }
        .source-stat-card .stat-label { color: #495057; font-size: 0.875rem; font-weight: 500; }
        .status-progress { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .status-progress-bar { height: 100%; background: #007bff; }
      `}</style>
      <section className="content">
        <div className="container-fluid">
          <div className="row mb-3">
            <div className="col-12">
              <Link href={reverse("manage_lead_sources")} className="btn btn-secondary btn-sm">
                <i className="fas fa-arrow-left" /> Back to Lead Sources
              </Link>
              <Link href={leadsUrl} className="btn btn-primary btn-sm ml-1">
                <i className="fas fa-list" /> View all leads from this source
              </Link>
              <Link href={reverse("edit_lead_source", source.id)} className="btn btn-info btn-sm ml-1">
                <i className="fas fa-edit" /> Edit source
              </Link>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-4">
              <div className="card card-primary card-outline">
                <div className="card-header">
                  <h3 className="card-title">{source.name}</h3>
                  <div className="card-tools">
                    {source.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                  </div>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-2">{source.description || "No description"}</p>
                  <p className="mb-0 small text-muted">Created {formatDjango(source.created_at, "M d, Y")}</p>
                </div>
              </div>
            </div>
            <div className="col-lg-8">
              <div className="row">
                {[
                  ["text-primary", total, "Total leads"],
                  ["text-warning", fresh, "New"],
                  ["text-info", contacted, "Contacted (status)"],
                  ["text-success", touched, "Reached (last contact set)"],
                  ["text-secondary", uncontacted, "Never contacted"],
                ].map(([color, value, label]) => (
                  <div className="col-sm-6 col-md-4 mb-3" key={String(label)}>
                    <div className="source-stat-card p-3 text-center h-100">
                      <div className={`stat-value ${color}`}>{value}</div>
                      <div className="stat-label">{label}</div>
                    </div>
                  </div>
                ))}
                <div className="col-sm-6 col-md-4 mb-3">
                  <div className="source-stat-card p-3 text-center h-100">
                    <div className="stat-value">
                      <span className="text-success">{won}</span>
                      <span className="text-muted">/</span>
                      <span className="text-danger">{lost}</span>
                    </div>
                    <div className="stat-label">Won / Lost</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Card title="Leads by status">
            {breakdown.length === 0 ? (
              <Empty text="No leads linked to this source yet." />
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th className="text-center" style={{ width: 120 }}>Leads</th>
                      <th className="text-center" style={{ width: 100 }}>Share</th>
                      <th style={{ minWidth: 180 }}>Distribution</th>
                      <th style={{ width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.code}>
                        <td>
                          <span className={`badge badge-${badgeColor(row.color)}`}>{row.name}</span>
                          <code className="small text-muted ml-1">{row.code}</code>
                        </td>
                        <td className="text-center">
                          <strong>{row.count}</strong>
                        </td>
                        <td className="text-center">{row.percent}%</td>
                        <td>
                          <div className="status-progress">
                            <div className="status-progress-bar" style={{ width: `${row.percent}%`, opacity: row.count ? 1 : 0.25 }} />
                          </div>
                        </td>
                        <td>
                          {row.count ? (
                            <Link
                              href={withQuery(reverse("manage_leads"), { source: source.id, status: row.code })}
                              className="btn btn-xs btn-outline-primary btn-sm"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-light">
                    <tr>
                      <th>Total</th>
                      <th className="text-center">{total}</th>
                      <th className="text-center">100%</th>
                      <th colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

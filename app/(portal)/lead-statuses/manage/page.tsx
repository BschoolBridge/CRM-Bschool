import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";

export const metadata = { title: "Manage Lead Statuses" };

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark", "pink"]);

function badgeColor(value: string): string {
  const color = value.trim().toLowerCase();
  return BADGE_COLORS.has(color) ? color : "secondary";
}

async function deleteStatus(id: number): Promise<void> {
  "use server";
  await requirePermission("delete");
  const status = await prisma.leadStatus.findUnique({ where: { id } });
  if (!status) notFound();
  if (status.is_system) {
    await flash("error", `Cannot delete system status '${status.name}'. You can deactivate it instead.`);
    redirect(reverse("manage_lead_statuses"));
  }
  const inUse = await prisma.lead.count({ where: { status: status.code } });
  if (inUse > 0) {
    await flash("error", `Cannot delete '${status.name}' — ${inUse} lead(s) are using this status. Reassign them first.`);
    redirect(reverse("manage_lead_statuses"));
  }
  await prisma.leadStatus.delete({ where: { id: status.id } });
  await invalidateReferenceData();
  await flash("success", "Lead status deleted successfully!");
  redirect(reverse("manage_lead_statuses"));
}

export default async function ManageLeadStatusesPage() {
  await requirePermission("settings");
  const ordered = [{ sort_order: "asc" as const }, { name: "asc" as const }];
  const [statuses, counts] = await Promise.all([
    prisma.leadStatus.findMany({ orderBy: ordered }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const byCode = new Map(counts.map((row) => [row.status, row._count._all]));
  const rows = statuses.map((status) => ({ ...status, lead_count: byCode.get(status.code) ?? 0 }));

  return (
    <>
      <PageHeader title="Manage Lead Statuses" />
      <section className="content">
        <div className="container-fluid">
          <Card
            title="Manage Lead Statuses"
            tools={
              <Link href={reverse("add_lead_status")} className="btn btn-primary">
                <i className="fas fa-plus" /> Add Lead Status
              </Link>
            }
          >
            {rows.length === 0 ? (
              <div className="text-center py-4">
                <Empty text="No lead statuses found." />
                <Link href={reverse("add_lead_status")}>Add your first lead status</Link>
              </div>
            ) : (
              <table className="table table-bordered table-striped">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Preview</th>
                    <th>Description</th>
                    <th>Lead Count</th>
                    <th>Status</th>
                    <th>System</th>
                    <th>Sort Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((status) => (
                    <tr key={status.id}>
                      <td>
                        <code>{status.code}</code>
                      </td>
                      <td>{status.name}</td>
                      <td>
                        <span className={`badge badge-${badgeColor(status.color)}`}>{status.name}</span>
                      </td>
                      <td>{status.description || "-"}</td>
                      <td>
                        <span className="badge badge-info">{status.lead_count} leads</span>
                      </td>
                      <td>
                        {status.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                      </td>
                      <td>
                        {status.is_system ? (
                          <span className="badge badge-warning">
                            <i className="fas fa-lock" /> System
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{status.sort_order}</td>
                      <td>
                        <Link href={reverse("edit_lead_status", status.id)} className="btn btn-sm btn-info">
                          <i className="fas fa-edit" /> Edit
                        </Link>{" "}
                        {status.is_system ? null : (
                          <PostButton
                            action={deleteStatus.bind(null, status.id)}
                            className="btn btn-sm btn-danger"
                            confirm="Are you sure you want to delete this lead status?"
                          >
                            <i className="fas fa-trash" /> Delete
                          </PostButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

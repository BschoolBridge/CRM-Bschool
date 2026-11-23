import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";

export const metadata = { title: "Manage Activity Types" };

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark", "pink"]);

function badgeColor(value: string): string {
  const color = value.trim().toLowerCase();
  return BADGE_COLORS.has(color) ? color : "secondary";
}

function safeIcon(value: string): string {
  const icon = value.trim();
  return icon && /^[a-zA-Z0-9\s\-_]+$/.test(icon) && !icon.includes("..") ? icon : "fas fa-tasks";
}

async function deleteType(id: number): Promise<void> {
  "use server";
  await requirePermission("delete");
  const type = await prisma.activityType.findUnique({ where: { id } });
  if (!type) notFound();
  if (type.is_system) {
    await flash("error", `Cannot delete system activity type '${type.name}'. You can deactivate it instead.`);
    redirect(reverse("manage_activity_types"));
  }
  const inUse = await prisma.leadActivity.count({ where: { activity_type: type.code } });
  if (inUse > 0) {
    await flash("error", `Cannot delete '${type.name}' — ${inUse} activities use this type.`);
    redirect(reverse("manage_activity_types"));
  }
  await prisma.activityType.delete({ where: { id: type.id } });
  await invalidateReferenceData();
  await flash("success", "Activity type deleted successfully!");
  redirect(reverse("manage_activity_types"));
}

export default async function ManageActivityTypesPage() {
  await requirePermission("settings");
  const ordered = [{ sort_order: "asc" as const }, { name: "asc" as const }];
  const [types, counts] = await Promise.all([
    prisma.activityType.findMany({ orderBy: ordered }),
    prisma.leadActivity.groupBy({ by: ["activity_type"], _count: { _all: true } }),
  ]);
  const byCode = new Map(counts.map((row) => [row.activity_type, row._count._all]));
  const rows = types.map((type) => ({ ...type, activity_count: byCode.get(type.code) ?? 0 }));

  return (
    <>
      <PageHeader title="Manage Activity Types" />
      <section className="content">
        <div className="container-fluid">
          <Card
            title="Manage Activity Types"
            tools={
              <Link href={reverse("add_activity_type")} className="btn btn-primary">
                <i className="fas fa-plus" /> Add Activity Type
              </Link>
            }
          >
            {rows.length === 0 ? (
              <div className="text-center py-4">
                <Empty text="No activity types found." />
                <Link href={reverse("add_activity_type")}>Add your first activity type</Link>
              </div>
            ) : (
              <table className="table table-bordered table-striped">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Icon</th>
                    <th>Preview</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>System</th>
                    <th>Sort</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((type) => (
                    <tr key={type.id}>
                      <td>
                        <code>{type.code}</code>
                      </td>
                      <td>{type.name}</td>
                      <td>
                        <i className={safeIcon(type.icon)} />
                      </td>
                      <td>
                        <span className={`badge badge-${badgeColor(type.color)}`}>
                          <i className={`${safeIcon(type.icon)} mr-1`} />
                          {type.name}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info">{type.activity_count} activities</span>
                      </td>
                      <td>
                        {type.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                      </td>
                      <td>
                        {type.is_system ? (
                          <span className="badge badge-warning">
                            <i className="fas fa-lock" /> System
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{type.sort_order}</td>
                      <td>
                        <Link href={reverse("edit_activity_type", type.id)} className="btn btn-sm btn-info">
                          <i className="fas fa-edit" /> Edit
                        </Link>{" "}
                        {type.is_system ? null : (
                          <PostButton
                            action={deleteType.bind(null, type.id)}
                            className="btn btn-sm btn-danger"
                            confirm="Are you sure you want to delete this activity type?"
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

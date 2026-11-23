import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/modules/reference/reference.service";
import { requirePermission } from "@/server/actor";
import { flash } from "@/server/flash";

export const metadata = { title: "Manage Next Actions" };

async function deleteAction(id: number): Promise<void> {
  "use server";
  await requirePermission("delete");
  const action = await prisma.nextAction.findUnique({ where: { id } });
  if (!action) notFound();
  if (action.is_system) {
    await flash("error", `Cannot delete system action '${action.name}'. You can deactivate it instead.`);
    redirect(reverse("manage_next_actions"));
  }
  const inUse = await prisma.leadActivity.count({ where: { next_action: action.code } });
  if (inUse > 0) {
    await flash("error", `Cannot delete '${action.name}' — ${inUse} activities use this action.`);
    redirect(reverse("manage_next_actions"));
  }
  await prisma.nextAction.delete({ where: { id: action.id } });
  await invalidateReferenceData();
  await flash("success", "Next action deleted successfully!");
  redirect(reverse("manage_next_actions"));
}

export default async function ManageNextActionsPage() {
  await requirePermission("settings");
  const ordered = [{ sort_order: "asc" as const }, { name: "asc" as const }];
  const [actions, counts] = await Promise.all([
    prisma.nextAction.findMany({ orderBy: ordered }),
    prisma.leadActivity.groupBy({ by: ["next_action"], where: { next_action: { not: "" } }, _count: { _all: true } }),
  ]);
  const byCode = new Map(counts.map((row) => [row.next_action, row._count._all]));
  const rows = actions.map((action) => ({ ...action, usage_count: byCode.get(action.code) ?? 0 }));

  return (
    <>
      <PageHeader title="Manage Next Actions" />
      <section className="content">
        <div className="container-fluid">
          <Card
            title="Manage Next Actions"
            tools={
              <Link href={reverse("add_next_action")} className="btn btn-primary">
                <i className="fas fa-plus" /> Add Next Action
              </Link>
            }
          >
            {rows.length === 0 ? (
              <div className="text-center py-4">
                <Empty text="No next actions found." />
                <Link href={reverse("add_next_action")}>Add your first next action</Link>
              </div>
            ) : (
              <table className="table table-bordered table-striped">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>System</th>
                    <th>Sort</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((action) => (
                    <tr key={action.id}>
                      <td>
                        <code>{action.code}</code>
                      </td>
                      <td>{action.name}</td>
                      <td>{action.description || "-"}</td>
                      <td>
                        <span className="badge badge-info">{action.usage_count} activities</span>
                      </td>
                      <td>
                        {action.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Inactive</span>
                        )}
                      </td>
                      <td>
                        {action.is_system ? (
                          <span className="badge badge-warning">
                            <i className="fas fa-lock" /> System
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{action.sort_order}</td>
                      <td>
                        <Link href={reverse("edit_next_action", action.id)} className="btn btn-sm btn-info">
                          <i className="fas fa-edit" /> Edit
                        </Link>{" "}
                        {action.is_system ? null : (
                          <PostButton
                            action={deleteAction.bind(null, action.id)}
                            className="btn btn-sm btn-danger"
                            confirm="Are you sure you want to delete this next action?"
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

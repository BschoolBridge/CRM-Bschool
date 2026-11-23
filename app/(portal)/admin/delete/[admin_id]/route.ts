import { notFound, redirect } from "next/navigation";
import { config } from "@/config/env";
import { reverse } from "@/http/urls";
import { isUniqueViolation, prisma } from "@/lib/prisma";
import { deleteUser } from "@/modules/users/user.service";
import { requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

export async function deleteAdminById(id: number): Promise<void> {
  const user = await requireSuperadmin();
  const adminObj = await prisma.admin.findUnique({ where: { id } });
  if (!adminObj) notFound();
  if (adminObj.admin_id === user.id) {
    await flash("error", "You cannot delete your own account!");
    redirect(reverse("manage_admins"));
  }
  try {
    await deleteUser(adminObj.admin_id);
  } catch (err) {
    await flash("error", `Could not delete admin user: ${errorDetail(err)}`);
    redirect(reverse("manage_admins"));
  }
  await flash("success", "Admin user deleted successfully!");
  redirect(reverse("manage_admins"));
}

export async function POST(_request: Request, context: { params: Promise<{ admin_id: string }> }) {
  const { admin_id } = await context.params;
  await deleteAdminById(requiredId(admin_id));
}

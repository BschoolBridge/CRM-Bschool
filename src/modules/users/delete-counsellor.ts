import { notFound, redirect } from "next/navigation";
import { config } from "../../config/env";
import { reverse } from "../../http/urls";
import { isUniqueViolation, prisma } from "../../lib/prisma";
import { requirePermission } from "../../server/actor";
import { flash } from "../../server/flash";
import { deleteUser } from "./user.service";

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

export async function deleteCounsellorById(id: number): Promise<void> {
  await requirePermission("delete");
  const counsellor = await prisma.counsellor.findUnique({ where: { id } });
  if (!counsellor) notFound();
  try {
    await deleteUser(counsellor.admin_id);
  } catch (err) {
    await flash("error", `Could not delete counsellor: ${errorDetail(err)}`);
    redirect(reverse("manage_counsellors"));
  }
  await flash("success", "Counsellor deleted successfully!");
  redirect(reverse("manage_counsellors"));
}

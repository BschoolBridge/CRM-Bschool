import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/actor";
import { USER_TYPE_ADMIN } from "@/server/auth";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

export async function deleteAdminNotificationById(id: number): Promise<void> {
  const user = await requireUser();
  if (user.user_type !== USER_TYPE_ADMIN) {
    await flash("error", "Access denied!");
    redirect("/");
  }
  const note = await prisma.notificationAdmin.findFirst({ where: { id, admin_id: user.id } });
  if (!note) notFound();
  await prisma.notificationAdmin.delete({ where: { id: note.id } });
  await flash("success", "Notification deleted.");
  redirect(reverse("admin_view_notifications"));
}

export async function POST(_request: Request, context: { params: Promise<{ notification_id: string }> }) {
  const { notification_id } = await context.params;
  await deleteAdminNotificationById(requiredId(notification_id));
}

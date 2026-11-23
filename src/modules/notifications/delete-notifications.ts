import { notFound, redirect } from "next/navigation";
import { reverse } from "../../http/urls";
import { prisma } from "../../lib/prisma";
import { currentCounsellor, requireUser } from "../../server/actor";
import { USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR } from "../../server/auth";
import { flash } from "../../server/flash";

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

export async function deleteCounsellorNotificationById(id: number): Promise<void> {
  const user = await requireUser();
  if (user.user_type !== USER_TYPE_COUNSELLOR) {
    await flash("error", "Access denied!");
    redirect("/");
  }
  const counsellor = await currentCounsellor(user);
  const note = await prisma.notificationCounsellor.findFirst({ where: { id, counsellor_id: counsellor.id } });
  if (!note) notFound();
  await prisma.notificationCounsellor.delete({ where: { id: note.id } });
  await flash("success", "Notification deleted.");
  redirect(reverse("counsellor_view_notifications"));
}

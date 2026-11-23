import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { currentCounsellor, requireUser } from "@/server/actor";
import { USER_TYPE_COUNSELLOR } from "@/server/auth";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

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

export async function POST(_request: Request, context: { params: Promise<{ notification_id: string }> }) {
  const { notification_id } = await context.params;
  await deleteCounsellorNotificationById(requiredId(notification_id));
}

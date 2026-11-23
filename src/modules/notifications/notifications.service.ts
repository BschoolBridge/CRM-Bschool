import { prisma, type Db } from "../../lib/prisma";

/** One inbox row per admin profile (Admin.objects.all() in the Django code). */
export async function notifyAllAdmins(message: string, db: Db = prisma): Promise<void> {
  const admins = await db.admin.findMany({ select: { admin_id: true } });
  if (!admins.length) return;
  await db.notificationAdmin.createMany({
    data: admins.map((a) => ({ admin_id: a.admin_id, message })),
  });
}

export async function adminAlertSentToday(fragment: string, since: Date): Promise<boolean> {
  const hit = await prisma.notificationAdmin.findFirst({
    where: { created_at: { gte: since }, message: { contains: fragment } },
    select: { id: true },
  });
  return Boolean(hit);
}

export function unreadAdminCount(userId: number): Promise<number> {
  return prisma.notificationAdmin.count({ where: { admin_id: userId, is_read: false } });
}

export function unreadCounsellorCount(counsellorId: number): Promise<number> {
  return prisma.notificationCounsellor.count({ where: { counsellor_id: counsellorId, is_read: false } });
}

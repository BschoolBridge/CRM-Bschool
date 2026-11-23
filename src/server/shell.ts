import { cache as rememberRequest } from "react";
import { cache } from "../lib/cache";
import { prisma } from "../lib/prisma";
import { assignmentNotificationsForPopup } from "../modules/notifications/assignment-notifications";
import { unreadAdminCount, unreadCounsellorCount } from "../modules/notifications/notifications.service";
import { adminCan, USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR, type AuthUser } from "./auth";

export interface ShellState {
  notificationCount: number;
  pendingTaskCount: number;
  assignmentAlerts: unknown[];
  canAdmission: boolean;
  isSuperadmin: boolean;
  permPerformance: boolean;
  permSettings: boolean;
  permDelete: boolean;
}

const EMPTY: ShellState = {
  notificationCount: 0,
  pendingTaskCount: 0,
  assignmentAlerts: [],
  canAdmission: false,
  isSuperadmin: false,
  permPerformance: false,
  permSettings: false,
  permDelete: false,
};

export const shellState = rememberRequest(async (user: AuthUser): Promise<ShellState> => {
  if (user.user_type === USER_TYPE_ADMIN) {
    const profile = user.admin_profile;
    return {
      ...EMPTY,
      notificationCount: await cache.remember(`crm:shell:admin:${user.id}`, 15, () => unreadAdminCount(user.id)),
      isSuperadmin: Boolean(profile?.is_superadmin),
      permPerformance: adminCan(profile, "performance"),
      permSettings: adminCan(profile, "settings"),
      permDelete: adminCan(profile, "delete"),
    };
  }
  const counsellor = user.counsellor;
  if (user.user_type !== USER_TYPE_COUNSELLOR || !counsellor) return EMPTY;
  const now = new Date();
  const [notificationCount, pendingTaskCount, assignmentAlerts] = await Promise.all([
    cache.remember(`crm:shell:c:${counsellor.id}:unread`, 15, () => unreadCounsellorCount(counsellor.id)),
    cache.remember(`crm:shell:c:${counsellor.id}:pending`, 15, async () => {
      const [incomplete, visits] = await Promise.all([
        prisma.leadActivity.count({ where: { counsellor_id: counsellor.id, is_completed: false } }),
        prisma.lead.count({ where: { assigned_counsellor_id: counsellor.id, next_follow_up: { gte: now } } }),
      ]);
      return incomplete + visits;
    }),
    assignmentNotificationsForPopup(counsellor.id),
  ]);
  return {
    ...EMPTY,
    notificationCount,
    pendingTaskCount,
    assignmentAlerts,
    canAdmission: counsellor.can_handle_admission_followup,
  };
});

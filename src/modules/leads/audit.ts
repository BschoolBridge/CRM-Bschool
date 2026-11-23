import { startOfLocalDay } from "../../lib/time";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { adminAlertSentToday, notifyAllAdmins } from "../notifications/notifications.service";
import { fullName } from "../presenters";

export async function logDataAccess(
  actor: { userId: number; ip?: string | null; userAgent?: string | null },
  action: string,
  extras: { counsellorId?: number; leadId?: number; businessId?: number } = {},
) {
  try {
    await prisma.dataAccessLog.create({
      data: {
        user_id: actor.userId,
        counsellor_id: extras.counsellorId ?? null,
        lead_id: extras.leadId ?? null,
        business_id: extras.businessId ?? null,
        action,
        ip_address: actor.ip ?? null,
        user_agent: String(actor.userAgent ?? "").slice(0, 500),
      },
    });
  } catch (err) {
    logger.warn({ err, action }, "failed to write DataAccessLog");
  }
}

export async function maybeAlertLeadViewBurst(counsellor: { id: number; employee_id: string; admin: { first_name: string; last_name: string; email: string } }) {
  const windowStart = new Date(Date.now() - 24 * 3_600_000);
  const views = await prisma.dataAccessLog.findMany({
    where: { counsellor_id: counsellor.id, action: "view_lead_detail", created_at: { gte: windowStart }, lead_id: { not: null } },
    distinct: ["lead_id"],
    select: { lead_id: true },
  });
  if (views.length < 200) return;
  const fragment = `possible data export or leak by counsellor ${counsellor.employee_id}`;
  if (await adminAlertSentToday(fragment, startOfLocalDay())) return;
  await notifyAllAdmins(
    `Security alert: ${fragment}. Potential data-leak risk: counsellor ${fullName(counsellor.admin)} ` +
      `(${counsellor.employee_id}, ${counsellor.admin.email}) has viewed ${views.length} unique leads in the last 24 hours. ` +
      "Please review their activity and access.",
  );
}

export async function maybeAlertPhoneRevealBurst(counsellor: { id: number; employee_id: string; admin: { first_name: string; last_name: string; email: string } }) {
  const windowStart = new Date(Date.now() - 3_600_000);
  const reveals = await prisma.dataAccessLog.findMany({
    where: {
      counsellor_id: counsellor.id,
      action: { in: ["reveal_phone", "reveal_alternate_phone"] },
      created_at: { gte: windowStart },
      lead_id: { not: null },
    },
    distinct: ["lead_id"],
    select: { lead_id: true },
  });
  if (reveals.length < 60) return;
  const fragment = `phone reveal threshold exceeded by counsellor ${counsellor.employee_id}`;
  if (await adminAlertSentToday(fragment, startOfLocalDay())) return;
  await notifyAllAdmins(
    `Security alert: ${fragment}. Data-protection alert: counsellor ${fullName(counsellor.admin)} ` +
      `(${counsellor.employee_id}, ${counsellor.admin.email}) has revealed phone numbers for ${reveals.length} unique leads ` +
      "in the last 1 hour. Please review their activity.",
  );
}

import { prisma } from "@/lib/prisma";
import { applyActivityToLead, createPendingFollowup, updateActivity } from "@/modules/activities/activity.service";
import type { LeadActivityForm } from "@/modules/activities/activity.form";

export async function saveAdminActivity(
  adminId: number,
  form: LeadActivityForm,
  lead: { id: number; status: string },
  counsellorId: number,
  existing: { id: number; logged_by_admin_id: number | null } | null,
) {
  const data = form.activityData();
  const activity = existing
    ? await updateActivity(existing.id, data)
    : await prisma.leadActivity.create({
        data: { ...data, lead_id: lead.id, counsellor_id: counsellorId, logged_by_admin_id: adminId },
      });
  const followupDate = form.hasNextAction() ? form.cleaned_data.followup_date : null;
  await applyActivityToLead(lead, activity.outcome, { touchContact: true, followupDate });
  if (followupDate) {
    await createPendingFollowup(
      lead.id,
      counsellorId,
      activity,
      followupDate,
      existing ? existing.logged_by_admin_id : adminId,
    );
  }
  return Boolean(followupDate);
}

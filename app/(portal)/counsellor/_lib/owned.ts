import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentCounsellor, requireCounsellor } from "@/server/actor";

export async function counsellorContext() {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  return { user, counsellor };
}

const leadInclude = {
  source: true,
  alternate_phones: true,
  assigned_counsellor: { include: { admin: true } },
} as const;

export async function ownedLead(leadId: number) {
  const { user, counsellor } = await counsellorContext();
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, assigned_counsellor_id: counsellor.id },
    include: leadInclude,
  });
  if (!lead) notFound();
  return { user, counsellor, lead };
}

export async function ownedActivity(leadId: number, activityId: number) {
  const owned = await ownedLead(leadId);
  const activity = await prisma.leadActivity.findFirst({
    where: { id: activityId, lead_id: owned.lead.id, counsellor_id: owned.counsellor.id },
  });
  if (!activity) notFound();
  return { ...owned, activity };
}

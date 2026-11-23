import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logDataAccess, maybeAlertPhoneRevealBurst } from "@/modules/leads/audit";
import { requiredId } from "@/server/request";
import { accessActor } from "../../../../../_lib/access";
import { ownedLead } from "../../../../_lib/owned";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await context.params;
  const { user, counsellor, lead } = await ownedLead(requiredId(lead_id));
  const profile = await prisma.counsellor.findUnique({ where: { id: counsellor.id }, include: { admin: true } });
  if (!profile) notFound();
  await logDataAccess(await accessActor(user.id), "reveal_phone", { counsellorId: counsellor.id, leadId: lead.id });
  await maybeAlertPhoneRevealBurst(profile);
  return Response.json({ phone: lead.phone });
}

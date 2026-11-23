import { notFound } from "next/navigation";
import { field } from "@/http/params";
import { prisma } from "@/lib/prisma";
import { logDataAccess, maybeAlertPhoneRevealBurst } from "@/modules/leads/audit";
import { recordFromFormData } from "@/server/form";
import { requiredId } from "@/server/request";
import { accessActor } from "../../../../../_lib/access";
import { ownedLead } from "../../../../_lib/owned";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await context.params;
  const { user, counsellor, lead } = await ownedLead(requiredId(lead_id));
  const which = field(recordFromFormData(await request.formData()), "which");
  let phone: string | null = null;
  if (which === "primary") phone = lead.alternate_phone || "";
  else if (/^\d+$/.test(which)) {
    const alt = await prisma.leadAlternatePhone.findFirst({ where: { id: Number(which), lead_id: lead.id } });
    if (!alt) return Response.json({ error: "Invalid which" }, { status: 400 });
    phone = alt.phone || "";
  } else {
    return Response.json({ error: "Invalid which" }, { status: 400 });
  }
  const profile = await prisma.counsellor.findUnique({ where: { id: counsellor.id }, include: { admin: true } });
  if (!profile) notFound();
  await logDataAccess(await accessActor(user.id), "reveal_alternate_phone", { counsellorId: counsellor.id, leadId: lead.id });
  await maybeAlertPhoneRevealBurst(profile);
  return Response.json({ phone });
}

import { notFound, redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { unfreezeActivityAdd } from "@/modules/activities/activity.service";
import { fullName } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ counsellor_id: string }> }) {
  const user = await requireAdmin();
  const { counsellor_id } = await context.params;
  const id = requiredId(counsellor_id);
  const counsellor = await prisma.counsellor.findUnique({ where: { id }, include: { admin: true } });
  if (!counsellor) notFound();
  if (await unfreezeActivityAdd(id, user.id)) {
    await flash("success", `${fullName(counsellor.admin)} can add activities again.`);
  } else {
    await flash("info", "This counsellor is not frozen for activity adds.");
  }
  redirect(reverse("counsellor_detail", id));
}

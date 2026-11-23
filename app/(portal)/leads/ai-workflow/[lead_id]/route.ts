import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { runAgenticWorkflow } from "@/modules/ai/ai.service";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { failureText } from "../../format";

/** A normal visit must not enrich, score, or route the lead. */
export function GET() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(_request: Request, context: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await context.params).lead_id);
  await requireAdmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();
  if (!lead.assigned_counsellor_id) {
    await flash("error", "Lead must be assigned to a counsellor to run AI workflow.");
    redirect(reverse("admin_view_lead", leadId));
  }
  try {
    for (const message of await runAgenticWorkflow(leadId)) await flash(message.level, message.text);
    await flash("success", "AI workflow completed successfully!");
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", failureText("Error running AI workflow", err));
  }
  redirect(reverse("admin_view_lead", leadId));
}

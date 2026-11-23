import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { requireAdmin } from "@/server/actor";
import { requiredId } from "@/server/request";

export const metadata = { title: "Manual Route" };

export default async function ManualRoutePage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  await requireAdmin();
  redirect(`${reverse("admin_view_lead", leadId)}#manual-route`);
}

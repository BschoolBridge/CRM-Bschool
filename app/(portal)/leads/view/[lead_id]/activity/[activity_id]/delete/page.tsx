import Link from "next/link";
import { notFound } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/server/actor";
import { requiredId } from "@/server/request";
import { deleteLeadActivity } from "../../../../../mutations";

export const metadata = { title: "Delete Activity" };

export default async function DeleteLeadActivityPage({
  params,
}: {
  params: Promise<{ lead_id: string; activity_id: string }>;
}) {
  const { lead_id, activity_id } = await params;
  const leadId = requiredId(lead_id);
  const activityId = requiredId(activity_id);
  await requireSuperadmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, first_name: true, last_name: true } });
  if (!lead) notFound();
  const activity = await prisma.leadActivity.findFirst({
    where: { id: activityId, lead_id: leadId },
    select: { id: true, subject: true },
  });
  if (!activity) notFound();
  return (
    <>
      <PageHeader title="Delete Activity" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Delete activity — ${lead.first_name} ${lead.last_name}`}>
            <p>Delete {activity.subject || "this activity"}?</p>
            <PostButton action={deleteLeadActivity.bind(null, lead.id, activity.id)} className="btn btn-danger" confirm="Delete this activity?">
              Delete activity
            </PostButton>
            <Link href={reverse("admin_view_lead", lead.id)} className="btn btn-secondary ml-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

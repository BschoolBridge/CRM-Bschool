import Link from "next/link";
import { notFound } from "next/navigation";
import { PostButton } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/actor";
import { requiredId } from "@/server/request";
import { deleteLead } from "../../mutations";

export const metadata = { title: "Delete Lead" };

export default async function DeleteLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  await requirePermission("delete");
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, lead_id: true, first_name: true, last_name: true },
  });
  if (!lead) notFound();
  return (
    <>
      <PageHeader title="Delete Lead" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Delete lead">
            <p>
              Delete <strong>{lead.first_name} {lead.last_name}</strong> (<code>{lead.lead_id}</code>)? This cannot be undone.
            </p>
            <PostButton action={deleteLead.bind(null, lead.id)} className="btn btn-danger" confirm="Are you sure you want to delete this lead?">
              Delete lead
            </PostButton>
            <Link href={reverse("manage_leads")} className="btn btn-secondary ml-2">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { idList } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/actor";
import { readSearch, type SearchParams } from "@/server/request";
import { ConfirmButton } from "../../manage/controls";
import { bulkDeleteLeads } from "../../mutations";

export const metadata = { title: "Delete Leads" };

export default async function BulkDeleteLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("delete");
  const search = await readSearch(searchParams);
  const ids = idList((search.lead_ids ?? "").split(","));
  if (!ids.length) {
    return (
      <>
        <PageHeader title="Delete Leads" />
        <section className="content">
          <div className="container-fluid">
            <Card title="Delete leads">
              <div className="alert alert-warning">No leads selected for deletion.</div>
              <Link href={reverse("manage_leads")} className="btn btn-secondary">Back to leads</Link>
            </Card>
          </div>
        </section>
      </>
    );
  }
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids } },
    select: { id: true, first_name: true, last_name: true, lead_id: true },
    orderBy: { id: "desc" },
  });
  if (!leads.length) {
    return (
      <>
        <PageHeader title="Delete Leads" />
        <section className="content">
          <div className="container-fluid">
            <Card title="Delete leads">
              <div className="alert alert-warning">No leads selected for deletion.</div>
              <Link href={reverse("manage_leads")} className="btn btn-secondary">Back to leads</Link>
            </Card>
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Delete Leads" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Delete ${leads.length} lead(s)`}>
            <p>These leads will be permanently deleted.</p>
            <ul>
              {leads.map((lead) => (
                <li key={lead.id}>
                  {lead.first_name} {lead.last_name} <code>{lead.lead_id}</code>
                </li>
              ))}
            </ul>
            <form action={bulkDeleteLeads}>
              {leads.map((lead) => (
                <input key={lead.id} type="hidden" name="lead_ids" value={lead.id} />
              ))}
              <ConfirmButton className="btn btn-danger" confirm="Are you sure you want to delete the selected leads?">
                Delete selected
              </ConfirmButton>
              <Link href={reverse("manage_leads")} className="btn btn-secondary ml-2">
                Cancel
              </Link>
            </form>
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/actor";
import { DELETE_ALL_CONFIRM_PHRASE } from "../../format";
import { deleteAllLeads } from "../../mutations";

export const metadata = { title: "Delete All Leads" };

export default async function DeleteAllLeadsPage() {
  await requirePermission("delete");
  const total = await prisma.lead.count();
  return (
    <>
      <PageHeader title="Delete All Leads" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Delete all leads">
            <p className="font-weight-bold">This will permanently delete all {total} lead(s) in the database.</p>
            <p className="text-muted">This is not limited to the current page or filters.</p>
            <p>
              Type <code>{DELETE_ALL_CONFIRM_PHRASE}</code> to confirm.
            </p>
            <form action={deleteAllLeads}>
              <div className="form-group">
                <label htmlFor="confirm_text">Confirmation</label>
                <input
                  type="text"
                  className="form-control"
                  id="confirm_text"
                  name="confirm_text"
                  autoComplete="off"
                  placeholder={DELETE_ALL_CONFIRM_PHRASE}
                  required
                />
              </div>
              <button type="submit" className="btn btn-danger">
                Delete every lead
              </button>
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

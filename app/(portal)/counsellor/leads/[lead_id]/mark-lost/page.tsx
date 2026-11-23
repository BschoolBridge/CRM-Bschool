import Link from "next/link";
import { reverse } from "@/http/urls";
import { presentLead } from "@/modules/presenters";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ownedLead } from "../../../_lib/owned";
import { markLeadLost } from "../../../_lib/lead-actions";

export const metadata = { title: "Mark as Lost" };

export default async function MarkLostPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const { lead: raw } = await ownedLead(requiredId(lead_id));
  const lead = presentLead(raw);
  return (
    <>
      <PageHeader title="Mark as Lost">
        <Link className="btn btn-sm btn-secondary" href={reverse("lead_detail", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`${lead.first_name} ${lead.last_name}`}>
            <form action={markLeadLost.bind(null, lead.id)}>
              <div className="form-group">
                <label htmlFor="reason">Reason</label>
                <textarea className="form-control" id="reason" name="reason" rows={4} />
              </div>
              <button className="btn btn-danger" type="submit">Mark as lost</button>
            </form>
          </Card>
        </div>
      </section>
    </>
  );
}

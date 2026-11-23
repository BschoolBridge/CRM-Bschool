import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { BUSINESS_STATUS, presentBusiness } from "@/modules/presenters";
import { recordFromFormData } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { shown } from "../../../_lib/access";
import { counsellorContext } from "../../_lib/owned";

export const metadata = { title: "Business" };

async function updateStatus(businessId: number, fd: FormData) {
  "use server";
  const { counsellor } = await counsellorContext();
  const business = await prisma.business.findFirst({ where: { id: businessId, counsellor_id: counsellor.id } });
  if (!business) notFound();
  const newStatus = field(recordFromFormData(fd), "status");
  if (BUSINESS_STATUS.some(([code]) => code === newStatus)) {
    await prisma.business.update({ where: { id: business.id }, data: { status: newStatus } });
    await flash("success", `Business status updated to ${newStatus}`);
  } else {
    await flash("error", "Invalid status");
  }
  redirect(reverse("business_detail", business.id));
}

export default async function BusinessDetailPage({ params }: { params: Promise<{ business_id: string }> }) {
  const { business_id } = await params;
  const { counsellor } = await counsellorContext();
  const row = await prisma.business.findFirst({
    where: { id: requiredId(business_id), counsellor_id: counsellor.id },
    include: { lead: true, counsellor: { include: { admin: true } } },
  });
  if (!row) notFound();
  const business = presentBusiness(row);

  return (
    <>
      <PageHeader title={`Business: ${business.title}`}>
        <Link className="btn btn-sm btn-secondary" href={reverse("my_businesses")}>My businesses</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-8">
              <Card title={business.business_id}>
                <p><strong>Title:</strong> {business.title}</p>
                <p><strong>Lead:</strong> <Link href={reverse("lead_detail", business.lead.id)}>{business.lead.first_name} {business.lead.last_name}</Link></p>
                <p><strong>Value:</strong> ₹{shown(business, "value")}</p>
                <p><strong>Status:</strong> {shown(business, "get_status_display")}</p>
                <p><strong>Start:</strong> {formatDjango(business.start_date, "M d, Y")}</p>
                <p><strong>End:</strong> {business.end_date ? formatDjango(business.end_date, "M d, Y") : "—"}</p>
                <p><strong>Payment terms:</strong> {business.payment_terms || "Not specified"}</p>
                <p><strong>Created:</strong> {formatDjango(business.created_at, "M d, Y")}</p>
                <p><strong>Description:</strong> {business.description || "No description available"}</p>
                <p className="mb-0"><strong>Notes:</strong> {business.notes || "No notes available"}</p>
              </Card>
            </div>
            <div className="col-md-4">
              <Card title="Update status">
                <form action={updateStatus.bind(null, business.id)}>
                  <div className="form-group">
                    <select className="form-control" name="status" defaultValue={business.status}>
                      {BUSINESS_STATUS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-block" type="submit">Update</button>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

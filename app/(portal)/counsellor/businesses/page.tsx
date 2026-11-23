import Link from "next/link";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma, type Prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { BUSINESS_STATUS, presentAll, presentBusiness } from "@/modules/presenters";
import { readSearch, type SearchParams } from "@/server/request";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";

export const metadata = { title: "My Businesses" };

export default async function MyBusinessesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await readSearch(searchParams);
  const { counsellor } = await counsellorContext();
  const status = field(query, "status");
  const where: Prisma.BusinessWhereInput = { counsellor_id: counsellor.id };
  if (status) where.status = status;
  const businesses = await paginate(
    query.page,
    15,
    () => prisma.business.count({ where }),
    (skip, take) =>
      prisma.business.findMany({
        where,
        include: { lead: true },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
  );
  presentAll(businesses, (business) => presentBusiness(business));
  const pagerQuery: Record<string, string> = {};
  if (status) pagerQuery.status = status;

  return (
    <>
      <PageHeader title="My Businesses" />
      <section className="content">
        <div className="container-fluid">
          <Card title="My Businesses">
            <form method="get" action={reverse("my_businesses")} className="form-inline mb-3">
              <select className="form-control mr-2" name="status" defaultValue={status}>
                <option value="">All statuses</option>
                {BUSINESS_STATUS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              <button className="btn btn-primary" type="submit">Filter</button>
            </form>
            {businesses.length === 0 ? <Empty text="You haven't generated any businesses yet." /> : (
              <table className="table table-bordered table-striped">
                <thead>
                  <tr><th>ID</th><th>Title</th><th>Lead</th><th>Value</th><th>Status</th><th>Start</th><th>End</th><th></th></tr>
                </thead>
                <tbody>
                  {businesses.map((business) => (
                    <tr key={business.id}>
                      <td>{business.business_id}</td>
                      <td>{business.title}</td>
                      <td>{business.lead.first_name} {business.lead.last_name}</td>
                      <td>₹{shown(business, "value")}</td>
                      <td>{shown(business, "get_status_display")}</td>
                      <td>{formatDjango(business.start_date, "M d, Y")}</td>
                      <td>{business.end_date ? formatDjango(business.end_date, "M d, Y") : "—"}</td>
                      <td><Link className="btn btn-sm btn-info" href={reverse("business_detail", business.id)}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={businesses} path={reverse("my_businesses")} query={pagerQuery} />
          </Card>
        </div>
      </section>
    </>
  );
}

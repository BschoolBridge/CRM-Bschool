import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { reverse } from "@/http/urls";
import { paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { fullName, presentAll, presentBusiness } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { readSearch, type SearchParams } from "@/server/request";
import { formatDay } from "../../leads/format";

export const metadata = { title: "Manage Businesses" };

function statusBadge(status: string) {
  if (status === "ACTIVE") return <span className="badge badge-success">Active</span>;
  if (status === "PENDING") return <span className="badge badge-warning">Pending</span>;
  if (status === "COMPLETED") return <span className="badge badge-info">Completed</span>;
  if (status === "CANCELLED") return <span className="badge badge-danger">Cancelled</span>;
  return null;
}

export default async function ManageBusinessesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await readSearch(searchParams);
  const businesses = await paginate(
    search.page,
    15,
    () => prisma.business.count(),
    (skip, take) =>
      prisma.business.findMany({
        include: { lead: true, counsellor: { include: { admin: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
  );
  presentAll(businesses, (business) => presentBusiness(business));

  return (
    <>
      <PageHeader title="Manage Businesses" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Manage Businesses">
            {businesses.length === 0 ? (
              <Empty text="No businesses yet." />
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-striped">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Lead</th>
                      <th>Counsellor</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((business) => (
                      <tr key={business.id}>
                        <td>{business.id}</td>
                        <td>{business.title}</td>
                        <td>{business.lead.first_name} {business.lead.last_name}</td>
                        <td>{fullName(business.counsellor.admin)}</td>
                        <td>₹{String(business.value)}</td>
                        <td>{statusBadge(business.status)}</td>
                        <td>{formatDay(business.start_date)}</td>
                        <td>{business.end_date ? formatDay(business.end_date) : ""}</td>
                        <td>
                          <a href="#" className="btn btn-sm btn-info">View</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3">
              <Pager page={businesses} path={reverse("manage_businesses")} />
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

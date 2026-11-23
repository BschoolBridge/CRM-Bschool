import { prisma } from "@/lib/prisma";
import { presentCounsellor } from "@/modules/presenters";
import { Card, PageHeader } from "@/components/ui";
import { shown } from "../../_lib/access";
import { counsellorContext } from "../_lib/owned";

export const metadata = { title: "My Profile" };

function fileUrl(value: unknown) {
  if (value && typeof value === "object" && "url" in value) return String((value as { url: string }).url);
  return "";
}

export default async function CounsellorProfilePage() {
  const { counsellor: sessionCounsellor } = await counsellorContext();
  const counsellor = presentCounsellor(
    await prisma.counsellor.findUniqueOrThrow({ where: { id: sessionCounsellor.id }, include: { admin: true } }),
  );
  const [totalLeads, activeAgg, businessCount] = await Promise.all([
    prisma.lead.count({ where: { assigned_counsellor_id: counsellor.id } }),
    prisma.business.aggregate({ where: { counsellor_id: counsellor.id, status: "ACTIVE" }, _sum: { value: true } }),
    prisma.business.count({ where: { counsellor_id: counsellor.id } }),
  ]);
  const totalBusiness = Number(activeAgg._sum.value ?? 0);
  const conversionRate = totalLeads > 0 ? (businessCount / totalLeads) * 100 : 0;
  const pic = fileUrl(counsellor.admin.profile_pic);

  return (
    <>
      <PageHeader title="My Profile" />
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-4">
              <Card>
                {pic ? <img className="profile-user-img img-fluid img-circle d-block mx-auto mb-3" src={pic} alt="" /> : null}
                <p className="text-center mb-0"><strong>{counsellor.admin.first_name} {counsellor.admin.last_name}</strong></p>
                <p className="text-center text-muted">{counsellor.employee_id}</p>
              </Card>
              <Card title="Work">
                <p>Leads: <strong>{totalLeads}</strong></p>
                <p>Active business value: <strong>{totalBusiness.toFixed(2)}</strong></p>
                <p className="mb-0">Conversion rate: <strong>{conversionRate.toFixed(1)}%</strong></p>
              </Card>
            </div>
            <div className="col-md-8">
              <Card title="Details">
                <p><strong>Department:</strong> {counsellor.department || "Not assigned"}</p>
                <p><strong>Email:</strong> {counsellor.admin.email}</p>
                <p><strong>Phone:</strong> {counsellor.admin.phone || "Not provided"}</p>
                <p><strong>Gender:</strong> {shown(counsellor.admin, "get_gender_display")}</p>
                <p className="mb-0"><strong>Address:</strong> {counsellor.admin.address || "Not provided"}</p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

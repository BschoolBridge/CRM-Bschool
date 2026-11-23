import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { presentCounsellor } from "@/modules/presenters";
import { reverse } from "@/http/urls";
import { Card, PageHeader } from "@/components/ui";
import { counsellorContext } from "../_lib/owned";
import { CrmCalendar } from "../_components/crm-calendar";

export const metadata = { title: "My Calendar" };

export default async function CounsellorCalendarPage() {
  const { counsellor: sessionCounsellor } = await counsellorContext();
  presentCounsellor(await prisma.counsellor.findUniqueOrThrow({ where: { id: sessionCounsellor.id }, include: { admin: true } }));

  return (
    <>
      <PageHeader title="My Calendar">
        <Link className="btn btn-sm btn-secondary" href={reverse("counsellor_home")}>Back to Dashboard</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title="My Calendar">
            <div className="mb-3">
              <span className="badge badge-primary mr-2">Activities</span>
              <span className="badge badge-success">Visits</span>
            </div>
            <CrmCalendar eventsUrl={reverse("get_calendar_events")} variant="month" />
          </Card>
        </div>
      </section>
    </>
  );
}

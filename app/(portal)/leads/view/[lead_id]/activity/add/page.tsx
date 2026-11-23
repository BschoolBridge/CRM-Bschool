import Link from "next/link";
import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadActivityForm } from "@/modules/activities/activity.form";
import { fullName, presentCounsellor, presentLead } from "@/modules/presenters";
import { requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";
import { saveAdminActivity } from "../../../../activity-save";
import { failureText, formatStamp } from "../../../../format";

export const metadata = { title: "Add Activity" };

export default async function AddLeadActivityPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  await requireSuperadmin();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { assigned_counsellor: { include: { admin: true } } },
  });
  if (!lead) notFound();
  if (!lead.assigned_counsellor) {
    return (
      <>
        <PageHeader title="Add Activity" />
        <section className="content">
          <div className="container-fluid">
            <div className="alert alert-danger">This lead has no assigned counsellor. Assign a counsellor before adding activities.</div>
            <Link href={reverse("admin_view_lead", leadId)} className="btn btn-secondary">Back to lead</Link>
          </div>
        </section>
      </>
    );
  }
  const counsellor = presentCounsellor(lead.assigned_counsellor);
  presentLead(lead);

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    const user = await requireSuperadmin();
    const current = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { assigned_counsellor: { include: { admin: true } } },
    });
    if (!current) notFound();
    if (!current.assigned_counsellor) {
      await flash("error", "This lead has no assigned counsellor. Assign a counsellor before adding activities.");
      redirect(reverse("admin_view_lead", leadId));
    }
    const form = await LeadActivityForm.create(await formInput(fd));
    if (!(await form.isValid())) {
      await flash("error", "Please correct the errors below.");
      return { markup: formMarkup(form) };
    }
    try {
      const scheduled = await saveAdminActivity(user.id, form, current, current.assigned_counsellor.id, null);
      await flash(
        "success",
        scheduled ? "Activity logged and next follow-up scheduled for the counsellor." : "Activity logged for the counsellor.",
      );
      redirect(reverse("admin_view_lead", leadId));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", failureText("Could not add activity", err));
      return { markup: formMarkup(form) };
    }
  }

  const form = await LeadActivityForm.create();
  const previous = await prisma.leadActivity.findFirst({
    where: { lead_id: leadId, counsellor_id: counsellor.id },
    orderBy: [{ completed_date: "desc" }, { id: "desc" }],
  });

  return (
    <>
      <PageHeader title={`Add Activity — ${lead.first_name} ${lead.last_name}`} />
      <section className="content">
        <div className="container-fluid">
          <div className="alert alert-info">
            This activity will be recorded under <strong>{fullName(counsellor.admin)}</strong> (assigned counsellor for this lead).
          </div>
          <Card title={`Add Activity — ${lead.first_name} ${lead.last_name}`}>
            <p>
              Previous activity: {previous?.completed_date ? formatStamp(previous.completed_date) : <span className="text-muted">None</span>}
            </p>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Save activity" />
            <Link href={reverse("admin_view_lead", lead.id)} className="btn btn-secondary mt-3">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

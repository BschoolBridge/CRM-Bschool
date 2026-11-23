import Link from "next/link";
import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { LeadActivityForm } from "@/modules/activities/activity.form";
import { fullName, presentActivity, presentLead } from "@/modules/presenters";
import { requireSuperadmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";
import { saveAdminActivity } from "../../../../../activity-save";
import { failureText, formatStamp, presentedString } from "../../../../../format";

export const metadata = { title: "Edit Activity" };

export default async function EditLeadActivityPage({
  params,
}: {
  params: Promise<{ lead_id: string; activity_id: string }>;
}) {
  const { lead_id, activity_id } = await params;
  const leadId = requiredId(lead_id);
  const activityId = requiredId(activity_id);
  await requireSuperadmin();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();
  const activity = await prisma.leadActivity.findFirst({
    where: { id: activityId, lead_id: leadId },
    include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
  });
  if (!activity) notFound();
  presentLead(lead);
  presentActivity(activity);

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    const user = await requireSuperadmin();
    const current = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!current) notFound();
    const existing = await prisma.leadActivity.findFirst({ where: { id: activityId, lead_id: leadId } });
    if (!existing) notFound();
    const form = await LeadActivityForm.create({ ...(await formInput(fd)), instance: existing });
    if (!(await form.isValid())) {
      await flash("error", "Please correct the errors below.");
      return { markup: formMarkup(form) };
    }
    try {
      const scheduled = await saveAdminActivity(user.id, form, current, existing.counsellor_id, existing);
      await flash("success", scheduled ? "Activity updated and next follow-up scheduled." : "Activity updated.");
      redirect(reverse("admin_view_lead", leadId));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", failureText("Could not update activity", err));
      return { markup: formMarkup(form) };
    }
  }

  const form = await LeadActivityForm.create({ instance: activity });
  const loggerName = presentedString(activity, "admin_logger_name");
  return (
    <>
      <PageHeader title={`Edit Activity — ${lead.first_name} ${lead.last_name}`} />
      <section className="content">
        <div className="container-fluid">
          <div className="alert alert-info">
            Counsellor: <strong>{fullName(activity.counsellor.admin)}</strong>
            {loggerName ? <> · Logged by admin: <strong>{loggerName}</strong></> : null}
            {" "}· Added {formatStamp(activity.completed_date)}
          </div>
          <Card title={`Edit Activity — ${lead.first_name} ${lead.last_name}`}>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Update activity" />
            <Link href={reverse("admin_view_lead", lead.id)} className="btn btn-secondary mt-3">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { LeadActivityForm } from "@/modules/activities/activity.form";
import {
  applyActivityToLead,
  counsellorActivityFrozenMessage,
  createPendingFollowup,
  isActivityFrozen,
  maybeFreezeForActivityBurst,
} from "@/modules/activities/activity.service";
import { invalidateCounsellorSnapshot } from "@/modules/dashboard/cache-keys";
import { presentLead } from "@/modules/presenters";
import { formInput, recordFromFormData, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { readSearch, requiredId, type SearchParams } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ActivityFormSection } from "@/components/activity-form-section";
import { activityFormMarkup } from "@/modules/activities/activity-form-markup";
import { fail } from "../../../../../_lib/access";
import { myLeadFiltersFrom, myLeadsRedirectPath } from "../../../../../_lib/my-leads-filters";
import { ownedLead } from "../../../../_lib/owned";

export const metadata = { title: "Add Activity" };

async function save(leadId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead } = await ownedLead(leadId);
  const input = await formInput(fd);
  const form = await LeadActivityForm.create(input);
  if (await isActivityFrozen(counsellor.id)) {
    await flash("error", counsellorActivityFrozenMessage());
    return { markup: activityFormMarkup(form) };
  }
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: activityFormMarkup(form) };
  }
  const notices: Array<["success" | "warning", string]> = [];
  try {
    const data = form.activityData();
    const activity = await prisma.leadActivity.create({
      data: { ...data, lead_id: lead.id, counsellor_id: counsellor.id },
    });
    await maybeFreezeForActivityBurst(counsellor.id);
    await applyActivityToLead(lead, activity.outcome, {
      touchContact: true,
      followupDate: form.hasNextAction() ? form.cleaned_data.followup_date : null,
    });
    if (form.hasNextAction() && form.cleaned_data.followup_date) {
      if (await isActivityFrozen(counsellor.id)) {
        notices.push(["success", "Activity added successfully!"]);
        notices.push(["warning", `Follow-up could not be scheduled: ${counsellorActivityFrozenMessage()}`]);
      } else {
        await createPendingFollowup(lead.id, counsellor.id, {
          ...activity,
          followup_notes: form.cleaned_data.followup_notes,
          next_action_title: form.cleaned_data.next_action_title,
        }, form.cleaned_data.followup_date);
        await maybeFreezeForActivityBurst(counsellor.id);
        notices.push(["success", "Activity completed & next follow-up scheduled!"]);
      }
    } else {
      notices.push(["success", "Activity added successfully!"]);
    }
    await invalidateCounsellorSnapshot(counsellor.id);
  } catch (err) {
    await flash("error", fail(err, "Could not add activity"));
    return { markup: activityFormMarkup(form) };
  }
  for (const [level, text] of notices) await flash(level, text);
  redirect(await myLeadsRedirectPath(recordFromFormData(fd)));
}

export default async function AddActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ lead_id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lead_id } = await params;
  const query = await readSearch(searchParams);
  const { counsellor, lead: raw } = await ownedLead(requiredId(lead_id));
  const lead = presentLead(raw);
  const blank = await LeadActivityForm.create();
  const previous = await prisma.leadActivity.findFirst({
    where: { lead_id: lead.id, counsellor_id: counsellor.id },
    orderBy: [{ completed_date: "desc" }, { id: "desc" }],
  });
  const frozen = await isActivityFrozen(counsellor.id);
  const filters = myLeadFiltersFrom(query);

  return (
    <>
      <PageHeader title="Add Activity">
        <Link className="btn btn-sm btn-secondary" href={reverse("lead_detail", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Add activity — ${lead.first_name} ${lead.last_name}`}>
            {previous?.completed_date ? <p className="text-muted">Previous activity: {formatDjango(previous.completed_date, "M d, Y H:i")}</p> : null}
            {frozen ? <div className="alert alert-danger">{counsellorActivityFrozenMessage()}</div> : null}
            <ActivityFormSection
              action={save.bind(null, lead.id)}
              markup={activityFormMarkup(blank)}
              submitLabel="Save"
              extra={Object.entries(filters).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
            />
          </Card>
        </div>
      </section>
    </>
  );
}

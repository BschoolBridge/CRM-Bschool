import Link from "next/link";
import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { LeadActivityForm } from "@/modules/activities/activity.form";
import {
  applyActivityToLead,
  counsellorActivityFrozenMessage,
  createPendingFollowup,
  isActivityFrozen,
  maybeFreezeForActivityBurst,
  updateActivity,
} from "@/modules/activities/activity.service";
import { invalidateCounsellorSnapshot } from "@/modules/dashboard/cache-keys";
import { presentActivity, presentLead } from "@/modules/presenters";
import { formInput, formMarkup, recordFromFormData, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { readSearch, requiredId, type SearchParams } from "@/server/request";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { fail } from "../../../../../../_lib/access";
import { myLeadFiltersFrom, myLeadsRedirectPath } from "../../../../../../_lib/my-leads-filters";
import { ownedActivity } from "../../../../../_lib/owned";

export const metadata = { title: "Edit Activity" };

async function save(leadId: number, activityId: number, _state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const { counsellor, lead, activity } = await ownedActivity(leadId, activityId);
  const form = await LeadActivityForm.create({ ...(await formInput(fd)), instance: activity });
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  const notices: Array<["success" | "warning", string]> = [];
  try {
    const data = form.activityData();
    const saved = await updateActivity(activity.id, data);
    await applyActivityToLead(lead, saved.outcome, {
      touchContact: saved.is_completed,
      followupDate: form.hasNextAction() ? form.cleaned_data.followup_date : null,
    });
    if (form.hasNextAction() && form.cleaned_data.followup_date) {
      if (await isActivityFrozen(counsellor.id)) {
        notices.push(["warning", `Activity updated, but follow-up could not be scheduled: ${counsellorActivityFrozenMessage()}`]);
      } else {
        await createPendingFollowup(lead.id, counsellor.id, saved, form.cleaned_data.followup_date);
        await maybeFreezeForActivityBurst(counsellor.id);
        notices.push(["success", "Activity completed & next follow-up scheduled!"]);
      }
    } else {
      notices.push(["success", "Activity updated successfully!"]);
    }
    await invalidateCounsellorSnapshot(counsellor.id);
  } catch (err) {
    await flash("error", fail(err, "Could not update activity"));
    return { markup: formMarkup(form) };
  }
  for (const [level, text] of notices) await flash(level, text);
  redirect(await myLeadsRedirectPath(recordFromFormData(fd)));
}

export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ lead_id: string; activity_id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lead_id, activity_id } = await params;
  const query = await readSearch(searchParams);
  const { lead: raw, activity: rawActivity } = await ownedActivity(requiredId(lead_id), requiredId(activity_id));
  const lead = presentLead(raw);
  const activity = presentActivity(rawActivity);
  const blank = await LeadActivityForm.create({ instance: rawActivity });
  const filters = myLeadFiltersFrom(query);
  return (
    <>
      <PageHeader title="Edit Activity">
        <Link className="btn btn-sm btn-secondary" href={reverse("lead_detail", lead.id)}>Back to lead</Link>
      </PageHeader>
      <section className="content">
        <div className="container-fluid">
          <Card title={`Edit activity — ${activity.subject}`}>
            <ClientForm
              action={save.bind(null, lead.id, activity.id)}
              markup={formMarkup(blank)}
              submitLabel="Save"
              extra={Object.entries(filters).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
            />
          </Card>
        </div>
      </section>
    </>
  );
}

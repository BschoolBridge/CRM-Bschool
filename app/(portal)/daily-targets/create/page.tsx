import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { calendarDateToIso } from "@/lib/time";
import { setDailyTarget } from "@/modules/dashboard/targets.service";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { DailyTargetFields } from "./fields";
import { DailyTargetForm } from "../target-form";

export const metadata = { title: "Set Daily Target" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const form = await DailyTargetForm.create(await formInput(fd));
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  let message = "";
  try {
    const { target_count, target_date, assign_mode, counsellors } = form.cleaned_data;
    const ids =
      assign_mode === "all"
        ? (await prisma.counsellor.findMany({ where: { is_active: true }, select: { id: true } })).map((counsellor) => counsellor.id)
        : counsellors;
    const target = await setDailyTarget({
      targetDate: target_date,
      targetCount: target_count,
      createdById: user.id,
      counsellorIds: ids,
    });
    message = `Target of ${target.target_count} tasks set for ${ids.length} counsellor(s) on ${calendarDateToIso(target.target_date)}!`;
  } catch (err) {
    form.addError(null, `Error: ${(err as Error).message}`);
    return { markup: formMarkup(form) };
  }
  await flash("success", message);
  redirect(reverse("manage_daily_targets"));
}

export default async function CreateDailyTargetPage() {
  await requireAdmin();
  const form = await DailyTargetForm.create({ data: null });
  return (
    <>
      <PageHeader title="Set Daily Target" />
      <section className="content">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <Card title="Set Daily Target">
                <p className="text-muted mb-3">
                  Enter the total number of tasks. The system will auto-prioritise: <strong>today&apos;s visits</strong> first, then <strong>pending activities</strong>, then <strong>leads by status</strong> (NEW last).
                </p>
                <DailyTargetFields action={save} markup={formMarkup(form)} />
                <Link href={reverse("manage_daily_targets")} className="btn btn-secondary mt-2">
                  Cancel
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { CounsellorNotificationForm } from "@/modules/notifications/notification.form";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send Notification" };

export default async function SendNotificationPage() {
  await requireAdmin();
  const form = await CounsellorNotificationForm.create();

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    await requireAdmin();
    const bound = await CounsellorNotificationForm.create(await formInput(fd));
    if (!(await bound.isValid())) {
      await flash("error", "Please fill the form properly!");
      return { markup: formMarkup(bound) };
    }
    await prisma.notificationCounsellor.create({
      data: { counsellor_id: bound.cleaned_data.counsellor, message: bound.cleaned_data.message },
    });
    await flash("success", "Notification sent successfully!");
    redirect(reverse("admin_home"));
  }

  return (
    <>
      <PageHeader title="Send Notification" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Send Notification to Counsellors">
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Send Notification" />
            <Link className="btn btn-secondary mt-3" href={reverse("admin_home")}>
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

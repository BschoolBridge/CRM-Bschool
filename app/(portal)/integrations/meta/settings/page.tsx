import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { MetaIntegrationSettingsForm } from "@/modules/integrations/integration.forms";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requirePermission } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "WhatsApp, Instagram & Facebook" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const inst = await prisma.metaIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1, access_token: "" }, update: {} });
  const form = MetaIntegrationSettingsForm.create({ ...(await formInput(fd)), instance: inst });
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const cleaned = form.cleaned_data;
  await prisma.metaIntegrationSettings.update({
    where: { id: 1 },
    data: {
      public_base_url: cleaned.public_base_url ?? "",
      verify_token: cleaned.verify_token ?? "",
      app_secret: cleaned.app_secret || inst.app_secret,
      access_token: cleaned.access_token || inst.access_token,
      whatsapp_phone_number_id: cleaned.whatsapp_phone_number_id ?? "",
      facebook_page_id: cleaned.facebook_page_id ?? "",
      whatsapp_enabled: cleaned.whatsapp_enabled,
      instagram_enabled: cleaned.instagram_enabled,
      facebook_messenger_enabled: cleaned.facebook_messenger_enabled,
      notify_admins_on_message: cleaned.notify_admins_on_message,
    },
  });
  await flash("success", "Integration settings saved.");
  redirect(reverse("manage_meta_integration"));
}

export default async function MetaSettingsPage() {
  await requirePermission("settings");
  const inst = await prisma.metaIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1, access_token: "" }, update: {} });
  const form = MetaIntegrationSettingsForm.create({ instance: inst });
  const webhookPath = reverse("meta_webhook");
  const base = (inst.public_base_url || "").replace(/\/+$/, "");
  return (
    <>
      <PageHeader title="WhatsApp, Instagram & Facebook" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Connection">
            <p className="text-muted">Callback URL: {base ? `${base}${webhookPath}` : webhookPath}</p>
            <p>Path: <code>{webhookPath}</code></p>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { effectiveAisensyConfig } from "@/modules/integrations/aisensy.service";
import { AiSensyIntegrationSettingsForm } from "@/modules/integrations/integration.forms";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { flash } from "@/server/flash";
import { requirePermission } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata = { title: "AiSensy WhatsApp" };

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requirePermission("settings");
  const inst = await prisma.aiSensyIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const form = AiSensyIntegrationSettingsForm.create({ ...(await formInput(fd)), instance: inst });
  if (!(await form.isValid())) return { markup: formMarkup(form) };
  const cleaned = form.cleaned_data;
  await prisma.aiSensyIntegrationSettings.update({
    where: { id: 1 },
    data: {
      public_base_url: cleaned.public_base_url ?? "",
      webhook_secret: cleaned.webhook_secret || inst.webhook_secret,
      webhook_token: cleaned.webhook_token || inst.webhook_token,
      enabled: cleaned.enabled,
    },
  });
  await flash("success", "AiSensy integration settings saved.");
  redirect(reverse("manage_aisensy_integration"));
}

export default async function AiSensySettingsPage() {
  await requirePermission("settings");
  const inst = await prisma.aiSensyIntegrationSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const form = AiSensyIntegrationSettingsForm.create({ instance: inst });
  const cfg = await effectiveAisensyConfig();
  const webhookPath = reverse("aisensy_webhook");
  const base = cfg.public_base_url || "";
  return (
    <>
      <PageHeader title="AiSensy WhatsApp" />
      <section className="content">
        <div className="container-fluid">
          <Card title="AiSensy">
            <p>Callback URL: {base ? `${base}${webhookPath}` : webhookPath}</p>
            <p>Path: <code>{webhookPath}</code></p>
            <p>Secret configured: <strong>{cfg.webhook_secret ? "Yes" : "No"}</strong></p>
            <p>Token configured: <strong>{cfg.webhook_token ? "Yes" : "No"}</strong></p>
            <p>Enabled: <strong>{cfg.enabled ? "Yes" : "No"}</strong></p>
            <ClientForm action={save} markup={formMarkup(form)} submitLabel="Save" />
          </Card>
        </div>
      </section>
    </>
  );
}

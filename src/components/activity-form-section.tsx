import Script from "next/script";
import { headers } from "next/headers";
import type { FormState } from "../server/form";
import { ActivityClientForm } from "./activity-form";

/** Activity form + lead_activity_form.js (next-action / visit-scheduled UI). */
export async function ActivityFormSection({
  action,
  markup,
  submitLabel,
  extra,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  markup: string;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <ActivityClientForm action={action} markup={markup} submitLabel={submitLabel} extra={extra} />
      <Script src="/static/js/lead_activity_form.js" strategy="afterInteractive" nonce={nonce} />
    </>
  );
}

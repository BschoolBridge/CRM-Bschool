import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { leadWebhookConfig } from "@/modules/integrations/lead-webhook.service";
import { WEBSITE_SOURCE_CONTACTS, WEBSITE_SOURCE_ENQUIRY } from "@/modules/integrations/website-sources";
import { flash } from "@/server/flash";
import { requirePermission } from "@/server/actor";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Website lead webhook" };

async function acknowledge() {
  "use server";
  await requirePermission("settings");
  await flash("info", "Webhook auth is configured via environment variables (CRM_WEBHOOK_TOKEN). Restart the app after changing .env.");
  redirect(reverse("manage_lead_webhook_integration"));
}

export default async function LeadWebhookSettingsPage() {
  await requirePermission("settings");
  const cfg = leadWebhookConfig();
  const webhookPath = reverse("lead_webhook");
  const webhookFull = cfg.public_base_url ? `${cfg.public_base_url}${webhookPath}` : "";
  return (
    <>
      <PageHeader title="Website lead webhook" />
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-8">
              <Card title="Bschool Bridge website → CRM">
                <p className="text-muted">
                  The website should POST the counselling form payload below. Use the same bearer token on the website and in the CRM <code>.env</code>.
                </p>
                {webhookFull ? (
                  <>
                    <div className="form-group">
                      <label>CRM_WEBHOOK_URL</label>
                      <input className="form-control" readOnly value={webhookFull} />
                    </div>
                    <p><strong>HTTP method:</strong> POST</p>
                    <p><strong>Content-Type:</strong> <code>application/json</code></p>
                    <p><strong>Auth header:</strong> <code>Authorization: Bearer &lt;CRM_WEBHOOK_TOKEN&gt;</code></p>
                    <p className="text-muted">
                      Also accepted: <code>X-CRM-Webhook-Token</code>. Query-string tokens are ignored.
                    </p>
                  </>
                ) : (
                  <div className="alert alert-warning">Set SITE_URL in your server environment and restart the app to see the full webhook URL.</div>
                )}

                <h5 className="mt-4">Always sent by the website</h5>
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>Website field</th>
                      <th>CRM storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>Stored in lead notes as website lead id</td></tr>
                    <tr><td><code>createdAt</code></td><td>Used as lead <code>created_at</code> when creating; also noted</td></tr>
                    <tr><td><code>fullName</code></td><td>Lead first/last name</td></tr>
                    <tr><td><code>phone</code> (+91…)</td><td>Lead phone (required). Digits normalized</td></tr>
                    <tr><td><code>targetExam</code></td><td>Exam attempt (CAT/XAT/…); year parsed when present</td></tr>
                    <tr><td><code>percentile</code> (text)</td><td>Exam attempt notes / numeric percentile when parseable</td></tr>
                    <tr><td><code>source</code></td><td><code>source_campaign</code> + website enquiry source</td></tr>
                    <tr><td><code>status</code> (<code>new</code>)</td><td>Lead status <code>NEW</code></td></tr>
                    <tr><td><code>notes</code></td><td>Appended to lead notes when non-empty</td></tr>
                  </tbody>
                </table>

                <h5 className="mt-3">Sent when filled in, otherwise null</h5>
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>Website field</th>
                      <th>CRM storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>email</code></td><td>Lead email (placeholder email if missing)</td></tr>
                    <tr><td><code>city</code></td><td>Lead city + preference location</td></tr>
                    <tr><td><code>workExperience</code></td><td>Academic profile employment status</td></tr>
                    <tr><td><code>academicBackground</code></td><td>Academic profile highest qualification</td></tr>
                    <tr><td><code>budget</code></td><td>Lead preference fee band</td></tr>
                    <tr><td><code>specialization</code></td><td>Lead preference specialization</td></tr>
                    <tr><td><code>college</code></td><td>Lead school name; unverified shortlist when <code>source=apply_click</code></td></tr>
                  </tbody>
                </table>

                <p><strong>Source values:</strong> <code>counseling_form</code>, <code>visit_popup</code>, <code>apply_click</code>, <code>counseling_button</code> → CRM source “{WEBSITE_SOURCE_ENQUIRY}”.</p>
                <p>Contact-page style labels still map to “{WEBSITE_SOURCE_CONTACTS}”.</p>
                <p>{cfg.dedupe_by_phone ? "Same phone number updates the latest existing lead (newest data wins) and removes older duplicate leads for that number." : "Each submission creates a new lead (phone dedupe disabled via CRM_WEBHOOK_DEDUPE_PHONE=0)."}</p>

                <h5 className="mt-3">Example JSON body</h5>
                <pre className="bg-light p-3" style={{ whiteSpace: "pre-wrap" }}>{`{
  "id": "web_lead_123",
  "createdAt": "2026-11-20T18:00:00.000Z",
  "fullName": "Riya Sharma",
  "phone": "+919876543210",
  "targetExam": "CAT 2026",
  "percentile": "90-95",
  "source": "counseling_form",
  "status": "new",
  "notes": null,
  "email": "riya@example.com",
  "city": "Pune",
  "workExperience": "1–2 years",
  "academicBackground": "Engineering",
  "budget": "₹10–15 lakh",
  "specialization": "Marketing",
  "college": null
}`}</pre>

                <form action={acknowledge} className="mt-3">
                  <button className="btn btn-primary" type="submit">Save</button>
                </form>
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title="Server .env">
                <p>Enabled: <strong>{cfg.enabled ? "Yes" : "No"}</strong></p>
                <p>Token configured: <strong>{cfg.token ? "Yes" : "No"}</strong></p>
                <p>Signature secret: <strong>{cfg.secret ? "Yes (optional)" : "No"}</strong></p>
                <p>Phone dedupe: <strong>{cfg.dedupe_by_phone ? "On" : "Off"}</strong></p>
                <p className="mb-0">Path: <code>{webhookPath}</code></p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

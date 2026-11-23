import Link from "next/link";
import { unstable_rethrow, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { logger } from "@/lib/logger";
import { failurePayload, importLeads } from "@/modules/leads/import.service";
import { LeadImportForm } from "@/modules/leads/transfer-import.forms";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { readSession, updateSession } from "@/server/session";
import { asSessionFailures, failureText, readImportFailures } from "../format";

export const metadata = { title: "Import Leads" };

const METHODS = [
  ["round_robin", "Round-Robin (Equal distribution)"],
  ["workload_balanced", "Workload Balanced (Lightest workload first)"],
  ["performance_based", "Performance Based (Top performers first)"],
  ["specialization_based", "Specialization Based (Expertise matching)"],
] as const;

async function save(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  await requireAdmin();
  const input = await formInput(fd);
  const form = await LeadImportForm.create(input);
  if (!(await form.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup: formMarkup(form) };
  }
  const { file, source, assigned_counsellor } = form.cleaned_data;
  try {
    const result = await importLeads({
      buffer: file.buffer,
      fileName: file.originalname,
      sourceId: source,
      assignedCounsellorId: assigned_counsellor,
      autoAssign: Boolean(field(input.data, "auto_assign")),
      assignmentMethod: field(input.data, "assignment_method") || "round_robin",
    });
    for (const message of result.messages) await flash(message.level, message.text);
    if (result.failures.length) {
      await updateSession((data) => {
        data.leadImportFailures = asSessionFailures(failurePayload(file.originalname, result.failures));
      });
      await flash("info", `Review failed rows and reasons: ${reverse("import_lead_failures")}`);
    } else {
      await updateSession((data) => {
        delete data.leadImportFailures;
      });
    }
    redirect(reverse("manage_leads"));
  } catch (err) {
    unstable_rethrow(err);
    logger.error({ err }, "lead import failed");
    await flash("error", failureText("Import failed", err));
    return { markup: formMarkup(form) };
  }
}

export default async function ImportLeadsPage() {
  await requireAdmin();
  const form = await LeadImportForm.create();
  const session = await readSession();
  const hasFailures = Boolean(readImportFailures(session.data));
  return (
    <>
      <PageHeader title="Import Leads" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Import Leads from Excel/CSV">
            <div className="alert alert-info">
              <strong>Instructions:</strong> Upload an Excel (.xlsx) or CSV file with the following columns:
              <ul className="mb-0 mt-2">
                <li><strong>Required:</strong> name, phone</li>
                <li>
                  <strong>Optional:</strong> email, alternate_phone, address, School Name, course_interested, graduation_status
                  (YES/NO), graduation_course, graduation_year, graduation_college
                </li>
                <li>
                  <strong>Note:</strong> If graduation_status is &quot;NO&quot;, graduation_course and graduation_college will be set to
                  &quot;Not Applicable&quot;
                </li>
              </ul>
            </div>
            <ClientForm
              action={save}
              markup={formMarkup(form)}
              submitLabel="Import Leads"
              extra={
                <div className="form-group">
                  <label>Automatic Assignment Options</label>
                  <div className="custom-control custom-switch">
                    <input type="checkbox" className="custom-control-input" name="auto_assign" id="auto_assign" />
                    <label className="custom-control-label" htmlFor="auto_assign">
                      Automatically assign leads to counsellors after import
                    </label>
                    <small className="form-text text-muted">Only works if no specific counsellor is selected above</small>
                  </div>
                  <div className="mt-3">
                    <label>Assignment Method:</label>
                    {METHODS.map(([value, label], index) => (
                      <div className="custom-control custom-radio" key={value}>
                        <input
                          type="radio"
                          name="assignment_method"
                          value={value}
                          className="custom-control-input"
                          id={`assignment_${value}`}
                          defaultChecked={index === 0}
                        />
                        <label className="custom-control-label" htmlFor={`assignment_${value}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
            <div className="mt-3">
              {hasFailures ? (
                <Link href={reverse("import_lead_failures")} className="btn btn-outline-danger mr-2">
                  View Failed Rows
                </Link>
              ) : null}
              <Link href={reverse("manage_leads")} className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </Card>
          <Card title="Download Sample Template">
            <p>Download a sample template to see the required format:</p>
            <a href={reverse("download_import_template", "excel")} className="btn btn-success mr-2">
              Download Excel Template
            </a>
            <a href={reverse("download_import_template", "csv")} className="btn btn-info">
              Download CSV Template
            </a>
          </Card>
        </div>
      </section>
    </>
  );
}

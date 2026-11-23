import Link from "next/link";
import { unstable_rethrow, notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { invalidateAdminDashboard } from "@/modules/dashboard/cache-keys";
import { LeadTransferForm } from "@/modules/leads/transfer-import.forms";
import { TransferError, transferLead } from "@/modules/leads/transfer.service";
import { fullName, presentLead } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formInput, formMarkup, type FormState } from "@/server/form";
import { requiredId } from "@/server/request";
import { failureText } from "../../format";

export const metadata = { title: "Transfer Lead" };

export default async function TransferLeadPage({ params }: { params: Promise<{ lead_id: string }> }) {
  const leadId = requiredId((await params).lead_id);
  await requireAdmin();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { assigned_counsellor: { include: { admin: true } } },
  });
  if (!lead) notFound();
  presentLead(lead);

  async function save(_state: FormState, fd: FormData): Promise<FormState> {
    "use server";
    const user = await requireAdmin();
    const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!current) notFound();
    const input = await formInput(fd);
    const form = await LeadTransferForm.create(input);
    if (!(await form.isValid())) {
      await flash("error", "Please fill the form properly!");
      return { markup: formMarkup(form) };
    }
    try {
      await transferLead(current.id, form.cleaned_data.to_counsellor, form.cleaned_data.reason, {
        approvedById: user.id,
        adminApproved: true,
        additionalNotes: field(input.data, "additional_notes"),
        updateStatus: field(input.data, "update_lead_status") === "on",
      });
      await invalidateAdminDashboard();
      const to = await prisma.counsellor.findUniqueOrThrow({
        where: { id: form.cleaned_data.to_counsellor },
        include: { admin: true },
      });
      await flash("success", `Lead transferred to ${to.admin.first_name}`);
      redirect(reverse("manage_leads"));
    } catch (err) {
      unstable_rethrow(err);
      await flash("error", err instanceof TransferError ? err.message : failureText("Transfer failed", err));
      return { markup: formMarkup(form) };
    }
  }

  const form = await LeadTransferForm.create();
  const counsellor = lead.assigned_counsellor;
  return (
    <>
      <PageHeader title="Transfer Lead" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Transfer Lead: ${lead.first_name} ${lead.last_name}`}>
            <div className="alert alert-info">
              Transferring reassigns the lead to a different counsellor. All past activities stay on the lead; pending activities move to the new counsellor.
            </div>
            <div className="row mb-3">
              <div className="col-md-6">
                <p>
                  <strong>{lead.first_name} {lead.last_name}</strong>
                  <br />
                  {lead.email}
                  <br />
                  {lead.phone}
                  <br />
                  School: {lead.school_name || "Not provided"}
                  <br />
                  Current Status: <StatusBadge code={lead.status} />
                </p>
              </div>
              <div className="col-md-6">
                <p className="mb-1"><strong>Current Counsellor</strong></p>
                {counsellor ? (
                  <p>
                    <strong>{fullName(counsellor.admin)}</strong>
                    <br />
                    Employee ID: {counsellor.employee_id}
                    <br />
                    Department: {counsellor.department || "Not assigned"}
                  </p>
                ) : (
                  <p className="text-muted">Not assigned</p>
                )}
              </div>
            </div>
            <ClientForm
              action={save}
              markup={formMarkup(form)}
              submitLabel="Transfer Lead"
              extra={
                <>
                  <div className="form-group">
                    <label htmlFor="additional_notes">Additional Notes</label>
                    <textarea name="additional_notes" id="additional_notes" className="form-control" rows={3} placeholder="Any additional information for the new counsellor..." />
                  </div>
                  <div className="form-group">
                    <label>Transfer Options</label>
                    <div className="custom-control custom-switch">
                      <input type="checkbox" className="custom-control-input" name="notify_current_counsellor" id="notify_current_counsellor" defaultChecked />
                      <label className="custom-control-label" htmlFor="notify_current_counsellor">Notify current counsellor about the transfer</label>
                    </div>
                    <div className="custom-control custom-switch">
                      <input type="checkbox" className="custom-control-input" name="notify_new_counsellor" id="notify_new_counsellor" defaultChecked />
                      <label className="custom-control-label" htmlFor="notify_new_counsellor">Notify new counsellor about the assignment</label>
                    </div>
                    <div className="custom-control custom-switch">
                      <input type="checkbox" className="custom-control-input" name="update_lead_status" id="update_lead_status" />
                      <label className="custom-control-label" htmlFor="update_lead_status">Update lead status to &quot;Transferred&quot;</label>
                    </div>
                  </div>
                </>
              }
            />
            <Link href={reverse("manage_leads")} className="btn btn-secondary mt-3">
              Cancel
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}

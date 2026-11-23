import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { field, fieldList, idList } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { invalidateAdminDashboard } from "@/modules/dashboard/cache-keys";
import { extractManageLeadFilters, manageLeadsWhere } from "@/modules/leads/lead.queries";
import { LeadTransferForm } from "@/modules/leads/transfer-import.forms";
import { TransferError, transferLead } from "@/modules/leads/transfer.service";
import { fullName, presentAll, presentLead } from "@/modules/presenters";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { formMarkup, recordFromFormData, type FormState } from "@/server/form";
import { readSearch, type SearchParams } from "@/server/request";

export const metadata = { title: "Bulk Transfer Leads" };

async function confirmTransfer(_state: FormState, fd: FormData): Promise<FormState> {
  "use server";
  const user = await requireAdmin();
  const body = recordFromFormData(fd);
  const scope = field(body, "transfer_scope") || "selected";
  const filters = extractManageLeadFilters(body);
  const where = scope === "filtered"
    ? await (async () => {
        if (!Object.keys(filters).length) {
          await flash("warning", "Apply at least one filter on Manage Leads before transferring all matching leads.");
          redirect(reverse("manage_leads"));
        }
        return manageLeadsWhere(body);
      })()
    : await (async () => {
        const ids = idList(fieldList(body, "lead_ids"));
        if (!ids.length) {
          await flash("warning", "No leads selected for transfer.");
          redirect(reverse("manage_leads"));
        }
        return { id: { in: ids } };
      })();

  const leadCount = await prisma.lead.count({ where });
  if (leadCount === 0) {
    await flash("warning", "No valid leads found for transfer.");
    redirect(reverse("manage_leads"));
  }

  const form = await LeadTransferForm.create({ data: field(body, "confirm_transfer") === "1" ? body : null });
  if (form.isBound) {
    if (await form.isValid()) {
      const { to_counsellor: toId, reason } = form.cleaned_data;
      const toCounsellor = await prisma.counsellor.findUniqueOrThrow({ where: { id: toId }, include: { admin: true } });
      const leads = await prisma.lead.findMany({
        where,
        select: { id: true, first_name: true, last_name: true },
        orderBy: [{ first_name: "asc" }, { last_name: "asc" }, { id: "asc" }],
      });
      let transferred = 0;
      const skipped: string[] = [];
      for (const lead of leads) {
        try {
          await transferLead(lead.id, toId, reason, {
            approvedById: user.id,
            adminApproved: true,
            additionalNotes: field(body, "additional_notes"),
            updateStatus: field(body, "update_lead_status") === "on",
          });
          transferred++;
        } catch (err) {
          const why = err instanceof TransferError ? err.message : "An unexpected error occurred.";
          skipped.push(`${lead.first_name} ${lead.last_name}: ${why}`);
        }
      }
      await invalidateAdminDashboard();
      if (transferred) {
        await flash(
          "success",
          `Successfully transferred ${transferred} lead(s) to ${fullName(toCounsellor.admin)}. Activity history was kept on each lead.`,
        );
      }
      for (const message of skipped.slice(0, 5)) await flash("warning", message);
      if (skipped.length > 5) await flash("warning", `…and ${skipped.length - 5} more lead(s) were skipped.`);
      redirect(reverse("manage_leads"));
    }
    await flash("error", "Please fill the form properly.");
    return { markup: formMarkup(form) };
  }
  redirect(reverse("manage_leads"));
}

export default async function BulkTransferPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await readSearch(searchParams);
  const scope = search.transfer_scope || "selected";
  const filters = extractManageLeadFilters(search);
  let blocked = "";
  const where = scope === "filtered"
    ? Object.keys(filters).length
      ? await manageLeadsWhere(search)
      : null
    : (() => {
        const ids = idList((search.lead_ids ?? "").split(","));
        return ids.length ? { id: { in: ids } } : null;
      })();
  if (!where) {
    blocked = scope === "filtered"
      ? "Apply at least one filter on Manage Leads before transferring all matching leads."
      : "No leads selected for transfer.";
  }
  const leadCount = where ? await prisma.lead.count({ where }) : 0;
  if (where && leadCount === 0) blocked = "No valid leads found for transfer.";
  if (blocked || !where) {
    return (
      <>
        <PageHeader title="Bulk Transfer Leads" />
        <section className="content">
          <div className="container-fluid">
            <Card title="Bulk Transfer Leads">
              <div className="alert alert-warning">{blocked || "No leads selected for transfer."}</div>
              <Link href={reverse("manage_leads")} className="btn btn-secondary">Back to leads</Link>
            </Card>
          </div>
        </section>
      </>
    );
  }
  const preview = await prisma.lead.findMany({
    where,
    include: { assigned_counsellor: { include: { admin: true } }, source: true },
    orderBy: [{ first_name: "asc" }, { last_name: "asc" }, { id: "asc" }],
    take: 50,
  });
  presentAll(preview, (lead) => presentLead(lead));
  const form = await LeadTransferForm.create();
  const hiddenIds = scope === "filtered" ? [] : preview.map((lead) => String(lead.id));

  return (
    <>
      <PageHeader title="Bulk Transfer Leads" />
      <section className="content">
        <div className="container-fluid">
          <Card title={`Bulk transfer — ${leadCount} lead${leadCount === 1 ? "" : "s"}`}>
            <div className="alert alert-info">
              <strong>Activity history is kept.</strong> Completed activities stay on the lead timeline. Pending activities move to the new counsellor.
            </div>
            {scope === "filtered" ? (
              <div className="alert alert-secondary py-2">
                <strong>Filter scope:</strong>
                {filters.search ? <span className="badge badge-light border ml-1">Search: {filters.search}</span> : null}
                {filters.status ? <span className="badge badge-light border ml-1">Status: {filters.status}</span> : null}
                {filters.priority ? <span className="badge badge-light border ml-1">Priority: {filters.priority}</span> : null}
                {filters.counsellor ? <span className="badge badge-light border ml-1">Counsellor ID: {filters.counsellor}</span> : null}
                {filters.source ? <span className="badge badge-light border ml-1">Source ID: {filters.source}</span> : null}
              </div>
            ) : null}
            {leadCount > preview.length ? (
              <p className="text-muted small">
                Showing first {preview.length} of {leadCount} leads. The transfer will include <strong>all {leadCount}</strong> matching leads.
              </p>
            ) : null}
            <div className="table-responsive mb-3">
              <table className="table table-sm table-bordered mb-0">
                <thead className="thead-light">
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Current counsellor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.first_name} {lead.last_name}</td>
                      <td>{lead.phone || "—"}</td>
                      <td>{lead.assigned_counsellor ? fullName(lead.assigned_counsellor.admin) : <span className="text-muted">Not assigned</span>}</td>
                      <td><StatusBadge code={lead.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ClientForm
              action={confirmTransfer}
              markup={formMarkup(form)}
              submitLabel={`Transfer ${leadCount} lead${leadCount === 1 ? "" : "s"}`}
              extra={
                <>
                  <input type="hidden" name="confirm_transfer" value="1" />
                  <input type="hidden" name="transfer_scope" value={scope} />
                  {scope === "filtered" ? (
                    <>
                      <input type="hidden" name="search" value={filters.search ?? ""} />
                      <input type="hidden" name="status" value={filters.status ?? ""} />
                      <input type="hidden" name="priority" value={filters.priority ?? ""} />
                      <input type="hidden" name="counsellor" value={filters.counsellor ?? ""} />
                      <input type="hidden" name="source" value={filters.source ?? ""} />
                    </>
                  ) : (
                    hiddenIds.map((id) => <input key={id} type="hidden" name="lead_ids" value={id} />)
                  )}
                  <div className="form-group">
                    <label htmlFor="additional_notes">Additional notes</label>
                    <textarea name="additional_notes" id="additional_notes" className="form-control" rows={3} placeholder="Optional notes for the new counsellor…" />
                  </div>
                  <div className="custom-control custom-switch mb-3">
                    <input type="checkbox" className="custom-control-input" name="update_lead_status" id="update_lead_status" defaultChecked />
                    <label className="custom-control-label" htmlFor="update_lead_status">Set lead status to &quot;Transferred&quot;</label>
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

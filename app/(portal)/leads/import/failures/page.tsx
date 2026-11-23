import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { requireAdmin } from "@/server/actor";
import { readSession } from "@/server/session";
import { readImportFailures } from "../../format";

export const metadata = { title: "Lead Import Failures" };

export default async function ImportLeadFailuresPage() {
  await requireAdmin();
  const session = await readSession();
  const payload = readImportFailures(session.data);
  const rows = payload?.rows ?? [];
  return (
    <>
      <PageHeader title="Lead Import Failures" />
      <section className="content">
        <div className="container-fluid">
          <Card title="Failed Lead Rows">
            {payload && rows.length ? (
              <>
                <p className="mb-1">
                  <strong>File:</strong> {payload.file_name}
                </p>
                <p className="mb-1">
                  <strong>Total Failed Rows:</strong> {payload.total_failed}
                </p>
                {payload.truncated ? (
                  <p className="text-warning">Showing latest {rows.length} failed rows (older rows truncated).</p>
                ) : null}
                <div className="mb-3">
                  <a href={reverse("download_import_failures_excel")} className="btn btn-danger mr-2">
                    Download Failed Rows Excel
                  </a>
                  <Link href={reverse("import_leads")} className="btn btn-primary">
                    Back to Import
                  </Link>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered table-striped">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.row_num}-${row.phone}-${row.reason}`}>
                          <td>{row.row_num}</td>
                          <td>{row.name || "-"}</td>
                          <td>{row.email || "-"}</td>
                          <td>{row.phone || "-"}</td>
                          <td>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="alert alert-info">No failed lead import rows found in recent session.</div>
                <Empty text="No failed rows found for the latest import in this session." />
                <Link href={reverse("import_leads")} className="btn btn-primary mt-3">
                  Go to Import Leads
                </Link>
              </>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

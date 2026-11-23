import { redirect } from "next/navigation";
import { reverse } from "@/http/urls";
import { workbookBuffer, XLSX_MIME } from "@/lib/spreadsheet";
import { failureReportRows } from "@/modules/leads/import.service";
import { requireAdmin } from "@/server/actor";
import { flash } from "@/server/flash";
import { readSession } from "@/server/session";
import { readImportFailures } from "../../../format";

function attachment(filename: string, body: Buffer, contentType: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET() {
  await requireAdmin();
  const session = await readSession();
  const payload = readImportFailures(session.data);
  if (!payload?.rows.length) {
    await flash("info", "No failed lead import rows available to download.");
    redirect(reverse("import_lead_failures"));
  }
  const buffer = await workbookBuffer("Failed Leads", failureReportRows(payload));
  return attachment("lead_import_failures.xlsx", buffer, XLSX_MIME);
}

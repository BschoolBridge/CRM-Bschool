import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/config/env";
import { workbookBuffer, XLSX_MIME } from "@/lib/spreadsheet";
import { IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_SAMPLE_ROWS } from "@/modules/leads/import.service";
import { requireAdmin } from "@/server/actor";

function attachment(filename: string, body: Buffer, contentType: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ file_type: string }> }) {
  await requireAdmin();
  const { file_type: type } = await context.params;
  if (type === "excel") {
    const buffer = await workbookBuffer("Lead Import Template", [IMPORT_TEMPLATE_HEADERS, ...IMPORT_TEMPLATE_SAMPLE_ROWS]);
    return attachment("lead_import_template.xlsx", buffer, XLSX_MIME);
  }
  if (type !== "csv") return new Response("Invalid file type", { status: 400 });
  const file = path.join(config.resourcesDir, "import-templates", "lead_import_template.csv");
  try {
    const body = await fs.readFile(file);
    return attachment("lead_import_template.csv", body, "text/csv");
  } catch {
    return new Response("Template file not found", { status: 404 });
  }
}

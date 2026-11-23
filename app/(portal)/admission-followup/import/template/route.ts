import { XLSX_MIME, workbookBuffer } from "@/lib/spreadsheet";
import { requireAdmin } from "@/server/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const buf = await workbookBuffer("After Admission", [
    ["Name", "Phone", "Course", "Notes"],
    ["Rahul Sharma", "9876543210", "BBA", ""],
    ["Priya Verma", "9123456780", "MBA", "Call for documents"],
  ]);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="after_admission_import_template.xlsx"',
    },
  });
}

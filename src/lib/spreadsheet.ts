import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

export type SheetRow = Record<string, unknown>;

export function isBlankCell(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "string") return !value.trim();
  return false;
}

/** Plain value of an ExcelJS cell (formulas → result, rich text → text, hyperlinks → text). */
function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((p) => p.text).join("");
    if ("text" in value) return value.text;
    if ("error" in value) return null;
  }
  return value;
}

function csvRows(buffer: Buffer): Array<[number, SheetRow]> {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const records: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: false });
  const [header, ...body] = records;
  if (!header) return [];
  const keys = header.map((h) => (h ?? "").trim());
  const out: Array<[number, SheetRow]> = [];
  for (const cells of body) {
    if (cells.length === 1 && cells[0] === "") continue;
    const row: SheetRow = {};
    keys.forEach((key, j) => {
      if (key) row[key] = (cells[j] ?? "").trim();
    });
    out.push([out.length + 2, row]);
  }
  return out;
}

async function xlsxRows(buffer: Buffer): Promise<Array<[number, SheetRow]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cellValue(cell.value) ?? "").trim();
  });
  if (!headers.some(Boolean)) return [];

  const out: Array<[number, SheetRow]> = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const data: SheetRow = {};
    headers.forEach((key, col) => {
      if (key) data[key] = cellValue(row.getCell(col).value);
    });
    if (Object.values(data).every(isBlankCell)) continue;
    out.push([r, data]);
  }
  return out;
}

/** (row number, row) pairs; row 1 is the header, so data starts at 2. */
export async function readSpreadsheet(buffer: Buffer, filename: string): Promise<Array<[number, SheetRow]>> {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv")) return csvRows(buffer);
  if (name.endsWith(".xlsx")) return xlsxRows(buffer);
  throw new Error("Only .csv and .xlsx lead imports are supported.");
}

export async function workbookBuffer(sheetTitle: string, rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetTitle);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

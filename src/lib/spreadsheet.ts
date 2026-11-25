import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { resolveImportColumnMapping } from "../modules/leads/import-columns";

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

function rowHeaderScore(headers: string[]): number {
  const usable = headers.map((h) => h.trim()).filter(Boolean);
  if (!usable.length) return -1;
  // Title banners often repeat the same long phrase across merged cells.
  const unique = new Set(usable.map((h) => h.toLowerCase()));
  if (unique.size === 1 && usable.length >= 2) return -1;

  const mapping = resolveImportColumnMapping(usable);
  let score = Object.keys(mapping).length;
  if (mapping.fullName) score += 5;
  if (mapping.phone) score += 5;
  if (mapping.email) score += 1;
  return score;
}

/**
 * Prefer the first row that looks like a real header (name + phone),
 * so title/banner rows above the table are skipped.
 */
export function detectHeaderRowIndex(rows: string[][], scanLimit = 15): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(scanLimit, rows.length);
  for (let i = 0; i < limit; i++) {
    const labels = (rows[i] ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);
    const score = rowHeaderScore(labels);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
    const mapping = resolveImportColumnMapping(labels);
    if (mapping.fullName && mapping.phone && score >= 12) return i;
  }
  return bestIdx;
}

function csvRows(buffer: Buffer): Array<[number, SheetRow]> {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const records: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: false });
  if (!records.length) return [];
  const headerIdx = detectHeaderRowIndex(records);
  const keys = (records[headerIdx] ?? []).map((h) => (h ?? "").trim());
  const out: Array<[number, SheetRow]> = [];
  for (let i = headerIdx + 1; i < records.length; i++) {
    const cells = records[i] ?? [];
    if (cells.length === 1 && cells[0] === "") continue;
    const row: SheetRow = {};
    keys.forEach((key, j) => {
      if (key) row[key] = (cells[j] ?? "").trim();
    });
    if (Object.values(row).every(isBlankCell)) continue;
    out.push([i + 1, row]);
  }
  return out;
}

async function xlsxRows(buffer: Buffer): Promise<Array<[number, SheetRow]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const maxScan = Math.min(15, sheet.rowCount);
  const scanned: string[][] = [];
  for (let r = 1; r <= maxScan; r++) {
    const labels: string[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      labels[col - 1] = String(cellValue(cell.value) ?? "").trim();
    });
    scanned.push(labels);
  }

  const headerIdx0 = detectHeaderRowIndex(scanned);
  const headerRowNum = headerIdx0 + 1;
  const headers: string[] = [];
  sheet.getRow(headerRowNum).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cellValue(cell.value) ?? "").trim();
  });
  if (!headers.some(Boolean)) return [];

  const out: Array<[number, SheetRow]> = [];
  for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
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

/** (row number, row) pairs; header may be below a title/banner row. */
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

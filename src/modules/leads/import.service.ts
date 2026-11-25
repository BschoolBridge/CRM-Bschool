import { config } from "../../config/env";
import { logger } from "../../lib/logger";
import { normalizeLeadPhone, placeholderLeadEmail } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { isBlankCell, readSpreadsheet, type SheetRow } from "../../lib/spreadsheet";
import { invalidateAdminDashboard } from "../dashboard/cache-keys";
import { notifyLeadsAssigned } from "../notifications/assignment-notifications";
import { assignLeads, assignmentMethodLabel } from "./assignment.service";
import { remapImportRow } from "./import-columns";
import { allocateLeadIds } from "./lead-ids";
import { createLead, type LeadCreateData } from "./lead.repository";
import { duplicatePhoneMessage, findLeadByPhone } from "./phone-lookup";

export const IMPORT_FAILURES_MAX_ROWS = 5000;

/** Template columns aligned with the Bschool Bridge website lead webhook contract. */
export const IMPORT_TEMPLATE_HEADERS = [
  "fullName",
  "phone",
  "email",
  "targetExam",
  "percentile",
  "city",
  "workExperience",
  "academicBackground",
  "budget",
  "specialization",
  "college",
  "notes",
  "source",
];

export const IMPORT_TEMPLATE_SAMPLE_ROWS = [
  [
    "Riya Sharma",
    "9876543210",
    "riya.sharma@example.com",
    "CAT 2026",
    "90-95",
    "Delhi",
    "1–2 years",
    "B.Com",
    "₹10–15 lakh",
    "Marketing",
    "FMS Delhi",
    "Requested evening callback",
    "counseling_form",
  ],
  [
    "Aman Verma",
    "9988776655",
    "aman.verma@example.com",
    "XAT 2026",
    "80-85",
    "Mumbai",
    "fresher",
    "B.Tech",
    "under ₹10 lakh",
    "Finance",
    "",
    "",
    "visit_popup",
  ],
];

export interface ImportFailureRow {
  row_num: number;
  name: string;
  email: string;
  phone: string;
  reason: string;
  raw_row: Record<string, string>;
}

export interface ImportFailurePayload {
  created_at: string;
  file_name: string;
  total_failed: number;
  rows: ImportFailureRow[];
  truncated: boolean;
}

function cellText(row: SheetRow, key: string, fallback = ""): string {
  const v = row[key];
  if (isBlankCell(v)) return fallback;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s || fallback;
}

/** Lookup after remapImportRow; still tolerates leftover aliases / case differences. */
function cellAny(row: SheetRow, ...keys: string[]): string {
  for (const key of keys) {
    const direct = cellText(row, key);
    if (direct) return direct;
  }
  const byLower = new Map(Object.keys(row).map((key) => [key.trim().toLowerCase(), key]));
  for (const key of keys) {
    const actual = byLower.get(key.toLowerCase());
    if (!actual) continue;
    const value = cellText(row, actual);
    if (value) return value;
  }
  return "";
}

function failureRow(rowNum: number, row: SheetRow, reason: string): ImportFailureRow {
  const mapped = remapImportRow(row);
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const k = key.trim();
    if (k) raw[k] = isBlankCell(value) ? "" : String(value).trim();
  }
  const name = cellAny(mapped, "fullName", "full_name", "name");
  return {
    row_num: rowNum,
    name,
    email: cellAny(mapped, "email", "email_address"),
    phone: cellAny(mapped, "phone", "mobile", "phone_number"),
    reason,
    raw_row: raw,
  };
}

const MAX_LENGTHS: Record<string, number> = {
  first_name: 100, last_name: 100, email: 254, phone: 15, alternate_phone: 15, school_name: 200,
  graduation_course: 200, graduation_college: 200, course_interested: 200, industry: 100, city: 100,
};

function lengthErrors(data: Record<string, unknown>): string | null {
  for (const [key, max] of Object.entries(MAX_LENGTHS)) {
    const value = String(data[key] ?? "");
    if (value.length > max) return `${key}: Ensure this value has at most ${max} characters (it has ${value.length}).`;
  }
  return null;
}

/** One import row → lead columns; throws with the reason shown in the failure report. */
export function leadFromImportRow(row: SheetRow, sourceId: number, assignedCounsellorId: number | null): LeadCreateData {
  // Map similar headers ("Full Name", "Mobile No.") onto canonical template keys.
  const mapped = remapImportRow(row);

  const fullName = cellAny(mapped, "fullName", "full_name", "name", "student_name", "applicant_name");
  const phoneRaw = cellAny(mapped, "phone", "mobile", "phone_number");
  if (!fullName) throw new Error("Missing required column value: fullName (or name)");
  if (!phoneRaw) throw new Error("Missing required column value: phone");

  const phone = normalizeLeadPhone(phoneRaw);
  if (!phone) throw new Error("Missing or invalid phone number");

  const [first = "", ...rest] = fullName.split(/\s+/).filter(Boolean);
  const email = cellAny(mapped, "email", "email_address").toLowerCase() || placeholderLeadEmail(phone);
  const targetExam = cellAny(mapped, "targetExam", "target_exam", "exam");
  const specialization = cellAny(mapped, "specialization");
  const courseInterested =
    cellAny(mapped, "course_interested")
    || [specialization, targetExam].filter(Boolean).join(" · ").slice(0, 200);
  const college = cellAny(mapped, "college", "school_name", "School Name", "graduation_college");
  const city = cellAny(mapped, "city").slice(0, 100);
  const fatherName = cellAny(mapped, "Father Name", "father_name", "fatherName", "fathers_name", "parent_name");
  const noteLines = [
    cellAny(mapped, "notes", "message", "comments", "remark"),
    fatherName ? `Father name: ${fatherName}` : "",
    targetExam ? `Target exam: ${targetExam}` : "",
    cellAny(mapped, "percentile", "score_band", "exam_percentile")
      ? `Percentile/score: ${cellAny(mapped, "percentile", "score_band", "exam_percentile")}`
      : "",
    cellAny(mapped, "workExperience", "work_experience")
      ? `Work experience: ${cellAny(mapped, "workExperience", "work_experience")}`
      : "",
    cellAny(mapped, "academicBackground", "academic_background")
      ? `Academic background: ${cellAny(mapped, "academicBackground", "academic_background")}`
      : "",
    cellAny(mapped, "budget") ? `Budget: ${cellAny(mapped, "budget")}` : "",
    cellAny(mapped, "source", "lead_source", "form_type", "form")
      ? `Website source: ${cellAny(mapped, "source", "lead_source", "form_type", "form")}`
      : "",
  ].filter(Boolean);

  let graduationStatus = cellAny(mapped, "graduation_status").toUpperCase() || "NO";
  if (!["YES", "NO"].includes(graduationStatus)) graduationStatus = "NO";
  const graduated = graduationStatus === "YES";

  let graduationYear: number | null = null;
  const yearRaw = cellAny(mapped, "graduation_year");
  if (yearRaw) {
    const n = Math.trunc(Number(yearRaw));
    graduationYear = Number.isFinite(n) ? n : null;
  }

  return {
    first_name: first.slice(0, 100),
    last_name: (rest.length ? fullName.slice(first.length).trim() : "").slice(0, 100),
    email,
    phone,
    alternate_phone: cellAny(mapped, "alternate_phone"),
    school_name: college.slice(0, 200),
    address: cellAny(mapped, "address"),
    city,
    graduation_status: graduationStatus,
    graduation_course: graduated ? cellAny(mapped, "graduation_course") || "Not Specified" : "Not Applicable",
    graduation_college: graduated ? cellAny(mapped, "graduation_college") || "Not Specified" : "Not Applicable",
    graduation_year: graduationYear,
    course_interested: courseInterested,
    industry: cellAny(mapped, "industry"),
    notes: noteLines.join("\n"),
    source_campaign: cellAny(mapped, "source", "lead_source", "form_type", "form").slice(0, 150) || null,
    source_id: sourceId,
    assigned_counsellor_id: assignedCounsellorId,
    is_graduated: graduated ? "YES" : "NO",
  };
}

export interface ImportOptions {
  buffer: Buffer;
  fileName: string;
  sourceId: number;
  assignedCounsellorId: number | null;
  autoAssign: boolean;
  assignmentMethod: string;
}

export interface ImportResult {
  successCount: number;
  errorCount: number;
  failures: ImportFailureRow[];
  messages: Array<{ level: "success" | "warning"; text: string }>;
}

export async function importLeads(opts: ImportOptions): Promise<ImportResult> {
  const pending: Array<{ rowNum: number; row: SheetRow; data: LeadCreateData }> = [];
  const failures: ImportFailureRow[] = [];
  const phonesSeen = new Set<string>();

  for (const [rowNum, row] of await readSpreadsheet(opts.buffer, opts.fileName)) {
    try {
      const data = leadFromImportRow(row, opts.sourceId, opts.assignedCounsellorId);
      const phone = data.phone as string;
      if (!phone) throw new Error("Missing or invalid phone number");
      if (phonesSeen.has(phone)) throw new Error("Duplicate phone number in this import file");
      phonesSeen.add(phone);
      const existing = await findLeadByPhone(phone);
      if (existing) throw new Error(duplicatePhoneMessage(existing));
      pending.push({ rowNum, row, data });
    } catch (err) {
      failures.push(failureRow(rowNum, row, (err as Error).message));
    }
  }

  const importedLeadIds: string[] = [];
  const batchSize = config.uploads.leadImportBatchSize;
  for (let i = 0; i < pending.length; i += batchSize) {
    const chunk = pending.slice(i, i + batchSize);
    const ids = await allocateLeadIds(chunk.length);
    const rows = chunk.map((p, j) => ({
      notes: "", address: "", enrichment_notes: "", routing_reason: "",
      ...p.data,
      lead_id: ids[j]!,
    }));
    try {
      await prisma.lead.createMany({ data: rows as never });
      importedLeadIds.push(...ids);
    } catch (err) {
      logger.warn({ err, rows: chunk.length }, "bulk lead insert failed; retrying one by one");
      for (const p of chunk) {
        try {
          const problem = lengthErrors({ ...p.data, alternate_phone: normalizeLeadPhone(p.data.alternate_phone ?? "") });
          if (problem) throw new Error(problem);
          if (!p.data.email) throw new Error("email: This field cannot be blank.");
          const created = await createLead(p.data, { notifyAssignment: false });
          importedLeadIds.push(created.lead_id);
        } catch (rowErr) {
          failures.push(failureRow(p.rowNum, p.row, (rowErr as Error).message));
        }
      }
    }
  }

  const imported = importedLeadIds.length
    ? await prisma.lead.findMany({
        where: { lead_id: { in: importedLeadIds } },
        select: { id: true, first_name: true, last_name: true, lead_id: true, source_id: true, assigned_counsellor_id: true },
      })
    : [];
  const successCount = imported.length;
  const errorCount = failures.length;
  await notifyLeadsAssigned(imported.filter((l) => l.assigned_counsellor_id));

  const messages: ImportResult["messages"] = [];
  if (opts.autoAssign && imported.length && !opts.assignedCounsellorId) {
    try {
      const counsellors = await prisma.counsellor.findMany({ where: { is_active: true }, select: { id: true }, orderBy: { id: "asc" } });
      if (counsellors.length) {
        await assignLeads(
          imported.filter((l) => !l.assigned_counsellor_id).map((l) => l.id),
          counsellors.map((c) => c.id),
          opts.assignmentMethod,
        );
        messages.push({
          level: "success",
          text: `Successfully imported ${successCount} leads and auto-assigned them using ${assignmentMethodLabel(opts.assignmentMethod)} method. ${errorCount} errors occurred.`,
        });
      } else {
        messages.push({
          level: "warning",
          text: `Successfully imported ${successCount} leads but no active counsellors found for auto-assignment. ${errorCount} errors occurred.`,
        });
      }
    } catch (err) {
      messages.push({
        level: "warning",
        text: `Successfully imported ${successCount} leads but auto-assignment failed: ${(err as Error).message}. ${errorCount} errors occurred.`,
      });
    }
  } else if (errorCount > 0) {
    messages.push({ level: "warning", text: `Successfully imported ${successCount} leads. ${errorCount} rows had errors and were skipped.` });
  } else {
    messages.push({ level: "success", text: `Successfully imported ${successCount} leads.` });
  }

  if (successCount > 0) await invalidateAdminDashboard();
  return { successCount, errorCount, failures, messages };
}

export function failurePayload(fileName: string, failures: ImportFailureRow[]): ImportFailurePayload {
  return {
    created_at: new Date().toISOString(),
    file_name: fileName,
    total_failed: failures.length,
    rows: failures.slice(0, IMPORT_FAILURES_MAX_ROWS),
    truncated: failures.length > IMPORT_FAILURES_MAX_ROWS,
  };
}

/** Failure report workbook: the original columns plus `failure_reason`. */
export function failureReportRows(payload: ImportFailurePayload): unknown[][] {
  const headers: string[] = [];
  for (const row of payload.rows) for (const key of Object.keys(row.raw_row)) if (!headers.includes(key)) headers.push(key);
  return [
    [...headers, "failure_reason"],
    ...payload.rows.map((row) => [...headers.map((h) => row.raw_row[h] ?? ""), row.reason]),
  ];
}

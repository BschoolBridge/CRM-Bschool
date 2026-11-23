import { config } from "@/config/env";
import { formatLocal } from "@/lib/time";
import type { ImportFailurePayload, ImportFailureRow } from "@/modules/leads/import.service";
import type { AppSession } from "@/server/session";

export const DELETE_ALL_CONFIRM_PHRASE = "DELETE ALL LEADS";

export function failureText(prefix: string, err: unknown): string {
  return `${prefix}: ${config.debug && err instanceof Error ? err.message : "please try again."}`;
}

export function formatStamp(value: Date | null | undefined): string {
  return value ? formatLocal(value, "LLL dd, yyyy HH:mm") : "";
}

export function formatDay(value: Date | null | undefined): string {
  return value ? formatLocal(value, "LLL dd, yyyy") : "";
}

export function truncateChars(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1))}…`;
}

export function readImportFailures(data: AppSession): ImportFailurePayload | null {
  const raw = data.leadImportFailures;
  if (!raw || !Array.isArray(raw.rows)) return null;
  const extra = raw as unknown as Partial<ImportFailurePayload> & { filename?: string };
  return {
    created_at: extra.created_at ?? "",
    file_name: extra.file_name ?? extra.filename ?? "",
    total_failed: typeof extra.total_failed === "number" ? extra.total_failed : raw.rows.length,
    rows: raw.rows as unknown as ImportFailureRow[],
    truncated: Boolean(extra.truncated),
  };
}

export function asSessionFailures(payload: ImportFailurePayload): NonNullable<AppSession["leadImportFailures"]> {
  return payload as unknown as NonNullable<AppSession["leadImportFailures"]>;
}

export function routeLabel(code: string): string {
  const labels: Record<string, string> = {
    undergraduate_counselor: "Undergraduate Counselor",
    graduate_counselor: "Graduate Counselor",
    specialized_department: "Specialized Department",
    senior_counselor: "Senior Counselor",
  };
  return labels[code] ?? code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function presentedString(row: object, key: string): string {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

import { DateTime } from "luxon";
import { logger } from "../../lib/logger";
import { prisma, type Db } from "../../lib/prisma";

const ASSIGN_PREFIX = "New lead assigned:";
const BULK_ASSIGN_PREFIX = "New leads assigned:";
// Single: New lead assigned: {name} — Source: {source} [lead:{pk}:{source_id}]
const ASSIGN_MSG_RE = /^New lead assigned: ([\s\S]+?) — Source: ([\s\S]+?)(?: \[lead:(\d+):(\d+)\])?$/;
// Bulk: New leads assigned: 200 — Sources: Website (120), Referral (80) [bulk:…]
const BULK_ASSIGN_MSG_RE = /^New leads assigned: (\d+) — Sources: ([\s\S]+?)(?: \[bulk:([^\]]+)\])?$/;
const SOURCE_COUNT_RE = /([^,]+?) \((\d+)\)/g;

export interface AssignedLeadRef {
  id: number;
  first_name: string;
  last_name: string;
  lead_id: string;
  source_id: number;
  assigned_counsellor_id: number | null;
  source?: { name: string } | null;
}

interface SourceCount {
  name: string;
  count: number;
}

export interface AssignmentPopup {
  type: "lead_assigned";
  batch: true;
  inbox_id: number | null;
  inbox_ids: number[];
  id: number | null;
  title: string;
  message: string;
  total_count: number;
  sources: SourceCount[];
  assigned_at: string;
  unique_id: string;
}

function byName(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

async function sourceNames(db: Db, leads: AssignedLeadRef[]): Promise<Map<number, string>> {
  const missing = [...new Set(leads.filter((l) => !l.source).map((l) => l.source_id))];
  const rows = missing.length
    ? await db.leadSource.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })
    : [];
  const names = new Map(rows.map((r) => [r.id, r.name]));
  for (const l of leads) if (l.source) names.set(l.source_id, l.source.name);
  return names;
}

export function singleAssignmentMessage(lead: AssignedLeadRef, sourceName: string): string {
  const label = `${lead.first_name} ${lead.last_name}`.trim() || lead.lead_id || "Lead";
  return `${ASSIGN_PREFIX} ${label} — Source: ${sourceName || "Unknown"} [lead:${lead.id}:${lead.source_id || 0}]`;
}

function bulkAssignmentMessage(count: number, sourceCounts: Map<string, number>): string {
  const parts = [...sourceCounts.entries()]
    .sort(([a], [b]) => byName(a, b))
    .map(([name, n]) => `${name} (${n})`)
    .join(", ");
  const batchId = DateTime.utc().toFormat("yyyyMMddHHmmssSSS") + "000";
  return `${BULK_ASSIGN_PREFIX} ${count} — Sources: ${parts} [bulk:${batchId}]`;
}

/** Inbox row for a lead whose counsellor changed through a regular single save. */
export async function notifyLeadAssigned(lead: AssignedLeadRef, db: Db = prisma): Promise<void> {
  if (!lead.assigned_counsellor_id) return;
  try {
    const names = await sourceNames(db, [lead]);
    await db.notificationCounsellor.create({
      data: {
        counsellor_id: lead.assigned_counsellor_id,
        message: singleAssignmentMessage(lead, names.get(lead.source_id) ?? "Unknown"),
      },
    });
  } catch (err) {
    logger.warn({ err, leadId: lead.id }, "could not create assignment notification");
  }
}

/** Bulk assignment: one summary inbox row per counsellor. */
export async function notifyLeadsAssigned(leads: AssignedLeadRef[], db: Db = prisma): Promise<void> {
  const byCounsellor = new Map<number, AssignedLeadRef[]>();
  for (const lead of leads) {
    if (!lead.assigned_counsellor_id || !lead.id) continue;
    const list = byCounsellor.get(lead.assigned_counsellor_id) ?? [];
    list.push(lead);
    byCounsellor.set(lead.assigned_counsellor_id, list);
  }
  if (!byCounsellor.size) return;
  const names = await sourceNames(db, leads);

  for (const [counsellorId, list] of byCounsellor) {
    const counts = new Map<string, number>();
    for (const lead of list) {
      const name = names.get(lead.source_id) ?? "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    try {
      await db.notificationCounsellor.create({
        data: { counsellor_id: counsellorId, message: bulkAssignmentMessage(list.length, counts) },
      });
    } catch (err) {
      logger.warn({ err, counsellorId }, "could not create bulk assignment notification");
    }
  }
}

interface InboxNote {
  id: number;
  message: string;
  created_at: Date;
}

function parseSources(text: string): SourceCount[] {
  return [...text.matchAll(SOURCE_COUNT_RE)].map((m) => ({ name: m[1]!.trim(), count: Number(m[2]) }));
}

function summaryPayload(ids: number[], total: number, sources: SourceCount[], at: string, uniqueId: string): AssignmentPopup {
  return {
    type: "lead_assigned",
    batch: true,
    inbox_id: ids[0] ?? null,
    inbox_ids: ids,
    id: ids[0] ?? null,
    title: `${total} new leads assigned`,
    message: `${total} leads have been assigned to you.`,
    total_count: total,
    sources,
    assigned_at: at,
    unique_id: uniqueId,
  };
}

function fromBulkNote(note: InboxNote): AssignmentPopup {
  const m = BULK_ASSIGN_MSG_RE.exec(note.message.trim());
  const total = m ? Number(m[1]) : 0;
  return summaryPayload([note.id], total, m ? parseSources(m[2]!) : [], note.created_at.toISOString(), `lead_assigned_bulk_${note.id}`);
}

function aggregateSingleNotes(notes: InboxNote[]): AssignmentPopup | null {
  const counts = new Map<string, number>();
  const ids: number[] = [];
  let latest: Date | null = null;
  for (const note of notes) {
    const m = ASSIGN_MSG_RE.exec(note.message.trim());
    if (!m) continue;
    const source = m[2]!.trim();
    counts.set(source, (counts.get(source) ?? 0) + 1);
    ids.push(note.id);
    if (!latest || note.created_at > latest) latest = note.created_at;
  }
  if (!ids.length) return null;
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const sources = [...counts.entries()].sort(([a], [b]) => byName(a, b)).map(([name, count]) => ({ name, count }));
  return summaryPayload(ids, total, sources, (latest ?? new Date()).toISOString(), `lead_assigned_batch_${ids[0]}_${total}`);
}

/** Summary payloads for the counsellor popup (total count + per-source breakdown). */
export async function assignmentNotificationsForPopup(counsellorId: number): Promise<AssignmentPopup[]> {
  // Prisma binds LIKE params as utf8mb4_bin; Hostinger MariaDB rejects mixing that with
  // unicode_ci message columns (error 1267), which broke counsellor login/home.
  const notes = await prisma.$queryRaw<Array<{ id: number; message: string; created_at: Date }>>`
    SELECT id, message, created_at
    FROM counsellor_notifications
    WHERE counsellor_id = ${counsellorId}
      AND is_read = 0
      AND (
        message COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ${BULK_ASSIGN_PREFIX} COLLATE utf8mb4_unicode_ci, '%')
        OR message COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ${ASSIGN_PREFIX} COLLATE utf8mb4_unicode_ci, '%')
      )
    ORDER BY created_at DESC
  `;

  const bulk = notes.filter((n) => n.message.trim().startsWith(BULK_ASSIGN_PREFIX));
  const single = notes.filter((n) => n.message.trim().startsWith(ASSIGN_PREFIX));
  const payloads = bulk.map(fromBulkNote);
  const aggregated = single.length ? aggregateSingleNotes(single) : null;
  if (aggregated) payloads.push(aggregated);
  if (payloads.length <= 1) return payloads;

  const merged = new Map<string, number>();
  const ids: number[] = [];
  let total = 0;
  let latest: string | null = null;
  for (const p of payloads) {
    total += p.total_count;
    ids.push(...p.inbox_ids);
    for (const s of p.sources) merged.set(s.name, (merged.get(s.name) ?? 0) + s.count);
    if (!latest || p.assigned_at > latest) latest = p.assigned_at;
  }
  const sources = [...merged.entries()].sort(([a], [b]) => byName(a, b)).map(([name, count]) => ({ name, count }));
  return [summaryPayload(ids, total, sources, latest ?? new Date().toISOString(), `lead_assigned_merged_${ids[0]}_${total}`)];
}

export async function markAssignmentNotificationsRead(counsellorId: number, ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const { count } = await prisma.notificationCounsellor.updateMany({
    where: { counsellor_id: counsellorId, id: { in: ids } },
    data: { is_read: true },
  });
  return count;
}

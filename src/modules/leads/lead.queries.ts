import { field, type FieldBag } from "../../http/params";
import { normalizeLeadPhone } from "../../lib/phone";
import { prisma, Prisma } from "../../lib/prisma";
import { localDayBounds, parseIsoDate } from "../../lib/time";
import { PRESET_OUTCOMES } from "../activities/activity.form";

export const MANAGE_LEADS_FILTER_PARAMS = ["search", "status", "priority", "counsellor", "source"] as const;
export const UNASSIGNED = "none";

export type ManageLeadFilters = Partial<Record<(typeof MANAGE_LEADS_FILTER_PARAMS)[number], string>>;

export function extractManageLeadFilters(params: FieldBag): ManageLeadFilters {
  const out: ManageLeadFilters = {};
  for (const key of MANAGE_LEADS_FILTER_PARAMS) {
    const value = field(params, key);
    if (value) out[key] = value;
  }
  return out;
}

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** IDs whose "First Last" contains the term. Only needed when the term spans the space. */
async function idsMatchingFullName(term: string): Promise<number[]> {
  if (!/\s/.test(term)) return [];
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM leads WHERE CONCAT(first_name, ' ', last_name) LIKE ${likePattern(term)}`;
  return rows.map((r) => Number(r.id));
}

/** Manage Leads search: names (incl. full name), contact fields, source, notes, counsellor. */
export async function leadSearchWhere(rawTerm: string): Promise<Prisma.LeadWhereInput> {
  const term = rawTerm.trim();
  if (!term) return {};
  const contains = { contains: term };
  const or: Prisma.LeadWhereInput[] = [
    { first_name: contains },
    { last_name: contains },
    { email: contains },
    { phone: contains },
    { alternate_phone: contains },
    { lead_id: contains },
    { school_name: contains },
    { course_interested: contains },
    { source: { is: { name: contains } } },
    { notes: contains },
    { address: contains },
    { assigned_counsellor: { is: { admin: { is: { first_name: contains } } } } },
    { assigned_counsellor: { is: { admin: { is: { last_name: contains } } } } },
  ];
  const fullNameIds = await idsMatchingFullName(term);
  if (fullNameIds.length) or.push({ id: { in: fullNameIds } });
  const norm = normalizeLeadPhone(term);
  if (norm && norm !== term.replace(/ /g, "")) {
    or.push({ phone: { contains: norm } }, { alternate_phone: { contains: norm } });
  }
  return { OR: or };
}

export async function manageLeadsWhere(params: FieldBag): Promise<Prisma.LeadWhereInput> {
  const f = extractManageLeadFilters(params);
  const and: Prisma.LeadWhereInput[] = [];
  if (f.search) and.push(await leadSearchWhere(f.search));
  if (f.status) and.push({ status: f.status });
  if (f.priority) and.push({ priority: f.priority });
  if (f.counsellor === UNASSIGNED) and.push({ assigned_counsellor_id: null });
  else if (f.counsellor && /^-?\d+$/.test(f.counsellor)) and.push({ assigned_counsellor_id: Number(f.counsellor) });
  if (f.source && /^-?\d+$/.test(f.source)) and.push({ source_id: Number(f.source) });
  return and.length ? { AND: and } : {};
}

export const leadListInclude = {
  source: true,
  assigned_counsellor: { include: { admin: true } },
} satisfies Prisma.LeadInclude;

// ── Counsellor "My Leads" ───────────────────────────────────────────────────

export const MY_LEADS_FILTER_PARAMS = [
  "search", "status", "priority", "source", "created_from", "created_to", "follow_up", "outcome", "page",
] as const;
export type MyLeadFilters = Partial<Record<(typeof MY_LEADS_FILTER_PARAMS)[number], string>>;

export function extractMyLeadFilters(params: FieldBag): MyLeadFilters {
  const out: MyLeadFilters = {};
  for (const key of MY_LEADS_FILTER_PARAMS) {
    const value = field(params, key);
    if (value) out[key] = value;
  }
  return out;
}

/** Lead IDs (for this counsellor) whose most recent activity outcome matches the filter. */
async function idsByLatestOutcome(counsellorId: number, filter: string): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number; outcome: string | null }>>`
    SELECT l.id, (
      SELECT a.outcome FROM lead_activities a
      WHERE a.lead_id = l.id AND a.counsellor_id = ${counsellorId}
      ORDER BY a.completed_date DESC, a.id DESC
      LIMIT 1
    ) AS outcome
    FROM leads l
    WHERE l.assigned_counsellor_id = ${counsellorId}`;
  return rows
    .filter(({ outcome }) => {
      const o = outcome ?? "";
      if (filter === "__awaiting__") return o === "";
      if (filter === "__other__") return o !== "" && !PRESET_OUTCOMES.includes(o);
      return o === filter;
    })
    .map((r) => Number(r.id));
}

export async function myLeadsWhere(counsellorId: number, f: MyLeadFilters): Promise<Prisma.LeadWhereInput> {
  const and: Prisma.LeadWhereInput[] = [{ assigned_counsellor_id: counsellorId }];
  if (f.search) {
    const contains = { contains: f.search };
    and.push({
      OR: [
        { first_name: contains },
        { last_name: contains },
        { email: contains },
        { phone: contains },
        { alternate_phone: contains },
        { lead_id: contains },
        { school_name: contains },
        { course_interested: contains },
        { source: { is: { name: contains } } },
      ],
    });
  }
  if (f.status) and.push({ status: f.status });
  if (f.priority) and.push({ priority: f.priority });
  if (f.source && /^-?\d+$/.test(f.source)) and.push({ source_id: Number(f.source) });
  const from = parseIsoDate(f.created_from);
  if (from) and.push({ created_at: { gte: localDayBounds(from).start } });
  const to = parseIsoDate(f.created_to);
  if (to) and.push({ created_at: { lt: localDayBounds(to).end } });
  if (f.follow_up === "yes") and.push({ next_follow_up: { not: null } });
  else if (f.follow_up === "no") and.push({ next_follow_up: null });
  if (f.outcome) and.push({ id: { in: await idsByLatestOutcome(counsellorId, f.outcome) } });
  return { AND: and };
}

/** Never-contacted leads first (newest on top); worked leads sink to the bottom. */
export const counsellorQueueOrder: Prisma.LeadOrderByWithRelationInput[] = [
  { last_contact_date: { sort: "asc", nulls: "first" } },
  { created_at: "desc" },
];

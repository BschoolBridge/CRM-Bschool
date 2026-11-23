import { prisma, type Db } from "../../lib/prisma";
import { formatHumanDateTime } from "../../lib/time";
import { fullName, presentActivity } from "../presenters";
import { ensureStatusChangeActivityType, leadStatusLabel } from "../reference/reference.service";

const FROM_PREFIX = "FROM_CODE:";
const TO_PREFIX = "TO_CODE:";

interface StatusChangeOptions {
  counsellorId?: number | null;
  loggedByAdminId?: number | null;
  note?: string;
  db?: Db;
}

/**
 * Record a lead status change as a completed STATUS_CHANGE activity. The
 * FROM_CODE/TO_CODE lines are parsed back by statusHistory().
 */
export async function logStatusChange(
  lead: { id: number; assigned_counsellor_id: number | null },
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
  options: StatusChangeOptions = {},
) {
  const from = (oldStatus ?? "").trim();
  const to = (newStatus ?? "").trim();
  if (!to || from === to) return null;

  const counsellorId = options.counsellorId ?? lead.assigned_counsellor_id;
  if (!counsellorId) return null;

  const db = options.db ?? prisma;
  await ensureStatusChangeActivityType(db);
  const [fromLabel, toLabel] = await Promise.all([leadStatusLabel(from), leadStatusLabel(to)]);
  const when = formatHumanDateTime(new Date());

  const lines = [
    `Status changed from "${fromLabel}" to "${toLabel}".`,
    `Changed on: ${when}`,
    `${FROM_PREFIX} ${from}`,
    `${TO_PREFIX} ${to}`,
  ];
  if (options.note?.trim()) lines.push(options.note.trim());

  return db.leadActivity.create({
    data: {
      lead_id: lead.id,
      counsellor_id: counsellorId,
      logged_by_admin_id: options.loggedByAdminId ?? null,
      activity_type: "STATUS_CHANGE",
      subject: `Status changed: ${fromLabel} → ${toLabel}`.slice(0, 200),
      description: lines.join("\n"),
      outcome: toLabel.slice(0, 200),
      next_action: "",
      is_completed: true,
      duration: 0,
    },
  });
}

export function parseStatusChangeCodes(description: string): { from: string; to: string } {
  let from = "";
  let to = "";
  for (const raw of (description ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(FROM_PREFIX)) from = line.slice(FROM_PREFIX.length).trim();
    else if (line.startsWith(TO_PREFIX)) to = line.slice(TO_PREFIX.length).trim();
  }
  return { from, to };
}

/** Newest-first status history rows for the lead detail pages. */
export async function statusHistory(leadId: number, limit = 50) {
  const activities = await prisma.leadActivity.findMany({
    where: { lead_id: leadId, activity_type: "STATUS_CHANGE" },
    include: { counsellor: { include: { admin: true } }, logged_by_admin: true },
    orderBy: [{ completed_date: "desc" }, { id: "desc" }],
    take: limit,
  });

  return Promise.all(
    activities.map(async (activity) => {
      presentActivity(activity);
      const { from, to } = parseStatusChangeCodes(activity.description);
      const subject = activity.subject ?? "";
      const fromLabel = from
        ? await leadStatusLabel(from)
        : subject.includes("→")
          ? subject.split("→")[0]!.replace("Status changed:", "").trim()
          : "—";
      const toLabel = to ? await leadStatusLabel(to) : activity.outcome || "—";
      const changedBy =
        (activity as unknown as { admin_logger_name: string }).admin_logger_name ||
        (activity.counsellor ? fullName(activity.counsellor.admin) : "");
      return {
        changed_at: activity.completed_date,
        from_code: from,
        to_code: to,
        from_label: fromLabel,
        to_label: toLabel,
        activity,
        changed_by: changedBy,
      };
    }),
  );
}

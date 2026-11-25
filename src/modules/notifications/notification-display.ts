import { reverse } from "../../http/urls";

const ASSIGN_MSG_RE = /^New lead assigned: ([\s\S]+?) — Source: ([\s\S]+?)(?: \[lead:(\d+):(\d+)\])?$/;
const BULK_ASSIGN_MSG_RE = /^New leads assigned: (\d+) — Sources: ([\s\S]+?)(?: \[bulk:([^\]]+)\])?$/;

export interface NotificationDisplay {
  title: string;
  body: string;
  href: string | null;
  kind: "assignment" | "bulk_assignment" | "system";
}

/** Turn raw inbox message text into a readable title/body (and optional lead link). */
export function presentNotificationMessage(message: string): NotificationDisplay {
  const text = message.trim();
  const single = ASSIGN_MSG_RE.exec(text);
  if (single) {
    const name = single[1]!.trim();
    const source = single[2]!.trim();
    const leadPk = single[3] ? Number(single[3]) : null;
    return {
      title: "New lead assigned",
      body: `${name} · Source: ${source}`,
      href: leadPk && Number.isFinite(leadPk) ? reverse("lead_detail", leadPk) : reverse("my_leads"),
      kind: "assignment",
    };
  }
  const bulk = BULK_ASSIGN_MSG_RE.exec(text);
  if (bulk) {
    const count = bulk[1]!;
    const sources = bulk[2]!.trim();
    return {
      title: `${count} new leads assigned`,
      body: `Sources: ${sources}`,
      href: reverse("my_leads"),
      kind: "bulk_assignment",
    };
  }
  return {
    title: "Notification",
    body: text,
    href: null,
    kind: "system",
  };
}

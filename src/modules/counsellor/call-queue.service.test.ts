import { beforeEach, describe, expect, it, vi } from "vitest";
import { callQueueCount, loadCallQueue } from "./call-queue.service";

type LeadShape = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  priority: string;
  assigned_counsellor_id: number;
  next_follow_up: Date | null;
  created_at: Date;
};

type ActivityShape = {
  id: number;
  counsellor_id: number;
  is_completed: boolean;
  scheduled_date: Date;
  subject: string;
  lead: Omit<LeadShape, "next_follow_up" | "created_at">;
};

const memory = vi.hoisted(() => {
  const activities: ActivityShape[] = [];
  const leads: LeadShape[] = [];
  return {
    activities,
    leads,
    reset() {
      activities.length = 0;
      leads.length = 0;
    },
  };
});

vi.mock("../../lib/time", () => ({
  localToday: () => "2026-03-20",
  localDayBounds: (isoDate: string) => {
    const start = new Date(`${isoDate}T00:00:00.000Z`);
    return { start, end: new Date(start.getTime() + 86_400_000) };
  },
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    leadActivity: {
      async findMany(args: {
        where: {
          counsellor_id: number;
          is_completed: boolean;
          scheduled_date: { lt?: Date; gte?: Date };
          lead: { assigned_counsellor_id: number; status: { notIn: string[] } };
        };
        take: number;
      }) {
        return memory.activities
          .filter((row) => {
            if (row.counsellor_id !== args.where.counsellor_id) return false;
            if (row.is_completed !== args.where.is_completed) return false;
            if (row.lead.assigned_counsellor_id !== args.where.lead.assigned_counsellor_id) return false;
            if (args.where.lead.status.notIn.includes(row.lead.status)) return false;
            const { gte, lt } = args.where.scheduled_date;
            if (gte && row.scheduled_date < gte) return false;
            if (lt && !(row.scheduled_date < lt)) return false;
            return true;
          })
          .slice(0, args.take)
          .map((row) => ({
            id: row.id,
            subject: row.subject,
            scheduled_date: row.scheduled_date,
            lead: {
              id: row.lead.id,
              first_name: row.lead.first_name,
              last_name: row.lead.last_name,
              phone: row.lead.phone,
              status: row.lead.status,
              priority: row.lead.priority,
            },
          }));
      },
    },
    lead: {
      async findMany(args: {
        where: {
          assigned_counsellor_id: number;
          status?: string | { notIn: string[] };
          next_follow_up?: { gte: Date; lt: Date };
        };
        take: number;
      }) {
        return memory.leads
          .filter((lead) => {
            if (lead.assigned_counsellor_id !== args.where.assigned_counsellor_id) return false;
            if (typeof args.where.status === "string") {
              if (lead.status !== args.where.status) return false;
            } else if (args.where.status?.notIn.includes(lead.status)) {
              return false;
            }
            if (args.where.next_follow_up) {
              if (!lead.next_follow_up) return false;
              if (lead.next_follow_up < args.where.next_follow_up.gte) return false;
              if (!(lead.next_follow_up < args.where.next_follow_up.lt)) return false;
            }
            return true;
          })
          .slice(0, args.take);
      },
    },
  },
}));

describe("loadCallQueue", () => {
  beforeEach(() => {
    memory.reset();
  });

  it("buckets overdue, due today, and new leads without duplicating a lead", async () => {
    memory.activities.push(
      {
        id: 1,
        counsellor_id: 7,
        is_completed: false,
        scheduled_date: new Date("2026-03-18T10:00:00.000Z"),
        subject: "Old callback",
        lead: {
          id: 10,
          first_name: "Ada",
          last_name: "Lovelace",
          phone: "9999999999",
          status: "CONTACTED",
          priority: "HIGH",
          assigned_counsellor_id: 7,
        },
      },
      {
        id: 2,
        counsellor_id: 7,
        is_completed: false,
        scheduled_date: new Date("2026-03-20T11:00:00.000Z"),
        subject: "Today call",
        lead: {
          id: 11,
          first_name: "Grace",
          last_name: "Hopper",
          phone: "8888888888",
          status: "QUALIFIED",
          priority: "MEDIUM",
          assigned_counsellor_id: 7,
        },
      },
    );
    memory.leads.push(
      {
        id: 11,
        first_name: "Grace",
        last_name: "Hopper",
        phone: "8888888888",
        status: "QUALIFIED",
        priority: "MEDIUM",
        assigned_counsellor_id: 7,
        next_follow_up: new Date("2026-03-20T15:00:00.000Z"),
        created_at: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        id: 12,
        first_name: "Alan",
        last_name: "Turing",
        phone: "7777777777",
        status: "NEW",
        priority: "HIGH",
        assigned_counsellor_id: 7,
        next_follow_up: null,
        created_at: new Date("2026-03-19T00:00:00.000Z"),
      },
      {
        id: 10,
        first_name: "Ada",
        last_name: "Lovelace",
        phone: "9999999999",
        status: "NEW",
        priority: "LOW",
        assigned_counsellor_id: 7,
        next_follow_up: null,
        created_at: new Date("2026-03-19T00:00:00.000Z"),
      },
    );

    const queue = await loadCallQueue(7);

    expect(queue.overdue.map((item) => item.lead.id)).toEqual([10]);
    expect(queue.dueToday.map((item) => item.lead.id)).toEqual([11]);
    expect(queue.newLeads.map((item) => item.lead.id)).toEqual([12]);
    expect(queue.total).toBe(3);
    expect(await callQueueCount(7)).toBe(3);
  });

  it("skips terminal statuses", async () => {
    memory.activities.push({
      id: 3,
      counsellor_id: 7,
      is_completed: false,
      scheduled_date: new Date("2026-03-18T10:00:00.000Z"),
      subject: "Won lead leftover",
      lead: {
        id: 20,
        first_name: "Closed",
        last_name: "Won",
        phone: "111",
        status: "CLOSED_WON",
        priority: "HIGH",
        assigned_counsellor_id: 7,
      },
    });
    memory.leads.push({
      id: 21,
      first_name: "Lost",
      last_name: "Lead",
      phone: "222",
      status: "CLOSED_LOST",
      priority: "LOW",
      assigned_counsellor_id: 7,
      next_follow_up: new Date("2026-03-20T12:00:00.000Z"),
      created_at: new Date("2026-03-01T00:00:00.000Z"),
    });

    const queue = await loadCallQueue(7);
    expect(queue.total).toBe(0);
  });
});

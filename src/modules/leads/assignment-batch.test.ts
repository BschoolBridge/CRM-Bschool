import { beforeEach, describe, expect, it, vi } from "vitest";

interface LeadRow {
  id: number;
  first_name: string;
  last_name: string;
  lead_id: string;
  source_id: number;
  assigned_counsellor_id: number | null;
  industry: string;
  source: { name: string };
}

const memory = vi.hoisted(() => {
  const leads: LeadRow[] = [];
  const notified: number[][] = [];
  function matches(lead: LeadRow, where: { id?: { in: number[] }; assigned_counsellor_id?: number | null }): boolean {
    if (where.id && !where.id.in.includes(lead.id)) return false;
    if (where.assigned_counsellor_id !== undefined && lead.assigned_counsellor_id !== where.assigned_counsellor_id) return false;
    return true;
  }
  const api = {
    lead: {
      async findMany(args: { where: { id?: { in: number[] }; assigned_counsellor_id?: number | null }; select?: { id?: boolean } }) {
        const rows = leads.filter((lead) => matches(lead, args.where));
        if (args.select && Object.keys(args.select).length === 1 && args.select.id) return rows.map((lead) => ({ id: lead.id }));
        return rows.map((lead) => ({ ...lead }));
      },
      async updateMany(args: { where: { id: { in: number[] }; assigned_counsellor_id: null }; data: { assigned_counsellor_id: number } }) {
        let count = 0;
        for (const lead of leads) {
          if (!args.where.id.in.includes(lead.id) || lead.assigned_counsellor_id !== null) continue;
          lead.assigned_counsellor_id = args.data.assigned_counsellor_id;
          count += 1;
        }
        return { count };
      },
    },
    $transaction(ops: Array<Promise<{ count: number }>>) {
      return Promise.all(ops);
    },
  };
  return {
    api,
    leads,
    notified,
    reset() {
      leads.length = 0;
      notified.length = 0;
    },
  };
});

vi.mock("../../lib/prisma", () => ({ prisma: memory.api }));
vi.mock("../notifications/assignment-notifications", () => ({
  notifyLeadsAssigned: async (rows: Array<{ id: number }>) => {
    memory.notified.push(rows.map((row) => row.id));
  },
}));

import { UNASSIGNED_ASSIGN_BATCH, assignLeads, unassignedAssignmentMessage } from "./assignment.service";

function lead(id: number, assigned: number | null): LeadRow {
  return {
    id,
    first_name: "A",
    last_name: "B",
    lead_id: `L${id}`,
    source_id: 1,
    assigned_counsellor_id: assigned,
    industry: "",
    source: { name: "Web" },
  };
}

beforeEach(() => {
  memory.reset();
});

describe("unassigned assignment", () => {
  it("keeps a lead that was already assigned and reports only the rows it changed", async () => {
    memory.leads.push(lead(1, null), lead(2, 9));
    const count = await assignLeads([1, 2], [7], "round_robin");
    expect(count).toBe(1);
    expect(memory.leads.find((row) => row.id === 1)?.assigned_counsellor_id).toBe(7);
    expect(memory.leads.find((row) => row.id === 2)?.assigned_counsellor_id).toBe(9);
    expect(memory.notified).toEqual([[1]]);
  });

  it("tells the admin when the batch left unassigned leads", () => {
    expect(UNASSIGNED_ASSIGN_BATCH).toBe(200);
    expect(unassignedAssignmentMessage(200, 0, "round_robin", " across all active counsellors")).toBe(
      "Successfully assigned 200 leads using Round Robin method across all active counsellors!",
    );
    expect(unassignedAssignmentMessage(200, 40, "round_robin", " across all active counsellors")).toContain(
      "40 unassigned leads remain. Run assignment again to continue.",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { findOrCreateDailyTarget, setDailyTarget } from "./targets.service";

class UniqueTargetError extends Error {
  code = "P2002";
}

type TargetRow = { id: number; target_date: Date; target_count: number; created_by_id: number | null };

const memory = vi.hoisted(() => {
  const rows: TargetRow[] = [];
  const assignments: Array<{ target_id: number; counsellor_id: number }> = [];
  let nextId = 1;
  let creates = 0;
  const sameDay = (left: Date, right: Date) => left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
  const dailyTarget = {
    async findFirst(args: { where: { target_date: Date } }) {
      return rows.filter((row) => sameDay(row.target_date, args.where.target_date)).sort((a, b) => a.id - b.id)[0] ?? null;
    },
    async create(args: { data: { target_date: Date; target_count: number; created_by_id?: number | null } }) {
      creates += 1;
      if (rows.some((row) => sameDay(row.target_date, args.data.target_date))) throw new UniqueTargetError("duplicate date");
      const row: TargetRow = {
        id: nextId++,
        target_date: args.data.target_date,
        target_count: args.data.target_count,
        created_by_id: args.data.created_by_id ?? null,
      };
      rows.push(row);
      return row;
    },
    async update(args: { where: { id: number }; data: { target_count: number } }) {
      const row = rows.find((item) => item.id === args.where.id);
      if (!row) throw new Error("missing");
      row.target_count = args.data.target_count;
      return row;
    },
  };
  const dailyTargetAssignment = {
    async upsert(args: { where: { target_id_counsellor_id: { target_id: number; counsellor_id: number } }; create: { target_id: number; counsellor_id: number } }) {
      const key = args.where.target_id_counsellor_id;
      if (!assignments.some((item) => item.target_id === key.target_id && item.counsellor_id === key.counsellor_id)) {
        assignments.push({ ...args.create });
      }
      return key;
    },
  };
  const tx = { dailyTarget, dailyTargetAssignment };
  const api = {
    ...tx,
    $transaction(fn: (client: typeof tx) => Promise<unknown>) {
      return fn(tx);
    },
  };
  return { rows, assignments, api, creates: () => creates, reset() { rows.length = 0; assignments.length = 0; nextId = 1; creates = 0; } };
});

vi.mock("../../lib/prisma", () => ({
  prisma: memory.api,
  isUniqueViolation: (err: unknown) => err instanceof UniqueTargetError,
}));

const day = new Date("2026-10-29T00:00:00.000Z");

beforeEach(() => {
  memory.reset();
});

describe("daily target date", () => {
  it("returns the same row for a repeated request and does not insert again", async () => {
    const first = await findOrCreateDailyTarget(memory.api as never, day, { target_count: 100 });
    const second = await findOrCreateDailyTarget(memory.api as never, day, { target_count: 100 });
    expect(second.id).toBe(first.id);
    expect(memory.rows).toHaveLength(1);
    expect(memory.creates()).toBe(1);
  });

  it("keeps one row when two first-time creates race", async () => {
    const [left, right] = await Promise.all([
      findOrCreateDailyTarget(memory.api as never, day, { target_count: 100 }),
      findOrCreateDailyTarget(memory.api as never, day, { target_count: 100 }),
    ]);
    expect(left.id).toBe(right.id);
    expect(memory.rows).toHaveLength(1);
    expect(left.target_count).toBe(100);
  });

  it("updates the existing day's count instead of inserting another target", async () => {
    await findOrCreateDailyTarget(memory.api as never, day, { target_count: 100 });
    const updated = await setDailyTarget({
      targetDate: day,
      targetCount: 80,
      createdById: 4,
      counsellorIds: [9, 9],
    });
    expect(updated.target_count).toBe(80);
    expect(memory.rows).toHaveLength(1);
    expect(memory.assignments).toEqual([{ target_id: updated.id, counsellor_id: 9 }]);
    expect(memory.creates()).toBe(1);
  });
});

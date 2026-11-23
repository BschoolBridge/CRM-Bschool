import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "../../lib/cache";
import { ACTIVITY_BOARD_CACHE_KEY } from "./cache-keys";

const calls = vi.hoisted(() => ({ activity: [] as Array<{ where: { counsellor_id?: { in: number[] }; is_completed?: boolean } }> }));

vi.mock("../../lib/prisma", () => ({
  isUniqueViolation: () => false,
  prisma: {
    dailyTarget: {
      async findFirst() {
        return { id: 1, target_date: new Date("2026-10-29T00:00:00.000Z"), target_count: 100, created_by_id: null };
      },
      async create() {
        throw new Error("target already exists");
      },
    },
    dailyTargetAssignment: {
      async findMany() {
        return [{ counsellor_id: 2 }, { counsellor_id: 5 }];
      },
      async createMany() {
        return { count: 0 };
      },
    },
    leadActivity: {
      async groupBy(args: { where: { counsellor_id?: { in: number[] }; is_completed?: boolean } }) {
        calls.activity.push(args);
        if (args.where.is_completed === false) {
          return [
            { counsellor_id: 2, _count: { _all: 4 } },
            { counsellor_id: 5, _count: { _all: 1 } },
          ];
        }
        return [
          { counsellor_id: 2, activity_type: "CALL", _count: { _all: 2 } },
          { counsellor_id: 2, activity_type: "FOLLOW_UP", _count: { _all: 1 } },
          { counsellor_id: 5, activity_type: "EMAIL", _count: { _all: 3 } },
        ];
      },
    },
    lead: {
      async groupBy() {
        return [];
      },
    },
  },
}));

import { counsellorProgressBoard } from "./targets.service";

beforeEach(async () => {
  calls.activity.length = 0;
  await cache.delete(ACTIVITY_BOARD_CACHE_KEY);
});

describe("counsellor progress board", () => {
  it("counts every counsellor in one grouped query and reuses that result", async () => {
    const first = await counsellorProgressBoard([5, 2]);
    expect(calls.activity).toHaveLength(2);
    expect(calls.activity[0]?.where.counsellor_id).toEqual({ in: [2, 5] });
    expect(first.find((row) => row.counsellor_id === 2)).toMatchObject({
      completed_toward_target: 3,
      contact_touchpoints_today: 2,
      follow_up_activities_today: 1,
      pending_activities: 4,
      daily_target: 100,
    });
    expect(first.find((row) => row.counsellor_id === 5)?.completed_toward_target).toBe(3);

    await counsellorProgressBoard([2, 5]);
    expect(calls.activity).toHaveLength(2);
  });

  it("does not query when no counsellors are requested", async () => {
    await expect(counsellorProgressBoard([])).resolves.toEqual([]);
    expect(calls.activity).toHaveLength(0);
  });
});

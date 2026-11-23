import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionAuthHash, USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR } from "./auth";

const state = vi.hoisted(() => ({
  sessionData: {} as { userId?: number; authHash?: string },
  user: null as Record<string, unknown> | null,
  where: null as { id?: number; assigned_counsellor_id?: number } | null,
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async () => state.user,
    },
    lead: {
      findFirst: async (args: { where: { id?: number; assigned_counsellor_id?: number } }) => {
        state.where = args.where;
        if (args.where.id === 10 && args.where.assigned_counsellor_id === 4) {
          return { id: 10, assigned_counsellor_id: 4 };
        }
        return null;
      },
    },
  },
}));

vi.mock("./session", () => ({
  readSession: async () => ({ sid: "sid", data: state.sessionData }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

function signIn(user: Record<string, unknown> | null) {
  state.user = user;
  state.sessionData = user ? { userId: Number(user.id), authHash: sessionAuthHash(String(user.password)) } : {};
}

beforeEach(() => {
  state.where = null;
  state.user = null;
  state.sessionData = {};
  vi.resetModules();
});

async function loadOwned(leadId: number) {
  const { ownedLead } = await import("../../app/(portal)/counsellor/_lib/owned");
  return ownedLead(leadId);
}

describe("counsellor lead ownership", () => {
  it("returns a lead assigned to the signed-in counsellor", async () => {
    signIn({ id: 8, password: "stored-hash", user_type: USER_TYPE_COUNSELLOR, is_active: true, admin_profile: null, counsellor: { id: 4 } });
    const owned = await loadOwned(10);
    expect(owned.lead.id).toBe(10);
    expect(state.where).toEqual(expect.objectContaining({ id: 10, assigned_counsellor_id: 4 }));
  });

  it("hides a lead assigned to someone else", async () => {
    signIn({ id: 8, password: "stored-hash", user_type: USER_TYPE_COUNSELLOR, is_active: true, admin_profile: null, counsellor: { id: 4 } });
    await expect(loadOwned(11)).rejects.toThrow("NOT_FOUND");
    expect(state.where).toEqual(expect.objectContaining({ id: 11, assigned_counsellor_id: 4 }));
  });

  it("rejects a session that no longer matches the password", async () => {
    signIn({ id: 8, password: "stored-hash", user_type: USER_TYPE_COUNSELLOR, is_active: true, admin_profile: null, counsellor: { id: 4 } });
    state.sessionData.authHash = "stale";
    await expect(loadOwned(10)).rejects.toThrow("REDIRECT /");
    expect(state.where).toBeNull();
  });

  it("sends an admin away from the counsellor lead page", async () => {
    signIn({ id: 1, password: "stored-hash", user_type: USER_TYPE_ADMIN, is_active: true, admin_profile: { is_superadmin: true }, counsellor: null });
    await expect(loadOwned(10)).rejects.toThrow("REDIRECT /admin/home/");
    expect(state.where).toBeNull();
  });
});

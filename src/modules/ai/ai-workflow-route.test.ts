import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionAuthHash, USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR } from "../../server/auth";

const state = vi.hoisted(() => ({
  sessionData: {} as { userId?: number; authHash?: string },
  user: null as Record<string, unknown> | null,
  lead: null as { id: number; assigned_counsellor_id: number | null } | null,
  userFindUnique: vi.fn(),
  leadFindUnique: vi.fn(),
  run: vi.fn(),
  flash: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: state.userFindUnique },
    lead: { findUnique: state.leadFindUnique },
  },
}));

vi.mock("../../server/session", () => ({
  readSession: async () => ({ sid: "sid", data: state.sessionData }),
}));

vi.mock("../../server/flash", () => ({
  flash: state.flash,
}));

vi.mock("./ai.service", () => ({
  runAgenticWorkflow: state.run,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && (err.message.startsWith("REDIRECT ") || err.message === "NOT_FOUND")) throw err;
  },
}));

function signIn(user: Record<string, unknown> | null) {
  state.user = user;
  state.sessionData = user
    ? { userId: Number(user.id), authHash: sessionAuthHash(String(user.password)) }
    : {};
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    password: "stored-hash",
    user_type: USER_TYPE_ADMIN,
    is_active: true,
    admin_profile: { is_superadmin: true },
    counsellor: null,
    ...overrides,
  };
}

async function load() {
  return import("../../../app/(portal)/leads/ai-workflow/[lead_id]/route");
}

function post(leadId: string) {
  return {
    request: new Request(`http://127.0.0.1/leads/ai-workflow/${leadId}/`, { method: "POST" }),
    context: { params: Promise.resolve({ lead_id: leadId }) },
  };
}

beforeEach(() => {
  state.sessionData = {};
  state.user = null;
  state.lead = { id: 7, assigned_counsellor_id: 3 };
  state.userFindUnique.mockReset();
  state.leadFindUnique.mockReset();
  state.run.mockReset();
  state.flash.mockReset();
  state.userFindUnique.mockImplementation(async () => state.user);
  state.leadFindUnique.mockImplementation(async () => state.lead);
  state.run.mockResolvedValue([{ level: "success", text: "Academic workflow complete. Routed to graduate counselor." }]);
  vi.resetModules();
});

describe("admin AI workflow route", () => {
  it("does not run the workflow on GET", async () => {
    signIn(account());
    const route = await load();
    const response = route.GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(state.run).not.toHaveBeenCalled();
    expect(state.leadFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a signed-out POST before reading the lead", async () => {
    signIn(null);
    const route = await load();
    const { request, context } = post("7");
    await expect(route.POST(request, context)).rejects.toThrow("REDIRECT /");
    expect(state.run).not.toHaveBeenCalled();
    expect(state.leadFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a counsellor POST", async () => {
    signIn(account({ user_type: USER_TYPE_COUNSELLOR, admin_profile: null, counsellor: { id: 4 } }));
    const route = await load();
    const { request, context } = post("7");
    await expect(route.POST(request, context)).rejects.toThrow("REDIRECT /counsellor/home/");
    expect(state.run).not.toHaveBeenCalled();
  });

  it("rejects a lead id that is not an integer", async () => {
    signIn(account());
    const route = await load();
    const { request, context } = post("nope");
    await expect(route.POST(request, context)).rejects.toThrow("NOT_FOUND");
    expect(state.run).not.toHaveBeenCalled();
    expect(state.leadFindUnique).not.toHaveBeenCalled();
  });

  it("does not run the workflow when the lead has no counsellor", async () => {
    signIn(account());
    state.lead = { id: 7, assigned_counsellor_id: null };
    const route = await load();
    const { request, context } = post("7");
    await expect(route.POST(request, context)).rejects.toThrow("REDIRECT /leads/view/7/");
    expect(state.run).not.toHaveBeenCalled();
    expect(state.flash).toHaveBeenCalledWith("error", "Lead must be assigned to a counsellor to run AI workflow.");
  });

  it("runs the workflow for an admin and keeps the step messages", async () => {
    signIn(account());
    const route = await load();
    const { request, context } = post("7");
    await expect(route.POST(request, context)).rejects.toThrow("REDIRECT /leads/view/7/");
    expect(state.run).toHaveBeenCalledTimes(1);
    expect(state.run).toHaveBeenCalledWith(7);
    expect(state.flash).toHaveBeenCalledWith("success", "Academic workflow complete. Routed to graduate counselor.");
    expect(state.flash).toHaveBeenCalledWith("success", "AI workflow completed successfully!");
  });

  it("reports a workflow failure without claiming success", async () => {
    signIn(account());
    state.run.mockRejectedValue(new Error("openai down"));
    const route = await load();
    const { request, context } = post("7");
    await expect(route.POST(request, context)).rejects.toThrow("REDIRECT /leads/view/7/");
    expect(state.run).toHaveBeenCalledTimes(1);
    expect(state.flash).toHaveBeenCalledWith("error", "Error running AI workflow: openai down");
    expect(state.flash).not.toHaveBeenCalledWith("success", "AI workflow completed successfully!");
  });
});

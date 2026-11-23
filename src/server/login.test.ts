import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../lib/password";
import { USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR } from "./auth";

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  sessions: [] as unknown[],
  flashes: [] as string[],
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: async () => state.user,
      update: async () => ({ id: 1 }),
    },
  },
}));

vi.mock("./flash", () => ({
  flash: async (_level: string, text: string) => {
    state.flashes.push(text);
  },
}));

vi.mock("./session", () => ({
  createSession: async (data: unknown) => {
    state.sessions.push(data);
  },
}));

vi.mock("./request", () => ({
  clientIp: async () => "direct",
  tooManyAttempts: async () => false,
}));

let encoded = "";

beforeAll(async () => {
  encoded = await hashPassword("correct-horse");
});

beforeEach(() => {
  state.user = null;
  state.sessions = [];
  state.flashes = [];
  vi.resetModules();
});

async function submit(email: string, password: string) {
  const { POST } = await import("../../app/doLogin/route");
  const body = new FormData();
  body.set("email", email);
  body.set("password", password);
  return POST(new Request("http://127.0.0.1:8000/doLogin/", { method: "POST", body }));
}

async function submitPhone(phone: string, password: string) {
  const { POST } = await import("../../app/doLogin/route");
  const body = new FormData();
  body.set("phone", phone);
  body.set("password", password);
  return POST(new Request("http://127.0.0.1:8000/doLogin/", { method: "POST", body }));
}

function pathname(response: Response): string {
  return new URL(response.headers.get("location") ?? "http://127.0.0.1:8000/", "http://127.0.0.1:8000").pathname;
}

describe("login", () => {
  it("rejects GET", async () => {
    const { GET } = await import("../../app/doLogin/route");
    const response = GET();
    expect(response.status).toBe(405);
  });

  it("sends an admin with the right password to the admin home", async () => {
    state.user = { id: 1, email: "admin@example.com", password: encoded, is_active: true, user_type: USER_TYPE_ADMIN, last_login: null };
    const response = await submit("Admin@Example.com", "correct-horse");
    expect(response.status).toBe(307);
    expect(pathname(response)).toBe("/admin/home/");
    expect(state.sessions).toHaveLength(1);
  });

  it("sends a counsellor to the counsellor home", async () => {
    state.user = { id: 4, email: "counsellor@example.com", password: encoded, is_active: true, user_type: USER_TYPE_COUNSELLOR, last_login: null };
    const response = await submit("counsellor@example.com", "correct-horse");
    expect(pathname(response)).toBe("/counsellor/home/");
    expect(state.sessions).toHaveLength(1);
  });

  it("rejects a wrong password, an inactive user, and an unknown email", async () => {
    state.user = { id: 1, email: "admin@example.com", password: encoded, is_active: true, user_type: USER_TYPE_ADMIN, last_login: null };
    const wrong = await submit("admin@example.com", "nope");
    expect(pathname(wrong)).toBe("/");
    expect(state.flashes).toContain("Invalid details");
    expect(state.sessions).toHaveLength(0);

    state.user = { id: 1, email: "admin@example.com", password: encoded, is_active: false, user_type: USER_TYPE_ADMIN, last_login: null };
    state.flashes = [];
    const inactive = await submit("admin@example.com", "correct-horse");
    expect(pathname(inactive)).toBe("/");
    expect(state.sessions).toHaveLength(0);

    state.user = null;
    const missing = await submit("nobody@example.com", "correct-horse");
    expect(pathname(missing)).toBe("/");
    expect(state.sessions).toHaveLength(0);
  });

  it("sends an admin logging in with phone number to admin home", async () => {
    state.user = { id: 1, email: "admin@example.com", phone: "8957056200", password: encoded, is_active: true, user_type: USER_TYPE_ADMIN, last_login: null };
    const response = await submitPhone("8957056200", "correct-horse");
    expect(response.status).toBe(307);
    expect(pathname(response)).toBe("/admin/home/");
    expect(state.sessions).toHaveLength(1);
  });

  it("normalizes phone formats (+91, leading 0, spaces)", async () => {
    const { extractCleanPhone } = await import("../../app/doLogin/route");
    expect(extractCleanPhone("8957056200")).toBe("8957056200");
    expect(extractCleanPhone("+91 89570 56200")).toBe("8957056200");
    expect(extractCleanPhone("918957056200")).toBe("8957056200");
    expect(extractCleanPhone("08957056200")).toBe("8957056200");
    expect(extractCleanPhone("89570-56200")).toBe("8957056200");
  });
});

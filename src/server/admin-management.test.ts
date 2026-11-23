import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionAuthHash, USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR } from "./auth";
import type { UserForm } from "../modules/users/user.forms";
import type { AdminPermissionInput } from "../modules/users/user.service";

const state = vi.hoisted(() => ({
  sessionData: {} as { userId?: number; authHash?: string },
  user: null as Record<string, unknown> | null,
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userDelete: vi.fn(),
  adminFindUnique: vi.fn(),
  adminFindMany: vi.fn(),
  adminCount: vi.fn(),
  flash: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: state.userFindUnique,
      findFirst: state.userFindFirst,
      create: state.userCreate,
      delete: state.userDelete,
    },
    admin: {
      findUnique: state.adminFindUnique,
      findMany: state.adminFindMany,
      count: state.adminCount,
    },
  },
  isUniqueViolation: () => false,
}));

vi.mock("./session", () => ({
  readSession: async () => ({ sid: "sid", data: state.sessionData }),
}));

vi.mock("./flash", () => ({
  flash: state.flash,
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

const LIMITED_PERMISSIONS: AdminPermissionInput = {
  is_superadmin: true,
  can_delete: true,
  can_view_performance: true,
  can_view_counsellor_work: true,
  can_manage_settings: true,
};

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    password: "stored-hash",
    user_type: USER_TYPE_ADMIN,
    is_active: true,
    admin_profile: {
      is_superadmin: false,
      can_delete: true,
      can_view_performance: true,
      can_view_counsellor_work: false,
      can_manage_settings: true,
    },
    counsellor: null,
    ...overrides,
  };
}

function signIn(user: Record<string, unknown> | null) {
  state.user = user;
  state.sessionData = user
    ? { userId: Number(user.id), authHash: sessionAuthHash(String(user.password)) }
    : {};
}

async function load() {
  const actor = await import("./actor");
  const users = await import("../modules/users/user.service");
  const add = await import("../../app/(portal)/admin/add/page");
  const addActions = await import("../modules/users/admin-form-actions");
  const edit = await import("../../app/(portal)/admin/edit/[admin_id]/page");
  const manage = await import("../../app/(portal)/admin/manage/page");
  const remove = await import("../modules/users/delete-admin");
  return { actor, users, add: { ...add, ...addActions }, edit: { ...edit, ...addActions }, manage, remove };
}

beforeEach(() => {
  state.sessionData = {};
  state.user = null;
  state.userFindUnique.mockReset();
  state.userFindFirst.mockReset();
  state.userCreate.mockReset();
  state.userDelete.mockReset();
  state.adminFindUnique.mockReset();
  state.adminFindMany.mockReset();
  state.adminCount.mockReset();
  state.flash.mockReset();
  state.userFindUnique.mockImplementation(async () => state.user);
  state.userFindFirst.mockResolvedValue(null);
  state.userCreate.mockResolvedValue({ id: 9 });
  state.userDelete.mockResolvedValue({ id: 50 });
  state.adminFindMany.mockResolvedValue([]);
  state.adminCount.mockResolvedValue(0);
  vi.resetModules();
});

describe("superadmin admin management", () => {
  it("rejects a signed-out request", async () => {
    signIn(null);
    const { actor } = await load();
    await expect(actor.requireSuperadmin()).rejects.toThrow("REDIRECT /");
    expect(state.userCreate).not.toHaveBeenCalled();
  });

  it("sends a counsellor away from admin management", async () => {
    signIn(account({ user_type: USER_TYPE_COUNSELLOR, admin_profile: null, counsellor: { id: 4 } }));
    const { add, remove } = await load();
    await expect(add.default()).rejects.toThrow("REDIRECT /counsellor/home/");
    await expect(remove.deleteAdminById(5)).rejects.toThrow("REDIRECT /counsellor/home/");
    expect(state.adminFindUnique).not.toHaveBeenCalled();
    expect(state.userDelete).not.toHaveBeenCalled();
  });

  it("stops a limited admin from opening or submitting admin management", async () => {
    signIn(account());
    const { users, add, edit, manage, remove } = await load();
    const fd = new FormData();
    fd.set("is_superadmin", "on");
    fd.set("first_name", "Eve");
    fd.set("last_name", "Admin");
    fd.set("email", "eve@example.com");
    fd.set("password", "secret-pass");

    await expect(add.default()).rejects.toThrow("REDIRECT /admin/home/");
    await expect(add.saveNewAdmin(null, fd)).rejects.toThrow("REDIRECT /admin/home/");
    await expect(edit.default({ params: Promise.resolve({ admin_id: "5" }) })).rejects.toThrow("REDIRECT /admin/home/");
    await expect(edit.saveAdminEdit(5, null, fd)).rejects.toThrow("REDIRECT /admin/home/");
    await expect(manage.default({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /admin/home/");
    await expect(remove.deleteAdminById(5)).rejects.toThrow("REDIRECT /admin/home/");
    await expect(users.createAdmin({} as UserForm, LIMITED_PERMISSIONS)).rejects.toThrow("REDIRECT /admin/home/");
    await expect(users.updateAdmin(5, 50, null, {} as UserForm, LIMITED_PERMISSIONS)).rejects.toThrow("REDIRECT /admin/home/");

    expect(state.flash).toHaveBeenCalledWith("error", "Only super admins can access this page.");
    expect(state.userCreate).not.toHaveBeenCalled();
    expect(state.adminFindUnique).not.toHaveBeenCalled();
    expect(state.adminFindMany).not.toHaveBeenCalled();
    expect(state.userDelete).not.toHaveBeenCalled();
  });

  it("lets a superadmin open management and blocks deleting their own account", async () => {
    signIn(account({ admin_profile: { is_superadmin: true, can_delete: true, can_view_performance: true, can_view_counsellor_work: true, can_manage_settings: true } }));
    state.adminFindMany.mockResolvedValue([]);
    state.adminFindUnique.mockResolvedValue({
      id: 5,
      admin_id: 1,
      is_superadmin: false,
      can_delete: false,
      can_view_performance: false,
      can_view_counsellor_work: false,
      can_manage_settings: false,
      admin: {
        id: 1,
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        gender: "F",
        phone: "",
        address: "London",
        profile_pic: null,
      },
    });
    const { actor, add, manage, remove } = await load();

    await expect(actor.requireSuperadmin()).resolves.toMatchObject({ id: 1 });
    await expect(add.saveNewAdmin(null, new FormData())).resolves.toMatchObject({ markup: expect.any(String) });
    await expect(manage.default({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    await expect(remove.deleteAdminById(5)).rejects.toThrow("REDIRECT /admin/manage/");

    expect(state.userCreate).not.toHaveBeenCalled();
    expect(state.userDelete).not.toHaveBeenCalled();
    expect(state.flash).toHaveBeenCalledWith("error", "You cannot delete your own account!");
  });

  it("lets a superadmin delete a different admin", async () => {
    signIn(account({ id: 1, admin_profile: { is_superadmin: true, can_delete: true, can_view_performance: true, can_view_counsellor_work: true, can_manage_settings: true } }));
    state.adminFindUnique.mockResolvedValue({ id: 5, admin_id: 50 });
    const { remove } = await load();

    await expect(remove.deleteAdminById(5)).rejects.toThrow("REDIRECT /admin/manage/");
    expect(state.userDelete).toHaveBeenCalledWith({ where: { id: 50 } });
    expect(state.flash).toHaveBeenCalledWith("success", "Admin user deleted successfully!");
  });
});

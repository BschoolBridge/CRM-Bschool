import { hashPassword } from "../../lib/password";
import { saveProfilePicture } from "../../lib/uploads";
import { prisma, type Db } from "../../lib/prisma";
import { requireSuperadmin } from "../../server/actor";
import { invalidateAdminDashboard } from "../dashboard/cache-keys";
import type { UserForm } from "./user.forms";

export interface AdminPermissionInput {
  is_superadmin: boolean;
  can_delete: boolean;
  can_view_performance: boolean;
  can_view_counsellor_work: boolean;
  can_manage_settings: boolean;
}

/** Fields shared by every user form; password is hashed only when supplied. */
async function userColumns(form: UserForm, existingPic: string | null) {
  const c = form.cleaned_data;
  let profile_pic = existingPic;
  if (c.profile_pic) profile_pic = await saveProfilePicture(c.profile_pic);
  else if (form.clearProfilePic()) profile_pic = null;
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    gender: c.gender,
    phone: c.phone ?? "",
    address: c.address,
    profile_pic,
    ...(c.password ? { password: await hashPassword(c.password) } : {}),
  };
}

export async function createCounsellor(form: UserForm) {
  const columns = await userColumns(form, null);
  const c = form.cleaned_data;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { ...columns, password: columns.password ?? "!", user_type: "2", fcm_token: "" },
    });
    await tx.counsellor.create({
      data: { admin_id: created.id, employee_id: c.employee_id!, department: c.department ?? "" },
    });
    return created;
  });
  await invalidateAdminDashboard();
  return user;
}

export async function updateCounsellor(counsellorId: number, userId: number, existingPic: string | null, form: UserForm) {
  const columns = await userColumns(form, existingPic);
  const c = form.cleaned_data;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: columns }),
    prisma.counsellor.update({
      where: { id: counsellorId },
      data: {
        employee_id: c.employee_id!,
        department: c.department ?? "",
        is_active: Boolean(c.is_active),
        can_handle_admission_followup: Boolean(c.can_handle_admission_followup),
      },
    }),
  ]);
  await invalidateAdminDashboard();
}

/** Deleting the user cascades to the counsellor/admin profile and their owned records. */
export async function deleteUser(userId: number) {
  await prisma.user.delete({ where: { id: userId } });
  await invalidateAdminDashboard();
}

/** Super admins implicitly hold every permission; the checkboxes only apply to regular admins. */
function adminPermissions(input: AdminPermissionInput): AdminPermissionInput {
  if (!input.is_superadmin) return input;
  return { is_superadmin: true, can_delete: true, can_view_performance: true, can_view_counsellor_work: true, can_manage_settings: true };
}

export async function createAdmin(form: UserForm, permissions: AdminPermissionInput) {
  await requireSuperadmin();
  const columns = await userColumns(form, null);
  return prisma.user.create({
    data: {
      ...columns,
      password: columns.password ?? "!",
      user_type: "1",
      is_staff: true,
      fcm_token: "",
      admin_profile: { create: adminPermissions(permissions) },
    },
  });
}

export async function updateAdmin(adminId: number, userId: number, existingPic: string | null, form: UserForm, permissions: AdminPermissionInput) {
  await requireSuperadmin();
  const columns = await userColumns(form, existingPic);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: columns }),
    prisma.admin.update({ where: { id: adminId }, data: adminPermissions(permissions) }),
  ]);
}

const ADMIN_PROFILE_DEFAULTS: AdminPermissionInput = {
  is_superadmin: false,
  can_delete: true,
  can_view_performance: true,
  can_view_counsellor_work: true,
  can_manage_settings: true,
};

/** Admin profile for user_type 1, created on demand (ensure_admin_profile signal). */
export async function ensureAdminProfile(userId: number, isSuperuser: boolean, db: Db = prisma) {
  const existing = await db.admin.findUnique({ where: { admin_id: userId } });
  if (!existing) {
    return db.admin.create({ data: { ...ADMIN_PROFILE_DEFAULTS, admin_id: userId, is_superadmin: isSuperuser } });
  }
  if (isSuperuser && !existing.is_superadmin) {
    return db.admin.update({
      where: { id: existing.id },
      data: { is_superadmin: true, can_delete: true, can_view_performance: true, can_view_counsellor_work: true, can_manage_settings: true },
    });
  }
  return existing;
}

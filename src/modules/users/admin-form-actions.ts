"use server";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { config } from "../../config/env";
import { reverse } from "../../http/urls";
import { isUniqueViolation, prisma } from "../../lib/prisma";
import { requireSuperadmin } from "../../server/actor";
import { flash } from "../../server/flash";
import { formInput, formMarkup, type FormState } from "../../server/form";
import { UserForm } from "./user.forms";
import { createAdmin, updateAdmin } from "./user.service";
import { permissionInput, permissionMarkup } from "./admin-form-shared";

function errorDetail(err: unknown): string {
  if (isUniqueViolation(err)) return "Employee ID already exists.";
  return config.debug && err instanceof Error ? err.message : "Please try again.";
}

export async function saveNewAdmin(_state: FormState, fd: FormData): Promise<FormState> {
  await requireSuperadmin();
  const input = await formInput(fd);
  const bound = new UserForm("admin", input);
  const permissions = permissionInput(input.data);
  const markup = formMarkup(bound) + permissionMarkup(permissions);
  if (!(await bound.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup };
  }
  try {
    await createAdmin(bound, permissions);
    await flash("success", "Admin user added successfully!");
    redirect(reverse("manage_admins"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", `Could not add admin user: ${errorDetail(err)}`);
    return { markup };
  }
}

export async function saveAdminEdit(adminId: number, _state: FormState, fd: FormData): Promise<FormState> {
  await requireSuperadmin();
  const row = await prisma.admin.findUnique({ where: { id: adminId }, include: { admin: true } });
  if (!row) notFound();
  const input = await formInput(fd);
  const bound = new UserForm("admin", { ...input, user: row.admin });
  const nextPermissions = permissionInput(input.data);
  const markup = formMarkup(bound) + permissionMarkup(nextPermissions);
  if (!(await bound.isValid())) {
    await flash("error", "Please fill the form properly!");
    return { markup };
  }
  try {
    await updateAdmin(row.id, row.admin_id, row.admin.profile_pic, bound, nextPermissions);
    await flash("success", "Admin user updated successfully!");
    redirect(reverse("manage_admins"));
  } catch (err) {
    unstable_rethrow(err);
    await flash("error", `Could not update admin user: ${errorDetail(err)}`);
    return { markup };
  }
}

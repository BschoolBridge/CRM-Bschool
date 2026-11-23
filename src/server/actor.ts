import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "../lib/prisma";
import { adminCan, homeFor, sessionAuthHash, USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR, type AdminPermission, type AuthUser } from "./auth";
import { clientIpFrom } from "./request";
import { readSession } from "./session";
import { flash } from "./flash";

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const { data } = await readSession();
  if (!data.userId || !data.authHash) return null;
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { admin_profile: true, counsellor: true },
  });
  if (!user?.is_active || data.authHash !== sessionAuthHash(user.password)) return null;
  return user;
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user || !homeFor(user.user_type)) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.user_type === USER_TYPE_COUNSELLOR) redirect("/counsellor/home/");
  if (user.user_type !== USER_TYPE_ADMIN) redirect("/");
  return user;
}

export async function requireCounsellor(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.user_type === USER_TYPE_ADMIN) redirect("/admin/home/");
  if (user.user_type !== USER_TYPE_COUNSELLOR) redirect("/");
  return user;
}

export async function requireSuperadmin(): Promise<AuthUser> {
  const user = await requireAdmin();
  if (!user.admin_profile?.is_superadmin) {
    await flash("error", "Only super admins can access this page.");
    redirect("/admin/home/");
  }
  return user;
}

export async function requirePermission(perm: AdminPermission): Promise<AuthUser> {
  const user = await requireAdmin();
  if (!adminCan(user.admin_profile, perm)) {
    await flash("error", "You don't have permission for this action.");
    redirect("/admin/home/");
  }
  return user;
}

export async function currentCounsellor(user: AuthUser) {
  if (!user.counsellor) notFound();
  return user.counsellor;
}

export async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: clientIpFrom(h),
    userAgent: h.get("user-agent"),
  };
}

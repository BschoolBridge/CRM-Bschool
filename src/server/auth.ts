import crypto from "node:crypto";
import type { Admin, Counsellor, User } from "../generated/prisma/client";
import { config } from "../config/env";

export const USER_TYPE_ADMIN = "1";
export const USER_TYPE_COUNSELLOR = "2";

export type AuthUser = User & { admin_profile: Admin | null; counsellor: Counsellor | null };

/** Ties the session to the current password hash: changing a password ends other sessions. */
export function sessionAuthHash(passwordHash: string): string {
  return crypto.createHmac("sha256", config.secretKey).update(`session-auth:${passwordHash}`).digest("hex");
}

export type AdminPermission = "delete" | "performance" | "counsellor_work" | "settings";

export function adminCan(profile: Admin | null | undefined, perm: AdminPermission): boolean {
  if (!profile) return false;
  if (profile.is_superadmin) return true;
  switch (perm) {
    case "delete":
      return profile.can_delete;
    case "performance":
      return profile.can_view_performance;
    case "counsellor_work":
      return false;
    case "settings":
      return profile.can_manage_settings;
  }
}

export function homeFor(userType: string): string | null {
  if (userType === USER_TYPE_ADMIN) return "/admin/home/";
  if (userType === USER_TYPE_COUNSELLOR) return "/counsellor/home/";
  return null;
}

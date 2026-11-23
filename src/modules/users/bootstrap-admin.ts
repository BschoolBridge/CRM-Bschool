import { readEnv } from "../../config/env";
import { logger } from "../../lib/logger";
import { hashPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { ensureAdminProfile } from "./user.service";

/**
 * Create the first super admin from Hostinger (or any panel) env vars when there
 * is no terminal for `npm run user:create-superuser`.
 *
 * Set once, restart the app, then remove BOOTSTRAP_ADMIN_PASSWORD from the panel.
 * Does nothing if a superuser already exists.
 */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const email = readEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = readEnv("BOOTSTRAP_ADMIN_PASSWORD");
  if (!email || !password) return;

  if (password.length < 8) {
    logger.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters; admin was not created");
    return;
  }

  const existingSuperusers = await prisma.user.count({ where: { is_superuser: true } });
  if (existingSuperusers > 0) {
    logger.info("Bootstrap admin skipped: a superuser already exists (remove BOOTSTRAP_ADMIN_* from env)");
    return;
  }

  const first = readEnv("BOOTSTRAP_ADMIN_FIRST_NAME") || "Admin";
  const last = readEnv("BOOTSTRAP_ADMIN_LAST_NAME") || "";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      is_superuser: true,
      is_staff: true,
      is_active: true,
      user_type: "1",
      first_name: first,
      last_name: last,
    },
    create: {
      email,
      password: passwordHash,
      first_name: first,
      last_name: last,
      is_superuser: true,
      is_staff: true,
      user_type: "1",
      gender: "M",
      address: "",
      fcm_token: "",
    },
  });
  await ensureAdminProfile(user.id, true);
  logger.info({ email: user.email, id: user.id }, "Bootstrap super admin created — remove BOOTSTRAP_ADMIN_PASSWORD from production env");
}

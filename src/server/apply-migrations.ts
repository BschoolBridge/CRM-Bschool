import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

/** Apply pending Prisma migrations. Safe to call on every boot (no-op when up to date). */
export async function applyPendingMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    logger.warn("Skipping migrate deploy: DATABASE_URL is not set");
    return;
  }

  const prismaBin = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const args = existsSync(prismaBin)
    ? [prismaBin, "migrate", "deploy"]
    : ["prisma", "migrate", "deploy"];
  const command = existsSync(prismaBin) ? process.execPath : "npx";

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (stdout.trim()) logger.info({ stdout: stdout.trim() }, "prisma migrate deploy");
    if (stderr.trim()) logger.info({ stderr: stderr.trim() }, "prisma migrate deploy stderr");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "prisma migrate deploy failed — import prisma/hostinger-phpmyadmin-import.sql in phpMyAdmin or fix DATABASE_URL");
  }
}

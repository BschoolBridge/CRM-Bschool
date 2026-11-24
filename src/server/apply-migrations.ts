import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import mariadb from "mariadb";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

function migrationsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "prisma", "migrations"),
    path.join(process.cwd(), "..", "prisma", "migrations"),
    path.join(process.cwd(), "..", "repository", "prisma", "migrations"),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

function poolFromDatabaseUrl(url: string) {
  const u = new URL(url);
  const host = u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
  return {
    host,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectTimeout: 15_000,
    allowPublicKeyRetrieval: true,
  };
}

/** True when the CRM schema is already present (e.g. phpMyAdmin import). */
async function schemaAlreadyPresent(databaseUrl: string): Promise<boolean> {
  let conn: mariadb.Connection | undefined;
  try {
    conn = await mariadb.createConnection(poolFromDatabaseUrl(databaseUrl));
    const rows = await conn.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'users'`,
    );
    const count = Number(rows?.[0]?.c ?? 0);
    return count > 0;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

/**
 * Apply pending Prisma migrations when the migrations folder is available.
 * Skips when Hostinger deploy has no migrations dir or phpMyAdmin already created tables.
 */
export async function applyPendingMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    logger.warn("Skipping migrate deploy: DATABASE_URL is not set");
    return;
  }

  try {
    if (await schemaAlreadyPresent(databaseUrl)) {
      logger.info("Database schema already present — skipping prisma migrate deploy");
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { err: message },
      "Could not reach MySQL — check DATABASE_URL (user/password/host 127.0.0.1). Schema probe failed",
    );
    return;
  }

  const migrations = migrationsDir();
  if (!migrations) {
    logger.warn(
      "prisma/migrations not found in this deploy bundle — import prisma/hostinger-phpmyadmin-import.sql in phpMyAdmin if tables are missing",
    );
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
    const detail =
      err && typeof err === "object" && "stderr" in err ? String((err as { stderr?: Buffer }).stderr ?? "") : "";
    logger.error(
      { err: message, detail: detail.trim() || undefined, migrations },
      "prisma migrate deploy failed",
    );
  }
}

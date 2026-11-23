/**
 * Bootstraps user rows from the Django SQLite database into MariaDB.
 * It does not copy counsellors, leads, admissions, or targets.
 * Default path: ../CRM-Portal/db.sqlite3 (override with DJANGO_SQLITE_PATH).
 * `npm run data:import-django -- --plan` prints the mapping and does not write.
 * Run a real import only against a disposable database.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  USER_BOOTSTRAP_TABLE,
  classifySqliteCounts,
  describeImportPlan,
  parseBootstrapUser,
} from "../src/modules/migration/django-import-plan";

const sqlitePath = process.env.DJANGO_SQLITE_PATH || path.resolve(import.meta.dirname, "../../CRM-Portal/db.sqlite3");

function openSqlite(): DatabaseSync {
  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite file not found: ${sqlitePath}`);
    process.exit(1);
  }
  return new DatabaseSync(sqlitePath, { readOnly: true });
}

function tableCounts(db: DatabaseSync): Record<string, number> {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{
    name: string;
  }>;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(table.name)) continue;
    const row = db.prepare(`SELECT COUNT(*) AS n FROM "${table.name}"`).get() as { n: number };
    counts[table.name] = Number(row.n);
  }
  return counts;
}

function printInventory(db: DatabaseSync): void {
  const report = classifySqliteCounts(tableCounts(db));
  console.log("Copied by this script:", report.copied.join(", ") || "(none)");
  console.log("CRM tables with rows left behind:", report.crmNotCopied.join(", ") || "(none)");
  console.log("Framework tables ignored:", report.frameworkIgnored.join(", ") || "(none)");
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000);
  const text = String(value);
  const parsed = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

if (process.argv.includes("--plan")) {
  console.log(describeImportPlan());
  if (fs.existsSync(sqlitePath)) {
    const db = openSqlite();
    try {
      console.log("");
      console.log("SQLite file:", sqlitePath);
      printInventory(db);
    } finally {
      db.close();
    }
  }
  process.exit(0);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const db = openSqlite();
  try {
    console.log(describeImportPlan().split("\n").slice(0, 4).join("\n"));
    console.log("Importing from", sqlitePath);
    printInventory(db);
    const rawUsers = db.prepare(`SELECT * FROM ${USER_BOOTSTRAP_TABLE}`).all() as Array<Record<string, unknown>>;
    const users = rawUsers.map(parseBootstrapUser);
    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        await tx.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            password: user.password,
            last_login: asDate(user.last_login),
            is_superuser: Boolean(user.is_superuser),
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            gender: user.gender,
            profile_pic: user.profile_pic || null,
            address: user.address,
            phone: user.phone,
            fcm_token: user.fcm_token,
            date_joined: asDate(user.date_joined) ?? new Date(),
            created_at: asDate(user.created_at) ?? new Date(),
            is_staff: Boolean(user.is_staff),
            is_active: user.is_active,
          },
          update: {},
        });
      }
    });
    const max = await prisma.user.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? 0) + 1;
    if (!Number.isInteger(nextId) || nextId < 1) throw new Error("Could not compute the next user id");
    await prisma.$executeRawUnsafe(`ALTER TABLE users AUTO_INCREMENT = ${nextId}`);
    console.log(`users: ${users.length}`);
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

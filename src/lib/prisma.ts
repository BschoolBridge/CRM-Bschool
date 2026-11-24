import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "../config/env";
import { logger } from "./logger";
import { PrismaClient, Prisma } from "../generated/prisma/client";

function poolConfigFromUrl(url: string) {
  const u = new URL(url);
  if (!["mysql:", "mariadb:"].includes(u.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// scheme");
  }
  const database = u.pathname.replace(/^\//, "");
  if (!u.username || !database) {
    throw new Error("DATABASE_URL must include username and database name");
  }
  // Hostinger Node apps must use 127.0.0.1 (not localhost / IPv6 ::1).
  const host = u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
  return {
    host,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    connectionLimit: Math.min(Math.max(config.databasePoolSize, 1), 10),
    connectTimeout: 15_000,
    acquireTimeout: 15_000,
    // MySQL 8 caching_sha2_password on shared hosts often needs this for TCP clients.
    allowPublicKeyRetrieval: true,
    ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: true } : undefined,
  };
}

const poolConfig = poolConfigFromUrl(config.databaseUrl);
logger.info(
  { host: poolConfig.host, port: poolConfig.port, user: poolConfig.user, database: poolConfig.database },
  "Prisma MariaDB pool configured",
);

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(poolConfig),
  log: config.debug ? ["warn", "error"] : ["error"],
});

export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;
export { Prisma };

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export function isForeignKeyViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2003" || err.code === "P2014")
  );
}

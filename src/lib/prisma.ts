import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "../config/env";
import { PrismaClient, Prisma } from "../generated/prisma/client";

function poolConfigFromUrl(url: string) {
  const u = new URL(url);
  if (!["mysql:", "mariadb:"].includes(u.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// scheme");
  }
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectionLimit: config.databasePoolSize,
    ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: true } : undefined,
  };
}

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(poolConfigFromUrl(config.databaseUrl)),
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

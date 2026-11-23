import { config } from "@/config/env";
import { publicErrorMessage } from "@/http/errors";
import { clientMeta } from "@/server/actor";

export function fail(err: unknown, prefix: string) {
  return publicErrorMessage(err, `${prefix}: please try again.`, config.debug);
}

export function shown(row: object, key: string): string {
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

export function flag(row: object, key: string): boolean {
  return Boolean((row as Record<string, unknown>)[key]);
}

export async function accessActor(userId: number) {
  const meta = await clientMeta();
  return { userId, ip: meta.ip, userAgent: meta.userAgent };
}

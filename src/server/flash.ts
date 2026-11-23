import { cookies } from "next/headers";
import { baseCookieOptions } from "./cookies";

const COOKIE = "crmflash";

export type FlashLevel = "success" | "error" | "warning" | "info";

export interface FlashMessage {
  level: FlashLevel;
  text: string;
}

function read(raw: string | undefined): FlashMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as FlashMessage[];
    return Array.isArray(parsed) ? parsed.filter((m) => m && m.text && m.level) : [];
  } catch {
    return [];
  }
}

export async function peekFlash(): Promise<FlashMessage[]> {
  const jar = await cookies();
  return read(jar.get(COOKIE)?.value);
}

export async function flash(level: FlashLevel, text: string): Promise<void> {
  const jar = await cookies();
  const pending = read(jar.get(COOKIE)?.value);
  pending.push({ level, text });
  jar.set(COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), baseCookieOptions(60));
}

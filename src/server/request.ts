import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { config } from "../config/env";
import { intId } from "../http/params";
import { cache } from "../lib/cache";

export type SearchParams = Record<string, string | string[] | undefined>;

export async function readSearch(sp: Promise<SearchParams>): Promise<Record<string, string>> {
  const raw = await sp;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = (Array.isArray(value) ? value.at(-1) : value) ?? "";
  }
  return out;
}

export function requiredId(value: string | undefined): number {
  const id = intId(value);
  if (id === null) notFound();
  return id;
}

function isLoopback(peer: string): boolean {
  const host = peer.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "::1" || host === "localhost" || host.startsWith("127.") || host.startsWith("::ffff:127.");
}

function forwardedAddress(headerList: { get(name: string): string | null | undefined }): string | null {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headerList.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * Use X-Forwarded-For only when TRUST_PROXY says the immediate peer is allowed to set it.
 * Route handlers cannot see the TCP peer, so `loopback` (the default) ignores those headers.
 * Set TRUST_PROXY=true only behind a proxy that overwrites them and is the only path to the app.
 * Counters stay in memory unless REDIS_URL is set.
 */
export function resolveClientIp(
  headerList: { get(name: string): string | null | undefined },
  peer: string | null,
  trustRaw: string,
): string {
  const mode = trustRaw.trim().toLowerCase();
  const forwarded = forwardedAddress(headerList);
  const peerAddress = peer?.trim() || null;
  const trustAll = mode === "true" || mode === "1" || mode === "yes" || mode === "on" || mode === "*";
  const trustNone = mode === "false" || mode === "0" || mode === "no" || mode === "off";
  let trustHeader = false;
  if (trustAll) trustHeader = true;
  else if (trustNone) trustHeader = false;
  else if (mode === "loopback") trustHeader = peerAddress !== null && isLoopback(peerAddress);
  else {
    const allowed = new Set(mode.split(",").map((item) => item.trim()).filter(Boolean));
    trustHeader = peerAddress !== null && allowed.has(peerAddress);
  }
  if (trustHeader && forwarded) return forwarded;
  if (peerAddress) return peerAddress;
  return trustHeader ? "unknown" : "direct";
}

export function clientIpFrom(headerList: { get(name: string): string | null | undefined }): string {
  return resolveClientIp(headerList, null, config.trustProxy);
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

export async function tooManyAttempts(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const n = await cache.increment(key, windowSeconds);
  return n > limit;
}

export function headerSource(headerList: Headers) {
  return {
    get(name: string) {
      return headerList.get(name);
    },
  };
}

function isBindAllHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "0.0.0.0" || host === "::" || host === "::0";
}

/**
 * Public site origin for redirects. Hostinger (and similar) Node runtimes bind to
 * 0.0.0.0:3000, so `request.url` is not a browser-reachable base — prefer SITE_URL.
 */
export function publicOrigin(request: Request): string {
  const configured = config.siteUrl?.trim();
  if (configured) {
    try {
      return new URL(configured.includes("://") ? configured : `https://${configured}`).origin;
    } catch {
      /* fall through */
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = forwardedHost || request.headers.get("host")?.trim() || "";
  let hostname = "";
  if (hostHeader) {
    try {
      hostname = new URL(`http://${hostHeader}`).hostname;
    } catch {
      hostname = hostHeader;
    }
  }
  if (hostHeader && !isBindAllHost(hostname)) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (config.useHttps ? "https" : new URL(request.url).protocol.replace(":", "") || "http");
    return `${proto}://${hostHeader}`;
  }

  const fallback = new URL(request.url);
  if (isBindAllHost(fallback.hostname)) fallback.hostname = "127.0.0.1";
  return fallback.origin;
}

/** Absolute redirect that stays on the public hostname (not the Node bind address). */
export function redirectTo(path: string, request: Request): NextResponse {
  return NextResponse.redirect(new URL(path, `${publicOrigin(request)}/`));
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRuntimeConfig, config, DEV_FALLBACK_SECRET } from "../config/env";
import { logger } from "../lib/logger";
import { hmacSha256Hex } from "../modules/integrations/hmac";
import { authorizeLeadWebhook } from "../modules/integrations/lead-webhook.service";
import { baseCookieOptions } from "./cookies";
import { clientIpFrom, resolveClientIp } from "./request";

vi.mock("../lib/prisma", () => ({
  prisma: {},
  isUniqueViolation: () => false,
}));

const TOKEN = "webhook-token-not-for-logs";
const SECRET = "webhook-hmac-secret";

function headers(values: Record<string, string | null>): { get(name: string): string | null } {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

const saved = {
  CRM_WEBHOOK_TOKEN: process.env.CRM_WEBHOOK_TOKEN,
  CRM_WEBHOOK_SECRET: process.env.CRM_WEBHOOK_SECRET,
  CRM_WEBHOOK_ENABLED: process.env.CRM_WEBHOOK_ENABLED,
};

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("forwarded client address", () => {
  const spoofed = headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.4", "x-real-ip": "198.51.100.9" });

  it("ignores a spoofed forwarding header when the peer cannot be verified", () => {
    expect(resolveClientIp(spoofed, null, "loopback")).toBe("direct");
    expect(resolveClientIp(headers({ "x-forwarded-for": "203.0.113.8" }), null, "loopback")).toBe("direct");
    expect(resolveClientIp(spoofed, null, "false")).toBe("direct");
    expect(clientIpFrom(spoofed)).toBe("direct");
  });

  it("trusts the header from a loopback peer and from an explicitly trusted proxy", () => {
    expect(resolveClientIp(spoofed, "127.0.0.1", "loopback")).toBe("203.0.113.9");
    expect(resolveClientIp(spoofed, "8.8.8.8", "loopback")).toBe("8.8.8.8");
    expect(resolveClientIp(spoofed, null, "true")).toBe("203.0.113.9");
    expect(resolveClientIp(headers({}), null, "true")).toBe("unknown");
  });
});

describe("production session settings", () => {
  it("keeps the local cookie off Secure and rejects a production boot without a secret or HTTPS", () => {
    expect(config.env).not.toBe("production");
    expect(config.useHttps).toBe(false);
    expect(baseCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(baseCookieOptions(60).maxAge).toBe(60);

    const secret = "production-secret-at-least-32-characters";
    expect(() => assertRuntimeConfig({ nodeEnv: "production", secretKey: "", useHttps: true })).toThrow(/SECRET_KEY/);
    expect(() => assertRuntimeConfig({ nodeEnv: "production", secretKey: "short", useHttps: true })).toThrow(/SECRET_KEY/);
    expect(() => assertRuntimeConfig({ nodeEnv: "production", secretKey: DEV_FALLBACK_SECRET, useHttps: true })).toThrow(/SECRET_KEY/);
    expect(() => assertRuntimeConfig({ nodeEnv: "production", secretKey: secret, useHttps: false })).toThrow(/USE_HTTPS/);
    expect(() =>
      assertRuntimeConfig({
        nodeEnv: "production",
        secretKey: secret,
        useHttps: false,
        siteUrl: "http://127.0.0.1:8000",
      }),
    ).not.toThrow();
    expect(() => assertRuntimeConfig({ nodeEnv: "production", secretKey: secret, useHttps: true })).not.toThrow();
    expect(() => assertRuntimeConfig({ nodeEnv: "development", secretKey: "", useHttps: false })).not.toThrow();
  });
});

describe("HTTPS env inference", () => {
  it("infers from SITE_URL / NODE_ENV when USE_HTTPS is unset", async () => {
    const { resolveUseHttps, isLocalHttpSite } = await import("../config/env");
    expect(resolveUseHttps({ useHttps: undefined, siteUrl: "https://crm.example.com", nodeEnv: "development" })).toBe(true);
    expect(resolveUseHttps({ useHttps: undefined, siteUrl: "http://127.0.0.1:8000", nodeEnv: "development" })).toBe(false);
    expect(resolveUseHttps({ useHttps: undefined, siteUrl: "http://127.0.0.1:8000", nodeEnv: "production" })).toBe(false);
    expect(resolveUseHttps({ useHttps: undefined, siteUrl: undefined, nodeEnv: "production" })).toBe(true);
    expect(resolveUseHttps({ useHttps: false, siteUrl: "https://crm.example.com", nodeEnv: "production" })).toBe(false);
    expect(isLocalHttpSite("http://127.0.0.1:8000")).toBe(true);
    expect(isLocalHttpSite("https://crm.example.com")).toBe(false);
  });
});

describe("lead webhook credentials", () => {
  it("rejects a query-string token and a wrong header without logging the secret", () => {
    process.env.CRM_WEBHOOK_ENABLED = "1";
    process.env.CRM_WEBHOOK_TOKEN = TOKEN;
    delete process.env.CRM_WEBHOOK_SECRET;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const body = Buffer.from("{}");

    expect(authorizeLeadWebhook(body, { get: () => "", query: { token: TOKEN, api_key: TOKEN } })).toBe(false);
    expect(authorizeLeadWebhook(body, headers({ authorization: "Bearer wrong-token" }))).toBe(false);
    expect(authorizeLeadWebhook(body, headers({ authorization: `Bearer ${TOKEN}` }))).toBe(true);
    expect(authorizeLeadWebhook(body, headers({ "x-crm-webhook-token": TOKEN }))).toBe(true);

    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it("accepts a matching HMAC header and rejects a bad signature", () => {
    process.env.CRM_WEBHOOK_ENABLED = "1";
    delete process.env.CRM_WEBHOOK_TOKEN;
    process.env.CRM_WEBHOOK_SECRET = SECRET;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const body = Buffer.from('{"email":"a@example.com"}');
    const signature = hmacSha256Hex(SECRET, body);

    expect(authorizeLeadWebhook(body, headers({ "x-crm-webhook-signature": `sha256=${signature}` }))).toBe(true);
    expect(authorizeLeadWebhook(body, headers({ "x-crm-webhook-signature": "sha256=deadbeef" }))).toBe(false);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET);
  });
});

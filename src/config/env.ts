import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();

const optionalBool = z
  .string()
  .optional()
  .transform((v): boolean | undefined => {
    if (v === undefined || v.trim() === "") return undefined;
    const t = v.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(t)) return true;
    if (["0", "false", "no", "off"].includes(t)) return false;
    return undefined;
  });

const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = Number.parseInt(v ?? "", 10);
      return Number.isFinite(n) ? n : fallback;
    });

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const raw = { ...process.env };
// Keep the original Django variable names working so an existing .env can be reused.
raw.SECRET_KEY ||= raw.DJANGO_SECRET_KEY;
raw.ALLOWED_HOSTS ||= raw.DJANGO_ALLOWED_HOSTS;
raw.USE_HTTPS ||= raw.DJANGO_USE_HTTPS;
raw.SITE_URL ||= raw.DJANGO_SITE_URL;

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: int(8000),
  LOG_LEVEL: z.string().default("info"),

  SECRET_KEY: z.string().default(""),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (mysql://user:pass@host:3306/db)"),
  DATABASE_POOL_SIZE: int(10),
  REDIS_URL: z.string().optional(),

  SITE_URL: z.string().optional(),
  ALLOWED_HOSTS: csv,
  CSRF_TRUSTED_ORIGINS: csv,
  /** When unset, inferred from SITE_URL (https → true) or NODE_ENV (production → true). */
  USE_HTTPS: optionalBool,
  TRUST_PROXY: z.string().default("loopback"),
  TIME_ZONE: z.string().default("Asia/Kolkata"),
  MEDIA_ROOT: z.string().default(path.join(ROOT, "media")),

  EMAIL_HOST: z.string().default("smtp.gmail.com"),
  EMAIL_PORT: int(587),
  EMAIL_ADDRESS: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),

  SESSION_COOKIE_AGE: int(1800),
  ADMIN_DASHBOARD_CACHE_SECONDS: int(45),
  COUNSELLOR_SNAPSHOT_CACHE_SECONDS: int(45),
  ACTIVITY_BURST_COUNT: int(5),
  ACTIVITY_BURST_WINDOW_SECONDS: int(120),
  MAX_LEAD_IMPORT_MB: int(10),
  MAX_PROFILE_PIC_MB: int(5),
  LEAD_IMPORT_BATCH_SIZE: int(400),
  DATA_UPLOAD_MAX_NUMBER_FIELDS: int(10000),

  OPENAI_API_KEY: z.string().optional(),

  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === "production";

export const DEV_FALLBACK_SECRET = "dev-insecure-secret-do-not-use-in-production-0000000000";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** True when SITE_URL clearly targets a local machine over HTTP. */
export function isLocalHttpSite(siteUrl: string | undefined): boolean {
  if (!siteUrl?.trim()) return false;
  try {
    const u = new URL(siteUrl.includes("://") ? siteUrl : `http://${siteUrl}`);
    return u.protocol === "http:" && isLocalHostname(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Resolve Secure-cookie / HTTPS mode.
 * Explicit USE_HTTPS wins; otherwise https SITE_URL → true, local http SITE_URL → false,
 * production → true, else false.
 */
export function resolveUseHttps(input: {
  useHttps: boolean | undefined;
  siteUrl: string | undefined;
  nodeEnv: string;
}): boolean {
  if (input.useHttps !== undefined) return input.useHttps;
  if (input.siteUrl?.trim().toLowerCase().startsWith("https://")) return true;
  if (isLocalHttpSite(input.siteUrl)) return false;
  return input.nodeEnv === "production";
}

/** Next.js sets this while compiling; skip boot-time production gates so local .env can build. */
export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Production must have a real session secret. HTTPS cookies required unless SITE_URL is local http. */
export function assertRuntimeConfig(input: {
  nodeEnv: string;
  secretKey: string;
  useHttps: boolean;
  siteUrl?: string;
}): void {
  if (input.nodeEnv !== "production") return;
  if (!input.secretKey || input.secretKey.length < 32 || input.secretKey === DEV_FALLBACK_SECRET) {
    throw new Error("SECRET_KEY must be set in production (at least 32 random characters).");
  }
  if (!input.useHttps && !isLocalHttpSite(input.siteUrl)) {
    throw new Error(
      "USE_HTTPS must be true in production (or set SITE_URL to https://…). Local http://127.0.0.1 is allowed for smoke tests.",
    );
  }
}

const useHttps = resolveUseHttps({
  useHttps: env.USE_HTTPS,
  siteUrl: env.SITE_URL,
  nodeEnv: env.NODE_ENV,
});

if (!isNextProductionBuild()) {
  assertRuntimeConfig({
    nodeEnv: env.NODE_ENV,
    secretKey: env.SECRET_KEY,
    useHttps,
    siteUrl: env.SITE_URL,
  });
}
if (!env.SECRET_KEY) env.SECRET_KEY = DEV_FALLBACK_SECRET;

const allowedHosts = env.ALLOWED_HOSTS.length
  ? env.ALLOWED_HOSTS.map((h) => h.split("/")[0]!.trim()).filter(Boolean)
  : ["127.0.0.1", "localhost"];

const trustedOrigins = new Set(env.CSRF_TRUSTED_ORIGINS.map((o) => o.replace(/\/+$/, "")));
const siteOrigin = originOf(env.SITE_URL);
if (siteOrigin) trustedOrigins.add(siteOrigin);

const firebase = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  databaseURL: env.FIREBASE_DATABASE_URL,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
  measurementId: env.FIREBASE_MEASUREMENT_ID,
};

export const config = {
  rootDir: ROOT,
  env: env.NODE_ENV,
  isProduction,
  debug: !isProduction,
  host: env.HOST,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  secretKey: env.SECRET_KEY,
  databaseUrl: env.DATABASE_URL,
  databasePoolSize: env.DATABASE_POOL_SIZE,
  redisUrl: env.REDIS_URL,
  siteUrl: env.SITE_URL ?? "",
  allowedHosts,
  trustedOrigins: [...trustedOrigins],
  // Secure cookies only when we intend HTTPS (inferred or explicit).
  useHttps: isProduction ? useHttps : false,
  trustProxy: env.TRUST_PROXY,
  timeZone: env.TIME_ZONE,
  mediaRoot: env.MEDIA_ROOT,
  publicDir: path.join(ROOT, "public"),
  resourcesDir: path.join(ROOT, "resources"),
  email: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    user: env.EMAIL_ADDRESS,
    password: env.EMAIL_PASSWORD,
    from: `CRM Portal <${env.EMAIL_ADDRESS ?? "no-reply@localhost"}>`,
  },
  sessionMaxAgeSeconds: env.SESSION_COOKIE_AGE,
  cache: {
    adminDashboardSeconds: env.ADMIN_DASHBOARD_CACHE_SECONDS,
    counsellorSnapshotSeconds: env.COUNSELLOR_SNAPSHOT_CACHE_SECONDS,
  },
  activityBurst: {
    count: env.ACTIVITY_BURST_COUNT,
    windowSeconds: env.ACTIVITY_BURST_WINDOW_SECONDS,
  },
  uploads: {
    maxLeadImportMb: env.MAX_LEAD_IMPORT_MB,
    maxProfilePicMb: env.MAX_PROFILE_PIC_MB,
    leadImportBatchSize: Math.max(50, env.LEAD_IMPORT_BATCH_SIZE),
    maxFormFields: env.DATA_UPLOAD_MAX_NUMBER_FIELDS,
  },
  openAiApiKey: env.OPENAI_API_KEY,
  firebase: Object.values(firebase).every(Boolean) ? firebase : null,
} as const;

export type AppConfig = typeof config;

/** Read integration env vars at call time so ops can rotate them without code changes. */
export function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

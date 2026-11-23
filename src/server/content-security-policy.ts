const SCRIPT_HOSTS = ["https://cdn.jsdelivr.net", "https://code.jquery.com", "https://www.gstatic.com"];
const STYLE_HOSTS = ["https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"];
const FONT_HOSTS = ["https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"];
const CONNECT_HOSTS = [
  "https://cdn.jsdelivr.net",
  "https://www.gstatic.com",
  "https://fcm.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
];

/**
 * Page CSP. Script sources are a per-request nonce plus strict-dynamic.
 * Style attributes stay allowed because AdminLTE and React style props use them.
 * Development keeps unsafe-eval for React's dev overlay.
 */
export function contentSecurityPolicy(nonce: string, nodeEnv: string): string {
  if (!/^[A-Za-z0-9+/=_-]{8,}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  const script = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...SCRIPT_HOSTS,
    nodeEnv === "production" ? "" : "'unsafe-eval'",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    script,
    `style-src 'self' 'unsafe-inline' ${STYLE_HOSTS.join(" ")}`,
    `font-src 'self' data: ${FONT_HOSTS.join(" ")}`,
    `img-src 'self' data: blob: ${STYLE_HOSTS.join(" ")}`,
    `connect-src 'self' ${CONNECT_HOSTS.join(" ")}`,
    "media-src 'self' data:",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** Service worker policy. strict-dynamic would block its importScripts() calls. */
export function workerContentSecurityPolicy(): string {
  return [
    "default-src 'none'",
    "script-src 'self' https://www.gstatic.com",
    "connect-src 'self' https://fcm.googleapis.com https://firebaseinstallations.googleapis.com https://www.gstatic.com",
  ].join("; ");
}

import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, workerContentSecurityPolicy } from "./src/server/content-security-policy";

const PUBLIC = [
  /^\/$/,
  /^\/doLogin\/?$/,
  /^\/logout_user\/?$/,
  /^\/password_reset(\/|$)/,
  /^\/reset(\/|$)/,
  /^\/integrations\/(meta|aisensy|leads)\/webhook\/?$/,
  /^\/firebase-messaging-sw\.js\/?$/,
];

const NO_STORE = "private, no-store, max-age=0, must-revalidate";

function allowedHost(host: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = process.env.ALLOWED_HOSTS || process.env.DJANGO_ALLOWED_HOSTS || "";
  const patterns = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!patterns.length) return true;
  const name = host.split(":")[0]?.toLowerCase() ?? "";
  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith(".")) return name === pattern.slice(1) || name.endsWith(pattern);
    return name === pattern;
  });
}

function publicLoginUrl(request: NextRequest): URL {
  const configured = (process.env.SITE_URL || process.env.DJANGO_SITE_URL || "").trim();
  if (configured) {
    try {
      const base = new URL(configured.includes("://") ? configured : `https://${configured}`);
      base.pathname = "/";
      base.search = "";
      base.hash = "";
      return base;
    } catch {
      /* fall through */
    }
  }

  const login = request.nextUrl.clone();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost && login.hostname === "0.0.0.0") {
    login.host = forwardedHost;
    if (forwardedProto) login.protocol = `${forwardedProto}:`;
  } else if (login.hostname === "0.0.0.0" || login.hostname === "::") {
    login.hostname = "127.0.0.1";
  }
  login.pathname = "/";
  login.search = "";
  login.hash = "";
  return login;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!allowedHost(host)) return new NextResponse("Bad Request (400)", { status: 400 });

  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = pathname.startsWith("/firebase-messaging-sw.js")
    ? workerContentSecurityPolicy()
    : contentSecurityPolicy(nonce, process.env.NODE_ENV ?? "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const isPublic = PUBLIC.some((re) => re.test(pathname));
  if (!isPublic && !request.cookies.get("sessionid")) {
    const redirect = NextResponse.redirect(publicLoginUrl(request));
    redirect.headers.set("Content-Security-Policy", policy);
    redirect.headers.set("Cache-Control", NO_STORE);
    return redirect;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  // Never let Hostinger/CDN cache authenticated HTML as a logged-out login redirect.
  if (!isPublic) {
    response.headers.set("Cache-Control", NO_STORE);
    response.headers.set("Vary", "Cookie");
  }
  if (request.cookies.get("crmflash")) response.cookies.delete("crmflash");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|static/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?)$).*)"],
};

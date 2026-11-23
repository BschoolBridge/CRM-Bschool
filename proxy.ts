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

function allowedHost(host: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = process.env.ALLOWED_HOSTS || process.env.DJANGO_ALLOWED_HOSTS || "";
  const patterns = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!patterns.length) return true;
  const name = host.split(":")[0]?.toLowerCase() ?? "";
  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith(".")) return name === pattern.slice(1) || name.endsWith(pattern);
    return name === pattern;
  });
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
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  if (request.cookies.get("crmflash")) response.cookies.delete("crmflash");

  const isPublic = PUBLIC.some((re) => re.test(pathname));
  if (!isPublic && !request.cookies.get("sessionid")) {
    const login = request.nextUrl.clone();
    login.pathname = "/";
    login.search = "";
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Content-Security-Policy", policy);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|static/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?)$).*)"],
};

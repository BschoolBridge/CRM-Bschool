import { NextResponse } from "next/server";
import { hashPassword, passwordNeedsRehash, simulatePasswordCheck, verifyPassword } from "../../src/lib/password";
import { extractCleanPhone } from "../../src/lib/phone";
import { prisma } from "../../src/lib/prisma";
import { homeFor, sessionAuthHash, USER_TYPE_ADMIN } from "../../src/server/auth";
import { flash } from "../../src/server/flash";
import { clientIp, tooManyAttempts } from "../../src/server/request";
import { createSession } from "../../src/server/session";

export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse("<h4>Denied</h4>", { status: 405, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  const ip = await clientIp();
  const body = await request.formData();
  const email = String(body.get("email") ?? "").trim().toLowerCase();
  const phone = String(body.get("phone") ?? "").trim();
  const password = String(body.get("password") ?? "");

  let user = null;
  if (email && email.includes("@")) {
    user = await prisma.user.findFirst({ where: { email } });
  } else {
    const rawTarget = phone || email;
    const cleanPhone = extractCleanPhone(rawTarget);
    if (cleanPhone && cleanPhone.length >= 7) {
      const variants = Array.from(
        new Set([rawTarget, cleanPhone, `+91${cleanPhone}`, `91${cleanPhone}`, `0${cleanPhone}`].filter(Boolean))
      );
      user = await prisma.user.findFirst({
        where: {
          OR: variants.map((p) => ({ phone: p })),
        },
      });
    } else if (email) {
      user = await prisma.user.findFirst({ where: { email } });
    }
  }

  const valid = user ? await verifyPassword(password, user.password) : (await simulatePasswordCheck(password), false);

  if (!user || !valid || !user.is_active) {
    if (await tooManyAttempts(`login:${ip}`, 20, 15 * 60)) {
      return new NextResponse("<h1>Too many login attempts</h1><p>Please wait a few minutes and try again.</p>", {
        status: 429,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    await flash("error", "Invalid details");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const home = homeFor(user.user_type);
  if (!home) {
    await flash("error", "Invalid user type");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const previousLogin = user.last_login;
  const passwordHash = passwordNeedsRehash(user.password) ? await hashPassword(password) : user.password;
  await prisma.user.update({ where: { id: user.id }, data: { last_login: new Date(), password: passwordHash } });
  await createSession({
    userId: user.id,
    authHash: sessionAuthHash(passwordHash),
    ...(user.user_type === USER_TYPE_ADMIN
      ? { adminLoginSince: previousLogin ? previousLogin.toISOString() : null, showWebsiteLeadsLoginAlert: true }
      : {}),
  });
  return NextResponse.redirect(new URL(home, request.url));
}

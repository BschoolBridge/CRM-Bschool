import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "../../src/config/env";
import { logger } from "../../src/lib/logger";
import { sendMail } from "../../src/lib/mailer";
import { prisma } from "../../src/lib/prisma";
import { fullName } from "../../src/modules/presenters";
import { encodeUid, makeResetToken } from "../../src/modules/auth/reset-tokens";
import { reverse } from "../../src/http/urls";
import { clientIp, tooManyAttempts } from "../../src/server/request";
import { BodyClass } from "../../src/components/client-form";
import { PlatformShowcaseLeft } from "../../src/components/login-view";

export const dynamic = "force-dynamic";

async function requestReset(formData: FormData) {
  "use server";
  const ip = await clientIp();
  if (await tooManyAttempts(`reset-request:${ip}`, 10, 3600)) {
    redirect("/password_reset/done/");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  try {
    const users = await prisma.user.findMany({ where: { email, is_active: true } });
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const origin = config.siteUrl ? new URL(config.siteUrl).origin : `${proto}://${host}`;

    for (const user of users) {
      if (!user.password || user.password.startsWith("!")) continue;
      const resetUrl = `${origin}${reverse("password_reset_confirm", encodeUid(user.id), makeResetToken(user))}`;
      const body = [
        `Hello ${fullName(user)},`,
        "",
        "We received a request to reset your password for your Bschool Bridge account.",
        "",
        resetUrl,
        "",
        "If you did not request this password reset, please ignore this email.",
        "This link will expire in 24 hours.",
        "",
        "Bschool Bridge",
      ].join("\n");
      await sendMail(user.email, `Password reset on ${new URL(origin).host}`, body);
    }
  } catch (err) {
    logger.error({ err }, "password reset email sending failed (check SMTP settings)");
  }
  redirect("/password_reset/done/");
}

export default function PasswordResetPage() {
  return (
    <>
      <BodyClass name="login-custom-body" />
      <link rel="stylesheet" href="/static/assests/css/custom_login.css" />
      <div className="login-split-page">
        <PlatformShowcaseLeft />
        <section className="login-split-right" aria-label="Forgot Password">
          <div className="login-card-wrapper">
            {/* Logo */}
            <div className="login-brand-header">
              <img
                src="/static/assests/bschool-bridge-logo-trimmed.png"
                alt="Bschool Bridge"
                className="login-brand-logo-img"
                width={210}
                height={90}
              />
            </div>

            {/* Title matching login page typography */}
            <div className="login-welcome-title">
              Forgot your <span className="text-highlight-gold">password?</span>
            </div>
            <p className="login-welcome-desc">
              Enter your registered email address below. We will send you a secure link to reset your password.
            </p>

            {/* Auth Form identical to login form */}
            <form action={requestReset} className="login-auth-form">
              <div className="login-input-group">
                <input
                  required
                  id="email"
                  type="email"
                  name="email"
                  className="login-text-input"
                  placeholder="EMAIL ADDRESS"
                  autoComplete="email"
                />
              </div>

              <button type="submit" className="login-action-btn">
                Send reset link
              </button>
            </form>

            {/* Back link matching login styles */}
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <Link href="/" className="forgot-password-anchor">
                <i className="fa-solid fa-arrow-left" style={{ marginRight: "6px" }} /> Back to sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

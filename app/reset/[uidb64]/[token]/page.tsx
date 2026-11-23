import Link from "next/link";
import { redirect } from "next/navigation";
import { logger } from "../../../../src/lib/logger";
import { hashPassword } from "../../../../src/lib/password";
import { prisma } from "../../../../src/lib/prisma";
import { cache } from "../../../../src/lib/cache";
import { isExtraWeak } from "../../../../src/modules/auth/password-policy";
import { checkResetToken, decodeUid } from "../../../../src/modules/auth/reset-tokens";
import { flash, peekFlash } from "../../../../src/server/flash";
import { clientIp } from "../../../../src/server/request";
import { BodyClass } from "../../../../src/components/client-form";
import { PlatformShowcaseLeft } from "../../../../src/components/login-view";

export const dynamic = "force-dynamic";

export default async function PasswordResetConfirmPage({
  params,
}: {
  params: Promise<{ uidb64: string; token: string }>;
}) {
  const { uidb64, token } = await params;
  const ip = await clientIp();
  const attemptsKey = `password_reset_attempts_${ip}`;
  const attempts = (await cache.get<number>(attemptsKey)) ?? 0;
  const uid = decodeUid(uidb64);
  const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
  const valid = Boolean(user && checkResetToken(user, token));
  if (user && !valid) logger.warn({ userId: user.id, ip }, "invalid password reset token");

  const messages = await peekFlash();
  const errors = messages.filter((m) => m.level === "error").map((m) => m.text);

  async function handleSetPassword(formData: FormData) {
    "use server";
    const currentIp = await clientIp();
    const key = `password_reset_attempts_${currentIp}`;
    const seen = await cache.increment(key, 3600);
    if (seen > 5) {
      await flash("error", "Too many password reset attempts. Please try again later.");
      redirect(`/reset/${uidb64}/${token}/`);
    }
    const id = decodeUid(uidb64);
    const owner = id ? await prisma.user.findUnique({ where: { id } }) : null;
    if (!owner || !checkResetToken(owner, token)) redirect(`/reset/${uidb64}/${token}/`);

    const p1 = String(formData.get("new_password1") ?? "");
    const p2 = String(formData.get("new_password2") ?? "");
    if (p1 !== p2) {
      await flash("error", "The two password fields did not match.");
      redirect(`/reset/${uidb64}/${token}/`);
    }
    if (p1.length < 8) {
      await flash("error", "Password must be at least 8 characters long.");
      redirect(`/reset/${uidb64}/${token}/`);
    }
    if (isExtraWeak(p1)) {
      await flash("error", "This password is too common. Please choose a stronger password.");
      redirect(`/reset/${uidb64}/${token}/`);
    }
    await prisma.user.update({ where: { id: owner.id }, data: { password: await hashPassword(p1) } });
    await cache.delete(key);
    logger.info({ userId: owner.id }, "password reset completed");
    await flash("success", "Your password has been reset successfully!");
    redirect("/reset/done/");
  }

  return (
    <>
      <BodyClass name="login-custom-body" />
      <link rel="stylesheet" href="/static/assests/css/custom_login.css" />
      <div className="login-split-page">
        <PlatformShowcaseLeft />
        <section className="login-split-right" aria-label="Set New Password">
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

            {/* Title */}
            <div className="login-welcome-title">
              Set a new <span className="text-highlight-gold">password</span>
            </div>
            <p className="login-welcome-desc">
              Choose a strong password with at least 8 characters to secure your Bschool Bridge account.
            </p>

            {/* Flash Error Banner */}
            {errors.length > 0 && (
              <div className="login-error-banner" role="alert">
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: "8px" }} />
                {errors.join(", ")}
              </div>
            )}

            {attempts >= 5 || !valid ? (
              <div className="w-100 text-center">
                <div className="login-error-banner justify-content-center mb-3">
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: "8px" }} />
                  This reset link is invalid or has expired.
                </div>
                <Link href="/password_reset/" className="forgot-password-anchor">
                  Request a new reset link
                </Link>
              </div>
            ) : (
              <form action={handleSetPassword} className="login-auth-form">
                <div className="login-input-group">
                  <input
                    required
                    id="new_password1"
                    type="password"
                    name="new_password1"
                    className="login-text-input"
                    placeholder="NEW PASSWORD (MIN. 8 CHARS)"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>

                <div className="login-input-group">
                  <input
                    required
                    id="new_password2"
                    type="password"
                    name="new_password2"
                    className="login-text-input"
                    placeholder="CONFIRM NEW PASSWORD"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>

                <button type="submit" className="login-action-btn">
                  Update password
                </button>
              </form>
            )}

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

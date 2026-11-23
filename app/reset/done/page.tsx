import Link from "next/link";
import { BodyClass } from "../../../src/components/client-form";
import { PlatformShowcaseLeft } from "../../../src/components/login-view";
import { peekFlash } from "../../../src/server/flash";

export const dynamic = "force-dynamic";

export default async function PasswordResetCompletePage() {
  const messages = await peekFlash();
  return (
    <>
      <BodyClass name="login-custom-body" />
      <link rel="stylesheet" href="/static/assests/css/custom_login.css" />
      <div className="login-split-page">
        <PlatformShowcaseLeft />
        <section className="login-split-right" aria-label="Password Reset Complete">
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
              Password <span className="text-highlight-gold">updated</span>
            </div>
            <p className="login-welcome-desc">
              Your password has been changed successfully. You can now sign in with your new credentials.
            </p>

            {messages.map((message) => (
              <div key={message.text} className="alert alert-success w-100 mb-3">
                {message.text}
              </div>
            ))}

            <div style={{ width: "100%", marginTop: "12px" }}>
              <Link
                href="/"
                className="login-action-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                Sign in now
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

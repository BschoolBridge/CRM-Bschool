import Link from "next/link";
import { BodyClass } from "../../../src/components/client-form";
import { PlatformShowcaseLeft } from "../../../src/components/login-view";

export default function PasswordResetDonePage() {
  return (
    <>
      <BodyClass name="login-custom-body" />
      <link rel="stylesheet" href="/static/assests/css/custom_login.css" />
      <div className="login-split-page">
        <PlatformShowcaseLeft />
        <section className="login-split-right" aria-label="Password Reset Sent">
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
              Check your <span className="text-highlight-gold">inbox</span>
            </div>
            <p className="login-welcome-desc">
              If an active account exists for that email, a password reset link has been dispatched. Please review your inbox and spam folder.
            </p>

            {/* Action button */}
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
                Return to sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

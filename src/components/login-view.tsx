"use client";

import Link from "next/link";
import { useState } from "react";

interface LoginViewProps {
  errors: string[];
}

export function PlatformShowcaseLeft() {
  return (
    <section className="login-split-left" aria-label="Bschool Bridge Platform Showcase">
      <div className="split-left-overlay">
        {/* Main Hero Header */}
        <div className="ad-header-group">
          <div className="ad-kicker">
            <span className="ad-kicker-badge">BSCHOOL BRIDGE</span> ADMISSIONS PLATFORM
          </div>
          <h1 className="ad-batch-title">Compare 700+ BSchools</h1>
          <h2 className="ad-subhead">Discover MBA &amp; PGDM Programs with Transparent Placement Signals</h2>
          <p className="ad-description">
            Compare fees, cutoffs, and placement ROI using curated research notes and public rankings — so you can
            shortlist B-schools with clearer context.
          </p>
        </div>

        {/* Platform Performance & Proof Metrics from bschoolbridge.com */}
        <div className="ad-stats-container">
          <div className="ad-hero-stat">
            <div className="ad-stat-big-number">700+</div>
            <div className="ad-stat-big-label">B-Schools Listed &amp; Verified</div>
          </div>
          <div className="ad-stat-list">
            <div className="ad-stat-pill">
              <span className="ad-stat-value">4 Major Rankings</span>
              <span className="ad-stat-tag">NIRF, Outlook, BT, IIRF</span>
            </div>
            <div className="ad-stat-pill">
              <span className="ad-stat-value">18+ Research Guides</span>
              <span className="ad-stat-tag">Cutoffs &amp; Selection Criteria</span>
            </div>
            <div className="ad-stat-pill">
              <span className="ad-stat-value">100% Data-Backed</span>
              <span className="ad-stat-tag">No Commission Push</span>
            </div>
          </div>
        </div>

        <p className="ad-support-highlight">
          Covering CAT, XAT, NMAT, SNAP, MAT, CMAT cutoffs, ROI calculator &amp; free counselling.
        </p>
      </div>
    </section>
  );
}

export function LoginView({ errors }: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-split-page">
      <PlatformShowcaseLeft />


      {/* Right Login Section */}
      <section className="login-split-right" aria-label="Sign in">
        {/* Centered Login Card Form */}
        <div className="login-card-wrapper">
          {/* Logo & Institute Branding */}
          <div className="login-brand-header">
            <img
              src="/static/assests/bschool-bridge-logo-trimmed.png"
              alt="Bschool Bridge"
              className="login-brand-logo-img"
              width={210}
              height={90}
            />
          </div>

          {/* Welcome Title */}
          <div className="login-welcome-title">
            Welcome <span className="text-highlight-gold">back</span>
          </div>
          <p className="login-welcome-desc">
            Sign in to access your leads, calling queues, and admissions dashboard.
          </p>

          {/* Email / Phone Segmented Tab Toggle */}
          <div className="login-tabs-switcher" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "email"}
              className={`login-switch-tab ${activeTab === "email" ? "active" : ""}`}
              onClick={() => setActiveTab("email")}
            >
              EMAIL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "phone"}
              className={`login-switch-tab ${activeTab === "phone" ? "active" : ""}`}
              onClick={() => setActiveTab("phone")}
            >
              PHONE
            </button>
          </div>

          {/* Flash Error Banner */}
          {errors.length > 0 && (
            <div className="login-error-banner" role="alert">
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: "8px" }} />
              {errors.join(", ")}
            </div>
          )}

          {/* Sign In Form */}
          <form action="/doLogin/" method="post" className="login-auth-form">
            {activeTab === "email" ? (
              <div className="login-input-group">
                <input
                  required
                  id="email"
                  type="email"
                  name="email"
                  className="login-text-input"
                  placeholder="EMAIL ADDRESS"
                  autoComplete="username"
                />
              </div>
            ) : (
              <div className="login-phone-group">
                <span className="login-phone-prefix">+91</span>
                <input
                  required
                  id="phone"
                  type="tel"
                  name="phone"
                  className="login-text-input phone-input"
                  placeholder="PHONE NUMBER"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
            )}

            <div className="login-input-group password-field-group">
              <input
                required
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="login-text-input password-input"
                placeholder="PASSWORD"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-reveal-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={showPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye"} />
              </button>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="login-remember-forgot-row">
              <label className="remember-checkbox-label">
                <input type="checkbox" name="remember" className="custom-checkbox" />
                <span>Remember me</span>
              </label>
              <Link href="/password_reset/" className="forgot-password-anchor">
                Forgot password?
              </Link>
            </div>

            {/* Sign in Button */}
            <button type="submit" className="login-action-btn">
              Sign in
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

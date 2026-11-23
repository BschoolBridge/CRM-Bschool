import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, workerContentSecurityPolicy } from "./content-security-policy";
import { canReadProfilePicture, profilePictureKey } from "./media-access";

describe("content security policy", () => {
  it("allows scripts by nonce and keeps style attributes for AdminLTE", () => {
    const policy = contentSecurityPolicy("abcDEF12+/=", "production");
    expect(policy).toContain("script-src 'self' 'nonce-abcDEF12+/=' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("keeps React's dev eval and gives the service worker a host allowlist", () => {
    expect(contentSecurityPolicy("noncevalue", "development")).toContain("'unsafe-eval'");
    const worker = workerContentSecurityPolicy();
    expect(worker).toContain("https://www.gstatic.com");
    expect(worker).not.toContain("strict-dynamic");
  });
});

describe("profile picture access", () => {
  it("accepts only a profile picture path", () => {
    expect(profilePictureKey(["profile_pics", "photo.jpg"])).toBe("profile_pics/photo.jpg");
    expect(profilePictureKey(["..", "profile_pics", "photo.jpg"])).toBeNull();
    expect(profilePictureKey(["profile_pics", "..", "secret.png"])).toBeNull();
    expect(profilePictureKey(["profile_pics", "notes.csv"])).toBeNull();
  });

  it("lets the owner and an admin read a picture, and stops another counsellor", () => {
    expect(canReadProfilePicture({ id: 4, user_type: "2" }, 4)).toBe(true);
    expect(canReadProfilePicture({ id: 4, user_type: "2" }, 9)).toBe(false);
    expect(canReadProfilePicture({ id: 1, user_type: "1" }, 9)).toBe(true);
    expect(canReadProfilePicture({ id: 1, user_type: "1" }, null)).toBe(false);
  });
});

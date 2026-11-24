import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({
  config: {
    secretKey: "test-secret-key-at-least-32-characters",
    sessionMaxAgeSeconds: 1800,
    useHttps: true,
  },
}));

describe("session cookie signing", () => {
  it("round-trips sid values that would break with base64 + cookies", async () => {
    const { sessionCookieValue, sidFromSessionCookie } = await import("./session-cookie");
    // Force many random sids; base64url must never introduce + or /.
    for (let i = 0; i < 40; i++) {
      const sid = Buffer.from(`sid-${i}-${"x".repeat(i % 17)}`).toString("base64url");
      const cookie = sessionCookieValue(sid);
      expect(cookie).not.toMatch(/[+/=]/);
      expect(sidFromSessionCookie(cookie)).toBe(sid);
      expect(sidFromSessionCookie(encodeURIComponent(cookie))).toBe(sid);
    }
  });
});

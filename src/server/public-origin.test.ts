import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  siteUrl: "",
  useHttps: true,
}));

vi.mock("../config/env", () => ({
  config: {
    get siteUrl() {
      return state.siteUrl;
    },
    get useHttps() {
      return state.useHttps;
    },
    trustProxy: "loopback",
  },
}));

vi.mock("../lib/cache", () => ({
  cache: { increment: async () => 1 },
}));

describe("publicOrigin", () => {
  beforeEach(() => {
    state.siteUrl = "";
    state.useHttps = true;
    vi.resetModules();
  });

  it("prefers SITE_URL over a 0.0.0.0 request URL", async () => {
    state.siteUrl = "https://crm.bschoolbridge.com";
    const { publicOrigin } = await import("./request");
    expect(publicOrigin(new Request("http://0.0.0.0:3000/doLogin/"))).toBe("https://crm.bschoolbridge.com");
  });

  it("uses x-forwarded host/proto when SITE_URL is unset", async () => {
    const { publicOrigin } = await import("./request");
    expect(
      publicOrigin(
        new Request("http://0.0.0.0:3000/doLogin/", {
          headers: {
            "x-forwarded-host": "crm.bschoolbridge.com",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe("https://crm.bschoolbridge.com");
  });

  it("rewrites bind-all hosts to 127.0.0.1 as a last resort", async () => {
    const { publicOrigin } = await import("./request");
    expect(publicOrigin(new Request("http://0.0.0.0:3000/doLogin/"))).toBe("http://127.0.0.1:3000");
  });
});

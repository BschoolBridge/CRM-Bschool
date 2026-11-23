import { config } from "../config/env";

/** Shared cookie flags. `secure` follows production HTTPS and stays off for local HTTP. */
export function baseCookieOptions(maxAge?: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: config.useHttps,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

import { redirectTo } from "../../src/server/request";
import { destroySession } from "../../src/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await destroySession();
  return redirectTo("/", request);
}

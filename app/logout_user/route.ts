import { redirectTo } from "../../src/server/request";
import { destroySession } from "../../src/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await destroySession();
  const response = redirectTo("/", request);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}

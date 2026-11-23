import { NextResponse } from "next/server";
import { destroySession } from "../../src/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url));
}

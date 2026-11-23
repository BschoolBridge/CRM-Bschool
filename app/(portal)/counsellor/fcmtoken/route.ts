import { prisma } from "@/lib/prisma";
import { requireCounsellor } from "@/server/actor";
import { recordFromFormData } from "@/server/form";

export const dynamic = "force-dynamic";

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json: unknown = await request.json();
      if (json && typeof json === "object" && !Array.isArray(json)) return json as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  try {
    return recordFromFormData(await request.formData());
  } catch {
    return {};
  }
}

async function saveToken(request: Request) {
  const user = await requireCounsellor();
  const body = await readBody(request);
  const token = String(body.token ?? "");
  if (token) {
    await prisma.user.update({ where: { id: user.id }, data: { fcm_token: token } });
    return Response.json({ status: "success" });
  }
  return Response.json({ status: "error" });
}

export async function POST(request: Request) {
  return saveToken(request);
}

export async function GET() {
  await requireCounsellor();
  return Response.json({ status: "error" });
}

import { fieldList, idList } from "@/http/params";
import { markAssignmentNotificationsRead } from "@/modules/notifications/assignment-notifications";
import { currentCounsellor, requireCounsellor } from "@/server/actor";
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

export async function POST(request: Request) {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  const body = await readBody(request);
  let raw = fieldList(body, "ids");
  if (!raw.length && Array.isArray(body.ids)) raw = body.ids.map(String);
  const marked = await markAssignmentNotificationsRead(counsellor.id, idList(raw));
  return Response.json({ ok: true, marked });
}

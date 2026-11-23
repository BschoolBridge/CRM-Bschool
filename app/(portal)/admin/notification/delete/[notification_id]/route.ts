import { deleteAdminNotificationById } from "@/modules/notifications/delete-notifications";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ notification_id: string }> }) {
  const { notification_id } = await context.params;
  await deleteAdminNotificationById(requiredId(notification_id));
}

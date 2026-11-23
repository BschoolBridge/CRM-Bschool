import { deleteAdminById } from "@/modules/users/delete-admin";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ admin_id: string }> }) {
  const { admin_id } = await context.params;
  await deleteAdminById(requiredId(admin_id));
}

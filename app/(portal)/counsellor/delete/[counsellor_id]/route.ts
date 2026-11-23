import { deleteCounsellorById } from "@/modules/users/delete-counsellor";
import { requiredId } from "@/server/request";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ counsellor_id: string }> }) {
  const { counsellor_id } = await context.params;
  await deleteCounsellorById(requiredId(counsellor_id));
}

import { notFound, redirect } from "next/navigation";
import { field } from "@/http/params";
import { reverse, withQuery } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { sendThreadReply } from "@/modules/integrations/meta.service";
import { recordFromFormData } from "@/server/form";
import { flash } from "@/server/flash";
import { requiredId } from "@/server/request";
import { requirePermission } from "@/server/actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ thread_id: string }> }) {
  await requirePermission("settings");
  const { thread_id } = await context.params;
  const thread = await prisma.socialChatThread.findUnique({ where: { id: requiredId(thread_id) } });
  if (!thread) notFound();
  const body = field(recordFromFormData(await request.formData()), "body");
  const redirectUrl = withQuery(reverse("social_chat_inbox"), { thread: thread.id });
  if (!body) {
    await flash("warning", "Enter a message to send.");
    redirect(redirectUrl);
  }
  const [ok, err] = await sendThreadReply(thread, body);
  if (ok) {
    await prisma.socialChatMessage.create({ data: { thread_id: thread.id, direction: "out", body } });
    await prisma.socialChatThread.update({
      where: { id: thread.id },
      data: { last_message_at: new Date(), last_message_preview: body.slice(0, 300) },
    });
    await flash("success", "Message sent.");
  } else {
    await prisma.socialChatMessage.create({
      data: { thread_id: thread.id, direction: "out", body, error_detail: err.slice(0, 500) },
    });
    await flash("error", `Could not send: ${err}`);
  }
  redirect(redirectUrl);
}

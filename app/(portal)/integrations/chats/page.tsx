import Link from "next/link";
import { notFound } from "next/navigation";
import { field } from "@/http/params";
import { reverse } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { presentAll, presentThread } from "@/modules/presenters";
import { readSearch, type SearchParams } from "@/server/request";
import { requirePermission } from "@/server/actor";
import { Card, Empty, PageHeader } from "@/components/ui";
import { shown } from "../../_lib/access";

export const metadata = { title: "Social inbox" };

export default async function SocialInboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("settings");
  const query = await readSearch(searchParams);
  const threads = presentAll(
    await prisma.socialChatThread.findMany({ include: { lead: true }, orderBy: { last_message_at: "desc" }, take: 300 }),
    (thread) => presentThread(thread),
  );
  const tid = field(query, "thread");
  let active: ReturnType<typeof presentThread> | null = null;
  let messageList: Array<{ id: number; direction: string; body: string; error_detail: string | null; created_at: Date }> = [];
  if (/^\d+$/.test(tid)) {
    const row = await prisma.socialChatThread.findUnique({ where: { id: Number(tid) }, include: { lead: true } });
    if (!row) notFound();
    active = presentThread(row);
    messageList = await prisma.socialChatMessage.findMany({
      where: { thread_id: active.id },
      include: { thread: true },
      orderBy: { created_at: "asc" },
      take: 500,
    });
  }

  return (
    <>
      <PageHeader title="Social inbox" />
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-4">
              <Card title={<>Conversations <span className="badge badge-light">{threads.length}</span></>}>
                {threads.length === 0 ? <Empty text="No chats yet. When WhatsApp, Instagram, or Facebook messages arrive, they appear here." /> : (
                  <div className="list-group list-group-flush">
                    {threads.map((thread) => (
                      <Link key={thread.id} href={`${reverse("social_chat_inbox")}?thread=${thread.id}`} className={`list-group-item list-group-item-action${active?.id === thread.id ? " active" : ""}`}>
                        <div className="d-flex justify-content-between">
                          <strong>{thread.display_name || thread.external_user_id}</strong>
                          <small>{thread.last_message_at ? formatDjango(thread.last_message_at, "M j, H:i") : ""}</small>
                        </div>
                        <span className="badge badge-light">{shown(thread, "get_channel_display")}</span>
                        <div className="small text-truncate">{thread.last_message_preview || "—"}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <div className="col-md-8">
              {active ? (
                <Card title={<>{active.display_name || active.external_user_id} <span className="badge badge-light ml-2">{shown(active, "get_channel_display")}</span></>}>
                  {active.lead ? <p><Link href={reverse("admin_view_lead", active.lead.id)}>Open lead</Link></p> : null}
                  <div className="mb-3" style={{ maxHeight: "50vh", overflow: "auto" }}>
                    {messageList.length === 0 ? <Empty text="No messages in this thread." /> : messageList.map((message) => (
                      <div key={message.id} className={`mb-3 ${message.direction === "out" ? "text-right" : ""}`}>
                        <div className={`d-inline-block text-left p-2 rounded ${message.direction === "out" ? "bg-primary text-white" : "bg-white border"}`}>
                          {message.body}
                          {message.error_detail ? <div className="small mt-1">{message.error_detail}</div> : null}
                        </div>
                        <div className="small text-muted">{message.direction === "out" ? "You" : "Them"} · {formatDjango(message.created_at, "M j, H:i")}</div>
                      </div>
                    ))}
                  </div>
                  <form method="post" action={reverse("social_chat_send", active.id)}>
                    <div className="input-group">
                      <textarea className="form-control" name="body" rows={2} placeholder="Type a reply…" required maxLength={4000} />
                      <div className="input-group-append">
                        <button className="btn btn-primary" type="submit">Send</button>
                      </div>
                    </div>
                  </form>
                </Card>
              ) : <Card title="Conversation"><Empty text="Select a conversation." /></Card>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

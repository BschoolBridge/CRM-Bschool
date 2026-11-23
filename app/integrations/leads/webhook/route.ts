import { logger } from "../../../../src/lib/logger";
import { authorizeLeadWebhook, processLeadWebhook } from "../../../../src/modules/integrations/lead-webhook.service";
import { clientIpFrom, headerSource, tooManyAttempts } from "../../../../src/server/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  if (await tooManyAttempts(`webhook:${ip}`, 600, 60)) return new Response("Too many requests", { status: 429 });
  const raw = Buffer.from(await request.arrayBuffer());
  const source = headerSource(request.headers);
  if (!authorizeLeadWebhook(raw, source)) {
    logger.warn("Lead webhook rejected: auth failed");
    return new Response("Invalid webhook authentication", { status: 403 });
  }
  const summary = await processLeadWebhook(raw, source);
  return Response.json(summary, { status: summary.ok ? 200 : 400 });
}

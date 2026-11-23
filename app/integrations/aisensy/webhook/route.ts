import { logger } from "../../../../src/lib/logger";
import { authorizeAisensy, processAisensyWebhook } from "../../../../src/modules/integrations/aisensy.service";
import { clientIpFrom, tooManyAttempts } from "../../../../src/server/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  if (await tooManyAttempts(`webhook:${ip}`, 600, 60)) return new Response("Too many requests", { status: 429 });
  const raw = Buffer.from(await request.arrayBuffer());
  const headers = { get: (name: string) => request.headers.get(name) };
  if (!(await authorizeAisensy(raw, headers))) {
    logger.warn("AiSensy webhook rejected: auth failed");
    return new Response("Invalid webhook authentication", { status: 403 });
  }
  const summary = await processAisensyWebhook(raw);
  return Response.json(summary, { status: summary.ok ? 200 : 400 });
}

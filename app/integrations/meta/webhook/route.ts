import { logger } from "../../../../src/lib/logger";
import { effectiveMetaConfig, handleMetaWebhookJson, verifyMetaSignature, verifyMetaSubscribe } from "../../../../src/modules/integrations/meta.service";
import { clientIpFrom, tooManyAttempts } from "../../../../src/server/request";

export const dynamic = "force-dynamic";

async function limited(request: Request): Promise<Response | null> {
  const ip = clientIpFrom(request.headers);
  if (await tooManyAttempts(`webhook:${ip}`, 600, 60)) return new Response("Too many requests", { status: 429 });
  return null;
}

export async function GET(request: Request) {
  const blocked = await limited(request);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (!challenge) return new Response("Missing challenge", { status: 403 });
  const cfg = await effectiveMetaConfig();
  const out = verifyMetaSubscribe(url.searchParams.get("hub.mode") ?? "", url.searchParams.get("hub.verify_token") ?? "", challenge, cfg.verify_token);
  if (out === null) return new Response("Verification failed", { status: 403 });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const blocked = await limited(request);
  if (blocked) return blocked;
  const cfg = await effectiveMetaConfig();
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256") ?? undefined, cfg.app_secret)) {
    logger.warn("Meta webhook rejected: bad signature");
    return new Response("Invalid signature", { status: 403 });
  }
  try {
    await handleMetaWebhookJson(raw, cfg);
  } catch (err) {
    logger.error({ err }, "Meta webhook handler error");
  }
  return new Response(null, { status: 200 });
}

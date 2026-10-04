import { NextResponse } from "next/server";
import { observeLandfallOperation } from "@/landfall/operational-observability";
import { GET as authorizedChart } from "../route";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { LandfallNearbyPairBroker, nearbyPairRequestSchema } from "@/landfall/nearby-pairing-server";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
// Explicit deployment opt-in: a restarted or differently routed instance loses
// its ephemeral exchange and fails closed. No private pairing state is persisted.
const broker = new LandfallNearbyPairBroker();
async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  const chunks: Uint8Array[] = [];
  let length = 0;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    void reader.cancel().catch(() => undefined);
  };
  const timer = setTimeout(cancel, 3000);
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    for (;;) {
      const value = await reader.read();
      if (value.done) break;
      length += value.value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value.value);
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  if (cancelled) throw new Error("INVALID_BODY");
  const bytes = Buffer.concat(chunks);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Every exchange reauthorizes the current released physical objective. */
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  return observeLandfallOperation("NEARBY_PAIRING", () => performPost(request, context));
}
async function performPost(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
    if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "Player session expired." }, { status: 403, headers });
    if (!consumeRateLimit(`landfall-nearby:${identity.playerProfileId}`, { limit: 30, windowMs: 60000 }).allowed)
      return NextResponse.json(
        { error: "Wait before preparing another companion exchange." },
        { status: 429, headers },
      );
    const authorized = await authorizedChart(request, context);
    if (!authorized.ok) return authorized;
    const body = (await authorized.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    const bootstrap = body.bootstrap,
      world = bootstrap?.runtimeDefinition.worldspaces[0];
    if (
      !body.available ||
      !bootstrap ||
      bootstrap.paused ||
      bootstrap.replayOnly ||
      world?.kind !== "PHYSICAL" ||
      !bootstrap.activeWaypointId
    )
      return NextResponse.json({ error: "Open the current released physical objective." }, { status: 409, headers });
    if (process.env.LANDFALL_NEARBY_PAIRING_MODE !== "ephemeral-instance")
      return NextResponse.json({ available: false, reason: "PAIRING_NOT_CONFIGURED" }, { status: 503, headers });
    const { playthroughId } = await context.params;
    if (bootstrap.sessionId !== playthroughId)
      return NextResponse.json({ error: "Refresh the current Voyage." }, { status: 409, headers });
    const scope = {
      playerProfileId: identity.playerProfileId,
      sessionId: playthroughId,
      publishedVersionId: bootstrap.publishedVersionId,
      worldspaceId: world.id,
      waypointId: bootstrap.activeWaypointId,
      expectedSequence: bootstrap.currentSequence,
    };
    let input;
    try {
      input = nearbyPairRequestSchema.parse(await readBoundedBody(request));
    } catch (error) {
      return NextResponse.json(
        { error: "Companion request is invalid." },
        { status: error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400, headers },
      );
    }
    try {
      const response =
        input.operation === "STATUS"
          ? { state: "CONFIGURED", peerVerified: false, canComplete: false }
          : input.operation === "CREATE"
            ? broker.create(scope, input.offer)
            : input.operation === "JOIN"
              ? broker.join(scope, input.code, input.offer)
              : input.operation === "READ"
                ? broker.read(scope, input.handle)
                : broker.stop(scope, input.handle);
      return NextResponse.json({ available: true, ...response }, { headers });
    } catch {
      return NextResponse.json(
        { error: "The exchange expired or the current Voyage changed. Prepare both devices again." },
        { status: 409, headers },
      );
    }
  } catch {
    return NextResponse.json({ available: false, reason: "PAIRING_UNAVAILABLE" }, { status: 503, headers });
  }
}

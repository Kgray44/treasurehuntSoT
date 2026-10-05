import { NextResponse } from "next/server";
import { observeLandfallOperation } from "@/landfall/operational-observability";
import { z } from "zod";
import { GET as authorizedChart } from "../route";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLandfallBoundedJson } from "@/landfall/bounded-request-body";
import { deployedLandfallInstallationSigner as signer } from "@/landfall/installation-token-server";
import { readInstallationEnvelope } from "@/landfall/installation-token";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const command = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("STATUS") }),
  z.strictObject({
    operation: z.literal("VERIFY"),
    medium: z.enum(["QR", "NFC"]),
    token: z.string().min(32).max(2048),
  }),
]);
function objective(value: PlayerLandfallBootstrap | undefined) {
  const world = value?.runtimeDefinition.worldspaces[0];
  const waypoint = value?.runtimeDefinition.waypoints.find((item) => item.id === value.activeWaypointId);
  return value &&
    !value.paused &&
    !value.replayOnly &&
    world?.kind === "PHYSICAL" &&
    waypoint?.worldspaceId === world.id
    ? { world, waypoint }
    : null;
}
/** Authentication of an optional installation only. No scan writes progression, location or raw telemetry. */
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  return observeLandfallOperation("INSTALLATION", () => performPost(request, context));
}
async function performPost(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 401, headers });
    if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 403, headers });
    if (!consumeRateLimit(`landfall-interaction:${identity.playerProfileId}`, { limit: 20, windowMs: 60000 }).allowed)
      return NextResponse.json({ state: "RATE_LIMITED", canComplete: false }, { status: 429, headers });
    const chart = await authorizedChart(request, context);
    if (!chart.ok) return chart;
    const data = (await chart.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    const current = objective(data.bootstrap);
    const { playthroughId } = await context.params;
    if (!data.available || !current || data.bootstrap?.sessionId !== playthroughId)
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    let input;
    try {
      input = command.parse(await readLandfallBoundedJson(request));
    } catch {
      return NextResponse.json({ state: "INVALID", canComplete: false }, { status: 400, headers });
    }
    const trust = signer.status();
    if (trust.state === "NOT_CONFIGURED") return NextResponse.json(trust, { headers });
    const pinned = await loadPinnedLandfallDefinition(playthroughId);
    if (
      !pinned ||
      pinned.publishedVersionId !== data.bootstrap.publishedVersionId ||
      pinned.currentSequence !== data.bootstrap.currentSequence
    )
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    const scope = {
      taleId: pinned.taleId,
      publishedVersionId: pinned.publishedVersionId,
      worldspaceId: current.world.id,
      waypointId: current.waypoint.id,
    };
    if (input.operation === "STATUS")
      return NextResponse.json({ ...trust, scope, installations: current.waypoint.installations ?? [] }, { headers });
    let verified;
    try {
      const envelope = readInstallationEnvelope(input.token);
      const installation = current.waypoint.installations?.find(
        (item) => item.id === envelope.claim.id && item.medium === input.medium,
      );
      if (!installation) throw new Error();
      verified = signer.verify(input.token, { ...scope, id: installation.id, medium: input.medium });
    } catch {
      return NextResponse.json({ state: "INVALID", canComplete: false }, { status: 400, headers });
    }
    const refreshed = await authorizedChart(request, context);
    if (!refreshed.ok) return refreshed;
    const fresh = (await refreshed.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    const next = objective(fresh.bootstrap);
    if (
      !fresh.available ||
      !next ||
      fresh.bootstrap?.sessionId !== playthroughId ||
      fresh.bootstrap.publishedVersionId !== pinned.publishedVersionId ||
      fresh.bootstrap.currentSequence !== pinned.currentSequence ||
      next.world.id !== scope.worldspaceId ||
      next.waypoint.id !== scope.waypointId
    )
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    return NextResponse.json(
      {
        state: "VERIFIED",
        installationId: verified.id,
        medium: verified.medium,
        expiresAt: verified.expiresAt,
        physicalPresence: "NOT_PROVEN",
        canComplete: false,
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 503, headers });
  }
}

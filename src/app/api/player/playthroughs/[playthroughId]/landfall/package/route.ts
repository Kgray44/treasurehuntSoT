import { NextResponse } from "next/server";
import { GET as authorizedChart } from "../route";
import { requirePlayerIdentity } from "@/platform/auth";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { buildLandfallOfflinePackage, landfallPackageSigningKey } from "@/landfall/offline-package-server";
import { resolveAssetVariant } from "@/chronicle/assets";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
    const chartResponse = await authorizedChart(request, context);
    if (!chartResponse.ok) return chartResponse;
    const chart = (await chartResponse.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    if (!chart.available || !chart.bootstrap) return NextResponse.json({ available: false }, { headers });
    const { playthroughId } = await context.params;
    const rate = consumeRateLimit(`landfall-package:${identity.playerProfileId}:${playthroughId}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Wait before requesting another package." },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(rate) } },
      );
    const signing = landfallPackageSigningKey();
    if (!signing) return NextResponse.json({ available: false, reason: "SIGNING_NOT_CONFIGURED" }, { headers });
    const pinned = await loadPinnedLandfallDefinition(playthroughId);
    const bootstrap = chart.bootstrap;
    if (
      !pinned ||
      pinned.publishedVersionId !== bootstrap.publishedVersionId ||
      pinned.currentSequence !== bootstrap.currentSequence
    )
      return NextResponse.json({ error: "Voyage changed. Refresh the Chart." }, { status: 409, headers });
    const url = new URL(request.url);
    const now = Date.now();
    const issuedAt = url.searchParams.has("issuedAt")
      ? Number(url.searchParams.get("issuedAt"))
      : Math.floor(now / 600_000) * 600_000;
    const ttl = pinned.definition.providerPlan?.offline.requested
      ? Math.min(24, pinned.definition.providerPlan.offline.retentionHours) * 3600_000
      : 1800_000;
    const expiresAt = Math.min(issuedAt + ttl, identity.expiresAt.getTime());
    if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now >= expiresAt)
      return NextResponse.json({ error: "Package authorization expired." }, { status: 409, headers });
    const scenes = [bootstrap.scene, ...(bootstrap.availableMaps ?? []).map((map) => map.scene)];
    const assetIds = [
      ...new Set(
        scenes
          .flatMap((scene) => [scene.imageAssetId, ...scene.overlays.map((overlay) => overlay.assetId)])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    // Explicit Creator selection declares permission to retain these first-party assets.
    // No public tile endpoint, remote URL, or hidden future asset is fetched here.
    const allowedAssets = new Set(
      pinned.definition.providerPlan?.offline.requested ? pinned.definition.providerPlan.offline.assetIds : [],
    );
    const assets: {
      id: string;
      bytes: Uint8Array;
      mime: "image/png" | "image/jpeg" | "image/webp";
      attribution: string;
    }[] = [];
    const missingAssets: string[] = [];
    for (const id of assetIds.slice(0, 24)) {
      if (!allowedAssets.has(id)) {
        missingAssets.push(id);
        continue;
      }
      try {
        const { variant, buffer } = await resolveAssetVariant(id, "OPTIMIZED", pinned.publishedVersionId);
        if (!["image/png", "image/jpeg", "image/webp"].includes(variant.mimeType) || buffer.length > 1024 * 1024) {
          missingAssets.push(id);
          continue;
        }
        assets.push({
          id,
          bytes: new Uint8Array(buffer),
          mime: variant.mimeType as (typeof assets)[number]["mime"],
          attribution: scenes
            .flatMap((scene) => scene.attribution)
            .map((item) => item.label)
            .join("; "),
        });
      } catch {
        missingAssets.push(id);
      }
    }
    missingAssets.push(...assetIds.slice(24));
    const scope = {
      playerProfileId: identity.playerProfileId,
      sessionId: playthroughId,
      taleId: pinned.taleId,
      publishedVersionId: pinned.publishedVersionId,
      worldspaceId: bootstrap.runtimeDefinition.worldspaces[0].id,
    };
    const material = buildLandfallOfflinePackage({
      bootstrap,
      scope,
      signing,
      issuedAt,
      expiresAt,
      maxBytes: pinned.definition.providerPlan?.offline.maxBytes,
      assets,
    });
    const resourceId = url.searchParams.get("resource");
    if (resourceId) {
      if (url.searchParams.get("package") !== material.envelope.manifest.id)
        return NextResponse.json({ error: "Package changed." }, { status: 409, headers });
      const bytes = material.chunks.get(resourceId);
      const resource = material.envelope.manifest.resources.find((item) => item.id === resourceId);
      if (!bytes || !resource) return NextResponse.json({ error: "Resource not found." }, { status: 404, headers });
      return new Response(bytes as BodyInit, {
        headers: { ...headers, "Content-Type": resource.mime, "Content-Length": String(bytes.length) },
      });
    }
    return NextResponse.json(
      {
        available: true,
        envelope: material.envelope,
        verificationKey: { id: signing.id, jwk: signing.publicKey },
        availability: {
          chart: "READY",
          routes: "READY",
          assets: missingAssets.length ? "PARTIAL" : "READY",
          externalTiles: "ONLINE_REQUIRED",
          missingAssets,
        },
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ error: "Offline region is unavailable." }, { status: 503, headers });
  }
}

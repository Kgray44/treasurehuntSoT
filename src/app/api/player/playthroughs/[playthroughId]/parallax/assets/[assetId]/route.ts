import { NextResponse } from "next/server";
import { requirePlayerIdentity, playerCanAccessPlaythrough } from "@/platform/auth";
import { loadReleasedSpatialAsset } from "@/parallax/asset-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ playthroughId: string; assetId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
    const { playthroughId, assetId } = await context.params;
    if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId))) throw new Error("unavailable");
    const url = new URL(request.url);
    const asset = await loadReleasedSpatialAsset({
      playthroughId,
      playerProfileId: identity.playerProfileId,
      assetId,
      blockId: url.searchParams.get("block"),
      versionChecksum: url.searchParams.get("versionChecksum"),
    });
    // Recheck current membership after disk loading; a cached model is never a grant.
    if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId))) throw new Error("unavailable");
    return new Response(asset.bytes, {
      headers: {
        ...headers,
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(asset.byteLength),
        "X-Parallax-Asset-SHA256": asset.sha256,
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404, headers });
  }
}

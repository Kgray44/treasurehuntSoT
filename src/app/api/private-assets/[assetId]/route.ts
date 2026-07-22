import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { privateContentAuthorization } from "@/private-content/authorization";
import { parsePrivateByteRange, PrivateAssetDeliveryService } from "@/private-content/delivery-phase2";
import { LegacyPrivateAssetDeliveryStorageProvider } from "@/private-content/storage";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const assetId = (await context.params).assetId;
    const playthroughId = new URL(request.url).searchParams.get("playthrough");
    // Authenticate before issuing a range-specific response, so a guessed asset
    // remains indistinguishable from an unavailable one.
    if (!(await privateContentAuthorization.canReadPrivateAsset({ assetId, playthroughId }))) throw new Error("opaque");
    const reference = await db.privateAssetReference.findFirst({
      where: { id: assetId, available: true },
      include: { object: true },
    });
    if (!reference) throw new Error("opaque");
    try {
      parsePrivateByteRange(request.headers.get("range") ?? undefined, reference.object.byteLength);
    } catch {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${reference.object.byteLength}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const delivery = await new PrivateAssetDeliveryService(
      new LegacyPrivateAssetDeliveryStorageProvider(),
      privateContentAuthorization,
    ).open({
      asset: {
        id: reference.id,
        object: {
          key: reference.object.storageKey,
          sha256: reference.object.sha256,
          byteLength: reference.object.byteLength,
        },
        scanState: (reference.object as unknown as { scanStatus: "CLEAN" }).scanStatus,
        mediaType: reference.object.mediaType,
      },
      playthroughId,
      range: request.headers.get("range") ?? undefined,
    });
    return new Response(Readable.toWeb(delivery.stream) as ReadableStream, {
      status: delivery.status,
      headers: delivery.headers,
    });
  } catch {
    // The same answer for guessed IDs, cross-account reads, revoked access,
    // quarantined assets, unavailable storage, and missing objects.
    return NextResponse.json(
      { error: "Asset not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

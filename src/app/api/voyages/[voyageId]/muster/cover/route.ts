import { resolveAssetVariant } from "@/chronicle/assets";
import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { loadMusterAccess } from "@/muster/service";
import { musterIdentity, musterError } from "@/muster/http";
export async function GET(_: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor } = await musterIdentity();
    const { voyage } = await loadMusterAccess((await context.params).voyageId, actor, db, true);
    const assetId =
      voyage.tale.coverAssetId ??
      (voyage.version ? parsePublishedSnapshot(voyage.version.contentSnapshot).tale.coverAssetId : null);
    if (!assetId) return new Response(null, { status: 404 });
    const asset = await db.taleAsset.findFirst({
      where: { id: assetId, taleId: voyage.taleId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) return new Response(null, { status: 404 });
    // This endpoint exposes only this authorized Voyage's Chronicle cover, never an arbitrary story asset.
    const { variant, buffer } = await resolveAssetVariant(assetId, "PREVIEW");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": variant.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    return musterError(cause);
  }
}

import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { resolveAssetVariant } from "@/tall-tale/assets";
import { db } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const url = new URL(request.url);
    const version = url.searchParams.get("version") ?? undefined;
    const assetId = (await context.params).assetId;
    if ((!version || version.startsWith("draft:")) && !(await requireGmCapability("CREATE_TALES")))
      return NextResponse.json({ error: "This draft asset is private." }, { status: 403 });
    const { variant, buffer } = await resolveAssetVariant(
      assetId,
      (url.searchParams.get("variant") ?? "OPTIMIZED").toUpperCase(),
      version,
    );
    const download = url.searchParams.get("download") === "1";
    const asset = download
      ? await db.taleAsset.findUnique({ where: { id: assetId }, select: { originalFilename: true } })
      : null;
    const safeFilename = asset?.originalFilename.replace(/[\r\n"\\/]/g, "_") ?? "tall-tale-asset";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": variant.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control":
          version && !version.startsWith("draft:") ? "public, max-age=31536000, immutable" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(download ? { "Content-Disposition": `attachment; filename="${safeFilename}"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}

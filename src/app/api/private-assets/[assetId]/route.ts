import { NextResponse } from "next/server";
import { privateContentAuthorization } from "@/private-content/authorization";
import { LocalPrivateAssetStore } from "@/private-content/storage";
import { db } from "@/lib/db";

function rangeFor(header: string | null, length: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[2] ? Number(match[2]) : length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= length) return false;
  return { start, end: Math.min(end, length - 1) };
}

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const assetId = (await context.params).assetId;
    const playthroughId = new URL(request.url).searchParams.get("playthrough");
    if (!(await privateContentAuthorization.canReadPrivateAsset({ assetId, playthroughId }))) throw new Error("not-found");
    const reference = await db.privateAssetReference.findFirst({ where: { id: assetId, available: true }, include: { object: true } });
    if (!reference) throw new Error("not-found");
    const source = await new LocalPrivateAssetStore().readObject(reference.object.sha256);
    const range = rangeFor(request.headers.get("range"), source.length);
    if (range === false) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${source.length}`, "Cache-Control": "private, no-store" } });
    const body = range ? source.subarray(range.start, range.end + 1) : source;
    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": reference.object.mediaType,
        "Content-Length": String(body.length),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${source.length}` } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment; filename=private-asset",
      },
    });
  } catch {
    // The same answer for a guessed ID, revoked access, and a missing object.
    return NextResponse.json({ error: "Asset not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}

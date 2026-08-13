import { NextResponse } from "next/server";
import { resolveAssetVariant } from "@/chronicle/assets";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { ownedHistoricalCover } from "@/wakebook/archive-query";

export async function GET(_: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    const record = await ownedHistoricalCover(session.account.profile.id, (await context.params).recordId);
    if (!record?.chronicleCoverSnapshot)
      return NextResponse.json({ error: "Historical cover not found." }, { status: 404 });
    const { variant, buffer } = await resolveAssetVariant(
      record.chronicleCoverSnapshot,
      "PREVIEW",
      record.publishedVersionId,
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": variant.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Historical cover not found." }, { status: 404 });
  }
}

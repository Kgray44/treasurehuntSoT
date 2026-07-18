import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { resolveAssetVariant } from "@/tall-tale/assets";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer, pendingInvitationMatches } from "@/platform/auth";
import { playerSafeAssetIds } from "@/platform/libraries";
import { parsePublishedSnapshot } from "@/tall-tale/publishing";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const url = new URL(request.url);
    const version = url.searchParams.get("version") ?? undefined;
    const assetId = (await context.params).assetId;
    const download = url.searchParams.get("download") === "1";
    const creator = await requireGmCapability(download ? "MANAGE_ASSETS" : "CREATE_TALES");
    if (!version || version.startsWith("draft:")) {
      if (!creator) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    } else if (!creator) {
      let authorized = false;
      const sessionId = url.searchParams.get("session");
      const invitationId = url.searchParams.get("invitation");
      if (sessionId && (await authorizeTaleSessionPlayer(sessionId))) {
        const playthrough = await db.taleSession.findFirst({
          where: { id: sessionId, publishedVersionId: version },
          include: { version: true, events: { select: { blockId: true } } },
        });
        if (playthrough?.version)
          authorized = playerSafeAssetIds(
            playthrough.version.contentSnapshot,
            playthrough.events.map((event) => event.blockId),
            playthrough.inventory,
          ).has(assetId);
      } else if (invitationId && (await pendingInvitationMatches(invitationId))) {
        const invitation = await db.invitation.findFirst({
          where: { id: invitationId, playthrough: { publishedVersionId: version } },
          include: { playthrough: { include: { version: true } } },
        });
        if (invitation?.playthrough.version) {
          const snapshot = parsePublishedSnapshot(invitation.playthrough.version.contentSnapshot);
          authorized = snapshot.tale.coverAssetId === assetId;
        }
      } else if (url.searchParams.get("public") === "cover") {
        authorized = Boolean(
          await db.tallTale.findFirst({
            where: {
              coverAssetId: assetId,
              status: "PUBLISHED",
              visibility: "PUBLIC",
              latestPublishedVersionId: version,
              archivedAt: null,
            },
            select: { id: true },
          }),
        );
      }
      if (!authorized) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }
    const { variant, buffer } = await resolveAssetVariant(
      assetId,
      (url.searchParams.get("variant") ?? "OPTIMIZED").toUpperCase(),
      version,
    );
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

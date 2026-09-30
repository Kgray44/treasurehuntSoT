import { NextResponse } from "next/server";
import { getTaleSessionState } from "@/chronicle/progression";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { requirePlayerIdentity, playerCanAccessPlaythrough } from "@/platform/auth";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity)
      return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers: privateHeaders });
    const { playthroughId } = await context.params;
    if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
      return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers: privateHeaders });
    const state = await getTaleSessionState(playthroughId, undefined, false, true);
    if (state.session.status !== "ACTIVE")
      return NextResponse.json({ available: false }, { headers: privateHeaders });
    const pinned = await loadPinnedLandfallDefinition(playthroughId);
    if (!pinned)
      return NextResponse.json({ available: false }, { headers: privateHeaders });
    if (pinned.publishedVersionId !== state.session.versionId)
      return NextResponse.json({ error: "Pinned version changed." }, { status: 409, headers: privateHeaders });
    return NextResponse.json(
      {
        available: true,
        bootstrap: projectPlayerLandfallBootstrap(pinned, {
          chapterId: state.chapter?.id ?? null,
          blockId: state.block?.id ?? null,
          releasedAssets: state.assets,
        }),
      },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json({ error: "Voyage Chart is unavailable." }, { status: 503, headers: privateHeaders });
  }
}

import { NextResponse } from "next/server";
import { gmCan, requireGm } from "@/lib/security";
import { requirePlayerIdentity } from "@/platform/auth";
import { listPlayerLibrary } from "@/platform/libraries";
import { db } from "@/lib/db";

export async function GET() {
  const [playerSession, staffSession] = await Promise.all([requirePlayerIdentity(), requireGm()]);
  const player = playerSession ? await listPlayerLibrary(playerSession.playerProfileId) : null;
  const captain = staffSession && gmCan(staffSession.user, "CAPTAIN");
  const creator = staffSession && gmCan(staffSession.user, "CREATE_TALES");
  const [waitingPlayers, recentDraft] = await Promise.all([
    captain
      ? db.playthroughMembership.count({
          where: {
            status: "READY",
            playthrough: { previewMode: false, OR: [{ captainId: staffSession.userId }, { captainId: null }] },
          },
        })
      : 0,
    creator
      ? db.tallTale.findFirst({
          where: { creatorId: staffSession.userId, archivedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true },
        })
      : null,
  ]);
  const activePlayerCards = player ? [...player.groups.inProgress, ...player.groups.awaitingCaptain] : [];
  return NextResponse.json({
    player: playerSession
      ? {
          authenticated: true,
          displayName: playerSession.player.displayName,
          activeCount: activePlayerCards.length,
          continue:
            activePlayerCards.length === 1
              ? { label: `Continue ${activePlayerCards[0].title}`, href: activePlayerCards[0].primaryHref }
              : { label: "Open My Voyages", href: "/player/library" },
        }
      : { authenticated: false },
    captain: captain
      ? {
          authenticated: true,
          waitingPlayers,
          continue: { label: "Return to Captain's Console", href: "/captain/library" },
        }
      : { authenticated: false },
    creator: creator
      ? {
          authenticated: true,
          recentDraft,
          continue: recentDraft
            ? { label: `Continue Editing ${recentDraft.title}`, href: `/studio/tales/${recentDraft.id}` }
            : { label: "Open Chronicle Library", href: "/studio/library" },
        }
      : { authenticated: false },
  });
}

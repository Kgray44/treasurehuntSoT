import { NextResponse } from "next/server";
import { resolveCurrentUser } from "@/homeport/current-user.server";
import { listPlayerLibrary } from "@/platform/libraries";
import { db } from "@/lib/db";

export async function GET() {
  const context = await resolveCurrentUser({ rotateCompatibility: true });
  if (context.status === "unavailable")
    return NextResponse.json(
      { error: "Account context is temporarily unavailable.", correlationId: context.correlationId },
      { status: 503, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } },
    );
  const authenticated = context.status === "authenticated";
  const player =
    authenticated && context.capabilities.canUsePlayer && context.user.profileId
      ? await listPlayerLibrary(context.user.profileId)
      : null;
  const captain = authenticated && context.capabilities.canUseCaptain;
  const creator = authenticated && context.capabilities.canUseCreator;
  const staffActor =
    authenticated && (captain || creator)
      ? await db.userAccount.findUnique({
          where: { id: context.user.accountId },
          select: { legacyGameMasterId: true },
        })
      : null;
  const staffActorId = staffActor?.legacyGameMasterId ?? (authenticated ? context.user.accountId : "");
  const [waitingPlayers, recentDraft] = await Promise.all([
    captain
      ? db.playthroughMembership.count({
          where: {
            status: "READY",
            playthrough: { previewMode: false, OR: [{ captainId: staffActorId }, { captainId: null }] },
          },
        })
      : 0,
    creator
      ? db.chronicle.findFirst({
          where: { creatorId: staffActorId, archivedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true },
        })
      : null,
  ]);
  const activePlayerCards = player ? [...player.groups.inProgress, ...player.groups.awaitingCaptain] : [];
  return NextResponse.json(
    {
      player: player
        ? {
            authenticated: true,
            displayName: context.status === "authenticated" ? context.user.displayName : "Player",
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
    },
    { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } },
  );
}

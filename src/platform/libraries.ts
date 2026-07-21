import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { parseJsonArray, type JsonObject, type PublishedBlock } from "@/chronicle/types";
import {
  emptyJournalReadingState,
  sanitizePlayerObject,
  type PlayerJournalReadingState,
  type PlayerJournalReadingStateInput,
} from "@/chronicle/journal-contract";

const pendingInvitationStates = ["CREATED", "SENT", "COPIED", "VIEWED"];
const validMembershipStates = ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"];
const libraryMembershipStates = [...validMembershipStates, "DECLINED", "REMOVED", "SUSPENDED"];

function safeObject(value: JsonObject) {
  return sanitizePlayerObject(value);
}

function safeBlock(block: PublishedBlock) {
  return {
    id: block.id,
    blockType: block.blockType,
    title: block.title,
    configuration: safeObject(block.configuration),
    presentation: safeObject(block.presentation ?? {}),
  };
}

function stringValues(value: unknown, output = new Set<string>()) {
  if (typeof value === "string") output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => stringValues(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => stringValues(item, output));
  return output;
}

type PlayerMembership = Awaited<ReturnType<typeof loadPlayerMemberships>>[number];

async function loadPlayerMemberships(playerId: string) {
  return db.playthroughMembership.findMany({
    where: { playerProfileId: playerId, status: { in: libraryMembershipStates } },
    orderBy: { updatedAt: "desc" },
    include: {
      player: true,
      playthrough: {
        include: {
          tale: true,
          version: true,
          invitations: { orderBy: { createdAt: "desc" }, include: { replacement: { select: { id: true } } } },
          events: { orderBy: { sequence: "asc" } },
          revealStates: { orderBy: { revealedAt: "asc" } },
          memberships: { include: { player: { select: { id: true, displayName: true } } } },
        },
      },
    },
  });
}

function invitationFor(membership: PlayerMembership) {
  return membership.playthrough.invitations.find(
    (invitation) => invitation.intendedPlayerId === membership.playerProfileId && !invitation.replacement,
  );
}

function libraryState(membership: PlayerMembership) {
  const invitation = invitationFor(membership);
  if (membership.status === "INVITED" && invitation && pendingInvitationStates.includes(invitation.status))
    return "INVITATIONS";
  if (["EXPIRED", "REVOKED", "REPLACED", "DECLINED"].includes(invitation?.status ?? "")) return "EXPIRED_REVOKED";
  if (["INVITING", "READY", "SCHEDULED", "DRAFT_SETUP"].includes(membership.playthrough.status))
    return "AWAITING_CAPTAIN";
  if (["ACTIVE", "PAUSED"].includes(membership.playthrough.status)) return "IN_PROGRESS";
  if (membership.playthrough.status === "COMPLETED") return "COMPLETED";
  return "EXPIRED_REVOKED";
}

function cardOf(membership: PlayerMembership, captainName?: string) {
  const playthrough = membership.playthrough;
  if (!playthrough.version) return null;
  const snapshot = parsePublishedSnapshot(playthrough.version.contentSnapshot);
  const invitation = invitationFor(membership);
  const visitedBlockIds = new Set(playthrough.events.map((event) => event.blockId).filter(Boolean));
  if (playthrough.currentBlockId) visitedBlockIds.add(playthrough.currentBlockId);
  const revealedChapters = snapshot.chapters.filter((chapter) =>
    chapter.blocks.some((block) => visitedBlockIds.has(block.id)),
  );
  const currentChapter = snapshot.chapters.find((chapter) => chapter.id === playthrough.currentChapterId);
  const state = libraryState(membership);
  return {
    id: playthrough.id,
    taleId: playthrough.taleId,
    taleSlug: snapshot.tale.slug,
    title: snapshot.tale.title,
    subtitle: snapshot.tale.subtitle,
    shortDescription: snapshot.tale.shortDescription,
    coverUrl: snapshot.tale.coverAssetId
      ? `/api/media/${snapshot.tale.coverAssetId}?variant=PREVIEW&version=${encodeURIComponent(
          playthrough.publishedVersionId ?? "",
        )}&session=${encodeURIComponent(playthrough.id)}`
      : null,
    captainName: captainName ?? "Captain",
    voyageName: playthrough.voyageName ?? playthrough.ownerLabel ?? "Voyage",
    state,
    status: invitation && state === "INVITATIONS" ? invitation.status : playthrough.status,
    membershipStatus: membership.status,
    pinned: Boolean(membership.pinnedAt),
    versionLabel: playthrough.version.versionLabel,
    publishedAt: playthrough.version.publishedAt.toISOString(),
    invitedAt: invitation?.createdAt.toISOString() ?? null,
    invitationExpiresAt: invitation?.expiresAt.toISOString() ?? null,
    plannedStartAt: playthrough.plannedStartAt?.toISOString() ?? null,
    currentChapterTitle: currentChapter?.title ?? null,
    revealedChapterCount: revealedChapters.length,
    completionDate: playthrough.completedAt?.toISOString() ?? null,
    memoriesCollected: playthrough.revealStates.length + parseJsonArray<string>(playthrough.inventory).length,
    lastSynchronizedAt: playthrough.updatedAt.toISOString(),
    paused: playthrough.status === "PAUSED",
    primaryHref:
      state === "COMPLETED"
        ? `/player/playthroughs/${playthrough.id}/journal`
        : state === "IN_PROGRESS"
          ? `/player/playthroughs/${playthrough.id}/journal`
          : `/player/playthroughs/${playthrough.id}`,
    primaryLabel:
      state === "INVITATIONS"
        ? "View invitation"
        : state === "AWAITING_CAPTAIN"
          ? "Open waiting room"
          : state === "IN_PROGRESS"
            ? playthrough.status === "PAUSED"
              ? "Resume Adventure"
              : "Continue Adventure"
            : state === "COMPLETED"
              ? "Open Completed Journal"
              : "View status",
  };
}

export async function listPlayerLibrary(
  playerId: string,
  options: { search?: string; state?: string; sort?: string } = {},
) {
  const memberships = await loadPlayerMemberships(playerId);
  const captainIds = [...new Set(memberships.map((item) => item.playthrough.captainId).filter(Boolean) as string[])];
  const captains = captainIds.length
    ? await db.gameMasterUser.findMany({ where: { id: { in: captainIds } }, select: { id: true, username: true } })
    : [];
  const names = new Map(captains.map((captain) => [captain.id, captain.username]));
  let cards = memberships
    .filter((membership) => !membership.hiddenAt)
    .map((membership) => cardOf(membership, names.get(membership.playthrough.captainId ?? "")))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  const search = options.search?.trim().toLocaleLowerCase();
  if (search)
    cards = cards.filter((card) =>
      [card.title, card.captainName, card.voyageName, card.completionDate?.slice(0, 4)]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(search)),
    );
  if (options.state && options.state !== "ALL") cards = cards.filter((card) => card.state === options.state);
  if (options.sort === "TITLE") cards.sort((a, b) => a.title.localeCompare(b.title));
  else if (options.sort === "COMPLETED")
    cards.sort((a, b) => (b.completionDate ?? "").localeCompare(a.completionDate ?? ""));
  cards.sort((left, right) => Number(right.pinned) - Number(left.pinned));
  const groups = {
    invitations: cards.filter((card) => card.state === "INVITATIONS"),
    awaitingCaptain: cards.filter((card) => card.state === "AWAITING_CAPTAIN"),
    inProgress: cards.filter((card) => card.state === "IN_PROGRESS"),
    completed: cards.filter((card) => card.state === "COMPLETED"),
    replayOrNewEdition: cards.filter((card) => card.state === "REPLAY_NEW_EDITION"),
    expiredOrRevoked: cards.filter((card) => card.state === "EXPIRED_REVOKED"),
  };
  return {
    player: memberships[0]
      ? { id: memberships[0].player.id, displayName: memberships[0].player.displayName }
      : await db.playerProfile.findUniqueOrThrow({ where: { id: playerId }, select: { id: true, displayName: true } }),
    groups,
    total: cards.length,
    serverTime: new Date().toISOString(),
  };
}

export async function updatePlayerPlaythroughPreference(
  playerId: string,
  playthroughId: string,
  action: "pin" | "unpin" | "hide" | "show",
) {
  const membership = await db.playthroughMembership.findFirst({
    where: { playerProfileId: playerId, playthroughId },
    include: { playthrough: true },
  });
  if (!membership) throw new Error("Voyage membership not found.");
  if (action === "hide" && !["COMPLETED", "CANCELLED", "ABANDONED"].includes(membership.playthrough.status)) {
    const invitation = await db.invitation.findFirst({
      where: { playthroughId, intendedPlayerId: playerId },
      orderBy: { createdAt: "desc" },
    });
    if (!invitation || !["DECLINED", "EXPIRED", "REVOKED", "REPLACED"].includes(invitation.status))
      throw new Error("Only completed voyages and closed invitations can be hidden.");
  }
  await db.playthroughMembership.update({
    where: { id: membership.id },
    data:
      action === "pin"
        ? { pinnedAt: new Date() }
        : action === "unpin"
          ? { pinnedAt: null }
          : action === "hide"
            ? { hiddenAt: new Date() }
            : { hiddenAt: null },
  });
  return { ok: true, action };
}

export async function getPlayerPlaythrough(playerId: string, playthroughId: string) {
  const membership = (await loadPlayerMemberships(playerId)).find((item) => item.playthroughId === playthroughId);
  if (!membership) return null;
  const card = cardOf(membership);
  if (!card) return null;
  const playthrough = membership.playthrough;
  return {
    ...card,
    crew: playthrough.memberships
      .filter((item) => validMembershipStates.includes(item.status))
      .map((item) => ({ displayName: item.player.displayName, crewRole: item.crewRole, status: item.status })),
    connection: { state: "POLLING", lastServerConfirmation: playthrough.updatedAt.toISOString() },
    canEnter: ["ACTIVE", "PAUSED"].includes(playthrough.status),
    runtimeHref: ["ACTIVE", "PAUSED"].includes(playthrough.status)
      ? `/player/playthroughs/${playthrough.id}/journal`
      : null,
  };
}

export async function getPlayerArchive(playerId: string, playthroughId: string) {
  const membership = (await loadPlayerMemberships(playerId)).find((item) => item.playthroughId === playthroughId);
  const version = membership?.playthrough.version;
  if (!membership || membership.playthrough.status !== "COMPLETED" || !version) return null;
  const playthrough = membership.playthrough;
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  const visited = new Set(playthrough.events.map((event) => event.blockId).filter(Boolean) as string[]);
  const chapters = snapshot.chapters
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      blocks: chapter.blocks.filter((block) => visited.has(block.id)).map(safeBlock),
    }))
    .filter((chapter) => chapter.blocks.length);
  const assetIds = new Set<string>([
    ...parseJsonArray<string>(playthrough.inventory),
    ...playthrough.revealStates.filter((state) => state.contentType === "ASSET").map((state) => state.contentKey),
  ]);
  chapters.forEach((chapter) => chapter.blocks.forEach((block) => stringValues(block.configuration, assetIds)));
  const assets = snapshot.assets
    .filter((asset) => assetIds.has(asset.id))
    .map((asset) => ({
      id: asset.id,
      displayName: asset.displayName,
      description: asset.description,
      mediaType: asset.mediaType,
      url: `/api/media/${asset.id}?variant=OPTIMIZED&version=${encodeURIComponent(
        playthrough.publishedVersionId ?? "",
      )}&session=${encodeURIComponent(playthrough.id)}`,
    }));
  return {
    playthrough: {
      id: playthrough.id,
      versionId: version.id,
      voyageName: playthrough.voyageName ?? playthrough.ownerLabel ?? "Completed voyage",
      completedAt: playthrough.completedAt?.toISOString() ?? playthrough.updatedAt.toISOString(),
      versionLabel: version.versionLabel,
      versionPublishedAt: version.publishedAt.toISOString(),
      checksum: version.checksum,
    },
    tale: {
      title: snapshot.tale.title,
      subtitle: snapshot.tale.subtitle,
      shortDescription: snapshot.tale.shortDescription,
    },
    chapters,
    assets,
    inventory: parseJsonArray<string>(playthrough.inventory),
    memories: playthrough.revealStates.map((state) => ({
      type: state.contentType,
      key: state.contentKey,
      revealedAt: state.revealedAt.toISOString(),
    })),
    timeline: playthrough.events.map((event) => ({
      sequence: event.sequence,
      type: event.eventType,
      at: event.createdAt.toISOString(),
    })),
  };
}

type StoredPlayerPreferences = {
  journals?: Record<string, Partial<PlayerJournalReadingState>>;
  [key: string]: unknown;
};

function playerPreferences(value: string): StoredPlayerPreferences {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function getPlayerJournalReadingState(playerId: string, playthroughId: string) {
  const membership = await db.playthroughMembership.findFirst({
    where: { playerProfileId: playerId, playthroughId, status: { in: validMembershipStates } },
    include: { player: { select: { preferences: true } } },
  });
  if (!membership) return null;
  const stored = playerPreferences(membership.player.preferences).journals?.[playthroughId] ?? {};
  return {
    ...emptyJournalReadingState,
    pageId: typeof stored.pageId === "string" ? stored.pageId : null,
    openDrawer: ["chapters", "map", "artifacts", "messages"].includes(stored.openDrawer ?? "")
      ? stored.openDrawer!
      : null,
    hasOpened: Boolean(stored.hasOpened),
    lastEventSequence: Math.max(0, Number(stored.lastEventSequence ?? 0)),
    textScale: Math.min(1.5, Math.max(0.85, Number(stored.textScale ?? 1))),
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  } satisfies PlayerJournalReadingState;
}

export async function updatePlayerJournalReadingState(
  playerId: string,
  playthroughId: string,
  input: PlayerJournalReadingStateInput,
) {
  const membership = await db.playthroughMembership.findFirst({
    where: { playerProfileId: playerId, playthroughId, status: { in: validMembershipStates } },
    include: { player: { select: { preferences: true } } },
  });
  if (!membership) return null;
  const preferences = playerPreferences(membership.player.preferences);
  const current = preferences.journals?.[playthroughId] ?? {};
  const next: PlayerJournalReadingState = {
    ...emptyJournalReadingState,
    ...current,
    ...input,
    lastEventSequence: Math.max(
      Number(current.lastEventSequence ?? 0),
      Number(input.lastEventSequence ?? current.lastEventSequence ?? 0),
    ),
    updatedAt: new Date().toISOString(),
  } as PlayerJournalReadingState;
  await db.playerProfile.update({
    where: { id: playerId },
    data: {
      preferences: JSON.stringify({ ...preferences, journals: { ...preferences.journals, [playthroughId]: next } }),
    },
  });
  return next;
}

export async function listCaptainLibrary(captainId: string) {
  const sessions = await db.taleSession.findMany({
    where: { previewMode: false, OR: [{ captainId }, { captainId: null }] },
    orderBy: { updatedAt: "desc" },
    include: {
      tale: true,
      version: true,
      memberships: { include: { player: { select: { id: true, displayName: true } } } },
      invitations: {
        orderBy: { createdAt: "desc" },
        include: {
          events: { orderBy: { createdAt: "desc" }, take: 1 },
          replacement: { select: { id: true } },
        },
      },
      verificationRequests: { where: { status: "PENDING" }, take: 1 },
    },
  });
  const tales = await db.chronicle.findMany({
    where: { archivedAt: null, latestPublishedVersionId: { not: null } },
    orderBy: { title: "asc" },
    include: { versions: { orderBy: { versionNumber: "desc" }, include: { _count: { select: { sessions: true } } } } },
  });
  const playerProfiles = await db.playerProfile.findMany({
    where: { status: "ACTIVE" },
    orderBy: { displayName: "asc" },
    take: 200,
    select: { id: true, displayName: true, username: true },
  });
  const cards = sessions.map((session) => ({
    id: session.id,
    taleId: session.taleId,
    taleTitle: session.tale.title,
    voyageName: session.voyageName ?? session.ownerLabel ?? "Voyage",
    versionLabel: session.version?.versionLabel ?? "Unpublished",
    status: session.status,
    plannedStartAt: session.plannedStartAt?.toISOString() ?? null,
    lastActivityAt: session.updatedAt.toISOString(),
    currentSequence: session.currentSequence,
    currentBlockId: session.currentBlockId,
    connected: Boolean(session.lastHeartbeatAt && Date.now() - session.lastHeartbeatAt.getTime() < 45_000),
    pendingAction: session.verificationRequests[0]?.providerType ?? null,
    players: session.memberships.map((membership) => ({
      id: membership.player.id,
      displayName: membership.player.displayName,
      status: membership.status,
    })),
    invitationSummary: session.invitations.reduce<Record<string, number>>((summary, invitation) => {
      summary[invitation.status] = (summary[invitation.status] ?? 0) + 1;
      return summary;
    }, {}),
  }));
  return {
    groups: {
      needsAttention: cards.filter(
        (card) =>
          card.pendingAction ||
          ["READY", "SCHEDULED"].includes(card.status) ||
          card.players.some((player) => player.status === "READY"),
      ),
      activeVoyages: cards.filter((card) => ["ACTIVE", "PAUSED"].includes(card.status)),
      readyToLaunch: cards.filter((card) => ["INVITING", "READY", "SCHEDULED"].includes(card.status)),
      completedPlaythroughs: cards.filter((card) => card.status === "COMPLETED"),
    },
    invitations: sessions.flatMap((session) =>
      session.invitations.map((invitation) => ({
        id: invitation.id,
        playthroughId: session.id,
        taleTitle: session.tale.title,
        voyageName: session.voyageName ?? session.ownerLabel,
        versionLabel: session.version?.versionLabel ?? null,
        recipientName: invitation.recipientName,
        status: invitation.status,
        tokenPrefix: invitation.tokenPrefix,
        shortCodePrefix: invitation.shortCodePrefix,
        expiresAt: invitation.expiresAt.toISOString(),
        viewedAt: invitation.viewedAt?.toISOString() ?? null,
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        replacementId: invitation.replacement?.id ?? null,
        lastActivityAt: invitation.events[0]?.createdAt.toISOString() ?? invitation.updatedAt.toISOString(),
      })),
    ),
    publishedTales: tales.map((tale) => ({
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: tale.subtitle,
      visibility: tale.visibility,
      versions: tale.versions.map((version) => ({
        id: version.id,
        label: version.versionLabel,
        publishedAt: version.publishedAt.toISOString(),
        activeRunCount: version._count.sessions,
      })),
    })),
    playerProfiles,
    serverTime: new Date().toISOString(),
  };
}

export function playerSafeAssetIds(snapshotRaw: string, eventBlockIds: Array<string | null>, inventoryRaw: string) {
  const snapshot = parsePublishedSnapshot(snapshotRaw);
  const visited = new Set(eventBlockIds.filter(Boolean) as string[]);
  const values = new Set(parseJsonArray<string>(inventoryRaw));
  for (const chapter of snapshot.chapters)
    for (const block of chapter.blocks)
      if (visited.has(block.id)) stringValues(safeObject(block.configuration), values);
  if (snapshot.tale.coverAssetId) values.add(snapshot.tale.coverAssetId);
  return values;
}

export { safeObject as playerSafeObject };

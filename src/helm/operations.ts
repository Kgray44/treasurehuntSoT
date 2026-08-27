import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { captainAuthorityClauses, type CanonicalCaptainActor } from "@/chronicle/captain-authorization";
import { aggregateMembershipPresence, type MembershipPresenceProjection } from "@/platform/membership-presence";
import { buildCaptainProgressMap, countCurrentHints, deriveCaptainConsoleCommands } from "@/helm/command-console";

export const captainOperationalStatuses = [
  "SETUP",
  "WAITING_FOR_CREW",
  "READY",
  "ACTIVE_HEALTHY",
  "ACTIVE_ATTENTION",
  "PAUSED",
  "DEGRADED",
  "RECONCILING",
  "COMPLETED",
  "ABANDONED",
  "CANCELLED",
] as const;
export type CaptainOperationalStatus = (typeof captainOperationalStatuses)[number];
export const captainAttentionSeverities = ["INFO", "NOTICE", "WARNING", "HIGH", "CRITICAL"] as const;
export type CaptainAttentionSeverity = (typeof captainAttentionSeverities)[number];
export type CaptainPresenceState =
  | "CONNECTED_SYNCED"
  | "CONNECTED_CATCHING_UP"
  | "RECENTLY_LOST"
  | "NOT_CURRENTLY_CONNECTED"
  | "UNKNOWN"
  | "REMOVED";

export type CaptainNeedsAttentionItem = Readonly<{
  key: string;
  voyageId: string;
  category: "VERIFICATION" | "READINESS" | "CONNECTION" | "SYSTEM";
  severity: CaptainAttentionSeverity;
  title: string;
  explanation: string;
  sourceType: string;
  sourceId: string | null;
  firstObservedAt: string;
  latestObservedAt: string;
  recommendedTarget: "CREW" | "PROGRESS" | "EVENTS" | "CONSOLE";
  resolved: boolean;
  stale: boolean;
  dismissible: false;
}>;

export type CaptainCrewMemberProjection = Readonly<{
  id: string;
  displayName: string;
  avatar: null;
  crewRole: string | null;
  membership: { status: string; joinedAt: string | null; completedAt: string | null; removedAt: string | null };
  presence: {
    state: CaptainPresenceState;
    lastSeenAt: string | null;
    activeDeviceCount: number;
    safeActivity: string | null;
    source: "MembershipPresenceDevice";
  };
  synchronization: {
    state: "UNKNOWN" | "SYNCHRONIZED" | "CATCHING_UP";
    acknowledgedSequence: number | null;
    currentSequence: number;
    lag: number | null;
    lastAcknowledgedAt: string | null;
  };
  readiness: { state: "READY" | "NOT_READY" | "UNKNOWN"; blockerCategories: string[] };
  invitation: { id: string; status: string; expiresAt: string; canManage: boolean } | null;
  isCaptainsOwnPlayerMembership: boolean;
  canReceiveCaptaincy: boolean;
}>;

export type CaptainOperationalEventProjection = Readonly<{
  id: string;
  category: "PROGRESSION" | "VERIFICATION" | "SYSTEM" | "CONNECTION";
  timestamp: string;
  sequence: number;
  safeActorLabel: string;
  summary: string;
  sourceAuthority: "TaleSessionEvent" | "MembershipPresenceDevice";
  sourceId: string;
}>;

export type CaptainProgressProjection = Readonly<{
  currentChapter: string | null;
  currentCheckpoint: string | null;
  currentSequence: number;
  completedHighLevelCount: number;
  pendingCaptain: boolean;
  pendingPlayer: boolean;
  providerWaiting: boolean;
  blockedRequirementCount: number;
  sourceVersion: string | null;
  updatedAt: string;
}>;

export type CaptainCommandConsoleProjection = Readonly<{
  commands: ReturnType<typeof deriveCaptainConsoleCommands>;
  progressMap: ReturnType<typeof buildCaptainProgressMap>;
  hintSummary: { available: number; released: number };
}>;

const severityRank: Record<CaptainAttentionSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  WARNING: 2,
  NOTICE: 3,
  INFO: 4,
};

const statusRank: Record<CaptainOperationalStatus, number> = {
  ACTIVE_ATTENTION: 5,
  RECONCILING: 6,
  DEGRADED: 7,
  PAUSED: 8,
  ACTIVE_HEALTHY: 9,
  READY: 10,
  WAITING_FOR_CREW: 11,
  SETUP: 12,
  COMPLETED: 13,
  ABANDONED: 13,
  CANCELLED: 13,
};

const membershipReady = new Set(["READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"]);
const captainTransferEligible = new Set(["ACCEPTED", "READY", "ACTIVE_MEMBER"]);

export function classifyAggregatePresence(lastHeartbeatAt: Date | null, now = new Date()): CaptainPresenceState {
  if (!lastHeartbeatAt) return "UNKNOWN";
  const age = now.getTime() - lastHeartbeatAt.getTime();
  if (age <= 45_000) return "CONNECTED_SYNCED";
  if (age <= 5 * 60_000) return "RECENTLY_LOST";
  return "NOT_CURRENTLY_CONNECTED";
}

export function captainPresenceFromMembership(presence: MembershipPresenceProjection): CaptainPresenceState {
  if (presence.state === "CONNECTED")
    return presence.synchronizationState === "SYNCHRONIZED" ? "CONNECTED_SYNCED" : "CONNECTED_CATCHING_UP";
  if (presence.state === "RECENTLY_LOST") return "RECENTLY_LOST";
  if (presence.state === "STALE") return "NOT_CURRENTLY_CONNECTED";
  return "UNKNOWN";
}

export function summarizeCrewPresence(
  crew: readonly { presence: MembershipPresenceProjection; membershipStatus?: string }[],
) {
  const participatingCrew = crew.filter((member) => member.membershipStatus !== "REMOVED");
  const count = (state: MembershipPresenceProjection["state"]) =>
    participatingCrew.filter((member) => member.presence.state === state).length;
  const synchronized = participatingCrew.filter(
    (member) => member.presence.synchronizationState === "SYNCHRONIZED",
  ).length;
  const catchingUp = participatingCrew.filter(
    (member) => member.presence.synchronizationState === "CATCHING_UP",
  ).length;
  return {
    total: participatingCrew.length,
    removed: crew.length - participatingCrew.length,
    connected: count("CONNECTED"),
    recentlyLost: count("RECENTLY_LOST"),
    stale: count("STALE"),
    unknown: count("UNKNOWN"),
    synchronized,
    catchingUp,
  };
}

export function aggregateCrewPresence(
  crew: readonly { presence: MembershipPresenceProjection; membershipStatus?: string }[],
): CaptainPresenceState {
  const summary = summarizeCrewPresence(crew);
  if (summary.connected) return summary.catchingUp ? "CONNECTED_CATCHING_UP" : "CONNECTED_SYNCED";
  if (summary.recentlyLost) return "RECENTLY_LOST";
  if (summary.stale) return "NOT_CURRENTLY_CONNECTED";
  return "UNKNOWN";
}

export function deriveCaptainNeedsAttention(input: {
  voyageId: string;
  pendingVerification?: { id: string; providerType: string; requestedAt: Date } | null;
  membershipStates: string[];
  sessionStatus: string;
  memberPresence?: Array<{
    membershipId: string;
    displayName: string;
    membershipStatus: string;
    presence: MembershipPresenceProjection;
  }>;
  updatedAt: Date;
  now?: Date;
}): CaptainNeedsAttentionItem[] {
  const now = input.now ?? new Date();
  const items: CaptainNeedsAttentionItem[] = [];
  if (input.pendingVerification)
    items.push({
      key: `${input.voyageId}:verification:${input.pendingVerification.id}`,
      voyageId: input.voyageId,
      category: "VERIFICATION",
      severity: "HIGH",
      title: "Verification is waiting",
      explanation: `A ${input.pendingVerification.providerType} verification request remains pending.`,
      sourceType: "TaleVerificationRequest",
      sourceId: input.pendingVerification.id,
      firstObservedAt: input.pendingVerification.requestedAt.toISOString(),
      latestObservedAt: now.toISOString(),
      recommendedTarget: "CONSOLE",
      resolved: false,
      stale: false,
      dismissible: false,
    });
  const pendingCrew = input.membershipStates.filter((state) => ["INVITED", "ACCEPTED"].includes(state)).length;
  if (pendingCrew)
    items.push({
      key: `${input.voyageId}:readiness:crew-incomplete`,
      voyageId: input.voyageId,
      category: "READINESS",
      severity: input.sessionStatus === "ACTIVE" ? "HIGH" : "NOTICE",
      title: pendingCrew === 1 ? "One crew member is not ready" : `${pendingCrew} crew members are not ready`,
      explanation: "Current invitation or membership evidence is incomplete; this is not a Phase 4 preflight result.",
      sourceType: "PlaythroughMembership",
      sourceId: null,
      firstObservedAt: input.updatedAt.toISOString(),
      latestObservedAt: now.toISOString(),
      recommendedTarget: "CREW",
      resolved: false,
      stale: false,
      dismissible: false,
    });
  if (input.sessionStatus === "ACTIVE")
    for (const member of input.memberPresence ?? []) {
      if (!membershipReady.has(member.membershipStatus) && !["INVITED", "ACCEPTED"].includes(member.membershipStatus))
        continue;
      const observedAt = member.presence.lastSeenAt ?? input.updatedAt.toISOString();
      if (member.presence.state === "STALE")
        items.push({
          key: `${input.voyageId}:connection:${member.membershipId}:stale`,
          voyageId: input.voyageId,
          category: "CONNECTION",
          severity: "WARNING",
          title: `${member.displayName} is not currently connected`,
          explanation:
            "No recent authenticated membership heartbeat is available. This does not change Voyage progress.",
          sourceType: "MembershipPresenceDevice",
          sourceId: member.membershipId,
          firstObservedAt: observedAt,
          latestObservedAt: now.toISOString(),
          recommendedTarget: "CREW",
          resolved: false,
          stale: true,
          dismissible: false,
        });
      else if (member.presence.state === "RECENTLY_LOST")
        items.push({
          key: `${input.voyageId}:connection:${member.membershipId}:recently-lost`,
          voyageId: input.voyageId,
          category: "CONNECTION",
          severity: "NOTICE",
          title: `${member.displayName} recently disconnected`,
          explanation:
            "The last authenticated membership heartbeat was recent; the next heartbeat may restore connection status.",
          sourceType: "MembershipPresenceDevice",
          sourceId: member.membershipId,
          firstObservedAt: observedAt,
          latestObservedAt: now.toISOString(),
          recommendedTarget: "CREW",
          resolved: false,
          stale: false,
          dismissible: false,
        });
      else if (member.presence.state === "CONNECTED" && member.presence.synchronizationState === "CATCHING_UP")
        items.push({
          key: `${input.voyageId}:connection:${member.membershipId}:catching-up`,
          voyageId: input.voyageId,
          category: "CONNECTION",
          severity: "NOTICE",
          title: `${member.displayName} is catching up`,
          explanation: `Their confirmed acknowledgement is ${member.presence.eventLag ?? 0} Voyage event${member.presence.eventLag === 1 ? "" : "s"} behind.`,
          sourceType: "MembershipPresenceDevice",
          sourceId: member.membershipId,
          firstObservedAt: observedAt,
          latestObservedAt: now.toISOString(),
          recommendedTarget: "CREW",
          resolved: false,
          stale: false,
          dismissible: false,
        });
    }
  return items.sort(
    (left, right) => severityRank[left.severity] - severityRank[right.severity] || left.key.localeCompare(right.key),
  );
}

export function deriveCaptainOperationalStatus(input: {
  sessionStatus: string;
  membershipStates: string[];
  attention: readonly CaptainNeedsAttentionItem[];
}): CaptainOperationalStatus {
  if (["COMPLETED", "ABANDONED", "CANCELLED"].includes(input.sessionStatus))
    return input.sessionStatus as CaptainOperationalStatus;
  if (input.sessionStatus === "PAUSED") return "PAUSED";
  if (["DEGRADED", "RECONCILING"].includes(input.sessionStatus)) return input.sessionStatus as CaptainOperationalStatus;
  if (input.sessionStatus === "ACTIVE")
    return input.attention.some((item) => ["HIGH", "CRITICAL"].includes(item.severity))
      ? "ACTIVE_ATTENTION"
      : "ACTIVE_HEALTHY";
  if (input.sessionStatus === "READY" || input.membershipStates.every((state) => membershipReady.has(state)))
    return "READY";
  if (
    ["INVITING", "SCHEDULED"].includes(input.sessionStatus) ||
    input.membershipStates.some((state) => !membershipReady.has(state))
  )
    return "WAITING_FOR_CREW";
  return "SETUP";
}

export function compareCaptainOperationalPriority(
  left: {
    status: CaptainOperationalStatus;
    attention: readonly CaptainNeedsAttentionItem[];
    firstObservedAt: string;
    id: string;
  },
  right: {
    status: CaptainOperationalStatus;
    attention: readonly CaptainNeedsAttentionItem[];
    firstObservedAt: string;
    id: string;
  },
) {
  const leftSeverity = left.attention[0] ? severityRank[left.attention[0].severity] : Number.MAX_SAFE_INTEGER;
  const rightSeverity = right.attention[0] ? severityRank[right.attention[0].severity] : Number.MAX_SAFE_INTEGER;
  return (
    leftSeverity - rightSeverity ||
    statusRank[left.status] - statusRank[right.status] ||
    left.firstObservedAt.localeCompare(right.firstObservedAt) ||
    left.id.localeCompare(right.id)
  );
}

function safeEventCategory(eventType: string): CaptainOperationalEventProjection["category"] {
  if (/verification/i.test(eventType)) return "VERIFICATION";
  if (/session|block|progress|presentation|hint/i.test(eventType)) return "PROGRESSION";
  return "SYSTEM";
}

function labelEventType(eventType: string) {
  return eventType
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("_", " ")
    .toLocaleLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toLocaleUpperCase());
}

export function projectCaptainOperationalEvent(event: {
  id: string;
  eventType: string;
  sequence: number;
  createdAt: Date;
}): CaptainOperationalEventProjection {
  return {
    id: event.id,
    category: safeEventCategory(event.eventType),
    timestamp: event.createdAt.toISOString(),
    sequence: event.sequence,
    safeActorLabel: "Voyage system",
    summary: labelEventType(event.eventType),
    sourceAuthority: "TaleSessionEvent",
    sourceId: event.id,
  };
}

export function projectMembershipPresenceOperationalEvent(input: {
  membershipId: string;
  displayName: string;
  membershipStatus?: string;
  presence: MembershipPresenceProjection;
  computedAt: Date;
}): CaptainOperationalEventProjection | null {
  if (input.presence.state === "UNKNOWN" || input.membershipStatus === "REMOVED") return null;
  const state = captainPresenceFromMembership(input.presence).replaceAll("_", " ").toLocaleLowerCase();
  return {
    id: `presence:${input.membershipId}:${input.presence.state}:${input.presence.acknowledgedSequence ?? "none"}`,
    category: "CONNECTION",
    timestamp: input.presence.evidenceUpdatedAt ?? input.computedAt.toISOString(),
    sequence: input.presence.acknowledgedSequence ?? -1,
    safeActorLabel: input.displayName,
    summary: `Current member presence: ${state}`,
    sourceAuthority: "MembershipPresenceDevice",
    sourceId: input.membershipId,
  };
}

export async function getCaptainVoyageProjection(voyageId: string, actor: CanonicalCaptainActor) {
  const session = await db.taleSession.findFirst({
    where: { id: voyageId, OR: captainAuthorityClauses(actor) },
    include: {
      tale: { select: { title: true } },
      version: { select: { id: true, versionLabel: true, contentSnapshot: true } },
      memberships: {
        include: {
          player: { select: { id: true, displayName: true, accountId: true } },
          presenceDevices: {
            select: {
              lastHeartbeatAt: true,
              acknowledgedSequence: true,
              safeActivity: true,
              disconnectedAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      invitations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          intendedPlayerId: true,
          status: true,
          expiresAt: true,
          replacement: { select: { id: true } },
        },
      },
      verificationRequests: { where: { status: "PENDING" }, orderBy: { requestedAt: "asc" }, take: 1 },
      events: { orderBy: [{ sequence: "desc" }, { id: "desc" }], take: 25 },
    },
  });
  if (!session) return null;
  const progressEvents = await db.taleSessionEvent.findMany({
    where: {
      sessionId: session.id,
      eventType: { in: ["blockEntered", "blockCompleted", "hintReleased"] },
    },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    select: { blockId: true, eventType: true, sequence: true },
  });
  const crewPresence = session.memberships.map((membership) => ({
    membershipId: membership.id,
    displayName: membership.participationAlias ?? membership.player.displayName,
    membershipStatus: membership.status,
    presence: aggregateMembershipPresence(membership.presenceDevices, session.currentSequence),
  }));
  const attention = deriveCaptainNeedsAttention({
    voyageId: session.id,
    pendingVerification: session.verificationRequests[0] ?? null,
    membershipStates: session.memberships.map((membership) => membership.status),
    sessionStatus: session.status,
    memberPresence: crewPresence,
    updatedAt: session.updatedAt,
  });
  const operationalStatus = deriveCaptainOperationalStatus({
    sessionStatus: session.status,
    membershipStates: session.memberships.map((membership) => membership.status),
    attention,
  });
  const snapshot = session.version ? parsePublishedSnapshot(session.version.contentSnapshot) : null;
  const chapter = snapshot?.chapters.find((item) => item.id === session.currentChapterId) ?? null;
  const block = chapter?.blocks.find((item) => item.id === session.currentBlockId) ?? null;
  const crew: CaptainCrewMemberProjection[] = session.memberships.map((membership, index) => {
    const presence = crewPresence[index]!.presence;
    const removed = membership.status === "REMOVED";
    const invitation =
      session.invitations.find(
        (candidate) => candidate.intendedPlayerId === membership.player.id && !candidate.replacement,
      ) ?? null;
    return {
      id: membership.id,
      displayName: membership.participationAlias ?? membership.player.displayName,
      avatar: null,
      crewRole: membership.crewRole,
      membership: {
        status: membership.status,
        joinedAt: membership.joinedAt?.toISOString() ?? null,
        completedAt: membership.completedAt?.toISOString() ?? null,
        removedAt: membership.removedAt?.toISOString() ?? null,
      },
      presence: {
        state: removed ? "REMOVED" : captainPresenceFromMembership(presence),
        lastSeenAt: removed ? null : presence.lastSeenAt,
        activeDeviceCount: removed ? 0 : presence.activeDeviceCount,
        safeActivity: removed ? null : presence.safeActivity,
        source: "MembershipPresenceDevice",
      },
      synchronization: {
        state: removed ? "UNKNOWN" : presence.synchronizationState,
        acknowledgedSequence: removed ? null : presence.acknowledgedSequence,
        currentSequence: session.currentSequence,
        lag: removed ? null : presence.eventLag,
        lastAcknowledgedAt: removed ? null : presence.evidenceUpdatedAt,
      },
      readiness: {
        state: membershipReady.has(membership.status)
          ? "READY"
          : ["INVITED", "ACCEPTED"].includes(membership.status)
            ? "NOT_READY"
            : "UNKNOWN",
        blockerCategories: ["INVITED", "ACCEPTED"].includes(membership.status) ? ["MEMBERSHIP"] : [],
      },
      invitation: invitation
        ? {
            id: invitation.id,
            status: invitation.status,
            expiresAt: invitation.expiresAt.toISOString(),
            canManage: ["CREATED", "SENT", "COPIED", "VIEWED"].includes(invitation.status),
          }
        : null,
      isCaptainsOwnPlayerMembership: membership.player.accountId === actor.accountId,
      canReceiveCaptaincy:
        membership.player.accountId !== actor.accountId &&
        Boolean(membership.player.accountId) &&
        captainTransferEligible.has(membership.status),
    };
  });
  const computedAt = new Date();
  const presenceEvents = crewPresence
    .map((member) => projectMembershipPresenceOperationalEvent({ ...member, computedAt }))
    .filter((event): event is CaptainOperationalEventProjection => Boolean(event));
  const releasedHintCount = progressEvents.filter(
    (event) => event.eventType === "hintReleased" && event.blockId === session.currentBlockId,
  ).length;
  const enteredBlocks = progressEvents.filter((event) => event.eventType === "blockEntered" && event.blockId);
  const priorPassageId = enteredBlocks.length > 1 ? (enteredBlocks.at(-2)?.blockId ?? null) : null;
  const hintCount = snapshot ? countCurrentHints(snapshot, session.currentBlockId) : 0;
  const commandConsole: CaptainCommandConsoleProjection = {
    commands: deriveCaptainConsoleCommands({
      lifecycle: session.status,
      captainAuthorityState: session.captainAuthorityState,
      currentBlockId: session.currentBlockId,
      pendingVerification: session.verificationRequests[0]
        ? { providerType: session.verificationRequests[0].providerType }
        : null,
      hintCount,
      releasedHintCount,
      priorPassageId,
    }),
    progressMap: snapshot
      ? buildCaptainProgressMap({
          snapshot,
          currentBlockId: session.currentBlockId,
          lifecycle: session.status,
          events: progressEvents,
        })
      : [],
    hintSummary: { available: hintCount, released: releasedHintCount },
  };
  return {
    voyage: {
      id: session.id,
      chronicle: session.tale.title,
      voyageName: session.voyageName ?? session.ownerLabel ?? "Voyage",
      edition: session.version?.versionLabel ?? "Unpublished",
      lifecycle: session.status,
      captainAuthorityState: session.captainAuthorityState,
      concurrencyVersion: session.concurrencyVersion,
      operationalStatus,
      // This aggregate is derived from membership evidence, never from the
      // legacy TaleSession heartbeat, and therefore cannot imply an individual.
      aggregatePresence: aggregateCrewPresence(crewPresence),
      crewPresenceSummary: summarizeCrewPresence(crewPresence),
      sourceUpdatedAt: session.updatedAt.toISOString(),
      computedAt: computedAt.toISOString(),
      staleAfter: new Date(session.updatedAt.getTime() + 30_000).toISOString(),
    },
    attention,
    crew,
    progress: {
      currentChapter: chapter?.title ?? null,
      currentCheckpoint: block?.title ?? null,
      currentSequence: session.currentSequence,
      completedHighLevelCount: session.events.filter((event) => /complete|advance|progress/i.test(event.eventType))
        .length,
      pendingCaptain: attention.some((item) => item.category === "VERIFICATION"),
      pendingPlayer: attention.some((item) => item.category === "READINESS"),
      providerWaiting: Boolean(session.verificationRequests[0]),
      blockedRequirementCount: attention.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)).length,
      sourceVersion: session.version?.id ?? null,
      updatedAt: session.updatedAt.toISOString(),
    } satisfies CaptainProgressProjection,
    // Current membership presence is a bounded, non-persistent operational
    // observation beside canonical history; polling removes/replaces it as it changes.
    events: [...session.events.map(projectCaptainOperationalEvent).reverse(), ...presenceEvents],
    commandConsole,
  };
}

export async function getCaptainOperationalEvents(voyageId: string, cursor?: string | null, category?: string | null) {
  const cursorEvent = cursor
    ? await db.taleSessionEvent.findFirst({
        where: { id: cursor, sessionId: voyageId },
        select: { id: true, sequence: true },
      })
    : null;
  const events = await db.taleSessionEvent.findMany({
    where: {
      sessionId: voyageId,
      ...(cursorEvent
        ? {
            OR: [
              { sequence: { lt: cursorEvent.sequence } },
              { sequence: cursorEvent.sequence, id: { lt: cursorEvent.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ sequence: "desc" }, { id: "desc" }],
    take: 26,
    select: { id: true, eventType: true, sequence: true, createdAt: true },
  });
  const projected = events
    .map(projectCaptainOperationalEvent)
    .filter((event) => !category || event.category === category);
  return { events: projected.slice(0, 25), nextCursor: events.length > 25 ? (events[25]?.id ?? null) : null };
}

import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CHALLENGE_MS, CrossdeckError, presence, type CrossdeckAction, type SurfaceRole } from "./contracts";

export type Actor = { accountId: string; id: string };
type Store = Prisma.TransactionClient;
const digest = (code: string) => createHash("sha256").update(`crossdeck:v1:${code}`).digest("hex");
const memberStatuses = ["ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"];
const accountStatuses = ["ACTIVE", "PENDING_VERIFICATION", "GUEST_UNCLAIMED"];
const fail = () => {
  throw new CrossdeckError(403, "This device can no longer join this Voyage. Sign in or choose another Voyage.");
};

async function authority(tx: Store, actor: Actor, now: Date) {
  const session = await tx.accountSession.findFirst({
    where: {
      id: actor.id,
      accountId: actor.accountId,
      revokedAt: null,
      expiresAt: { gt: now },
      sessionType: "ORDINARY",
      account: { status: { in: accountStatuses }, lockedAt: null, suspendedAt: null, mergedIntoAccountId: null },
    },
  });
  if (!session) return fail();
  return session;
}
async function membership(tx: Store, actor: Actor, voyageId: string, now: Date) {
  const member = await tx.playthroughMembership.findFirst({
    where: {
      playthroughId: voyageId,
      status: { in: memberStatuses },
      removedAt: null,
      player: { accountId: actor.accountId, status: "ACTIVE" },
      playthrough: {
        status: { in: ["ACTIVE", "READY", "SCHEDULED", "PAUSED", "COMPLETED"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    include: { playthrough: { include: { tale: { select: { slug: true, title: true } } } } },
  });
  if (!member) return fail();
  return member;
}
const included = {
  challenges: { orderBy: { createdAt: "desc" as const }, take: 1 },
  accountSession: { include: { account: true } },
  membership: {
    include: { player: true, playthrough: { include: { tale: { select: { slug: true, title: true } } } } },
  },
} as const;
type Surface = Prisma.CrossdeckSurfaceSessionGetPayload<{ include: typeof included }>;
function alive(s: Surface, now: Date) {
  const a = s.accountSession,
    p = a.account,
    m = s.membership;
  return (
    !s.revokedAt &&
    s.expiresAt > now &&
    !a.revokedAt &&
    a.expiresAt > now &&
    a.sessionType === "ORDINARY" &&
    accountStatuses.includes(p.status) &&
    !p.lockedAt &&
    !p.suspendedAt &&
    !p.mergedIntoAccountId &&
    !m.removedAt &&
    memberStatuses.includes(m.status) &&
    m.player.status === "ACTIVE" &&
    m.player.accountId === a.accountId &&
    ["ACTIVE", "READY", "SCHEDULED", "PAUSED", "COMPLETED"].includes(m.playthrough.status) &&
    (!m.playthrough.expiresAt || m.playthrough.expiresAt > now)
  );
}
function dto(s: Surface, actor: Actor, now: Date) {
  return {
    surfaceSessionId: s.id,
    surfaceId: s.surfaceId,
    label: s.label,
    role: s.role,
    voyageId: s.membership.playthroughId,
    voyageTitle: s.membership.playthrough.tale.title,
    voyageHref: `/play/${encodeURIComponent(s.membership.playthrough.tale.slug)}/session/${encodeURIComponent(s.membership.playthroughId)}`,
    presence: alive(s, now) ? presence(s.lifecycle, s.lastSeenAt, s.expiresAt, s.revokedAt, now) : "REVOKED",
    thisSession: s.accountSessionId === actor.id,
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    capabilities: JSON.parse(s.capabilities),
    pairing: s.challenges[0]?.consumedAt
      ? { state: "CONNECTED", surfaceId: s.challenges[0].claimedSurfaceId }
      : s.challenges[0] && s.challenges[0].expiresAt > now
        ? { state: "WAITING", surfaceId: null }
        : null,
  };
}
export type SurfaceDto = ReturnType<typeof dto>;
async function surface(tx: Store, actor: Actor, id: string, now: Date, ownSession = true) {
  const s = await tx.crossdeckSurfaceSession.findFirst({
    where: {
      surfaceId: id,
      accountSession: { accountId: actor.accountId },
      ...(ownSession ? { accountSessionId: actor.id } : {}),
    },
    include: included,
  });
  if (!s || !alive(s, now)) return fail();
  await membership(tx, actor, s.membership.playthroughId, now);
  return s;
}
function roleAllowed(role: SurfaceRole, s: Surface, actor: Actor) {
  if (
    role === "CAPTAIN_AUXILIARY" &&
    (s.membership.playthrough.captainAccountId !== actor.accountId ||
      s.membership.playthrough.captainAuthorityState !== "ASSIGNED")
  )
    fail();
  // Creator preview requires a future explicit authoring-session policy.
  if (role === "CREATOR_PREVIEW") throw new CrossdeckError(409, "Creator preview devices are not available yet.");
}
export function createCrossdeckService(db: PrismaClient, clock = () => new Date()) {
  return {
    async voyages(actor: Actor) {
      const now = clock();
      await authority(db, actor, now);
      const rows = await db.playthroughMembership.findMany({
        where: {
          status: { in: memberStatuses },
          removedAt: null,
          player: { accountId: actor.accountId, status: "ACTIVE" },
          playthrough: {
            status: { in: ["ACTIVE", "READY", "SCHEDULED", "PAUSED", "COMPLETED"] },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        include: { playthrough: { include: { tale: { select: { title: true } } } } },
        take: 100,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((m) => ({ id: m.playthroughId, title: m.playthrough.voyageName || m.playthrough.tale.title }));
    },
    async list(actor: Actor, voyageId?: string) {
      const now = clock();
      await authority(db, actor, now);
      if (voyageId) await membership(db, actor, voyageId, now);
      const all = await db.crossdeckSurfaceSession.findMany({
        where: {
          accountSession: { accountId: actor.accountId },
          revokedAt: null,
          expiresAt: { gt: now },
          ...(voyageId ? { membership: { playthroughId: voyageId } } : {}),
        },
        include: included,
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      // Revoked underlying identities never leak even titles into active projections.
      return all.filter((s) => alive(s, now)).map((s) => dto(s, actor, now));
    },
    async act(actor: Actor, action: CrossdeckAction) {
      const now = clock();
      return db.$transaction(async (tx) => {
        const auth = await authority(tx, actor, now);
        const retentionCutoff = new Date(now.getTime() - 7 * 86_400_000);
        await tx.crossdeckSurfaceSession.deleteMany({
          where: {
            accountSession: { accountId: actor.accountId },
            OR: [{ expiresAt: { lt: retentionCutoff } }, { revokedAt: { lt: retentionCutoff } }],
          },
        });
        if (action.action === "register") {
          const m = await membership(tx, actor, action.voyageId, now);
          const old = await tx.crossdeckSurfaceSession.findUnique({ where: { surfaceId: action.surfaceId } });
          if (
            old &&
            (old.accountSessionId !== actor.id || old.membershipId !== m.id || old.revokedAt || old.expiresAt <= now)
          )
            fail();
          const count = await tx.crossdeckSurfaceSession.count({
            where: { membershipId: m.id, revokedAt: null, expiresAt: { gt: now } },
          });
          if (!old && count >= 12) throw new CrossdeckError(409, "Remove an unused device before adding another.");
          const s = await tx.crossdeckSurfaceSession.upsert({
            where: { surfaceId: action.surfaceId },
            create: {
              surfaceId: action.surfaceId,
              accountSessionId: actor.id,
              membershipId: m.id,
              label: action.label,
              capabilities: JSON.stringify(action.capabilities),
              lastSeenAt: now,
              expiresAt: new Date(Math.min(auth.expiresAt.getTime(), now.getTime() + 86_400_000)),
            },
            update: {
              label: action.label,
              capabilities: JSON.stringify(action.capabilities),
              lifecycle: "ACTIVE",
              lastSeenAt: now,
            },
            include: included,
          });
          return { surface: dto(s, actor, now) };
        }
        if (action.action === "claim") {
          const c = await tx.crossdeckPairingChallenge.findUnique({
            where: { codeHash: digest(action.code) },
            include: { source: { include: included } },
          });
          // Same response for unknown, stale, wrong person and replay. No challenge metadata oracle.
          if (
            !c ||
            c.expiresAt <= now ||
            c.consumedAt ||
            !alive(c.source, now) ||
            presence(c.source.lifecycle, c.source.lastSeenAt, c.source.expiresAt, c.source.revokedAt, now) !==
              "ACTIVE" ||
            c.source.accountSession.accountId !== actor.accountId ||
            (action.voyageId && action.voyageId !== c.source.membership.playthroughId)
          )
            throw new CrossdeckError(409, "That code is unavailable. Ask the other device for a new code.");
          const m = await membership(tx, actor, c.source.membership.playthroughId, now);
          if (action.surfaceId === c.source.surfaceId)
            throw new CrossdeckError(409, "Open this code on your other device.");
          roleAllowed(c.requestedRole as SurfaceRole, c.source, actor);
          const existing = await tx.crossdeckSurfaceSession.findUnique({ where: { surfaceId: action.surfaceId } });
          if (existing)
            throw new CrossdeckError(409, "This browser is already connected. Use its existing device entry.");
          if (
            (await tx.crossdeckSurfaceSession.count({
              where: { membershipId: m.id, revokedAt: null, expiresAt: { gt: now } },
            })) >= 12
          )
            throw new CrossdeckError(409, "Remove an unused device before adding another.");
          const consumed = await tx.crossdeckPairingChallenge.updateMany({
            where: { id: c.id, consumedAt: null, expiresAt: { gt: now } },
            data: { consumedAt: now, claimedSurfaceId: action.surfaceId },
          });
          if (consumed.count !== 1) throw new CrossdeckError(409, "That code was already used. Ask for a new code.");
          const s = await tx.crossdeckSurfaceSession.create({
            data: {
              surfaceId: action.surfaceId,
              accountSessionId: actor.id,
              membershipId: m.id,
              label: action.label,
              role: c.requestedRole,
              capabilities: JSON.stringify(action.capabilities),
              lastSeenAt: now,
              expiresAt: new Date(Math.min(auth.expiresAt.getTime(), now.getTime() + 86_400_000)),
            },
            include: included,
          });
          return { surface: dto(s, actor, now) };
        }
        const s = await surface(
          tx,
          actor,
          action.surfaceId,
          now,
          action.action !== "remove" && action.action !== "role",
        );
        if (action.action === "challenge") {
          if (presence(s.lifecycle, s.lastSeenAt, s.expiresAt, s.revokedAt, now) !== "ACTIVE")
            throw new CrossdeckError(409, "Return to the other device before creating a code.");
          roleAllowed(action.role, s, actor);
          const code = randomBytes(6).toString("hex").toUpperCase();
          await tx.crossdeckPairingChallenge.deleteMany({ where: { sourceId: s.id } });
          const expiresAt = new Date(Math.min(s.expiresAt.getTime(), now.getTime() + CHALLENGE_MS));
          await tx.crossdeckPairingChallenge.create({
            data: { codeHash: digest(code), sourceId: s.id, requestedRole: action.role, expiresAt },
          });
          return { code, expiresAt: expiresAt.toISOString(), voyageId: s.membership.playthroughId };
        }
        if (action.action === "remove") {
          await tx.crossdeckSurfaceSession.update({
            where: { id: s.id },
            data: { revokedAt: now, lifecycle: "REVOKED" },
          });
          await tx.crossdeckPairingChallenge.deleteMany({ where: { sourceId: s.id } });
          return { removed: true };
        }
        if (action.action === "role") roleAllowed(action.role, s, actor);
        const changed = await tx.crossdeckSurfaceSession.update({
          where: { id: s.id },
          data:
            action.action === "role"
              ? { role: action.role }
              : {
                  lifecycle: action.lifecycle,
                  lastSeenAt: now,
                  ...(action.capabilities ? { capabilities: JSON.stringify(action.capabilities) } : {}),
                },
          include: included,
        });
        return { surface: dto(changed, actor, now) };
      });
    },
  };
}

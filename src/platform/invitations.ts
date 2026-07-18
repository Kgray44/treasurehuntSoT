import { randomBytes, randomUUID } from "node:crypto";
import { hash, compare } from "bcryptjs";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken, makeToken } from "@/lib/security";
import { parsePublishedSnapshot } from "@/tall-tale/publishing";
import { invitationUsable } from "@/platform/state";
import { safeAuditMetadata } from "@/platform/audit";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const createPlaythroughSchema = z.object({
  taleId: z.string().min(8).max(128),
  versionId: z.string().min(8).max(128),
  voyageName: z.string().trim().min(3).max(100),
  captainMode: z.enum(["CAPTAIN_CONTROLLED", "RULE_CONTROLLED", "HYBRID"]).default("CAPTAIN_CONTROLLED"),
  progressionMode: z.enum(["CAPTAIN_CONTROLLED", "RULE_CONTROLLED", "HYBRID"]).optional(),
  hints: z.enum(["DISABLED", "ON_REQUEST", "CAPTAIN_PUSHED", "TIMED", "TALE_DEFINED"]).default("ON_REQUEST"),
  sideQuests: z.boolean().default(true),
  plannedStartAt: z.string().datetime().nullable().optional(),
  scheduleTimezone: z.string().trim().max(80).nullable().optional(),
  startingBlockId: z.string().max(128).nullable().optional(),
  testVoyage: z.boolean().default(false),
  accessibilityDefaults: z.record(z.string(), z.unknown()).default({}),
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .default(168),
  accountRequired: z.boolean().default(false),
  maxRedemptions: z.number().int().min(1).max(20).default(1),
  players: z
    .array(
      z.object({
        playerId: z.string().min(8).max(128).optional(),
        displayName: z.string().trim().min(1).max(80),
        crewRole: z.string().trim().max(60).optional(),
        pin: z.string().min(4).max(80).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export type CreatePlaythroughInput = z.infer<typeof createPlaythroughSchema>;

export class InvitationUnavailableError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID"
      | "EXPIRED"
      | "REVOKED"
      | "REPLACED"
      | "CONSUMED"
      | "DECLINED"
      | "CONFLICT"
      | "ACCOUNT_REQUIRED",
  ) {
    super(message);
  }
}

export const normalizeShortCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const invitationCredentialForCode = (value: string) => `code:${normalizeShortCode(value)}`;

function makeShortCode() {
  const bytes = randomBytes(8);
  const raw = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const invitationWhere = (credential: string) => {
  if (credential.startsWith("code:")) return { shortCodeHash: hashToken(credential.slice(5)) };
  return { tokenHash: hashToken(credential) };
};

const activeInvitationStates = ["CREATED", "SENT", "COPIED", "VIEWED"];

async function getInvitation(credential: string) {
  return db.invitation.findFirst({
    where: invitationWhere(credential),
    include: {
      intendedPlayer: true,
      replacement: { select: { id: true } },
      playthrough: { include: { tale: true, version: true, memberships: true } },
    },
  });
}

function unavailableCode(invitation: NonNullable<Awaited<ReturnType<typeof getInvitation>>>) {
  if (invitation.expiresAt.getTime() <= Date.now()) return "EXPIRED" as const;
  if (invitation.status === "EXPIRED") return "EXPIRED" as const;
  if (invitation.status === "REVOKED") return "REVOKED" as const;
  if (invitation.status === "REPLACED") return "REPLACED" as const;
  if (["ACCEPTED", "READY", "JOINED", "CONSUMED"].includes(invitation.status)) return "CONSUMED" as const;
  if (invitation.status === "DECLINED") return "DECLINED" as const;
  return "INVALID" as const;
}

function publicInvitationView(invitation: NonNullable<Awaited<ReturnType<typeof getInvitation>>>) {
  const snapshot = invitation.playthrough.version
    ? parsePublishedSnapshot(invitation.playthrough.version.contentSnapshot)
    : null;
  const safeStatus = invitationUsable(
    invitation.status,
    invitation.expiresAt,
    invitation.redemptionCount,
    invitation.maxRedemptions,
  )
    ? invitation.status
    : unavailableCode(invitation);
  return {
    id: invitation.id,
    status: safeStatus,
    recipientName: invitation.recipientName,
    expiresAt: invitation.expiresAt.toISOString(),
    requiresPin: Boolean(invitation.pinHash),
    playthrough: {
      id: invitation.playthrough.id,
      voyageName: invitation.playthrough.voyageName ?? invitation.playthrough.ownerLabel ?? "Tall Tale voyage",
      status: invitation.playthrough.status,
      plannedStartAt: invitation.playthrough.plannedStartAt?.toISOString() ?? null,
      scheduleTimezone: invitation.playthrough.scheduleTimezone,
      tale: snapshot
        ? {
            title: snapshot.tale.title,
            subtitle: snapshot.tale.subtitle,
            shortDescription: snapshot.tale.shortDescription,
            coverUrl: snapshot.tale.coverAssetId
              ? `/api/media/${snapshot.tale.coverAssetId}?variant=PREVIEW&version=${encodeURIComponent(
                  invitation.playthrough.publishedVersionId ?? "",
                )}&invitation=${encodeURIComponent(invitation.id)}`
              : null,
          }
        : null,
      versionLabel: invitation.playthrough.version?.versionLabel ?? null,
    },
  };
}

export async function resolveInvitation(credential: string, markViewed = true) {
  const invitation = await getInvitation(credential);
  if (!invitation) throw new InvitationUnavailableError("This invitation is not available.", "INVALID");
  if (invitation.expiresAt.getTime() <= Date.now() && activeInvitationStates.includes(invitation.status)) {
    await db.$transaction([
      db.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED", lastValidatedAt: new Date() } }),
      db.invitationEvent.create({
        data: { invitationId: invitation.id, eventType: "EXPIRED", actorType: "SYSTEM", metadata: "{}" },
      }),
      db.platformAuditEvent.create({
        data: {
          actorType: "SYSTEM",
          action: "INVITATION_EXPIRED",
          resourceType: "INVITATION",
          resourceId: invitation.id,
          correlationId: randomUUID(),
          metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
        },
      }),
    ]);
    invitation.status = "EXPIRED";
  } else if (markViewed && activeInvitationStates.includes(invitation.status)) {
    const now = new Date();
    await db.$transaction([
      db.invitation.update({
        where: { id: invitation.id },
        data: { status: "VIEWED", viewedAt: invitation.viewedAt ?? now, lastValidatedAt: now },
      }),
      db.invitationEvent.create({
        data: { invitationId: invitation.id, eventType: "VIEWED", actorType: "ANONYMOUS", metadata: "{}" },
      }),
      db.platformAuditEvent.create({
        data: {
          actorType: "ANONYMOUS",
          action: "INVITATION_VIEWED",
          resourceType: "INVITATION",
          resourceId: invitation.id,
          correlationId: randomUUID(),
          metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
        },
      }),
    ]);
    invitation.status = "VIEWED";
    invitation.viewedAt ??= now;
  }
  if (["EXPIRED", "REVOKED", "REPLACED", "DECLINED"].includes(invitation.status))
    throw new InvitationUnavailableError("This invitation is no longer available.", unavailableCode(invitation));
  return publicInvitationView(invitation);
}

export async function createPlaythroughAndInvitations(
  unchecked: CreatePlaythroughInput,
  captainId: string,
  baseUrl: string,
) {
  const input = createPlaythroughSchema.parse(unchecked);
  const version = await db.publishedTaleVersion.findFirst({
    where: { id: input.versionId, taleId: input.taleId },
    include: { tale: true },
  });
  if (!version) throw new Error("Choose a published Tall Tale version before creating a voyage.");
  if (input.accountRequired && input.players.some((player) => !player.playerId))
    throw new Error("Account-required invitations must target an existing claimed Player account.");
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  if (!snapshot.chapters.some((chapter) => chapter.blocks.length))
    throw new Error("This published version has no playable Player content.");
  const secrets = await Promise.all(
    input.players.map(async (player) => {
      const token = makeToken(36);
      const shortCode = makeShortCode();
      return {
        player,
        token,
        shortCode,
        pinHash: player.pin ? await hash(player.pin, 12) : null,
      };
    }),
  );
  const correlationId = randomUUID();
  const playthrough = await db.$transaction(async (tx) => {
    const created = await tx.taleSession.create({
      data: {
        taleId: input.taleId,
        publishedVersionId: version.id,
        ownerLabel: input.players.map((player) => player.displayName).join(", "),
        voyageName: input.voyageName,
        captainId,
        accessTokenHash: hashToken(makeToken()),
        status: input.plannedStartAt ? "SCHEDULED" : "INVITING",
        captainMode: input.progressionMode ?? input.captainMode,
        configuration: JSON.stringify({
          hints: input.hints,
          sideQuests: input.sideQuests,
          startingBlockId: input.startingBlockId,
          testVoyage: input.testVoyage,
          accountRequired: input.accountRequired,
          accessibilityDefaults: input.accessibilityDefaults,
        }),
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
        scheduleTimezone: input.scheduleTimezone ?? null,
      },
    });
    for (const secret of secrets) {
      const player = secret.player.playerId
        ? await tx.playerProfile.findFirstOrThrow({
            where: {
              id: secret.player.playerId,
              status: "ACTIVE",
              ...(input.accountRequired ? { username: { not: null }, claimedAt: { not: null } } : {}),
            },
          })
        : await tx.playerProfile.create({ data: { displayName: secret.player.displayName } });
      await tx.playthroughMembership.create({
        data: {
          playthroughId: created.id,
          playerProfileId: player.id,
          status: "INVITED",
          crewRole: secret.player.crewRole ?? null,
        },
      });
      const invitation = await tx.invitation.create({
        data: {
          playthroughId: created.id,
          intendedPlayerId: player.id,
          tokenHash: hashToken(secret.token),
          tokenPrefix: secret.token.slice(0, 8),
          shortCodeHash: hashToken(normalizeShortCode(secret.shortCode)),
          shortCodePrefix: normalizeShortCode(secret.shortCode).slice(0, 4),
          pinHash: secret.pinHash,
          recipientName: secret.player.displayName,
          deliveryMethods: JSON.stringify(["SECURE_LINK", "QR_CODE", "SHORT_CODE", "COPYABLE_MESSAGE"]),
          expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000),
          maxRedemptions: input.maxRedemptions,
          createdBy: captainId,
        },
      });
      await tx.invitationEvent.create({
        data: {
          invitationId: invitation.id,
          eventType: "CREATED",
          actorType: "CAPTAIN",
          actorId: captainId,
          metadata: JSON.stringify({ versionLabel: version.versionLabel }),
        },
      });
      Object.assign(secret, { invitationId: invitation.id, playerId: player.id });
    }
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId: captainId,
        action: "PLAYTHROUGH_CREATED",
        resourceType: "PLAYTHROUGH",
        resourceId: created.id,
        correlationId,
        metadata: JSON.stringify(
          safeAuditMetadata({
            versionId: version.id,
            versionLabel: version.versionLabel,
            playerCount: input.players.length,
          }),
        ),
      },
    });
    return created;
  });
  const origin = baseUrl.replace(/\/$/, "");
  return {
    playthroughId: playthrough.id,
    versionId: version.id,
    versionLabel: version.versionLabel,
    invitations: await Promise.all(
      secrets.map(async (secret) => {
        const link = `${origin}/join/${secret.token}`;
        return {
          id: String((secret as typeof secret & { invitationId: string }).invitationId),
          recipientName: secret.player.displayName,
          link,
          shortCode: secret.shortCode,
          qrCodeDataUrl: await QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 2, width: 480 }),
          message: `${secret.player.displayName}, your invitation to ${snapshot.tale.title} is ready. Open ${link} or enter code ${secret.shortCode}.`,
          expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString(),
        };
      }),
    ),
  };
}

export async function acceptInvitation(
  credential: string,
  input: { pin?: string; displayName?: string },
  signedInPlayerId?: string,
) {
  const invitation = await getInvitation(credential);
  if (!invitation) throw new InvitationUnavailableError("This invitation is not available.", "INVALID");
  if (["ACCEPTED", "READY", "JOINED", "CONSUMED"].includes(invitation.status)) {
    const existing = invitation.playthrough.memberships.find(
      (membership) => membership.playerProfileId === invitation.intendedPlayerId,
    );
    if (existing)
      return { playerId: existing.playerProfileId, playthroughId: invitation.playthroughId, idempotent: true };
  }
  if (!invitationUsable(invitation.status, invitation.expiresAt, invitation.redemptionCount, invitation.maxRedemptions))
    throw new InvitationUnavailableError("This invitation can no longer be accepted.", unavailableCode(invitation));
  const configuration = (() => {
    try {
      return JSON.parse(invitation.playthrough.configuration) as { accountRequired?: boolean };
    } catch {
      return {};
    }
  })();
  if (configuration.accountRequired && !signedInPlayerId)
    throw new InvitationUnavailableError(
      "Sign in to the claimed Player account named on this invitation before accepting it.",
      "ACCOUNT_REQUIRED",
    );
  if (invitation.pinHash && (!input.pin || !(await compare(input.pin, invitation.pinHash))))
    throw new InvitationUnavailableError("The invitation PIN was not accepted.", "INVALID");
  if (signedInPlayerId && invitation.intendedPlayerId && signedInPlayerId !== invitation.intendedPlayerId) {
    const intended = invitation.intendedPlayer;
    if (intended?.username || intended?.claimedAt)
      throw new InvitationUnavailableError("This invitation belongs to another Player profile.", "INVALID");
  }
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        status: { in: activeInvitationStates },
        redemptionCount: invitation.redemptionCount,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: "READY",
        acceptedAt: new Date(),
        redemptionCount: { increment: 1 },
        lastValidatedAt: new Date(),
        ...(signedInPlayerId ? { intendedPlayerId: signedInPlayerId } : {}),
      },
    });
    if (!claimed.count)
      throw new InvitationUnavailableError("Invitation state changed. Refresh and try again.", "CONFLICT");
    let playerId = signedInPlayerId ?? invitation.intendedPlayerId;
    if (!playerId) {
      const player = await tx.playerProfile.create({
        data: { displayName: input.displayName?.trim() || invitation.recipientName },
      });
      playerId = player.id;
    } else if (input.displayName?.trim()) {
      await tx.playerProfile.update({ where: { id: playerId }, data: { displayName: input.displayName.trim() } });
    }
    if (signedInPlayerId && invitation.intendedPlayerId && signedInPlayerId !== invitation.intendedPlayerId) {
      await tx.playthroughMembership.deleteMany({
        where: { playthroughId: invitation.playthroughId, playerProfileId: invitation.intendedPlayerId },
      });
    }
    await tx.playthroughMembership.upsert({
      where: { playthroughId_playerProfileId: { playthroughId: invitation.playthroughId, playerProfileId: playerId } },
      update: { status: "READY", joinedAt: new Date(), removedAt: null },
      create: {
        playthroughId: invitation.playthroughId,
        playerProfileId: playerId,
        status: "READY",
        joinedAt: new Date(),
      },
    });
    const remaining = await tx.invitation.count({
      where: { playthroughId: invitation.playthroughId, status: { in: activeInvitationStates } },
    });
    if (!remaining)
      await tx.taleSession.updateMany({
        where: { id: invitation.playthroughId, status: { in: ["INVITING", "SCHEDULED"] } },
        data: {
          status: invitation.playthrough.plannedStartAt ? "SCHEDULED" : "READY",
          concurrencyVersion: { increment: 1 },
        },
      });
    await tx.invitationEvent.create({
      data: {
        invitationId: invitation.id,
        eventType: "ACCEPTED",
        actorType: "PLAYER",
        actorId: playerId,
        metadata: "{}",
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "PLAYER",
        actorId: playerId,
        action: "INVITATION_ACCEPTED",
        resourceType: "INVITATION",
        resourceId: invitation.id,
        correlationId,
        metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
      },
    });
    return { playerId, playthroughId: invitation.playthroughId, idempotent: false };
  });
}

export async function declineInvitation(credential: string, signedInPlayerId?: string) {
  const invitation = await getInvitation(credential);
  if (
    !invitation ||
    !invitationUsable(invitation.status, invitation.expiresAt, invitation.redemptionCount, invitation.maxRedemptions)
  )
    throw new InvitationUnavailableError("This invitation cannot be declined.", "INVALID");
  if (signedInPlayerId && invitation.intendedPlayerId && signedInPlayerId !== invitation.intendedPlayerId)
    throw new InvitationUnavailableError("This invitation belongs to another Player profile.", "INVALID");
  const correlationId = randomUUID();
  await db.$transaction([
    db.invitation.update({ where: { id: invitation.id }, data: { status: "DECLINED", declinedAt: new Date() } }),
    db.playthroughMembership.updateMany({
      where: { playthroughId: invitation.playthroughId, playerProfileId: invitation.intendedPlayerId ?? undefined },
      data: { status: "DECLINED" },
    }),
    db.invitationEvent.create({
      data: {
        invitationId: invitation.id,
        eventType: "DECLINED",
        actorType: "PLAYER",
        actorId: signedInPlayerId ?? invitation.intendedPlayerId,
        metadata: "{}",
      },
    }),
    db.platformAuditEvent.create({
      data: {
        actorType: "PLAYER",
        actorId: signedInPlayerId ?? invitation.intendedPlayerId,
        action: "INVITATION_DECLINED",
        resourceType: "INVITATION",
        resourceId: invitation.id,
        correlationId,
        metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
      },
    }),
  ]);
  return { ok: true };
}

export async function manageInvitation(
  invitationId: string,
  actorId: string,
  action: "copied" | "extend" | "revoke" | "replace",
  baseUrl: string,
  extendHours = 168,
) {
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    include: { playthrough: { include: { tale: true } } },
  });
  if (!invitation || invitation.playthrough.captainId !== actorId) throw new Error("Invitation not found.");
  const correlationId = randomUUID();
  if (action === "copied") {
    if (!activeInvitationStates.includes(invitation.status))
      throw new Error("Only a pending invitation can be copied.");
    await db.$transaction([
      db.invitation.update({ where: { id: invitation.id }, data: { status: "COPIED" } }),
      db.invitationEvent.create({
        data: { invitationId, eventType: "COPIED", actorType: "CAPTAIN", actorId, metadata: "{}" },
      }),
      db.platformAuditEvent.create({
        data: {
          actorType: "CAPTAIN",
          actorId,
          action: "INVITATION_COPIED",
          resourceType: "INVITATION",
          resourceId: invitation.id,
          correlationId,
          metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
        },
      }),
    ]);
    return { ok: true };
  }
  if (action === "extend") {
    if (!activeInvitationStates.includes(invitation.status))
      throw new Error("Only a pending invitation can be extended.");
    const expiresAt = new Date(Date.now() + Math.min(Math.max(extendHours, 1), 24 * 90) * 60 * 60 * 1000);
    await db.$transaction([
      db.invitation.update({ where: { id: invitation.id }, data: { expiresAt } }),
      db.invitationEvent.create({
        data: { invitationId, eventType: "EXPIRATION_EXTENDED", actorType: "CAPTAIN", actorId, metadata: "{}" },
      }),
      db.platformAuditEvent.create({
        data: {
          actorType: "CAPTAIN",
          actorId,
          action: "INVITATION_EXTENDED",
          resourceType: "INVITATION",
          resourceId: invitation.id,
          correlationId,
          metadata: JSON.stringify({ playthroughId: invitation.playthroughId, expiresAt: expiresAt.toISOString() }),
        },
      }),
    ]);
    return { ok: true, expiresAt: expiresAt.toISOString() };
  }
  if (action === "revoke") {
    if (!activeInvitationStates.includes(invitation.status))
      throw new Error("Only a pending invitation can be revoked.");
    await db.$transaction([
      db.invitation.update({ where: { id: invitation.id }, data: { status: "REVOKED", revokedAt: new Date() } }),
      db.playthroughMembership.updateMany({
        where: { playthroughId: invitation.playthroughId, playerProfileId: invitation.intendedPlayerId ?? undefined },
        data: { status: "REMOVED", removedAt: new Date() },
      }),
      db.invitationEvent.create({
        data: { invitationId, eventType: "REVOKED", actorType: "CAPTAIN", actorId, metadata: "{}" },
      }),
      db.platformAuditEvent.create({
        data: {
          actorType: "CAPTAIN",
          actorId,
          action: "INVITATION_REVOKED",
          resourceType: "INVITATION",
          resourceId: invitation.id,
          correlationId,
          metadata: JSON.stringify({ playthroughId: invitation.playthroughId }),
        },
      }),
    ]);
    return { ok: true };
  }
  if (!activeInvitationStates.includes(invitation.status))
    throw new Error("Only a pending invitation can be replaced.");
  const token = makeToken(36);
  const shortCode = makeShortCode();
  const replacement = await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "REPLACED", revokedAt: new Date() } });
    const created = await tx.invitation.create({
      data: {
        playthroughId: invitation.playthroughId,
        intendedPlayerId: invitation.intendedPlayerId,
        tokenHash: hashToken(token),
        tokenPrefix: token.slice(0, 8),
        shortCodeHash: hashToken(normalizeShortCode(shortCode)),
        shortCodePrefix: normalizeShortCode(shortCode).slice(0, 4),
        pinHash: invitation.pinHash,
        recipientName: invitation.recipientName,
        deliveryMethods: invitation.deliveryMethods,
        expiresAt: new Date(Date.now() + extendHours * 60 * 60 * 1000),
        maxRedemptions: invitation.maxRedemptions,
        replacesInvitationId: invitation.id,
        createdBy: actorId,
      },
    });
    await tx.invitationEvent.createMany({
      data: [
        {
          invitationId: invitation.id,
          eventType: "REPLACED",
          actorType: "CAPTAIN",
          actorId,
          metadata: JSON.stringify({ replacementId: created.id }),
        },
        {
          invitationId: created.id,
          eventType: "CREATED",
          actorType: "CAPTAIN",
          actorId,
          metadata: JSON.stringify({ replacesId: invitation.id }),
        },
      ],
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId,
        action: "INVITATION_REPLACED",
        resourceType: "INVITATION",
        resourceId: invitation.id,
        correlationId,
        metadata: JSON.stringify({ playthroughId: invitation.playthroughId, replacementId: created.id }),
      },
    });
    return created;
  });
  const link = `${baseUrl.replace(/\/$/, "")}/join/${token}`;
  return {
    ok: true,
    replacement: {
      id: replacement.id,
      link,
      shortCode,
      qrCodeDataUrl: await QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 2, width: 480 }),
      message: `${invitation.recipientName}, your replacement invitation to ${invitation.playthrough.tale.title} is ready. Open ${link} or enter code ${shortCode}.`,
      expiresAt: replacement.expiresAt.toISOString(),
    },
  };
}

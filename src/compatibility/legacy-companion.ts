import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createPlayerIdentitySession, playerCanAccessPlaythrough, requirePlayerIdentity } from "@/platform/auth";
import { ensureGuestAccountForProfile } from "@/wayfarer/accounts";
import { LEGACY_COMPANION_DOMAIN, LEGACY_COMPANION_MIGRATION_VERSION } from "@/chronicle/legacy-companion-migration";
import { canonicalReadsEnabled, canonicalWritesEnabled } from "@/compatibility/project-one-voyage-stage";
import { compatibilityTestTraffic, recordCompatibilityObservation } from "@/compatibility/compatibility-observation";

export class LegacyCompatibilityError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_MIGRATED" | "INVALID_CREDENTIAL" | "ACCESS_DENIED" | "MISSING_MAPPING",
  ) {
    super(message);
  }
}

type MappingModel = "Chronicle" | "PublishedTaleVersion" | "TaleSession" | "PlayerProfile" | "PlaythroughMembership";

async function mapping(sourceModel: string, sourceId: string, canonicalModel: MappingModel) {
  return db.legacyEntityReference.findFirst({
    where: {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel,
      sourceId,
      canonicalModel,
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
    },
  });
}

export async function resolveLegacyCampaign(campaignSlug: string) {
  if (!canonicalReadsEnabled())
    throw new LegacyCompatibilityError(
      "Canonical compatibility reads are not enabled for this rollout stage.",
      "NOT_MIGRATED",
    );
  const campaign = await db.campaign.findUnique({
    where: { slug: campaignSlug },
    select: { id: true, slug: true, title: true },
  });
  if (!campaign) return null;
  const [chronicle, version, session] = await Promise.all([
    mapping("Campaign", campaign.id, "Chronicle"),
    mapping("Campaign", campaign.id, "PublishedTaleVersion"),
    mapping("Campaign", campaign.id, "TaleSession"),
  ]);
  if (!chronicle || !version || !session)
    throw new LegacyCompatibilityError(
      `Legacy Voyage ${campaign.slug} has not completed Project One Voyage migration.`,
      "NOT_MIGRATED",
    );
  return {
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    title: campaign.title,
    chronicleId: chronicle.canonicalId,
    versionId: version.canonicalId,
    sessionId: session.canonicalId,
  };
}

/**
 * Finds one migrated historical URL anchor through provenance first. The
 * legacy Campaign row is then read only to recover its public slug/title for
 * a compatibility redirect; it is never used as a live state source.
 */
export async function resolveFirstMigratedLegacyCampaign() {
  if (!canonicalReadsEnabled())
    throw new LegacyCompatibilityError(
      "Canonical compatibility reads are not enabled for this rollout stage.",
      "NOT_MIGRATED",
    );
  const reference = await db.legacyEntityReference.findFirst({
    where: {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel: "Campaign",
      canonicalModel: "TaleSession",
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
    },
    orderBy: { migratedAt: "asc" },
  });
  if (!reference) return null;
  const campaign = await db.campaign.findUnique({ where: { id: reference.sourceId }, select: { slug: true } });
  return campaign ? resolveLegacyCampaign(campaign.slug) : null;
}

async function canonicalGuestForCampaign(campaignId: string, sessionId: string, accessCodeHash: string) {
  const existing = await mapping("LegacyAccessCode", campaignId, "PlayerProfile");
  if (existing) {
    const membership = await mapping("LegacyAccessCode", campaignId, "PlaythroughMembership");
    if (!membership) throw new LegacyCompatibilityError("Legacy credential mapping is incomplete.", "MISSING_MAPPING");
    const player = await db.playerProfile.findUnique({
      where: { id: existing.canonicalId },
      select: { accountId: true },
    });
    if (!player) throw new LegacyCompatibilityError("Legacy credential identity is incomplete.", "MISSING_MAPPING");
    const accountId = player.accountId ?? (await ensureGuestAccountForProfile(existing.canonicalId));
    return { playerId: existing.canonicalId, membershipId: membership.canonicalId, accountId };
  }
  return db.$transaction(async (tx) => {
    const raced = await tx.legacyEntityReference.findFirst({
      where: {
        sourceDomain: LEGACY_COMPANION_DOMAIN,
        sourceModel: "LegacyAccessCode",
        sourceId: campaignId,
        canonicalModel: "PlayerProfile",
        migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
      },
    });
    if (raced) {
      const membership = await tx.legacyEntityReference.findFirst({
        where: {
          sourceDomain: LEGACY_COMPANION_DOMAIN,
          sourceModel: "LegacyAccessCode",
          sourceId: campaignId,
          canonicalModel: "PlaythroughMembership",
          migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
        },
      });
      if (!membership)
        throw new LegacyCompatibilityError("Legacy credential mapping is incomplete.", "MISSING_MAPPING");
      const player = await tx.playerProfile.findUnique({
        where: { id: raced.canonicalId },
        select: { accountId: true },
      });
      if (!player?.accountId)
        throw new LegacyCompatibilityError("Legacy credential identity is incomplete.", "MISSING_MAPPING");
      return { playerId: raced.canonicalId, membershipId: membership.canonicalId, accountId: player.accountId };
    }
    const session = await tx.taleSession.findUniqueOrThrow({ where: { id: sessionId } });
    const account = await tx.userAccount.create({ data: { status: "GUEST_UNCLAIMED" } });
    const player = await tx.playerProfile.create({
      data: {
        accountId: account.id,
        displayName: "Legacy guest",
        preferences: JSON.stringify({ legacyCredential: "exchanged" }),
      },
    });
    await tx.accountRoleAssignment.create({ data: { accountId: account.id, role: "PLAYER" } });
    await tx.securityEvent.create({
      data: {
        accountId: account.id,
        eventType: "LEGACY_CREDENTIAL_EXCHANGED",
        correlationId: `legacy-access-code:${campaignId}`,
        metadata: JSON.stringify({ sourceDomain: LEGACY_COMPANION_DOMAIN }),
      },
    });
    const membership = await tx.playthroughMembership.create({
      data: {
        playthroughId: sessionId,
        playerProfileId: player.id,
        role: "PLAYER",
        status: session.status === "COMPLETED" ? "COMPLETED_MEMBER" : "ACTIVE_MEMBER",
        joinedAt: new Date(),
        completedAt: session.status === "COMPLETED" ? (session.completedAt ?? new Date()) : null,
      },
    });
    const referenceData = {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel: "LegacyAccessCode",
      sourceId: campaignId,
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
      sourceChecksum: accessCodeHash,
    };
    await tx.legacyEntityReference.create({
      data: { ...referenceData, canonicalModel: "PlayerProfile", canonicalId: player.id },
    });
    await tx.legacyEntityReference.create({
      data: { ...referenceData, canonicalModel: "PlaythroughMembership", canonicalId: membership.id },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "LEGACY_CREDENTIAL",
        action: "LEGACY_ACCESS_CODE_EXCHANGED",
        resourceType: "CHRONICLE_SESSION",
        resourceId: sessionId,
        correlationId: `legacy-access-code:${campaignId}`,
        metadata: JSON.stringify({ sourceDomain: LEGACY_COMPANION_DOMAIN, sourceCampaignId: campaignId }),
      },
    });
    return { playerId: player.id, membershipId: membership.id, accountId: account.id };
  });
}

/**
 * Compatibility exchange only. The legacy code proves campaign access, then a
 * new canonical identity session is issued. No legacy access or session row is
 * written here.
 */
export async function exchangeLegacyAccessCode(campaignSlug: string, accessCode: string) {
  if (!canonicalWritesEnabled())
    throw new LegacyCompatibilityError(
      "Canonical compatibility writes are not enabled for this rollout stage.",
      "NOT_MIGRATED",
    );
  const campaign = await db.campaign.findUnique({
    where: { slug: campaignSlug },
    select: { id: true, accessCodeHash: true },
  });
  if (!campaign || !(await bcrypt.compare(accessCode, campaign.accessCodeHash)))
    throw new LegacyCompatibilityError("That invitation could not be recognized.", "INVALID_CREDENTIAL");
  const resolved = await resolveLegacyCampaign(campaignSlug);
  if (!resolved) throw new LegacyCompatibilityError("That invitation could not be recognized.", "INVALID_CREDENTIAL");
  const guest = await canonicalGuestForCampaign(campaign.id, resolved.sessionId, campaign.accessCodeHash);
  const csrfToken = await createPlayerIdentitySession(guest.playerId);
  await recordCompatibilityObservation({
    correlationId: `legacy-access-code:${campaign.id}`,
    operation: "LEGACY_ACCESS_EXCHANGE",
    routeKey: "player-access",
    disposition: "ADAPTED",
    canonicalSessionId: resolved.sessionId,
    canonicalAccountId: guest.accountId,
    testTraffic: compatibilityTestTraffic(),
  });
  return { ...resolved, playerId: guest.playerId, csrfToken };
}

export async function requireLegacyCompatibilityAccess(campaignSlug: string) {
  const resolved = await resolveLegacyCampaign(campaignSlug);
  if (!resolved) return null;
  const identity = await requirePlayerIdentity();
  if (!identity || !(await playerCanAccessPlaythrough(resolved.sessionId, identity.playerProfileId))) return null;
  await recordCompatibilityObservation({
    correlationId: `legacy-player-read:${resolved.sessionId}:${identity.id}`,
    operation: "LEGACY_PLAYER_READ",
    routeKey: "player-compatibility",
    disposition: "ADAPTED",
    canonicalSessionId: resolved.sessionId,
    canonicalAccountId: "accountId" in identity ? identity.accountId : undefined,
    testTraffic: compatibilityTestTraffic(),
  });
  return { ...resolved, playerId: identity.playerProfileId, csrfToken: identity.csrfToken };
}

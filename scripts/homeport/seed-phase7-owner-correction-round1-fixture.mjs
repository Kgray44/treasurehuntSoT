import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const correctionRound = process.env.HOMEPORT_PHASE7_CORRECTION_ROUND ?? "1";
const fixtureVersion =
  process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION ??
  `homeport-phase7-owner-correction-round${correctionRound}-v1`;
const ownerAlias = process.env.HOMEPORT_PHASE7_OWNER_ALIAS ?? "FULL_CAPABILITY";
const ownerDisplayName = process.env.HOMEPORT_PHASE7_OWNER_DISPLAY_NAME ?? "Admiral Correction Test";
const databaseUrl = process.env.DATABASE_URL ?? "";
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const syntheticPassword = required("HOMEPORT_PHASE7_SYNTHETIC_PASSWORD");
const createdAt = new Date("2026-08-05T02:00:00.000Z");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath || !databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_FIXTURE_REFUSES_UNOWNED_DATABASE:${databasePath}`);
if (syntheticPassword.length < 24) throw new Error("HOMEPORT_PHASE7_SYNTHETIC_PASSWORD_REQUIRED");

const passwordHash = await bcrypt.hash(syntheticPassword, 10);
const tokenMaterial = {
  pendingVerification: randomBytes(36).toString("base64url"),
  pendingEmailChange: randomBytes(36).toString("base64url"),
  guestSession: randomBytes(36).toString("base64url"),
};

async function accountFixture({
  key,
  displayName,
  status = "ACTIVE",
  roles = ["PLAYER"],
  emailState = "VERIFIED",
  community = false,
}) {
  const accountId = `hp7c-account-${key}`;
  const profileId = `hp7c-player-${key}`;
  const email = `${key}@owner-correction.example.test`;
  const handle = `hp7c-${key}`;
  const profileStatus =
    status === "DEACTIVATED" ? "DEACTIVATED" : status === "DELETION_SCHEDULED" ? "DELETION_SCHEDULED" : "ACTIVE";
  await db.userAccount.upsert({
    where: { id: accountId },
    update: {
      status,
      claimedAt: status === "GUEST_UNCLAIMED" ? null : createdAt,
      suspendedAt: ["DEACTIVATED", "DELETION_SCHEDULED", "RESTRICTED"].includes(status) ? createdAt : null,
      lockedAt: status === "RESTRICTED" ? createdAt : null,
    },
    create: {
      id: accountId,
      status,
      claimedAt: status === "GUEST_UNCLAIMED" ? null : createdAt,
      suspendedAt: ["DEACTIVATED", "DELETION_SCHEDULED", "RESTRICTED"].includes(status) ? createdAt : null,
      lockedAt: status === "RESTRICTED" ? createdAt : null,
      createdAt,
    },
  });
  await db.playerProfile.upsert({
    where: { accountId },
    update: {
      displayName,
      handle,
      normalizedHandle: handle,
      biography: "Synthetic owner-correction identity. No real person is represented.",
      defaultVisibility: "PUBLIC",
      status: profileStatus,
      claimedAt: status === "GUEST_UNCLAIMED" ? null : createdAt,
    },
    create: {
      id: profileId,
      accountId,
      displayName,
      handle,
      normalizedHandle: handle,
      biography: "Synthetic owner-correction identity. No real person is represented.",
      defaultVisibility: "PUBLIC",
      status: profileStatus,
      claimedAt: status === "GUEST_UNCLAIMED" ? null : createdAt,
      createdAt,
    },
  });
  await db.accountRoleAssignment.deleteMany({ where: { accountId, id: { startsWith: "hp7c-role-" } } });
  for (const role of roles) {
    await db.accountRoleAssignment.create({
      data: { id: `hp7c-role-${key}-${role.toLowerCase()}`, accountId, role, grantedAt: createdAt },
    });
  }
  if (status !== "GUEST_UNCLAIMED") {
    await db.accountEmail.upsert({
      where: { normalizedEmail: email },
      update: {
        accountId,
        displayEmail: email,
        isPrimary: true,
        verificationState: emailState,
        verifiedAt: emailState === "VERIFIED" ? createdAt : null,
      },
      create: {
        id: `hp7c-email-${key}`,
        accountId,
        normalizedEmail: email,
        displayEmail: email,
        isPrimary: true,
        verificationState: emailState,
        verifiedAt: emailState === "VERIFIED" ? createdAt : null,
        createdAt,
      },
    });
    await db.accountCredential.upsert({
      where: { accountId },
      update: { passwordHash, changedAt: createdAt },
      create: { id: `hp7c-credential-${key}`, accountId, passwordHash, changedAt: createdAt, createdAt },
    });
  }
  if (community) {
    await db.communityProfile.upsert({
      where: { accountId },
      update: { handle, normalizedHandle: handle, displayName, visibility: "COMMUNITY", moderationStatus: "ACTIVE" },
      create: {
        id: `hp7c-community-${key}`,
        accountId,
        handle,
        normalizedHandle: handle,
        displayName,
        biography: "Synthetic owner-correction Community identity.",
        visibility: "COMMUNITY",
        moderationStatus: "ACTIVE",
        creatorStatus: "ACTIVE",
        createdAt,
      },
    });
  }
  return { accountId, profileId, email, displayName, handle, username: null };
}

async function seed() {
  const ownerAccount = await accountFixture({
    key: "full-capability",
    displayName: ownerDisplayName,
    roles: ["PLAYER", "CAPTAIN", "CREATOR"],
    community: true,
  });
  const aliases = {
    FULL_CAPABILITY: ownerAccount,
    ...(ownerAlias === "FULL_CAPABILITY" ? {} : { [ownerAlias]: ownerAccount }),
    ACTIVE_CHRONICLE_PLAYER: await accountFixture({
      key: "active-player",
      displayName: "Active Chronicle Test",
      roles: ["PLAYER", "CAPTAIN", "CREATOR"],
      community: true,
    }),
    UNCLAIMED_GUEST: await accountFixture({
      key: "unclaimed-guest",
      displayName: "Guest Claim Test",
      status: "GUEST_UNCLAIMED",
      roles: ["PLAYER"],
    }),
    PENDING_VERIFICATION: await accountFixture({
      key: "pending-verification",
      displayName: "Pending Verification Test",
      status: "PENDING_VERIFICATION",
      roles: ["PLAYER"],
      emailState: "PENDING",
    }),
    PENDING_EMAIL_CHANGE: await accountFixture({
      key: "pending-email-change",
      displayName: "Email Change Test",
      roles: ["PLAYER"],
    }),
    EXPORT_READY: await accountFixture({
      key: "export-ready",
      displayName: "Export Ready Test",
      roles: ["PLAYER"],
    }),
    DEACTIVATED: await accountFixture({
      key: "deactivated",
      displayName: "Deactivated Account Test",
      status: "DEACTIVATED",
      roles: ["PLAYER", "CREATOR"],
    }),
    DELETION_PENDING: await accountFixture({
      key: "deletion-pending",
      displayName: "Deletion Pending Test",
      status: "DELETION_SCHEDULED",
      roles: ["PLAYER"],
    }),
    REVIEW_EMPTY: await accountFixture({
      key: "review-empty",
      displayName: "Review Empty Test",
      roles: ["PLAYER"],
      community: true,
    }),
    REVIEW_ELIGIBLE: await accountFixture({
      key: "review-eligible",
      displayName: "Verified Completion Review Test",
      roles: ["PLAYER"],
      community: true,
    }),
    PROVIDER_COLLISION: await accountFixture({
      key: "provider-collision",
      displayName: "Provider Collision Test",
      roles: ["PLAYER"],
    }),
    EMAIL_COLLISION: await accountFixture({
      key: "email-collision",
      displayName: "Email Collision Test",
      roles: ["PLAYER"],
    }),
    RESTRICTED: await accountFixture({
      key: "restricted",
      displayName: "Restricted Correction Test",
      status: "RESTRICTED",
      roles: ["PLAYER", "CAPTAIN", "CREATOR"],
    }),
  };

  const activeSession = await db.taleSession.findFirst({
    where: { status: "ACTIVE", previewMode: false },
    orderBy: { id: "asc" },
  });
  if (!activeSession) throw new Error("HOMEPORT_PHASE7_CORRECTION_ACTIVE_CHRONICLE_REQUIRED");
  await db.playthroughMembership.upsert({
    where: {
      playthroughId_playerProfileId: {
        playthroughId: activeSession.id,
        playerProfileId: aliases.ACTIVE_CHRONICLE_PLAYER.profileId,
      },
    },
    update: { status: "ACTIVE_MEMBER", joinedAt: createdAt, removedAt: null },
    create: {
      id: "hp7c-membership-active-player",
      playthroughId: activeSession.id,
      playerProfileId: aliases.ACTIVE_CHRONICLE_PLAYER.profileId,
      role: "PLAYER",
      status: "ACTIVE_MEMBER",
      joinedAt: createdAt,
      createdAt,
    },
  });

  await db.accountToken.deleteMany({ where: { id: { startsWith: "hp7c-token-" } } });
  await db.accountToken.createMany({
    data: [
      {
        id: "hp7c-token-pending-verification",
        accountId: aliases.PENDING_VERIFICATION.accountId,
        purpose: "VERIFY_EMAIL",
        tokenHash: sha256Text(tokenMaterial.pendingVerification),
        expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt,
      },
      {
        id: "hp7c-token-pending-email-change",
        accountId: aliases.PENDING_EMAIL_CHANGE.accountId,
        purpose: "EMAIL_CHANGE",
        tokenHash: sha256Text(tokenMaterial.pendingEmailChange),
        pendingNormalizedEmail: "changed-address@owner-correction.example.test",
        pendingDisplayEmail: "changed-address@owner-correction.example.test",
        expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt,
      },
    ],
  });
  await db.accountSession.deleteMany({ where: { id: "hp7c-session-unclaimed-guest" } });
  await db.accountSession.create({
    data: {
      id: "hp7c-session-unclaimed-guest",
      accountId: aliases.UNCLAIMED_GUEST.accountId,
      tokenHash: sha256Text(tokenMaterial.guestSession),
      csrfToken: randomBytes(24).toString("base64url"),
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      deviceLabel: "Owner correction synthetic guest",
      createdAt,
    },
  });

  const identityOwner = aliases.FULL_CAPABILITY.accountId;
  for (const identity of [
    ["DISCORD", "synthetic-discord-owcr1", "Discord Correction Test", "identify"],
    ["STEAM", "76561198000000071", "Steam Correction Test", "openid"],
    ["MICROSOFT_ACCOUNT", "synthetic-microsoft-owcr1", "Microsoft Correction Test", "openid profile"],
    ["DISCORD_SIMULATOR", "collision-subject", "Collision Owner", "identify"],
  ]) {
    const [provider, providerAccountId, providerDisplayName, scopes] = identity;
    await db.externalIdentity.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      update: {
        accountId: identityOwner,
        providerDisplayName,
        allowedScopes: JSON.stringify(scopes.split(" ")),
        encryptedToken: null,
        status: "LINKED",
        revokedAt: null,
      },
      create: {
        id: `hp7c-identity-${provider.toLowerCase().replaceAll("_", "-")}`,
        accountId: identityOwner,
        provider,
        providerAccountId,
        providerDisplayName,
        allowedScopes: JSON.stringify(scopes.split(" ")),
        useForLogin: provider !== "STEAM",
        visibility: "ONLY_ME",
        status: "LINKED",
        linkedAt: createdAt,
        lastVerifiedAt: createdAt,
      },
    });
  }

  const exportManifest = {
    schemaVersion: 1,
    exportId: "hp7c-export-ready",
    accountId: aliases.EXPORT_READY.accountId,
    generatedAt: createdAt.toISOString(),
    scope: ["account.json", "profile.json"],
    exclusions: ["password hashes", "session and CSRF tokens", "one-time challenge tokens", "provider tokens"],
  };
  const exportPayload = JSON.stringify({
    manifest: exportManifest,
    files: {
      "account.json": { id: aliases.EXPORT_READY.accountId, status: "ACTIVE" },
      "profile.json": { displayName: aliases.EXPORT_READY.displayName },
    },
  });
  await db.accountDataExport.upsert({
    where: { id: "hp7c-export-ready" },
    update: {
      state: "READY",
      manifest: JSON.stringify(exportManifest),
      payload: exportPayload,
      checksum: sha256Text(exportPayload),
      readyAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "hp7c-export-ready",
      accountId: aliases.EXPORT_READY.accountId,
      state: "READY",
      manifest: JSON.stringify(exportManifest),
      payload: exportPayload,
      checksum: sha256Text(exportPayload),
      requestedAt: createdAt,
      buildingAt: createdAt,
      readyAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const lifecycleRows = [
    {
      id: "hp7c-lifecycle-deactivated",
      accountId: aliases.DEACTIVATED.accountId,
      kind: "DEACTIVATION",
      state: "COMPLETED",
      completedAt: createdAt,
      cancellableUntil: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      reason: "Synthetic owner correction deactivation",
    },
    {
      id: "hp7c-lifecycle-deletion",
      accountId: aliases.DELETION_PENDING.accountId,
      kind: "DELETION",
      state: "SCHEDULED",
      scheduledFor: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancellableUntil: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      reason: "Synthetic owner correction deletion",
    },
  ];
  for (const row of lifecycleRows) {
    await db.accountLifecycleRequest.upsert({
      where: { id: row.id },
      update: row,
      create: { ...row, requestedAt: createdAt },
    });
  }

  const listing = await db.communityListing.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      moderationStatus: "ACTIVE",
      archivedAt: null,
      removedAt: null,
      currentReleaseId: { not: null },
      owner: { visibility: "COMMUNITY", moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
    },
    orderBy: { id: "asc" },
    include: {
      currentRelease: {
        select: { sourcePublishedTaleVersionId: true, sourcePublishedTaleVersion: { select: { taleId: true } } },
      },
    },
  });
  if (!listing) throw new Error("HOMEPORT_PHASE7_CORRECTION_REVIEW_LISTING_REQUIRED");
  let reviewSourceVersionId = listing.currentRelease?.sourcePublishedTaleVersionId ?? null;
  let reviewSourceTaleId = listing.currentRelease?.sourcePublishedTaleVersion?.taleId ?? null;
  if (!reviewSourceVersionId || !reviewSourceTaleId) {
    const sourceVersion = await db.publishedTaleVersion.findFirst({
      where: { isCurrent: true, tale: { status: "PUBLISHED", visibility: "PUBLIC" } },
      select: { id: true, taleId: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
    if (!sourceVersion || !listing.currentReleaseId)
      throw new Error("HOMEPORT_PHASE7_CORRECTION_REVIEW_SOURCE_VERSION_REQUIRED");
    await db.communityRelease.update({
      where: { id: listing.currentReleaseId },
      data: { sourcePublishedTaleVersionId: sourceVersion.id },
    });
    reviewSourceVersionId = sourceVersion.id;
    reviewSourceTaleId = sourceVersion.taleId;
  }
  let completedSession = reviewSourceVersionId
    ? await db.taleSession.findFirst({
        where: {
          status: "COMPLETED",
          previewMode: false,
          publishedVersionId: reviewSourceVersionId,
        },
        orderBy: { id: "asc" },
      })
    : null;
  if (!completedSession && reviewSourceVersionId && reviewSourceTaleId) {
    completedSession = await db.taleSession.upsert({
      where: { id: "hp7c-session-review-completed" },
      update: {
        status: "COMPLETED",
        previewMode: false,
        publishedVersionId: reviewSourceVersionId,
        completedAt: createdAt,
      },
      create: {
        id: "hp7c-session-review-completed",
        taleId: reviewSourceTaleId,
        publishedVersionId: reviewSourceVersionId,
        ownerLabel: "Synthetic verified completion review",
        accessTokenHash: sha256Text("hp7c-session-review-completed-access"),
        status: "COMPLETED",
        previewMode: false,
        startedAt: new Date(createdAt.getTime() - 2 * 60 * 60 * 1000),
        completedAt: createdAt,
      },
    });
  }
  if (!completedSession) throw new Error("HOMEPORT_PHASE7_CORRECTION_COMPLETED_REVIEW_SESSION_REQUIRED");
  await db.playthroughMembership.upsert({
    where: {
      playthroughId_playerProfileId: {
        playthroughId: completedSession.id,
        playerProfileId: aliases.REVIEW_ELIGIBLE.profileId,
      },
    },
    update: { status: "COMPLETED_MEMBER", joinedAt: createdAt, completedAt: completedSession.completedAt ?? createdAt },
    create: {
      id: "hp7c-membership-review-eligible",
      playthroughId: completedSession.id,
      playerProfileId: aliases.REVIEW_ELIGIBLE.profileId,
      role: "PLAYER",
      status: "COMPLETED_MEMBER",
      joinedAt: createdAt,
      completedAt: completedSession.completedAt ?? createdAt,
      createdAt,
    },
  });
  await db.playthroughMembership.upsert({
    where: {
      playthroughId_playerProfileId: {
        playthroughId: completedSession.id,
        playerProfileId: aliases.REVIEW_EMPTY.profileId,
      },
    },
    update: { status: "COMPLETED_MEMBER", joinedAt: createdAt, completedAt: completedSession.completedAt ?? createdAt },
    create: {
      id: "hp7c-membership-review-empty",
      playthroughId: completedSession.id,
      playerProfileId: aliases.REVIEW_EMPTY.profileId,
      role: "PLAYER",
      status: "COMPLETED_MEMBER",
      joinedAt: createdAt,
      completedAt: completedSession.completedAt ?? createdAt,
      createdAt,
    },
  });
  await db.communityReview.upsert({
    where: {
      listingId_authorAccountId: {
        listingId: listing.id,
        authorAccountId: aliases.REVIEW_ELIGIBLE.accountId,
      },
    },
    update: {
      rating: 4,
      spoilerFreeBody: "A synthetic review with clear pacing and accessible clues.",
      status: "ACTIVE",
      reviewedReleaseId: listing.currentReleaseId,
      verifiedCompletion: true,
      completionSessionId: completedSession.id,
    },
    create: {
      id: "hp7c-review-active-player",
      listingId: listing.id,
      authorAccountId: aliases.REVIEW_ELIGIBLE.accountId,
      authorDisplayName: aliases.REVIEW_ELIGIBLE.displayName,
      authorHandle: aliases.REVIEW_ELIGIBLE.handle,
      rating: 4,
      spoilerFreeBody: "A synthetic review with clear pacing and accessible clues.",
      spoilerLevel: "NONE",
      status: "ACTIVE",
      reviewedReleaseId: listing.currentReleaseId,
      verifiedCompletion: true,
      completionSessionId: completedSession.id,
      createdAt,
    },
  });

  const existingAliasPath = path.join(taskRoot, "credentials", "account-aliases.private.json");
  const existing = JSON.parse(await readFile(existingAliasPath, "utf8"));
  const privateAliases = Object.fromEntries(
    Object.entries(aliases).map(([key, value]) => [
      key,
      {
        accountId: value.accountId,
        username: null,
        email: value.email,
        displayName: value.displayName,
        ...(key === "UNCLAIMED_GUEST" ? { sessionToken: tokenMaterial.guestSession } : {}),
      },
    ]),
  );
  const mergedAliases = { ...existing.aliases, ...privateAliases };
  await writeFile(existingAliasPath, `${JSON.stringify({ fixtureVersion, aliases: mergedAliases }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeFile(
    path.join(taskRoot, "tokens", "owner-correction-tokens.private.json"),
    `${JSON.stringify(tokenMaterial, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  const counts = {
    accounts: await db.userAccount.count(),
    profiles: await db.playerProfile.count(),
    roles: await db.accountRoleAssignment.count(),
    linkedIdentities: await db.externalIdentity.count(),
    exports: await db.accountDataExport.count(),
    lifecycleRequests: await db.accountLifecycleRequest.count(),
    reviews: await db.communityReview.count(),
  };
  const safeAliases = Object.fromEntries(
    Object.entries(aliases).map(([key, value]) => [
      key,
      { accountId: value.accountId, displayName: value.displayName },
    ]),
  );
  const fixtureIdentity = {
    schemaVersion: "1.0.0",
    fixtureVersion,
    classification: "SYNTHETIC_TEST_DATA",
    aliases: safeAliases,
    counts,
    activeChronicleId: activeSession.id,
    reviewListingId: listing.id,
    stateVariants: [
      "CLAIMED_VERIFIED_FULL_CAPABILITY",
      "UNCLAIMED_GUEST",
      "PENDING_EMAIL_VERIFICATION",
      "PENDING_EMAIL_CHANGE",
      "LINKED_DISCORD_STEAM_MICROSOFT",
      "PROVIDER_UNAVAILABLE_CONFIGURATION",
      "PLAYER_ONLY_GUEST",
      "ACTIVE_CHRONICLE_PLAYER",
      "NO_ACTIVE_CHRONICLE",
      "CREATOR_INITIALIZED",
      "CAPTAIN_INITIALIZED",
      "EXPORT_READY",
      "DEACTIVATION_PENDING",
      "DELETION_PENDING",
      "REVIEWS",
      "REVIEW_EMPTY",
      "FAST_NAVIGATION",
      "SLOW_NAVIGATION_OVER_500MS",
      "PROVIDER_COLLISION",
      "EMAIL_COLLISION",
      "RESTRICTED_ACCOUNT",
      "SYNTHETIC_OUTBOX",
    ],
  };
  const fixtureChecksum = sha256Text(JSON.stringify(fixtureIdentity));
  process.stdout.write(
    `${JSON.stringify({ status: `HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND${correctionRound}_FIXTURE_READY`, databasePath, ...fixtureIdentity, fixtureChecksum })}\n`,
  );
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

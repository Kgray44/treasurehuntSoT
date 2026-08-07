import { db } from "@/lib/db";
import { publicListingProjection, publicReleaseProjection } from "@/community/services";
import { personalHarborNavigation } from "@/homeport/personal-harbor-navigation";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { humanAccountState } from "@/wayfarer/account-lifecycle";

export { personalHarborNavigation, personalHarborSectionIds } from "@/homeport/personal-harbor-navigation";
export type { PersonalHarborSectionId } from "@/homeport/personal-harbor-navigation";

export async function personalInformation(accountId: string) {
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      emails: {
        where: { isPrimary: true },
        select: { displayEmail: true, verificationState: true, verifiedAt: true },
        take: 1,
      },
      profile: { select: { displayName: true, updatedAt: true } },
    },
  });
  if (!account) return null;
  const email = account.emails[0] ?? null;
  return {
    accountId: account.id,
    accountStatus: humanAccountState(account.status, email?.verificationState === "VERIFIED"),
    displayName: account.profile?.displayName ?? "Voyagewright account",
    primaryEmail: email?.displayEmail ?? null,
    emailVerificationState: email?.verificationState ?? "UNAVAILABLE",
    emailVerifiedAt: email?.verifiedAt?.toISOString() ?? null,
    emailChange: {
      status: email?.verificationState === "VERIFIED" ? ("AVAILABLE" as const) : ("VERIFICATION_REQUIRED" as const),
      reason:
        email?.verificationState === "VERIFIED"
          ? "Changing email requires the current password and verification at the new address."
          : "Verify the current primary email before requesting a change.",
    },
    createdAt: account.createdAt.toISOString(),
    revision: (account.profile?.updatedAt ?? account.updatedAt).toISOString(),
  };
}

export async function personalHarborOverview(accountId: string, profileId: string) {
  const [profile, identities, sessions, history, memories, artifacts, saves, capabilities] = await Promise.all([
    db.playerProfile.findUnique({
      where: { id: profileId },
      select: {
        displayName: true,
        handle: true,
        biography: true,
        defaultVisibility: true,
        avatarMedia: { select: { id: true, processingState: true, scanState: true, removedAt: true } },
        bannerMedia: { select: { id: true, processingState: true, scanState: true, removedAt: true } },
      },
    }),
    db.externalIdentity.count({ where: { accountId, status: "LINKED", revokedAt: null } }),
    db.accountSession.count({ where: { accountId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.playerChronicleRecord.count({ where: { playerProfileId: profileId } }),
    db.chronicleMemory.count({ where: { playerProfileId: profileId, deletedAt: null } }),
    db.playerArtifactRecord.count({ where: { playerProfileId: profileId } }),
    listSavedContent(accountId),
    workspaceCapabilityOverview(accountId),
  ]);
  const readyMedia = (
    media: { id: string; processingState: string; scanState: string; removedAt: Date | null } | null,
  ) =>
    media && media.processingState === "READY" && media.scanState === "LOCAL_VALIDATED" && !media.removedAt
      ? `/api/profile-media/${media.id}`
      : null;
  return {
    profile: {
      displayName: profile?.displayName ?? "Voyagewright account",
      handle: profile?.handle ?? null,
      biography: profile?.biography ?? null,
      defaultVisibility: profile?.defaultVisibility ?? "ONLY_ME",
      avatarUrl: readyMedia(profile?.avatarMedia ?? null),
      bannerUrl: readyMedia(profile?.bannerMedia ?? null),
      setupPrompt: profile?.handle
        ? null
        : {
            title: "Finish your public Profile",
            detail: "Choose a handle so other people can find and credit you.",
            href: "/account/profile",
          },
    },
    workspaces: capabilities.workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.label,
      state: workspace.state,
    })),
    counts: {
      linkedIdentities: identities,
      activeSessions: sessions,
      history,
      memories,
      artifacts,
      saved: saves.items.length,
    },
    destinations: personalHarborNavigation.flatMap((group) =>
      group.items.map(([sectionId, label, href]) => ({ sectionId, label, href, group: group.label })),
    ),
  };
}

export async function passportOverview(accountId: string, profileId: string) {
  const [history, memories, artifacts, saved] = await Promise.all([
    db.playerChronicleRecord.count({ where: { playerProfileId: profileId } }),
    db.chronicleMemory.count({ where: { playerProfileId: profileId, deletedAt: null } }),
    db.playerArtifactRecord.count({ where: { playerProfileId: profileId } }),
    listSavedContent(accountId),
  ]);
  return {
    sections: [
      {
        id: "history",
        label: "Chronicle History",
        href: "/passport/history",
        count: history,
        empty: "No completed or historical Voyages yet.",
      },
      {
        id: "memories",
        label: "Memories",
        href: "/passport/memories",
        count: memories,
        empty: "No private Chronicle Memories yet.",
      },
      {
        id: "artifacts",
        label: "Artifact Cabinet",
        href: "/passport/artifacts",
        count: artifacts,
        empty: "No personal artifacts have been granted yet.",
      },
      {
        id: "saved",
        label: "Saved from Community",
        href: "/passport/saved",
        count: saved.items.length,
        empty: "No eligible Community items are saved.",
      },
    ],
  };
}

export function accountDataAvailability() {
  return {
    operations: [
      {
        id: "privacy",
        label: "Review privacy controls",
        status: "AVAILABLE",
        href: "/account/privacy",
        reason: "Server-enforced Profile privacy controls are available.",
      },
      {
        id: "sessions",
        label: "Review or revoke sessions",
        status: "AVAILABLE",
        href: "/account/sessions",
        reason: "AccountSession is the accepted session authority.",
      },
      {
        id: "export",
        label: "Export account data",
        status: "REQUIRES_REAUTHENTICATION",
        href: "/account/data",
        reason: "A bounded private JSON export is available after password reauthentication.",
      },
      {
        id: "deactivate",
        label: "Deactivate account",
        status: "REQUIRES_REAUTHENTICATION",
        href: "/account/data",
        reason: "A reversible deactivation lifecycle is available after typed confirmation and reauthentication.",
      },
      {
        id: "delete",
        label: "Delete account",
        status: "REQUIRES_REAUTHENTICATION",
        href: "/account/data",
        reason:
          "Delayed deletion, cancellation, retention, and tombstone contracts are available after reauthentication.",
      },
    ],
  } as const;
}

type SavedCard = {
  subjectType: string;
  subjectId: string;
  title: string;
  summary: string | null;
  href: string;
  savedAt: string;
};

async function blockedBetween(accountId: string, ownerAccountId: string | undefined) {
  if (!ownerAccountId) return true;
  return Boolean(
    await db.communityBlock.findFirst({
      where: {
        OR: [
          { blockerAccountId: accountId, blockedAccountId: ownerAccountId },
          { blockerAccountId: ownerAccountId, blockedAccountId: accountId },
        ],
      },
      select: { id: true },
    }),
  );
}

async function savedCard(
  accountId: string,
  row: { subjectType: string; subjectId: string; createdAt: Date },
): Promise<SavedCard | null> {
  if (row.subjectType === "LISTING") {
    const listing = await db.communityListing.findFirst({
      where: {
        id: row.subjectId,
        publicationStatus: "PUBLISHED",
        visibility: { in: ["COMMUNITY", "FEATURED"] },
        moderationStatus: "ACTIVE",
        locationClass: { not: "PRIVATE_REAL_WORLD" },
        archivedAt: null,
        removedAt: null,
      },
      include: { owner: true },
    });
    if (!listing || (await blockedBetween(accountId, listing.owner.accountId))) return null;
    const value = publicListingProjection(listing);
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: value.title,
      summary: value.shortDescription,
      href: `/community/${encodeURIComponent(value.slug)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  if (row.subjectType === "RELEASE") {
    const release = await db.communityRelease.findFirst({
      where: {
        id: row.subjectId,
        moderationStatus: "ACTIVE",
        deprecatedAt: null,
        listing: {
          publicationStatus: "PUBLISHED",
          visibility: { in: ["COMMUNITY", "FEATURED"] },
          moderationStatus: "ACTIVE",
          archivedAt: null,
          removedAt: null,
        },
      },
      include: { listing: { include: { owner: true } } },
    });
    if (!release || (await blockedBetween(accountId, release.listing.owner.accountId))) return null;
    const value = publicReleaseProjection(release);
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: `${release.listing.title} ${value.semanticVersion}`,
      summary: value.releaseNotes,
      href: `/community/${encodeURIComponent(release.listing.slug)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  if (row.subjectType === "CREATOR") {
    const profile = await db.communityProfile.findFirst({
      where: {
        id: row.subjectId,
        visibility: "COMMUNITY",
        moderationStatus: "ACTIVE",
        creatorStatus: { not: "SUSPENDED" },
      },
    });
    if (!profile || (await blockedBetween(accountId, profile.accountId))) return null;
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: profile.displayName,
      summary: profile.biography,
      href: `/community/creators/${encodeURIComponent(profile.handle)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  if (row.subjectType === "VOYAGE_LOG") {
    const log = await db.communityVoyageLog.findFirst({
      where: { id: row.subjectId, visibility: "COMMUNITY", lifecycleState: "PUBLISHED", publishedAt: { not: null } },
    });
    if (!log || (await blockedBetween(accountId, log.ownerAccountId))) return null;
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: log.title,
      summary: log.safeSummary,
      href: `/community/voyage-logs/${encodeURIComponent(log.slug)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  if (row.subjectType === "COLLECTION") {
    const collection = await db.communityCollection.findFirst({
      where: { id: row.subjectId, visibility: "COMMUNITY", archivedAt: null, deletedAt: null },
    });
    if (!collection || (await blockedBetween(accountId, collection.ownerAccountId))) return null;
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: collection.title,
      summary: collection.description,
      href: `/community/collections/${encodeURIComponent(collection.slug)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  if (row.subjectType === "GUIDE") {
    const guide = await db.communityGuideContent.findFirst({
      where: { id: row.subjectId, status: "PUBLISHED", deprecatedAt: null },
    });
    if (!guide) return null;
    const owner = await db.communityProfile.findUnique({
      where: { id: guide.ownerProfileId },
      select: { accountId: true, moderationStatus: true, creatorStatus: true, visibility: true },
    });
    if (
      !owner ||
      owner.moderationStatus !== "ACTIVE" ||
      owner.creatorStatus === "SUSPENDED" ||
      owner.visibility !== "COMMUNITY" ||
      (await blockedBetween(accountId, owner.accountId))
    )
      return null;
    return {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: guide.title,
      summary: guide.safeSummary,
      href: `/community/guides/${encodeURIComponent(guide.slug)}`,
      savedAt: row.createdAt.toISOString(),
    };
  }
  return null;
}

export async function listSavedContent(accountId: string) {
  const rows = await db.communitySave.findMany({
    where: { accountId, kind: "SAVE" },
    select: { subjectType: true, subjectId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const projected = await Promise.all(rows.map((row) => savedCard(accountId, row)));
  return { items: projected.filter((item): item is SavedCard => Boolean(item)) };
}

export async function listChronicleMemories(profileId: string) {
  return {
    items: await db.chronicleMemory
      .findMany({
        where: { playerProfileId: profileId, deletedAt: null },
        select: {
          id: true,
          playerChronicleRecordId: true,
          title: true,
          body: true,
          referenceType: true,
          referenceId: true,
          createdAt: true,
          record: { select: { chronicleTitleSnapshot: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          recordId: item.playerChronicleRecordId,
          chronicleTitle: item.record.chronicleTitleSnapshot,
          title: item.title,
          body: item.body,
          referenceType: item.referenceType,
          referenceId: item.referenceId,
          createdAt: item.createdAt.toISOString(),
        })),
      ),
  };
}

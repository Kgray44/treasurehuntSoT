import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const LEGACY_COMPANION_DOMAIN = "legacy-companion";
export const LEGACY_COMPANION_MIGRATION_VERSION = "project-one-voyage-v1";

export type LegacyMigrationMode = "dry-run" | "execute" | "verify";

export type LegacyMigrationReport = {
  mode: LegacyMigrationMode;
  campaignsInspected: number;
  chroniclesCreated: number;
  publishedVersionsCreated: number;
  sessionsCreated: number;
  playersMigrated: number;
  membershipsMigrated: number;
  invitationsMigrated: number;
  chaptersTranslated: number;
  storyBlocksCreated: number;
  artifactsMigrated: number;
  sideQuestsMigrated: number;
  locationsMigrated: number;
  routesMigrated: number;
  eventsMigrated: number;
  auditRecordsMigrated: number;
  legacyIdentifiersMapped: number;
  warnings: string[];
  failures: string[];
  unmappedFields: string[];
  checksumMismatches: string[];
};

export type LegacyMigrationOptions = {
  mode?: LegacyMigrationMode;
  campaignSlug?: string;
  failFast?: boolean;
};

const legacyCampaignInclude = {
  chapters: {
    orderBy: { ordinal: "asc" },
    include: { content: true, clues: { orderBy: { ordinal: "asc" } }, hints: { orderBy: { ordinal: "asc" } } },
  },
  artifacts: { orderBy: { key: "asc" }, include: { awards: true } },
  mapLocations: { orderBy: { key: "asc" } },
  mapRoutes: { orderBy: { ordinal: "asc" } },
  sideQuests: { orderBy: { key: "asc" }, include: { objectives: { orderBy: { ordinal: "asc" } } } },
  journalEntries: { orderBy: { createdAt: "asc" } },
  events: { orderBy: { sequence: "asc" } },
  snapshots: { orderBy: { sequence: "asc" } },
  saveStates: { orderBy: { sequence: "asc" } },
  auditLogs: { orderBy: { createdAt: "asc" } },
  preparedActions: { orderBy: { preparedAt: "asc" } },
  commandExecutions: { orderBy: { createdAt: "asc" } },
  playerAccesses: { include: { audio: true, viewedContent: true, presences: true } },
} satisfies Prisma.CampaignInclude;

type LegacyCampaign = Prisma.CampaignGetPayload<{ include: typeof legacyCampaignInclude }>;
type Transaction = Prisma.TransactionClient;

function emptyReport(mode: LegacyMigrationMode): LegacyMigrationReport {
  return {
    mode,
    campaignsInspected: 0,
    chroniclesCreated: 0,
    publishedVersionsCreated: 0,
    sessionsCreated: 0,
    playersMigrated: 0,
    membershipsMigrated: 0,
    invitationsMigrated: 0,
    chaptersTranslated: 0,
    storyBlocksCreated: 0,
    artifactsMigrated: 0,
    sideQuestsMigrated: 0,
    locationsMigrated: 0,
    routesMigrated: 0,
    eventsMigrated: 0,
    auditRecordsMigrated: 0,
    legacyIdentifiersMapped: 0,
    warnings: [],
    failures: [],
    unmappedFields: [],
    checksumMismatches: [],
  };
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeJson(raw: string, fallback: Record<string, unknown> = {}) {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function jsonValue(raw: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

function sessionStatus(status: string, hasCompletedChapter: boolean) {
  if (status === "PAUSED") return "PAUSED";
  if (["COMPLETE", "COMPLETED"].includes(status) || hasCompletedChapter) return "COMPLETED";
  if (["CANCELLED", "ABANDONED"].includes(status)) return status;
  return "ACTIVE";
}

function safeAuditMetadata(raw: string) {
  const parsed = safeJson(raw);
  const entries = Object.entries(parsed).filter(([key, value]) => {
    const privateKey = /(secret|token|password|answer|narrative|snapshot|payload)/i.test(key);
    return !privateKey && ["string", "number", "boolean"].includes(typeof value);
  });
  return Object.fromEntries(entries);
}

async function createReference(
  tx: Transaction,
  report: LegacyMigrationReport,
  sourceModel: string,
  sourceId: string,
  canonicalModel: string,
  canonicalId: string,
  sourceChecksum: string,
) {
  await tx.legacyEntityReference.create({
    data: {
      sourceDomain: LEGACY_COMPANION_DOMAIN,
      sourceModel,
      sourceId,
      canonicalModel,
      canonicalId,
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
      sourceChecksum,
    },
  });
  report.legacyIdentifiersMapped += 1;
}

async function findReference(sourceModel: string, sourceId: string, canonicalModel: string) {
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

function campaignChecksum(campaign: LegacyCampaign) {
  return checksum({
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    status: campaign.status,
    sequence: campaign.currentSequence,
    updatedAt: campaign.updatedAt.toISOString(),
    chapters: campaign.chapters.map((chapter) => [chapter.id, chapter.state, chapter.updatedAt.toISOString()]),
    artifacts: campaign.artifacts.map((artifact) => [artifact.id, artifact.state, artifact.awards.length]),
    sideQuests: campaign.sideQuests.map((quest) => [quest.id, quest.state, quest.completedAt?.toISOString()]),
    events: campaign.events.map((event) => [event.id, event.sequence, event.type]),
  });
}

function publishedSnapshot(
  campaign: LegacyCampaign,
  chronicleId: string,
  chapters: Array<{ sourceId: string; id: string; blockId: string; ordinal: number; state: string }>,
  locations: Array<{ id: string; legacyKey: string | null }>,
  artifacts: Array<{ id: string; legacyKey: string | null }>,
) {
  return {
    schemaVersion: 1,
    tale: {
      id: chronicleId,
      slug: campaign.slug,
      title: campaign.title,
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: Math.max(1, campaign.playerAccesses.length),
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: chapters.map((imported) => {
      const chapter = campaign.chapters.find((candidate) => candidate.id === imported.sourceId)!;
      return {
        id: imported.id,
        title: chapter.content.title,
        subtitle: null,
        description: chapter.content.objective,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {
          sourceDomain: LEGACY_COMPANION_DOMAIN,
          sourceCampaignId: campaign.id,
          sourceChapterId: chapter.id,
          ordinal: chapter.ordinal,
          stateAtImport: chapter.state,
          relatedMapKey: chapter.relatedMapKey,
          relatedArtifactKey: chapter.relatedArtifactKey,
          relatedSideQuestKey: chapter.relatedSideQuestKey,
        },
        orderIndex: chapter.ordinal,
        entryBlockId: imported.blockId,
        completionBlockId: imported.blockId,
        blocks: [
          {
            id: imported.blockId,
            chapterId: imported.id,
            blockType: "narrative",
            title: chapter.content.title,
            internalLabel: `legacy-chapter-${chapter.ordinal}`,
            configuration: {
              heading: chapter.content.title,
              body: chapter.content.narrative,
              objective: chapter.content.objective,
              clue: chapter.clues[0]?.body ?? null,
              hints: chapter.hints.map((hint) => ({ ordinal: hint.ordinal, body: hint.body })),
              completionMode: "captainManual",
            },
            presentation: { pageTemplate: "story", pageTurnBehavior: "captain-triggered" },
            completion: { legacyStateAtImport: chapter.state },
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: chapters.find((candidate) => candidate.ordinal === imported.ordinal + 1)?.blockId ?? null,
            connections: [],
          },
        ],
      };
    }),
    assets: [],
    locations,
    artifacts,
    publishedAt: campaign.updatedAt.toISOString(),
  };
}

async function migrateCampaign(campaign: LegacyCampaign, report: LegacyMigrationReport) {
  const sourceHash = campaignChecksum(campaign);
  const existing = await findReference("Campaign", campaign.id, "Chronicle");
  if (existing) {
    if (existing.sourceChecksum !== sourceHash) {
      const mismatch = `Campaign ${campaign.slug} changed after ${LEGACY_COMPANION_MIGRATION_VERSION}; run shadow review before remigration.`;
      report.checksumMismatches.push(mismatch);
      throw new Error(mismatch);
    }
    report.warnings.push(
      `Campaign ${campaign.slug} already has a matching Chronicle mapping; no duplicate was created.`,
    );
    return;
  }

  await db.$transaction(async (tx) => {
    const raced = await tx.legacyEntityReference.findFirst({
      where: {
        sourceDomain: LEGACY_COMPANION_DOMAIN,
        sourceModel: "Campaign",
        sourceId: campaign.id,
        canonicalModel: "Chronicle",
        migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
      },
    });
    if (raced) throw new Error(`Campaign ${campaign.slug} is being migrated by another runner.`);

    const chronicle = await tx.chronicle.create({
      data: {
        slug: campaign.slug,
        title: campaign.title,
        status: "PUBLISHED",
        visibility: "PRIVATE",
        creatorId: "legacy-companion-import",
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
    });
    await createReference(tx, report, "Campaign", campaign.id, "Chronicle", chronicle.id, sourceHash);
    report.chroniclesCreated += 1;

    const draft = await tx.taleDraft.create({
      data: {
        taleId: chronicle.id,
        revisionNumber: 1,
        createdBy: "legacy-companion-import",
        validationState: "MIGRATED",
        validationSummary: JSON.stringify({ source: LEGACY_COMPANION_DOMAIN, sourceCampaignId: campaign.id }),
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
    });
    await createReference(tx, report, "Campaign", campaign.id, "TaleDraft", draft.id, sourceHash);

    const importedChapters: Array<{ sourceId: string; id: string; blockId: string; ordinal: number; state: string }> =
      [];
    for (const chapter of campaign.chapters) {
      const createdChapter = await tx.taleChapter.create({
        data: {
          draftRevisionId: draft.id,
          title: chapter.content.title,
          description: chapter.content.objective,
          orderIndex: chapter.ordinal,
          metadata: JSON.stringify({
            sourceDomain: LEGACY_COMPANION_DOMAIN,
            sourceChapterId: chapter.id,
            stateAtImport: chapter.state,
            safeTeaser: chapter.safeTeaser,
            revealedAt: chapter.revealedAt?.toISOString() ?? null,
            solvedAt: chapter.solvedAt?.toISOString() ?? null,
          }),
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        },
      });
      const block = await tx.storyBlock.create({
        data: {
          chapterId: createdChapter.id,
          blockType: "narrative",
          title: chapter.content.title,
          internalLabel: `legacy-chapter-${chapter.ordinal}`,
          orderIndex: 0,
          configuration: JSON.stringify({
            heading: chapter.content.title,
            body: chapter.content.narrative,
            objective: chapter.content.objective,
            clue: chapter.clues[0]?.body ?? null,
            hints: chapter.hints.map((hint) => ({ ordinal: hint.ordinal, body: hint.body })),
            completionMode: "captainManual",
            source: { campaignId: campaign.id, chapterId: chapter.id, ordinal: chapter.ordinal },
          }),
          presentation: JSON.stringify({ pageTemplate: "story", pageTurnBehavior: "captain-triggered" }),
          completion: JSON.stringify({ legacyStateAtImport: chapter.state }),
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        },
      });
      await tx.taleChapter.update({
        where: { id: createdChapter.id },
        data: { entryBlockId: block.id, completionBlockId: block.id },
      });
      await createReference(tx, report, "Chapter", chapter.id, "TaleChapter", createdChapter.id, checksum(chapter));
      await createReference(
        tx,
        report,
        "ChapterContent",
        chapter.content.id,
        "StoryBlock",
        block.id,
        checksum(chapter.content),
      );
      for (const clue of chapter.clues)
        await createReference(tx, report, "Clue", clue.id, "StoryBlock", block.id, checksum(clue));
      for (const hint of chapter.hints)
        await createReference(tx, report, "Hint", hint.id, "StoryBlock", block.id, checksum(hint));
      importedChapters.push({
        sourceId: chapter.id,
        id: createdChapter.id,
        blockId: block.id,
        ordinal: chapter.ordinal,
        state: chapter.state,
      });
      report.chaptersTranslated += 1;
      report.storyBlocksCreated += 1;
    }
    for (const [index, imported] of importedChapters.entries()) {
      const next = importedChapters[index + 1];
      if (next) await tx.storyBlock.update({ where: { id: imported.blockId }, data: { nextBlockId: next.blockId } });
    }

    const importedLocations: Array<{ id: string; legacyKey: string | null }> = [];
    for (const location of campaign.mapLocations) {
      const created = await tx.taleLocation.create({
        data: {
          taleId: chronicle.id,
          name: location.name,
          slug: location.key,
          legacyKey: location.key,
          locationType: location.locationType,
          safeLabel: location.safeLabel,
          exactness: location.exactness,
          mapX: location.x,
          mapY: location.y,
          mobileMapX: location.mobileX,
          mobileMapY: location.mobileY,
          region: location.regionLabel,
          generalDescription: location.description,
          playerFacingDescription: location.description,
          verificationProfile: JSON.stringify({ sourceStateAtImport: location.state, sourceId: location.id }),
          orderIndex: location.chapterOrdinal ?? 0,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        },
      });
      importedLocations.push({ id: created.id, legacyKey: created.legacyKey });
      await createReference(tx, report, "MapLocation", location.id, "TaleLocation", created.id, checksum(location));
      report.locationsMigrated += 1;
    }

    const importedArtifacts: Array<{ id: string; legacyKey: string | null }> = [];
    for (const artifact of campaign.artifacts) {
      const created = await tx.taleArtifact.create({
        data: {
          taleId: chronicle.id,
          name: artifact.name,
          shortDescription: artifact.description,
          loreDescription: artifact.discoveryText,
          ordinaryGameObjectLabel: artifact.silhouetteLabel,
          inventoryCategory: artifact.category,
          collectionGroup: artifact.assemblyGroup,
          legacyKey: artifact.key,
          safeName: artifact.safeName,
          silhouetteLabel: artifact.silhouetteLabel,
          displayX: artifact.displayX,
          displayY: artifact.displayY,
          assemblyPosition: artifact.assemblyPosition,
          connectedArtifactKey: artifact.connectedArtifactKey,
          sourceChapterOrdinal: artifact.chapterOrdinal,
          sortOrder: artifact.chapterOrdinal ?? 0,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        },
      });
      importedArtifacts.push({ id: created.id, legacyKey: created.legacyKey });
      await createReference(tx, report, "Artifact", artifact.id, "TaleArtifact", created.id, checksum(artifact));
      report.artifactsMigrated += 1;
    }

    for (const quest of campaign.sideQuests) {
      const created = await tx.taleSideQuest.create({
        data: {
          taleId: chronicle.id,
          legacyKey: quest.key,
          title: quest.title,
          safeTeaser: quest.safeTeaser,
          description: quest.description,
          rewardType: quest.rewardType,
          rewardLabel: quest.rewardLabel,
          completionSummary: quest.completionSummary,
          sourceChapterOrdinal: quest.chapterOrdinal,
          mapLocationKey: quest.mapLocationKey,
          artifactKey: quest.artifactKey,
          objectives: {
            create: quest.objectives.map((objective) => ({ ordinal: objective.ordinal, body: objective.body })),
          },
        },
        include: { objectives: true },
      });
      await createReference(tx, report, "SideQuest", quest.id, "TaleSideQuest", created.id, checksum(quest));
      for (const objective of quest.objectives) {
        const importedObjective = created.objectives.find((item) => item.ordinal === objective.ordinal);
        if (importedObjective)
          await createReference(
            tx,
            report,
            "SideQuestObjective",
            objective.id,
            "TaleSideQuestObjective",
            importedObjective.id,
            checksum(objective),
          );
      }
      report.sideQuestsMigrated += 1;
    }

    const snapshot = publishedSnapshot(campaign, chronicle.id, importedChapters, importedLocations, importedArtifacts);
    const snapshotRaw = JSON.stringify(snapshot);
    const version = await tx.publishedTaleVersion.create({
      data: {
        taleId: chronicle.id,
        versionNumber: 1,
        versionLabel: "1.0-migrated",
        publishedAt: campaign.updatedAt,
        publishedBy: "legacy-companion-import",
        releaseNotes: "Imported from the legacy Companion domain by Project One Voyage.",
        contentSnapshot: snapshotRaw,
        checksum: checksum(snapshot),
        isCurrent: true,
      },
    });
    await tx.chronicle.update({ where: { id: chronicle.id }, data: { latestPublishedVersionId: version.id } });
    await createReference(tx, report, "Campaign", campaign.id, "PublishedTaleVersion", version.id, sourceHash);
    report.publishedVersionsCreated += 1;

    const activeChapter =
      [...importedChapters].reverse().find((chapter) => ["ACTIVE", "SOLVED", "COMPLETE"].includes(chapter.state)) ??
      importedChapters.find((chapter) => chapter.state !== "LOCKED") ??
      importedChapters[0];
    const awardedArtifactIds = campaign.artifacts
      .filter((artifact) => artifact.awards.length > 0)
      .map((artifact) => importedArtifacts.find((candidate) => candidate.legacyKey === artifact.key)?.id)
      .filter((id): id is string => Boolean(id));
    const importedSequence = Math.max(campaign.currentSequence, ...campaign.events.map((event) => event.sequence), 0);
    const canonicalSession = await tx.taleSession.create({
      data: {
        taleId: chronicle.id,
        publishedVersionId: version.id,
        ownerLabel: "Imported legacy campaign",
        accessTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        status: sessionStatus(
          campaign.status,
          campaign.chapters.some((chapter) => chapter.state === "COMPLETE"),
        ),
        currentChapterId: activeChapter?.id,
        currentBlockId: activeChapter?.blockId,
        currentSequence: importedSequence,
        variables: JSON.stringify({
          legacy: {
            campaignId: campaign.id,
            sourceChecksum: sourceHash,
            finale: {
              state: campaign.finaleState,
              teaser: campaign.finaleTeaser,
              requirements: jsonValue(campaign.finaleRequirements, []),
            },
            chapters: Object.fromEntries(campaign.chapters.map((chapter) => [chapter.ordinal, chapter.state])),
            sideQuests: Object.fromEntries(
              campaign.sideQuests.map((quest) => [
                quest.key,
                { state: quest.state, objectives: quest.objectives.map((item) => item.complete) },
              ]),
            ),
            routes: Object.fromEntries(campaign.mapRoutes.map((route) => [route.key, route.state])),
            recoveryCheckpoints: campaign.saveStates.map((state) => ({
              sourceId: state.id,
              sequence: state.sequence,
              reason: state.reason,
              checksum: checksum(state.state),
              createdAt: state.createdAt.toISOString(),
            })),
          },
        }),
        inventory: JSON.stringify(awardedArtifactIds),
        startedAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        completedAt: campaign.chapters.some((chapter) => chapter.state === "COMPLETE") ? campaign.updatedAt : null,
      },
    });
    await createReference(tx, report, "Campaign", campaign.id, "TaleSession", canonicalSession.id, sourceHash);
    report.sessionsCreated += 1;

    for (const event of campaign.events) {
      const created = await tx.taleSessionEvent.create({
        data: {
          sessionId: canonicalSession.id,
          publishedVersionId: version.id,
          blockId: activeChapter?.blockId,
          eventType: `legacy.${event.type}`,
          sourceType: "legacy-companion",
          sourceId: event.actor,
          idempotencyKey: `${LEGACY_COMPANION_DOMAIN}:ProgressEvent:${event.id}`,
          payload: JSON.stringify({
            sourceEventId: event.id,
            sourcePayload: safeJson(event.payload),
            sourceVersion: event.version,
          }),
          sequence: event.sequence,
          correlationId: `legacy:${campaign.id}:${event.id}`,
          createdAt: event.createdAt,
        },
      });
      await createReference(tx, report, "ProgressEvent", event.id, "TaleSessionEvent", created.id, checksum(event));
      report.eventsMigrated += 1;
    }

    const reveal = async (
      contentType: string,
      contentKey: string,
      revealedAt: Date,
      sourceModel: string,
      sourceId: string,
    ) => {
      const created = await tx.revealState.create({
        data: {
          playthroughId: canonicalSession.id,
          contentType,
          contentKey,
          status: "REVEALED",
          revealedBy: "legacy-companion",
          revealedAt,
        },
      });
      await createReference(
        tx,
        report,
        sourceModel,
        sourceId,
        "RevealState",
        created.id,
        checksum([contentType, contentKey, revealedAt]),
      );
    };
    for (const location of campaign.mapLocations)
      if (location.revealedAt)
        await reveal("map-location", location.key, location.revealedAt, "MapLocation", location.id);
    for (const chapter of importedChapters) {
      if (chapter.state !== "LOCKED")
        await reveal("BLOCK", chapter.blockId, campaign.updatedAt, "Chapter", chapter.sourceId);
    }
    for (const route of campaign.mapRoutes) {
      if (route.revealedAt) await reveal("map-route", route.key, route.revealedAt, "MapRoute", route.id);
      report.routesMigrated += 1;
    }
    for (const artifact of campaign.artifacts)
      for (const award of artifact.awards)
        await reveal("artifact", artifact.key, award.awardedAt, "ArtifactAward", award.id);
    for (const quest of campaign.sideQuests)
      if (quest.state !== "HIDDEN")
        await reveal("side-quest", quest.key, quest.completedAt ?? campaign.updatedAt, "SideQuest", quest.id);

    for (const entry of campaign.journalEntries) {
      await createReference(tx, report, "JournalEntry", entry.id, "TaleSession", canonicalSession.id, checksum(entry));
    }
    for (const snapshotRecord of campaign.snapshots)
      await createReference(
        tx,
        report,
        "CampaignSnapshot",
        snapshotRecord.id,
        "TaleSession",
        canonicalSession.id,
        checksum(snapshotRecord),
      );
    for (const state of campaign.saveStates)
      await createReference(
        tx,
        report,
        "SaveStateSnapshot",
        state.id,
        "TaleSession",
        canonicalSession.id,
        checksum(state),
      );

    for (const access of campaign.playerAccesses) {
      const preference = access.audio
        ? {
            muted: access.audio.muted,
            masterVolume: access.audio.masterVolume,
            ambientVolume: access.audio.ambientVolume,
            effectsVolume: access.audio.effectsVolume,
            motionMode: access.audio.motionMode,
            textScale: access.audio.textScale,
            ambientEffects: access.audio.ambientEffects,
            textureIntensity: access.audio.textureIntensity,
            fullscreenPreferred: access.audio.fullscreenPreferred,
          }
        : {};
      const account = await tx.userAccount.create({ data: { status: "GUEST_UNCLAIMED" } });
      const player = await tx.playerProfile.create({
        data: {
          accountId: account.id,
          displayName: access.label ?? "Legacy Player",
          preferences: JSON.stringify({ legacyCompanion: preference }),
          createdAt: access.createdAt,
          lastSeenAt: access.lastSeenAt,
        },
      });
      await tx.accountRoleAssignment.create({ data: { accountId: account.id, role: "PLAYER" } });
      await tx.securityEvent.create({
        data: {
          accountId: account.id,
          eventType: "LEGACY_PLAYER_ACCESS_MIGRATED",
          correlationId: `legacy-player-access:${access.id}`,
          metadata: JSON.stringify({ sourceDomain: LEGACY_COMPANION_DOMAIN }),
        },
      });
      await createReference(tx, report, "PlayerAccess", access.id, "PlayerProfile", player.id, checksum(access));
      const membership = await tx.playthroughMembership.create({
        data: {
          playthroughId: canonicalSession.id,
          playerProfileId: player.id,
          role: "PLAYER",
          status: ["ACTIVE", "PAUSED"].includes(canonicalSession.status) ? "ACTIVE_MEMBER" : "COMPLETED_MEMBER",
          joinedAt: access.createdAt,
          completedAt: canonicalSession.status === "COMPLETED" ? campaign.updatedAt : null,
          createdAt: access.createdAt,
          updatedAt: campaign.updatedAt,
        },
      });
      await createReference(
        tx,
        report,
        "PlayerAccess",
        access.id,
        "PlaythroughMembership",
        membership.id,
        checksum(access),
      );
      report.playersMigrated += 1;
      report.membershipsMigrated += 1;
      if (access.audio)
        await createReference(
          tx,
          report,
          "AudioPreference",
          access.audio.id,
          "PlayerProfile",
          player.id,
          checksum(access.audio),
        );
      for (const viewed of access.viewedContent) {
        const created = await tx.revealState.create({
          data: {
            playthroughId: canonicalSession.id,
            contentType: `acknowledgement:${viewed.contentType}`,
            contentKey: `${player.id}:${viewed.contentKey}`,
            status: "ACKNOWLEDGED",
            revealedBy: player.id,
            revealedAt: viewed.viewedAt,
          },
        });
        await createReference(tx, report, "ViewedContent", viewed.id, "RevealState", created.id, checksum(viewed));
      }
      for (const presence of access.presences)
        await createReference(
          tx,
          report,
          "PlayerPresence",
          presence.id,
          "TaleSession",
          canonicalSession.id,
          checksum(presence),
        );
    }

    // Viewed ceremonies are keyed by Campaign rather than PlayerAccess in the
    // legacy schema. Preserve each acknowledgement as a canonical reveal
    // acknowledgement without treating it as a progression event.
    const ceremonies = await tx.viewedCeremony.findMany({
      where: { campaignId: campaign.id },
      orderBy: { viewedAt: "asc" },
    });
    for (const ceremony of ceremonies) {
      const created = await tx.revealState.upsert({
        where: {
          playthroughId_contentType_contentKey: {
            playthroughId: canonicalSession.id,
            contentType: "acknowledgement:ceremony",
            contentKey: `${ceremony.deviceId}:${ceremony.eventId}`,
          },
        },
        update: {},
        create: {
          playthroughId: canonicalSession.id,
          contentType: "acknowledgement:ceremony",
          contentKey: `${ceremony.deviceId}:${ceremony.eventId}`,
          status: "ACKNOWLEDGED",
          revealedBy: "legacy-companion",
          revealedAt: ceremony.viewedAt,
        },
      });
      await createReference(tx, report, "ViewedCeremony", ceremony.id, "RevealState", created.id, checksum(ceremony));
    }

    for (const audit of campaign.auditLogs) {
      const created = await tx.platformAuditEvent.create({
        data: {
          actorType: audit.userId ? "STAFF" : "LEGACY_SYSTEM",
          actorId: audit.userId,
          action: `LEGACY_${audit.action}`,
          resourceType: "CHRONICLE_SESSION",
          resourceId: canonicalSession.id,
          outcome: audit.outcome,
          correlationId: audit.correlationId ?? `legacy-audit:${audit.id}`,
          metadata: JSON.stringify({
            sourceAuditId: audit.id,
            reason: audit.reason,
            metadata: safeAuditMetadata(audit.metadata),
          }),
          createdAt: audit.createdAt,
        },
      });
      await createReference(tx, report, "AdminAuditLog", audit.id, "PlatformAuditEvent", created.id, checksum(audit));
      report.auditRecordsMigrated += 1;
    }
    for (const action of campaign.preparedActions) {
      const created = await tx.platformAuditEvent.create({
        data: {
          actorType: "LEGACY_SYSTEM",
          actorId: action.preparedBy,
          action: "LEGACY_PREPARED_ACTION_IMPORTED",
          resourceType: "CHRONICLE_SESSION",
          resourceId: canonicalSession.id,
          outcome: action.status,
          correlationId: `legacy-prepared:${action.id}`,
          metadata: JSON.stringify({
            command: action.command,
            targetKey: action.targetKey,
            expectedSequence: action.expectedSequence,
          }),
          createdAt: action.preparedAt,
        },
      });
      await createReference(
        tx,
        report,
        "PreparedAction",
        action.id,
        "PlatformAuditEvent",
        created.id,
        checksum(action),
      );
      report.auditRecordsMigrated += 1;
    }
    for (const execution of campaign.commandExecutions) {
      const created = await tx.platformAuditEvent.create({
        data: {
          actorType: "LEGACY_SYSTEM",
          action: "LEGACY_COMMAND_EXECUTION_IMPORTED",
          resourceType: "CHRONICLE_SESSION",
          resourceId: canonicalSession.id,
          outcome: execution.status,
          correlationId: execution.correlationId,
          metadata: JSON.stringify({
            command: execution.command,
            expectedSequence: execution.expectedSequence,
            sourceId: execution.id,
          }),
          createdAt: execution.createdAt,
        },
      });
      await createReference(
        tx,
        report,
        "CommandExecution",
        execution.id,
        "PlatformAuditEvent",
        created.id,
        checksum(execution),
      );
      report.auditRecordsMigrated += 1;
    }
  });
}

async function verifyCampaign(campaign: LegacyCampaign, report: LegacyMigrationReport) {
  const root = await findReference("Campaign", campaign.id, "Chronicle");
  const version = await findReference("Campaign", campaign.id, "PublishedTaleVersion");
  const session = await findReference("Campaign", campaign.id, "TaleSession");
  if (!root || !version || !session) {
    report.failures.push(`Campaign ${campaign.slug} is missing Chronicle, published-version, or session mapping.`);
    return;
  }
  if (root.sourceChecksum !== campaignChecksum(campaign)) {
    report.checksumMismatches.push(`Campaign ${campaign.slug} source checksum changed after migration.`);
    return;
  }
  const canonical = await db.chronicle.findUnique({
    where: { id: root.canonicalId },
    include: {
      drafts: { include: { chapters: { include: { blocks: true } } } },
      locations: true,
      storyArtifacts: true,
      sideQuests: true,
    },
  });
  const runtime = await db.taleSession.findUnique({
    where: { id: session.canonicalId },
    include: { events: true, memberships: true },
  });
  if (!canonical || !runtime || runtime.publishedVersionId !== version.canonicalId) {
    report.failures.push(`Campaign ${campaign.slug} has a broken canonical relation.`);
    return;
  }
  const draft = canonical.drafts.find((item) => item.revisionNumber === 1);
  const mismatch = (label: string, legacy: number, actual: number) => {
    if (legacy !== actual)
      report.failures.push(`${campaign.slug}: ${label} mismatch (${legacy} legacy, ${actual} canonical).`);
  };
  mismatch("chapters", campaign.chapters.length, draft?.chapters.length ?? 0);
  mismatch(
    "story blocks",
    campaign.chapters.length,
    draft?.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0) ?? 0,
  );
  mismatch("artifacts", campaign.artifacts.length, canonical.storyArtifacts.length);
  mismatch("side quests", campaign.sideQuests.length, canonical.sideQuests.length);
  mismatch("locations", campaign.mapLocations.length, canonical.locations.length);
  mismatch("events", campaign.events.length, runtime.events.length);
  mismatch("memberships", campaign.playerAccesses.length, runtime.memberships.length);
  if (runtime.currentSequence < campaign.currentSequence)
    report.failures.push(
      `${campaign.slug}: canonical sequence regressed from ${campaign.currentSequence} to ${runtime.currentSequence}.`,
    );
}

export async function migrateLegacyCompanion(options: LegacyMigrationOptions = {}): Promise<LegacyMigrationReport> {
  const mode = options.mode ?? "execute";
  const report = emptyReport(mode);
  const campaigns = await db.campaign.findMany({
    where: options.campaignSlug ? { slug: options.campaignSlug } : undefined,
    include: legacyCampaignInclude,
    orderBy: { slug: "asc" },
  });
  if (options.campaignSlug && !campaigns.length)
    throw new Error(`No legacy Campaign has slug ${options.campaignSlug}.`);
  report.campaignsInspected = campaigns.length;
  if (mode === "dry-run") {
    for (const campaign of campaigns) {
      report.chaptersTranslated += campaign.chapters.length;
      report.storyBlocksCreated += campaign.chapters.length;
      report.artifactsMigrated += campaign.artifacts.length;
      report.sideQuestsMigrated += campaign.sideQuests.length;
      report.locationsMigrated += campaign.mapLocations.length;
      report.routesMigrated += campaign.mapRoutes.length;
      report.eventsMigrated += campaign.events.length;
      report.playersMigrated += campaign.playerAccesses.length;
      report.membershipsMigrated += campaign.playerAccesses.length;
      report.auditRecordsMigrated +=
        campaign.auditLogs.length + campaign.preparedActions.length + campaign.commandExecutions.length;
    }
    return report;
  }
  if (mode === "verify") {
    for (const campaign of campaigns) await verifyCampaign(campaign, report);
    return report;
  }

  const run = await db.legacyMigrationRun.create({
    data: {
      migrationVersion: LEGACY_COMPANION_MIGRATION_VERSION,
      mode,
      status: "RUNNING",
      sourceSelector: options.campaignSlug ?? null,
    },
  });
  for (const campaign of campaigns) {
    try {
      await migrateCampaign(campaign, report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown migration failure.";
      report.failures.push(message);
      if (options.failFast ?? true) break;
    }
  }
  await db.legacyMigrationRun.update({
    where: { id: run.id },
    data: {
      status: report.failures.length ? "FAILED" : "COMPLETED",
      report: JSON.stringify({
        ...report,
        warnings: report.warnings.slice(0, 100),
        failures: report.failures.slice(0, 100),
      }),
      completedAt: new Date(),
    },
  });
  return report;
}

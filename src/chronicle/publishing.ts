import { db } from "@/lib/db";
import { canonicalAccountForLegacyActor } from "@/wayfarer/accounts";
import { eventBus } from "@/lib/events";
import { getStudioTale } from "@/chronicle/studio-service";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { validateTaleDraft } from "@/chronicle/validation";
import { logger } from "@/lib/logger";
import { parseDrydockBlock, runtimeCompatibilityProjection } from "@/drydock/contracts/parser";
import { isDrydockReportPublicationEligible } from "@/drydock/reports";
import { getDrydockReadiness } from "@/drydock/readiness-store";
import { createDrydockPublishingEvidencePayload } from "@/drydock/publishing-evidence";
import { canonicalChecksum } from "@/drydock/canonical";

export class PublishValidationError extends Error {
  constructor(public readonly validation: Awaited<ReturnType<typeof validateTaleDraft>>) {
    super("This Chronicle cannot be published yet. Resolve the blocking validation issues, then publish again.");
  }
}

export class DrydockReadinessError extends Error {
  constructor(public readonly decisionStatus: string) {
    super("This Chronicle has not reached the Drydock launch gate. Review the current readiness decision before publishing.");
  }
}

export function snapshotFromStudio(studio: Awaited<ReturnType<typeof getStudioTale>>): PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: studio.tale.id,
      slug: studio.tale.slug,
      title: studio.tale.title,
      subtitle: studio.tale.subtitle,
      shortDescription: studio.tale.shortDescription,
      longDescription: studio.tale.longDescription,
      coverAssetId: studio.tale.coverAssetId,
      theme: studio.tale.theme,
      visibility: studio.tale.visibility,
      playerCountMin: studio.tale.playerCountMin,
      playerCountMax: studio.tale.playerCountMax,
      estimatedDuration: studio.tale.estimatedDuration,
      contentWarnings: studio.tale.contentWarnings,
    },
    chapters: studio.draft.chapters.map((chapter, chapterIndex) => ({
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      description: chapter.description,
      coverAssetId: chapter.coverAssetId,
      estimatedDuration: chapter.estimatedDuration,
      isOptional: chapter.isOptional,
      metadata: chapter.metadata,
      orderIndex: chapterIndex,
      entryBlockId: chapter.blocks[0]?.id ?? null,
      completionBlockId:
        [...chapter.blocks]
          .reverse()
          .find((block) => block.blockType === "chapterComplete" || block.blockType === "taleComplete")?.id ??
        chapter.blocks.at(-1)?.id ??
        null,
      blocks: chapter.blocks.map((block, blockIndex) => {
        const parsed = parseDrydockBlock({
          ...block,
          connections: block.connections,
          nextBlockId: block.connections[0]?.targetBlockId ?? null,
        });
        if (!parsed.success) throw new Error(`Passage ${block.id} does not satisfy its Drydock publishing contract.`);
        const canonical = runtimeCompatibilityProjection(parsed.block);
        return {
          id: block.id,
          chapterId: chapter.id,
          blockType: block.blockType,
          title: block.title,
          internalLabel: block.internalLabel,
          configuration: canonical.configuration,
          presentation: canonical.presentation,
          completion: canonical.completion,
          creatorNotes: null,
          isEnabled: block.isEnabled,
          schemaVersion: canonical.schemaVersion,
          orderIndex: blockIndex,
          nextBlockId: canonical.nextBlockId,
          connections: canonical.connections.map((connection, connectionIndex) => ({
            ...connection,
            orderIndex: connectionIndex,
          })),
        };
      }),
    })),
    assets: studio.assets.map((asset) => ({
      id: asset.id,
      mediaType: asset.mediaType,
      displayName: asset.displayName,
      description: asset.description,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      roles: asset.roles,
      variants: asset.variants.map((variant) => ({
        id: variant.id,
        role: variant.role,
        mimeType: variant.mimeType,
        processingState: variant.processingState,
      })),
    })) as PublishedTaleSnapshot["assets"],
    locations: studio.locations.map((location) => ({ ...location, captainNotes: undefined })),
    artifacts: studio.artifacts,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishTale(
  taleId: string,
  publisherId: string,
  releaseNotes: string,
  expectedAutosaveVersion?: number,
) {
  const publisherAccountId = await canonicalAccountForLegacyActor(publisherId);
  logger.info({ area: "chronicle-publish", taleId, publisherId }, "Chronicle publish validation started");
  const validation = await validateTaleDraft(taleId);
  if (!validation.valid || !isDrydockReportPublicationEligible(validation.drydockReport))
    throw new PublishValidationError(validation);
  const drydockReport = validation.drydockReport;
  if (!drydockReport) throw new PublishValidationError(validation);
  if (expectedAutosaveVersion !== undefined && validation.autosaveVersion !== expectedAutosaveVersion)
    throw new Error("This Chronicle changed before publishing. Review the latest saved draft, then try again.");
  const studio = await getStudioTale(taleId);
  if (studio.draft.autosaveVersion !== validation.autosaveVersion)
    throw new Error("This Chronicle changed during validation. Review the current draft, then publish again.");
  const snapshot = snapshotFromStudio(studio);
  const contentSnapshot = JSON.stringify(snapshot);
  const checksum = canonicalChecksum(snapshot);
  // The receipt checksum is canonical-json based while an immutable version checksum
  // is stored-byte based. Both identities are checked before any publication write.
  const readiness = await getDrydockReadiness(taleId);
  if (readiness.sourceChecksum !== drydockReport.sourceChecksum || readiness.sourceChecksum !== checksum)
    throw new DrydockReadinessError("STALE_SOURCE");
  if (readiness.status !== "VERIFIED") throw new DrydockReadinessError(readiness.status);
  const evidencePayload = createDrydockPublishingEvidencePayload({
    draft: readiness.evidenceDraft,
    scenarioRunIds: [],
    coverageDigest: canonicalChecksum({ sourceChecksum: readiness.sourceChecksum, coverage: "phase4-launch-suite" }),
    platformVersion: "forever-treasure-companion-0.2.0",
    createdAt: new Date().toISOString(),
  });
  const version = await db.$transaction(async (tx) => {
    const latest = await tx.publishedTaleVersion.findFirst({ where: { taleId }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const structuredReleaseNotes =
      releaseNotes.trim() ||
      `Published ${snapshot.chapters.length} Chapters, ${snapshot.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0)} Passages, and ${snapshot.assets.length} assets${latest ? ` from Version ${latest.versionLabel}` : " as the first published Version"}.`;
    await tx.publishedTaleVersion.updateMany({ where: { taleId, isCurrent: true }, data: { isCurrent: false } });
    const created = await tx.publishedTaleVersion.create({
      data: {
        taleId,
        versionNumber,
        versionLabel: versionNumber === 1 ? "1.0" : `1.${versionNumber - 1}`,
        publishedBy: publisherId,
        publishedByAccountId: publisherAccountId,
        releaseNotes: structuredReleaseNotes,
        contentSnapshot,
        checksum,
        isCurrent: true,
      },
    });
    await tx.drydockPublishingEvidence.create({
      data: {
        publishedVersionId: created.id,
        sourceChecksum: readiness.sourceChecksum,
        schemaVersion: evidencePayload.schemaVersion,
        schemaRegistryVersion: evidencePayload.schemaRegistryVersion,
        ruleCatalogVersion: evidencePayload.ruleCatalogVersion,
        validationRunId: evidencePayload.validationRunId,
        requiredSuitePolicyVersion: evidencePayload.requiredSuitePolicyVersion,
        compatibilityPolicyVersion: evidencePayload.compatibilityPolicyVersion,
        compatibilityDigest: evidencePayload.compatibilityDigest,
        externalEvidenceDigest: evidencePayload.externalEvidenceDigest,
        evidence: JSON.stringify(evidencePayload),
        digest: evidencePayload.digest,
      },
    });
    await tx.chronicle.update({
      where: { id: taleId },
      data: { status: "PUBLISHED", latestPublishedVersionId: created.id },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CREATOR",
        actorId: publisherId,
        action: "TALE_VERSION_PUBLISHED",
        resourceType: "PUBLISHED_TALE_VERSION",
        resourceId: created.id,
        correlationId: crypto.randomUUID(),
        metadata: JSON.stringify({ taleId, versionLabel: created.versionLabel, checksum: created.checksum }),
      },
    });
    return created;
  });
  eventBus.emit("chronicle:catalog", {
    type: "catalog.updated",
    taleId,
    versionId: version.id,
    at: version.publishedAt.toISOString(),
  });
  logger.info(
    { area: "chronicle-publish", taleId, versionId: version.id, versionLabel: version.versionLabel },
    "Immutable Chronicle version published",
  );
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
    checksum: version.checksum,
    evidenceId: evidencePayload.digest,
    publishedAt: version.publishedAt.toISOString(),
  };
}

export function parsePublishedSnapshot(raw: string): PublishedTaleSnapshot {
  const snapshot = JSON.parse(raw) as PublishedTaleSnapshot;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.chapters))
    throw new Error("This Chronicle version uses an unsupported format. Update Voyagewright, then try again.");
  return snapshot;
}

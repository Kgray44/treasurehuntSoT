import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  checksumReusableEnvelope,
  parseReusableEnvelope,
  planReusableInsertion,
  applyReusableInsertion,
  type ReusableContentEnvelope,
} from "@/studio/reusable-content";
import { createReusableAuthoringItem, getReusableAuthoringItemVersion } from "@/studio/reusable-library-service";
import type { DraftState } from "@/components/studio/studio-types";
import { approveCreatorReusablePublication, reviewCreatorReusablePublication } from "./creator-reusable-moderation";
import { installCreatorReusableRelease, reviewCreatorReusableInstallation } from "./creator-reusable-installation";
import { preflightCreatorReusablePublication, submitCreatorReusablePublication } from "./creator-reusable-publication";
import { getPublicListingBySlug } from "./services";
import { getHomeportListingDetail } from "./homeport";
import { listCreatorInstalledCommunityItems } from "./creator-installed-library";

const isolated = /^file:.*validation-isolated-sc07-[^/\\]*\.db$/i.test(process.env.DATABASE_URL ?? "");

function savedEnvelope(ownerId: string, kind: "PRESET" | "CHAPTER_TEMPLATE") {
  const blockId = randomUUID();
  const chapterId = randomUUID();
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId: randomUUID(),
    versionId: randomUUID(),
    kind,
    name: kind === "PRESET" ? "Harbor welcome" : "Harbor opening",
    description: "A fictional introduction for another Creator.",
    tags: ["intro"],
    ownerId,
    blocks: [
      {
        id: blockId,
        blockType: "narrative",
        title: "Welcome",
        configuration: { body: "Welcome to the fictional harbor." },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 1,
      },
    ],
    chapters:
      kind === "CHAPTER_TEMPLATE"
        ? [{ id: chapterId, title: "Opening", isOptional: false, metadata: {}, blockIds: [blockId] }]
        : [],
    entryPorts: [],
    exitPorts: [],
    parameters: [],
    dependencies: { assetIds: [], artifactIds: [], locationIds: [], providerIds: [] },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: ownerId, modified: false },
    lineage: [],
    compatibility: { minimumReaderVersion: 1, blockContractVersions: { narrative: 1 } },
  };
  return { ...unsigned, checksum: checksumReusableEnvelope(unsigned) } satisfies ReusableContentEnvelope;
}

const destination: DraftState = {
  tale: {
    id: "destination-tale",
    slug: "destination",
    title: "Destination",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "CARTOGRAPHERS_TABLE",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: null,
    contentWarnings: null,
    latestPublishedVersionId: null,
  },
  chapters: [{ id: "destination-chapter", title: "Start", isOptional: false, metadata: {}, blocks: [] }],
};

describe.skipIf(!isolated)("SC-07 Creator reusable Community journey", () => {
  it.each(["PRESET", "CHAPTER_TEMPLATE"] as const)(
    "publishes %s and lets a second Creator install and reuse it privately",
    async (kind) => {
      const ownerId = randomUUID();
      const installerId = randomUUID();
      const moderatorId = randomUUID();
      const suffix = randomUUID().slice(0, 8);
      for (const id of [ownerId, installerId, moderatorId])
        await db.userAccount.create({ data: { id, status: "ACTIVE" } });
      for (const [accountId, name, handle] of [
        [ownerId, "Synthetic Creator", `sc07-owner-${suffix}`],
        [installerId, "Synthetic Installer", `sc07-installer-${suffix}`],
      ])
        await db.playerProfile.create({
          data: {
            accountId,
            displayName: name,
            handle,
            normalizedHandle: handle,
            defaultVisibility: "PUBLIC",
            status: "ACTIVE",
          },
        });
      await db.communityLicensePolicy.upsert({
        where: { key: "SC07_TEST_REUSE" },
        create: {
          key: "SC07_TEST_REUSE",
          displayName: "Synthetic reuse",
          allowsPrivateUse: true,
          allowsPublicUse: true,
          allowsRedistribution: true,
          allowsModification: true,
          requiresAttribution: true,
          active: true,
        },
        update: {},
      });
      const source = savedEnvelope(ownerId, kind);
      await createReusableAuthoringItem(ownerId, source);
      const input = {
        source: { itemId: source.itemId, versionId: source.versionId },
        slug: `sc07-${kind.toLowerCase().replaceAll("_", "-")}-${suffix}`,
        title: source.name,
        description: source.description,
        tags: ["intro"],
        licenseKey: "SC07_TEST_REUSE",
        rightsAcknowledged: true as const,
      };
      const review = await preflightCreatorReusablePublication(ownerId, input);
      expect(review.included.checksum).toBe(source.checksum);
      const pending = await submitCreatorReusablePublication(ownerId, input, review.reviewDigest);
      expect(pending.publicationStatus).toBe("READY_FOR_REVIEW");
      expect(await getPublicListingBySlug(input.slug)).toBeNull();
      await expect(reviewCreatorReusableInstallation(installerId, pending.listingId)).rejects.toMatchObject({
        code: "COMMUNITY_LISTING_NOT_FOUND",
      });
      const moderator = { accountId: moderatorId, roles: ["MODERATOR"] };
      const moderation = await reviewCreatorReusablePublication(moderator, pending.listingId);
      expect(moderation.included.checksum).toBe(source.checksum);
      await expect(
        approveCreatorReusablePublication({ accountId: ownerId, roles: ["MODERATOR"] }, pending.listingId, {
          releaseId: pending.releaseId,
          packageChecksum: moderation.packageChecksum,
          packageReviewed: true,
        }),
      ).rejects.toMatchObject({ code: "COMMUNITY_SELF_MODERATION_FORBIDDEN" });
      await approveCreatorReusablePublication(moderator, pending.listingId, {
        releaseId: pending.releaseId,
        packageChecksum: moderation.packageChecksum,
        packageReviewed: true,
      });
      expect(await getPublicListingBySlug(input.slug)).not.toBeNull();
      const publicDetail = await getHomeportListingDetail(input.slug);
      expect(publicDetail?.creatorInstallEligible).toBe(true);
      expect(JSON.stringify(publicDetail)).not.toContain("Welcome to the fictional harbor.");
      const installReview = await reviewCreatorReusableInstallation(installerId, pending.listingId);
      expect(installReview.releaseId).toBe(pending.releaseId);
      await expect(
        installCreatorReusableRelease({
          accountId: installerId,
          listingId: pending.listingId,
          releaseId: installReview.releaseId,
          packageChecksum: "0".repeat(64),
          requestId: `sc07-${randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: "COMMUNITY_REVIEW_STALE" });
      const installed = await installCreatorReusableRelease({
        accountId: installerId,
        listingId: pending.listingId,
        releaseId: installReview.releaseId,
        packageChecksum: installReview.packageChecksum,
        requestId: `sc07-${randomUUID()}`,
      });
      expect(installed.status).toBe("COMMITTED");
      expect((await reviewCreatorReusableInstallation(installerId, pending.listingId)).studioUrl).toBe(
        "/studio/exchange#installed-community",
      );
      const installedList = await listCreatorInstalledCommunityItems(installerId);
      expect(installedList).toContainEqual(
        expect.objectContaining({
          itemId: installed.itemId,
          releaseId: pending.releaseId,
          packageChecksum: installReview.packageChecksum,
          credits: ["Synthetic Creator"],
        }),
      );
      expect(await listCreatorInstalledCommunityItems(ownerId)).not.toContainEqual(
        expect.objectContaining({ itemId: installed.itemId }),
      );
      const privateItem = await getReusableAuthoringItemVersion(installerId, installed.itemId);
      expect(privateItem.envelope.ownerId).toBe(installerId);
      expect(privateItem.envelope.attribution.sourceOwnerId).toBe(ownerId);
      expect(privateItem.envelope.attribution.sourceReleaseId).toBe(pending.releaseId);
      const receipt = await db.communityInstallation.findFirstOrThrow({
        where: { accountId: installerId, releaseId: pending.releaseId },
      });
      expect(receipt.installedPackageChecksum).toBe(installReview.packageChecksum);
      const reusable = parseReusableEnvelope(privateItem.envelope);
      const plan = planReusableInsertion({
        envelope: reusable,
        draft: destination,
        operationId: randomUUID(),
        targetChapterId: destination.chapters[0].id,
      });
      const changed = applyReusableInsertion(destination, plan);
      expect(changed.chapters.some((chapter) => chapter.blocks.some((block) => block.title === "Welcome"))).toBe(true);
      await expect(getReusableAuthoringItemVersion(ownerId, installed.itemId)).rejects.toThrow();
    },
  );
});

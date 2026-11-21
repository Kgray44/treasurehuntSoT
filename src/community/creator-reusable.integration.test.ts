import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createStudioTale,
  forkPublishedVersion,
  getStudioTale,
  restorePublishedVersionToDraft,
  saveStudioDraft,
} from "@/chronicle/studio-service";
import { freezeChronicleFixture } from "../../tests/fixtures/sc07-chronicle";
import { preflightCreatorChroniclePublication } from "./creator-chronicle-publication";
import { createReusableFixtureEnvelope } from "../../tests/fixtures/sc07-reusable";
import { parseReusableEnvelope, planReusableInsertion, applyReusableInsertion } from "@/studio/reusable-content";
import {
  createChapterTemplate,
  createReusableAuthoringItem,
  getReusableAuthoringItemVersion,
} from "@/studio/reusable-library-service";
import type { DraftState } from "@/components/studio/studio-types";
import { decideCreatorReusablePublication, reviewCreatorReusablePublication } from "./creator-reusable-moderation";
import { installCreatorReusableRelease, reviewCreatorReusableInstallation } from "./creator-reusable-installation";
import { preflightCreatorReusablePublication, submitCreatorReusablePublication } from "./creator-reusable-publication";
import { getPublicListingBySlug } from "./services";
import { getHomeportListingDetail } from "./homeport";
import { listCreatorInstalledCommunityItems } from "./creator-installed-library";

const isolated = /^file:.*validation-isolated-sc07-[^/\\]*\.db$/i.test(process.env.DATABASE_URL ?? "");

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
      const source = createReusableFixtureEnvelope(ownerId, kind);
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
      const invalid = createReusableFixtureEnvelope(ownerId, kind, "");
      await createReusableAuthoringItem(ownerId, invalid);
      await expect(
        preflightCreatorReusablePublication(ownerId, {
          ...input,
          source: { itemId: invalid.itemId, versionId: invalid.versionId },
        }),
      ).rejects.toMatchObject({ code: "COMMUNITY_PASSAGE_CONTRACT_INVALID" });
      const review = await preflightCreatorReusablePublication(ownerId, input);
      expect(review.included.checksum).toBe(source.checksum);
      const pending = await submitCreatorReusablePublication(ownerId, input, review.reviewDigest);
      expect(pending.publicationStatus).toBe("READY_FOR_REVIEW");
      expect(await getPublicListingBySlug(input.slug)).toBeNull();
      await expect(reviewCreatorReusableInstallation(installerId, pending.listingId)).rejects.toMatchObject({
        code: "COMMUNITY_LISTING_NOT_FOUND",
      });
      const moderator = { accountId: moderatorId, roles: ["MODERATOR"] };
      const rejectedInput = { ...input, slug: `${input.slug}-rejected` };
      const rejectedPreflight = await preflightCreatorReusablePublication(ownerId, rejectedInput);
      const rejection = await submitCreatorReusablePublication(ownerId, rejectedInput, rejectedPreflight.reviewDigest);
      const rejectedReview = await reviewCreatorReusablePublication(moderator, rejection.listingId);
      const rejected = await decideCreatorReusablePublication(moderator, rejection.listingId, {
        releaseId: rejection.releaseId,
        packageChecksum: rejectedReview.packageChecksum,
        packageReviewed: true,
        decision: "REJECT",
        reason: "This synthetic listing needs clearer public credit.",
      });
      expect(rejected.publicationStatus).toBe("REJECTED");
      expect(await getPublicListingBySlug(rejectedInput.slug)).toBeNull();
      await expect(reviewCreatorReusableInstallation(installerId, rejection.listingId)).rejects.toMatchObject({
        code: "COMMUNITY_LISTING_NOT_FOUND",
      });
      const revisionInput = {
        ...rejectedInput,
        listingId: rejection.listingId,
        description: "A fictional introduction with clear credit.",
      };
      const revisionReview = await preflightCreatorReusablePublication(ownerId, revisionInput);
      const revised = await submitCreatorReusablePublication(ownerId, revisionInput, revisionReview.reviewDigest);
      expect(revised).toMatchObject({
        listingId: rejection.listingId,
        semanticVersion: "2.0.0",
        publicationStatus: "READY_FOR_REVIEW",
      });
      expect(revised.releaseId).not.toBe(rejection.releaseId);
      expect(
        (await db.communityRelease.findUniqueOrThrow({ where: { id: rejection.releaseId } })).packageChecksum,
      ).toBe(rejectedReview.packageChecksum);
      expect(await getPublicListingBySlug(rejectedInput.slug)).toBeNull();
      const moderation = await reviewCreatorReusablePublication(moderator, pending.listingId);
      expect(moderation.included.checksum).toBe(source.checksum);
      await expect(
        decideCreatorReusablePublication({ accountId: ownerId, roles: ["MODERATOR"] }, pending.listingId, {
          releaseId: pending.releaseId,
          packageChecksum: moderation.packageChecksum,
          packageReviewed: true,
        }),
      ).rejects.toMatchObject({ code: "COMMUNITY_SELF_MODERATION_FORBIDDEN" });
      await decideCreatorReusablePublication(moderator, pending.listingId, {
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
      const installInput = {
        accountId: installerId,
        listingId: pending.listingId,
        releaseId: installReview.releaseId,
        packageChecksum: installReview.packageChecksum,
      };
      const attempts = await Promise.all(
        [1, 2].map(() =>
          installCreatorReusableRelease({
            ...installInput,
            requestId: `sc07-${randomUUID()}`,
          }),
        ),
      );
      const installed = attempts.find((attempt) => attempt.status === "COMMITTED")!;
      expect(attempts.map((attempt) => attempt.status).sort()).toEqual(["ALREADY_INSTALLED", "COMMITTED"]);
      expect(attempts[0].itemId).toBe(attempts[1].itemId);
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
      if (kind === "CHAPTER_TEMPLATE") {
        const draft = await createStudioTale({
          creatorId: installerId,
          title: "Private reuse",
          slug: `sc07-derivative-${suffix}`,
        });
        const studio = await getStudioTale(draft.id);
        const originalChapter = studio.draft.chapters[0];
        const originalPassage = { ...source.blocks[0], id: randomUUID(), nextBlockId: null, connections: [] };
        const current = { tale: studio.tale, chapters: [{ ...originalChapter, blocks: [originalPassage] }] };
        const insertion = planReusableInsertion({ envelope: reusable, draft: current, operationId: randomUUID() });
        const workingCopy = applyReusableInsertion(current, insertion);
        const save = {
          ...workingCopy,
          autosaveVersion: studio.draft.autosaveVersion,
          reusableUsage: {
            itemId: privateItem.envelope.itemId,
            versionId: privateItem.envelope.versionId,
            sourceKind: "FRAGMENT_INSERTED",
            insertedBlockIds: Object.values(insertion.remap.blocks),
            insertedChapterIds: Object.values(insertion.remap.chapters),
            provenance: insertion.attribution,
          },
        };
        await expect(
          saveStudioDraft(draft.id, { ...save, tale: { ...save.tale, visibility: "PUBLIC" } }, installerId),
        ).rejects.toThrow(/Community content must remain private/);
        await saveStudioDraft(draft.id, save, installerId);
        const loaded = await getStudioTale(draft.id);
        await expect(
          saveStudioDraft(
            draft.id,
            {
              tale: { ...loaded.tale, visibility: "UNLISTED" },
              chapters: loaded.draft.chapters,
              autosaveVersion: loaded.draft.autosaveVersion,
            },
            installerId,
          ),
        ).rejects.toThrow(/Community content must remain private/);
        const chapterId = Object.values(insertion.remap.chapters)[0];
        await expect(
          createChapterTemplate(installerId, draft.id, { chapterId, name: "Recaptured chapter" }),
        ).rejects.toThrow(/upstream rights and credit/);
        await expect(
          createChapterTemplate(installerId, draft.id, { chapterId: current.chapters[0].id, name: "Original chapter" }),
        ).resolves.toHaveProperty("itemId");
        const derivative = await freezeChronicleFixture(draft.id, installerId, `derived-${suffix}`);
        await expect(
          preflightCreatorChroniclePublication(installerId, {
            publishedVersionId: derivative.id,
            slug: `sc07-derived-release-${suffix}`,
            title: "Private reuse",
            description: "An edited private draft.",
            tags: [],
            licenseKey: "SC07_TEST_REUSE",
            rightsAcknowledged: true,
            spoilersAcknowledged: true,
          }),
        ).rejects.toMatchObject({ code: "COMMUNITY_DERIVED_SOURCE_UNSUPPORTED" });
        await expect(forkPublishedVersion(draft.id, derivative.id, installerId)).rejects.toThrow(
          /upstream Community rights and credit/,
        );
        await expect(restorePublishedVersionToDraft(draft.id, derivative.id, installerId)).rejects.toThrow(
          /upstream Community rights and credit/,
        );
      }
    },
  );
});

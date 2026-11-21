import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createStudioTale, getStudioTale, saveStudioDraft } from "@/chronicle/studio-service";
import { publishedSourceChecksum, snapshotFromStudio } from "@/chronicle/snapshot";
import { approveCreatorChroniclePublication, reviewCreatorChroniclePublication } from "./creator-chronicle-moderation";
import { installCreatorChronicleRelease, reviewCreatorChronicleInstallation } from "./creator-chronicle-installation";
import {
  preflightCreatorChroniclePublication,
  submitCreatorChroniclePublication,
} from "./creator-chronicle-publication";
import { getPublicListingBySlug } from "./services";
import { getHomeportListingDetail } from "./homeport";

const isolated = /^file:.*validation-isolated-sc07-[^/\\]*\.db$/i.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!isolated)("SC-07 Chronicle Community journey", () => {
  it("pins a saved published Chronicle, moderates it, and gives another Creator a private fork", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const moderatorId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    for (const id of [ownerId, installerId, moderatorId])
      await db.userAccount.create({ data: { id, status: "ACTIVE" } });
    for (const [accountId, name, handle] of [
      [ownerId, "Synthetic Chronicle Creator", `sc07-co-${suffix}`],
      [installerId, "Synthetic Chronicle Installer", `sc07-ci-${suffix}`],
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
      where: { key: "SC07_TEST_CHRONICLE" },
      create: {
        key: "SC07_TEST_CHRONICLE",
        displayName: "Synthetic Chronicle reuse",
        allowsPrivateUse: true,
        allowsPublicUse: true,
        allowsRedistribution: true,
        allowsModification: true,
        requiresAttribution: true,
        active: true,
      },
      update: {},
    });
    const source = await createStudioTale({
      creatorId: ownerId,
      title: "Synthetic Harbor Tale",
      slug: `sc07-tale-${suffix}`,
      initialChapterTitle: "Opening",
    });
    const initial = await getStudioTale(source.id);
    const passageId = randomUUID();
    await saveStudioDraft(
      source.id,
      {
        autosaveVersion: initial.draft.autosaveVersion,
        tale: { ...initial.tale, visibility: "PRIVATE" },
        chapters: [
          {
            ...initial.draft.chapters[0],
            blocks: [
              {
                id: passageId,
                blockType: "narrative",
                title: "Welcome",
                configuration: { heading: "Welcome", body: "A fictional harbor awaits." },
                presentation: {},
                completion: { mode: "playerConfirmation" },
                isEnabled: true,
                schemaVersion: 2,
              },
            ],
          },
        ],
      },
      ownerId,
    );
    const snapshot = snapshotFromStudio(await getStudioTale(source.id));
    const checksum = publishedSourceChecksum(snapshot);
    const version = await db.publishedTaleVersion.create({
      data: {
        taleId: source.id,
        versionNumber: 1,
        versionLabel: "1.0",
        publishedBy: ownerId,
        publishedByAccountId: ownerId,
        contentSnapshot: JSON.stringify(snapshot),
        checksum,
        isCurrent: true,
      },
    });
    await db.drydockPublishingEvidence.create({
      data: {
        publishedVersionId: version.id,
        sourceChecksum: checksum,
        schemaVersion: 1,
        schemaRegistryVersion: 1,
        ruleCatalogVersion: 1,
        validationRunId: `synthetic-${suffix}`,
        requiredSuitePolicyVersion: "synthetic-test",
        compatibilityPolicyVersion: "synthetic-test",
        compatibilityDigest: "a".repeat(64),
        externalEvidenceDigest: "b".repeat(64),
        evidence: "{}",
        digest: randomUUID().replaceAll("-", "") + "c".repeat(32),
      },
    });
    await db.chronicle.update({
      where: { id: source.id },
      data: { status: "PUBLISHED", latestPublishedVersionId: version.id },
    });
    const input = {
      publishedVersionId: version.id,
      slug: `sc07-community-tale-${suffix}`,
      title: "Synthetic Harbor Tale",
      description: "A fictional harbor adventure.",
      tags: ["harbor"],
      licenseKey: "SC07_TEST_CHRONICLE",
      rightsAcknowledged: true as const,
      spoilersAcknowledged: true as const,
    };
    const review = await preflightCreatorChroniclePublication(ownerId, input);
    expect(review.sourceChecksum).toBe(checksum);
    const pending = await submitCreatorChroniclePublication(ownerId, input, review.reviewDigest);
    expect(await getPublicListingBySlug(input.slug)).toBeNull();
    const moderator = { accountId: moderatorId, roles: ["MODERATOR"] };
    const moderation = await reviewCreatorChroniclePublication(moderator, pending.listingId);
    expect(moderation.included.chapters[0].blocks[0].title).toBe("Welcome");
    await approveCreatorChroniclePublication(moderator, pending.listingId, {
      releaseId: pending.releaseId,
      packageChecksum: moderation.packageChecksum,
      packageReviewed: true,
    });
    expect(await getPublicListingBySlug(input.slug)).not.toBeNull();
    const publicDetail = await getHomeportListingDetail(input.slug);
    expect(publicDetail?.creatorInstallEligible).toBe(true);
    expect(JSON.stringify(publicDetail)).not.toContain("A fictional harbor awaits.");
    const installReview = await reviewCreatorChronicleInstallation(installerId, pending.listingId);
    expect(installReview.included.passages).toBe(1);
    const installed = await installCreatorChronicleRelease({
      accountId: installerId,
      listingId: pending.listingId,
      releaseId: pending.releaseId,
      packageChecksum: installReview.packageChecksum,
      requestId: `sc07-${randomUUID()}`,
    });
    expect(installed.status).toBe("COMMITTED");
    const fork = await getStudioTale(installed.taleId);
    expect(fork.tale.visibility).toBe("PRIVATE");
    expect(fork.draft.chapters[0].blocks[0].title).toBe("Welcome");
    const lineage = await db.chronicle.findUniqueOrThrow({ where: { id: installed.taleId } });
    expect(lineage.creatorAccountId).toBe(installerId);
    expect(lineage.forkedFromVersionId).toBe(version.id);
    const receipt = await db.communityInstallation.findFirstOrThrow({
      where: { accountId: installerId, releaseId: pending.releaseId },
    });
    expect(receipt.installedPackageChecksum).toBe(installReview.packageChecksum);
  });
});

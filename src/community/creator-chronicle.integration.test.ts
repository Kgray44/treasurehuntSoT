import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getStudioTale, saveStudioDraft } from "@/chronicle/studio-service";
import { createChronicleFixture } from "../../tests/fixtures/sc07-chronicle";
import { decideCreatorChroniclePublication, reviewCreatorChroniclePublication } from "./creator-chronicle-moderation";
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
    const { source, version } = await createChronicleFixture(ownerId, suffix);
    const { checksum } = version;
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
    await decideCreatorChroniclePublication(moderator, pending.listingId, {
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
    const installInput = {
      accountId: installerId,
      listingId: pending.listingId,
      releaseId: pending.releaseId,
      packageChecksum: installReview.packageChecksum,
      requestId: `sc07-${randomUUID()}`,
    };
    await db.$executeRawUnsafe(`CREATE TEMP TRIGGER sc07_block_chronicle_receipt
      BEFORE INSERT ON CommunityInstallation
      BEGIN SELECT RAISE(ABORT, 'SC07 synthetic receipt failure'); END`);
    try {
      await expect(installCreatorChronicleRelease(installInput)).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe("DROP TRIGGER sc07_block_chronicle_receipt");
    }
    expect(
      await db.chronicle.count({ where: { creatorAccountId: installerId, forkedFromVersionId: version.id } }),
    ).toBe(0);
    expect(
      await db.communityInstallOperation.count({
        where: { accountId: installerId, requestId: installInput.requestId },
      }),
    ).toBe(0);
    const installed = await installCreatorChronicleRelease(installInput);
    const retry = await installCreatorChronicleRelease({ ...installInput, requestId: `sc07-${randomUUID()}` });
    expect(retry).toMatchObject({ status: "ALREADY_INSTALLED", taleId: installed.taleId });
    expect(installed.status).toBe("COMMITTED");
    const fork = await getStudioTale(installed.taleId);
    expect(fork.tale.visibility).toBe("PRIVATE");
    expect(fork.draft.chapters[0].blocks[0].title).toBe("Welcome");
    const privateEdit = {
      autosaveVersion: fork.draft.autosaveVersion,
      tale: { ...fork.tale, title: "Edited private Chronicle", visibility: "PRIVATE" as const },
      chapters: fork.draft.chapters,
    };
    await expect(
      saveStudioDraft(
        installed.taleId,
        { ...privateEdit, tale: { ...privateEdit.tale, visibility: "PUBLIC" } },
        installerId,
      ),
    ).rejects.toThrow("Community Chronicle copies must remain private");
    await saveStudioDraft(installed.taleId, privateEdit, installerId);
    expect((await getStudioTale(installed.taleId)).tale.title).toBe("Edited private Chronicle");
    expect((await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: version.id } })).checksum).toBe(checksum);

    const lineage = await db.chronicle.findUniqueOrThrow({ where: { id: installed.taleId } });
    expect(lineage.creatorAccountId).toBe(installerId);
    expect(lineage.forkedFromVersionId).toBe(version.id);
    const receipt = await db.communityInstallation.findFirstOrThrow({
      where: { accountId: installerId, releaseId: pending.releaseId },
    });
    expect(receipt.installedPackageChecksum).toBe(installReview.packageChecksum);
  });
});

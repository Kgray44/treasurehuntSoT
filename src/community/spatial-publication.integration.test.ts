import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSpatialDraft } from "@/parallax/authoring";
import { builtinEnvironments, saveEnvironment } from "@/parallax/environment-service";
import { extractComposition, insertSavedComposition } from "@/parallax/element-authoring";
import { buildSpatialLibrary } from "@/parallax/library-catalog";
import { archiveSpatialScene, listSpatialItems, saveSpatialDraft } from "@/parallax/library-service";
import { installSpatialCommunityRelease, reviewSpatialInstallation } from "./spatial-installation";
import { readInstalledSpatialCommunitySummaryPage } from "./spatial-installed-catalog";
import { approveSpatialPublication, reviewSpatialPublicationForModeration } from "./spatial-moderation";
import { getPublicListingBySlug } from "./services";
import { createOrUpdateReview, listPublicReviews, reviewAccessForActor } from "./social";
import { authoritativeListingEngagement } from "./engagement-aggregates";
import {
  listOwnedSpatialPublications,
  preflightSpatialPublication,
  publishSpatialToCommunity,
} from "./spatial-publication";

const isolated = /^file:.*validation-isolated-sc07a-[^/\\]*\.db$/i.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!isolated)("SC-07A isolated Harborlight journey", () => {
  it("saves privately, submits an immutable package, and installs the moderated exact release", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const moderatorId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: moderatorId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: installerId,
        displayName: "Synthetic Installer",
        handle: `installer-${suffix}`,
        normalizedHandle: `installer-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Creator",
        handle: `creator-${suffix}`,
        normalizedHandle: `creator-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const draft = createSpatialDraft(randomUUID());
    draft.content.title = "Synthetic Desk Map";
    expect(await saveSpatialDraft(ownerId, draft, 0)).toBe(1);
    expect((await listSpatialItems(ownerId))[0].releases).toHaveLength(0);
    const input = {
      source: { kind: "ASSET" as const, id: draft.content.definitionId, revision: 1 },
      slug: `synthetic-desk-${suffix}`,
      title: "Synthetic Desk Map",
      description: "A synthetic tabletop map for other Creators to place.",
      tags: ["map", "tabletop"],
      visibility: "COMMUNITY" as const,
      locationClass: "GENERIC" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: false,
    };
    const preflight = await preflightSpatialPublication(ownerId, input);
    expect(preflight.included).toHaveLength(1);
    expect(preflight.attribution[0].displayName).toBe("Synthetic Creator");
    const published = await publishSpatialToCommunity(ownerId, input, preflight.reviewDigest);
    expect(published.publicationStatus).toBe("READY_FOR_REVIEW");
    expect((await publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).releaseId).toBe(
      published.releaseId,
    );
    const packageRow = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: published.releaseId } });
    expect(packageRow.scanStatus).toBe("CLEAN");
    const itemBefore = await db.communityPackageItem.findFirstOrThrow({ where: { packageId: packageRow.id } });
    const immutablePayload = itemBefore.metadata;
    const changed = structuredClone(draft);
    changed.content.entities[0].content = "A new private working revision.";
    expect(await saveSpatialDraft(ownerId, changed, 1)).toBe(2);
    expect((await db.communityPackageItem.findFirstOrThrow({ where: { id: itemBefore.id } })).metadata).toBe(
      immutablePayload,
    );
    const moderator = { accountId: moderatorId, roles: ["MODERATOR"], authorizationBasis: "isolated-test" };
    await expect(
      reviewSpatialPublicationForModeration({ accountId: ownerId, roles: ["MODERATOR"] }, published.listingId),
    ).rejects.toThrow(/cannot approve their own release/i);
    const moderationReview = await reviewSpatialPublicationForModeration(moderator, published.listingId);
    expect(moderationReview).toMatchObject({
      releaseId: published.releaseId,
      packageChecksum: packageRow.packageChecksum,
      publicationStatus: "READY_FOR_REVIEW",
    });
    await expect(
      approveSpatialPublication(moderator, published.listingId, {
        releaseId: published.releaseId,
        packageChecksum: "0".repeat(64),
        packageReviewed: true,
      }),
    ).rejects.toThrow(/release changed/i);
    expect(
      await approveSpatialPublication(moderator, published.listingId, {
        releaseId: moderationReview.releaseId,
        packageChecksum: moderationReview.packageChecksum,
        packageReviewed: true,
      }),
    ).toMatchObject({ publicationStatus: "PUBLISHED", releaseId: published.releaseId });
    expect(await getPublicListingBySlug(input.slug)).toMatchObject({ slug: input.slug });
    expect((await reviewAccessForActor(published.listingId, installerId)).eligible).toBe(false);
    const review = await reviewSpatialInstallation(installerId, published.listingId);
    expect(review.packageChecksum).toBe(packageRow.packageChecksum);
    const installed = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: published.listingId,
      releaseId: published.releaseId,
      packageChecksum: review.packageChecksum,
      requestId: randomUUID(),
    });
    expect(installed.status).toBe("COMMITTED");
    expect(installed.studioUrl).toContain("/studio/parallax?definition=");
    const library = await listSpatialItems(installerId);
    expect(library).toHaveLength(1);
    expect(library[0].readOnly).toBe(true);
    await expect(archiveSpatialScene(installerId, library[0].id, library[0].revision)).rejects.toThrow(
      "Community installation is read-only",
    );
    expect(library[0].releases).toHaveLength(1);
    expect(library[0].draft.lineage?.versionId).toBe(published.releaseId);
    const installedSummaries = await readInstalledSpatialCommunitySummaryPage(installerId, { limit: 1 });
    expect(installedSummaries.nextCursor).toBeNull();
    expect(installedSummaries.items).toMatchObject([
      {
        targetId: library[0].id,
        sourceId: "spatial",
        kind: "ASSETS",
        origin: "INSTALLED",
        releaseId: published.releaseId,
        semanticVersion: "1.0.0",
        readOnly: true,
        thumbnail: null,
        licenseSnapshot: { allowsPublicUse: true },
      },
    ]);
    expect(await readInstalledSpatialCommunitySummaryPage(ownerId)).toEqual({ items: [], nextCursor: null });
    expect((await reviewAccessForActor(published.listingId, installerId)).eligible).toBe(true);
    await createOrUpdateReview(
      { accountId: installerId },
      {
        listingId: published.listingId,
        rating: 4,
        spoilerFreeBody: "Useful synthetic spatial release.",
        dimensions: { clarity: 4 },
      },
    );
    expect(await listPublicReviews(published.listingId, installerId)).toMatchObject([
      { verifiedInstallation: true, verifiedCompletion: false, rating: 4 },
    ]);
    expect((await authoritativeListingEngagement([published.listingId])).get(published.listingId)).toMatchObject({
      reviewCount: 1,
      averageRating: 4,
    });
    expect(
      await installSpatialCommunityRelease({
        accountId: installerId,
        listingId: published.listingId,
        releaseId: published.releaseId,
        packageChecksum: review.packageChecksum,
        requestId: randomUUID(),
      }),
    ).toMatchObject({ status: "ALREADY_INSTALLED", itemId: library[0].id });
    expect((await listOwnedSpatialPublications(ownerId, { ...input.source, revision: 2 }))[0].id).toBe(
      published.listingId,
    );
    const update = { ...input, source: { ...input.source, revision: 2 }, listingId: published.listingId };
    const updateReview = await preflightSpatialPublication(ownerId, update);
    const nextRelease = await publishSpatialToCommunity(ownerId, update, updateReview.reviewDigest);
    expect(nextRelease.releaseId).not.toBe(published.releaseId);
    expect(nextRelease.semanticVersion).toBe("2.0.0");
    expect(nextRelease.publicationStatus).toBe("UPDATE_PENDING");
    expect((await readInstalledSpatialCommunitySummaryPage(installerId)).items[0].releaseId).toBe(published.releaseId);
    expect((await publishSpatialToCommunity(ownerId, update, updateReview.reviewDigest)).releaseId).toBe(
      nextRelease.releaseId,
    );
    const changedUpdate = { ...update, description: `${update.description} Revised while review is pending.` };
    const changedReview = await preflightSpatialPublication(ownerId, changedUpdate);
    await expect(publishSpatialToCommunity(ownerId, changedUpdate, changedReview.reviewDigest)).rejects.toThrow(
      /already awaiting review/,
    );
    const updateModerationReview = await reviewSpatialPublicationForModeration(moderator, published.listingId);
    expect(updateModerationReview).toMatchObject({
      releaseId: nextRelease.releaseId,
      publicationStatus: "UPDATE_PENDING",
    });
    await approveSpatialPublication(moderator, published.listingId, {
      releaseId: updateModerationReview.releaseId,
      packageChecksum: updateModerationReview.packageChecksum,
      packageReviewed: true,
    });
    expect(await getPublicListingBySlug(input.slug)).toMatchObject({ slug: input.slug });
    expect((await db.communityListing.findUniqueOrThrow({ where: { id: published.listingId } })).currentReleaseId).toBe(
      nextRelease.releaseId,
    );
    expect((await listSpatialItems(installerId))[0].draft.lineage?.versionId).toBe(published.releaseId);
    expect((await db.communityPackageItem.findFirstOrThrow({ where: { id: itemBefore.id } })).metadata).toBe(
      immutablePayload,
    );
    await db.reusableAuthoringItem.update({ where: { id: library[0].id }, data: { status: "ACTIVE" } });
    expect((await readInstalledSpatialCommunitySummaryPage(installerId)).items).toEqual([]);
  }, 90_000);

  it("resolves a Scene and its owned Environment while excluding private source labels", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Scene Creator",
        handle: `scene-${suffix}`,
        normalizedHandle: `scene-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const environment = structuredClone(builtinEnvironments()[0].current.content);
    environment.id = randomUUID();
    environment.name = "Imaginary harbor room";
    environment.origin = "MANUAL";
    environment.sourceLabel = "C:\\private\\room-photo.jpg";
    const savedEnvironment = await saveEnvironment(ownerId, environment, 0);
    const scene = createSpatialDraft(randomUUID());
    scene.category = "SCENE_TEMPLATE";
    scene.content.environment = savedEnvironment.reference;
    scene.content.title = "Harbor scene";
    await saveSpatialDraft(ownerId, scene, 0);
    const input = {
      source: { kind: "SCENE" as const, id: scene.content.definitionId, revision: 1 },
      slug: `harbor-scene-${suffix}`,
      title: "Harbor scene",
      description: "A reusable imaginary harbor scene.",
      tags: ["harbor"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: true,
    };
    const preflight = await preflightSpatialPublication(ownerId, input);
    expect(preflight.included).toHaveLength(2);
    expect(JSON.stringify(preflight.included)).not.toContain("room-photo.jpg");
    expect(preflight.dependencies[0].revision).toBe(1);
    const published = await publishSpatialToCommunity(ownerId, input, preflight.reviewDigest);
    await db.communityListing.update({ where: { id: published.listingId }, data: { publicationStatus: "PUBLISHED" } });
    const review = await reviewSpatialInstallation(installerId, published.listingId);
    const installed = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: published.listingId,
      releaseId: published.releaseId,
      packageChecksum: review.packageChecksum,
      requestId: randomUUID(),
    });
    expect(installed.status).toBe("COMMITTED");
    const library = await listSpatialItems(installerId);
    expect(library[0].draft.content.environment?.environmentId).not.toBe(environment.id);
    const installedEnvironment = await db.reusableAuthoringItem.findUniqueOrThrow({
      where: { id: library[0].draft.content.environment!.environmentId },
    });
    expect(installedEnvironment.status).toBe("INSTALLED_READ_ONLY");
    const sceneSummaries = (await readInstalledSpatialCommunitySummaryPage(installerId)).items;
    expect(sceneSummaries.map((item) => [item.sourceId, item.kind]).sort()).toEqual([
      ["environment", "ENVIRONMENTS"],
      ["spatial", "SCENES"],
    ]);
    expect(JSON.stringify(sceneSummaries)).not.toContain("room-photo.jpg");
    await db.playerProfile.create({
      data: {
        accountId: installerId,
        displayName: "Synthetic Installer",
        handle: `installer-${suffix}`,
        normalizedHandle: `installer-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    await expect(
      preflightSpatialPublication(installerId, {
        ...input,
        source: { kind: "ENVIRONMENT", id: installedEnvironment.id, revision: 1 },
        slug: `forbidden-republish-${suffix}`,
      }),
    ).rejects.toThrow(/Installed Community content/);
  }, 90_000);

  it("installs an owned synthetic Environment with a stable retry mapping", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Environment Creator",
        handle: `env-${suffix}`,
        normalizedHandle: `env-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const environment = structuredClone(builtinEnvironments()[0].current.content);
    environment.id = randomUUID();
    environment.name = "Imaginary pier";
    environment.origin = "MANUAL";
    const saved = await saveEnvironment(ownerId, environment, 0);
    const input = {
      source: { kind: "ENVIRONMENT" as const, id: environment.id, revision: 1 },
      slug: `imaginary-pier-${suffix}`,
      title: environment.name,
      description: "A wholly imagined room geometry.",
      tags: ["pier"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: true,
    };
    expect(saved.reference.revision).toBe(1);
    const review = await preflightSpatialPublication(ownerId, input);
    const release = await publishSpatialToCommunity(ownerId, input, review.reviewDigest);
    await db.communityListing.update({ where: { id: release.listingId }, data: { publicationStatus: "PUBLISHED" } });
    const installReview = await reviewSpatialInstallation(installerId, release.listingId);
    const committed = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: release.listingId,
      releaseId: release.releaseId,
      packageChecksum: installReview.packageChecksum,
      requestId: randomUUID(),
    });
    expect((await readInstalledSpatialCommunitySummaryPage(installerId)).items).toMatchObject([
      { targetId: committed.itemId, sourceId: "environment", kind: "ENVIRONMENTS", readOnly: true },
    ]);
    const retry = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: release.listingId,
      releaseId: release.releaseId,
      packageChecksum: installReview.packageChecksum,
      requestId: randomUUID(),
    });
    expect(retry).toMatchObject({
      status: "ALREADY_INSTALLED",
      itemId: committed.itemId,
      studioUrl: "/studio/parallax",
    });
  }, 90_000);

  it("publishes a source-matched owned composition and installs it as a reusable composition", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Composition Creator",
        handle: `composition-${suffix}`,
        normalizedHandle: `composition-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const parent = createSpatialDraft(randomUUID());
    expect(await saveSpatialDraft(ownerId, parent, 0)).toBe(1);
    const composition = extractComposition(parent, parent.content.entities[0].id, randomUUID());
    composition.content.title = "Reusable desk clue";
    expect(await saveSpatialDraft(ownerId, composition, 0)).toBe(1);
    const input = {
      source: { kind: "ASSET" as const, id: composition.content.definitionId, revision: 1 },
      slug: `desk-composition-${suffix}`,
      title: composition.content.title,
      description: "A reusable synthetic desk clue composition.",
      tags: ["composition"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: false,
    };
    const review = await preflightSpatialPublication(ownerId, input);
    expect(review.included).toHaveLength(1);
    expect(review.included[0].preview).toMatchObject({ composition: true });
    const release = await publishSpatialToCommunity(ownerId, input, review.reviewDigest);
    await db.communityListing.update({ where: { id: release.listingId }, data: { publicationStatus: "PUBLISHED" } });
    const installReview = await reviewSpatialInstallation(installerId, release.listingId);
    expect(
      await installSpatialCommunityRelease({
        accountId: installerId,
        listingId: release.listingId,
        releaseId: release.releaseId,
        packageChecksum: installReview.packageChecksum,
        requestId: randomUUID(),
      }),
    ).toMatchObject({ status: "COMMITTED" });
    const installed = (await listSpatialItems(installerId))[0];
    expect(installed.readOnly).toBe(true);
    expect(installed.draft.tags).toContain("composition");
    expect((await readInstalledSpatialCommunitySummaryPage(installerId)).items).toMatchObject([
      { targetId: installed.id, sourceId: "spatial", kind: "COMPOSITIONS", composition: true },
    ]);
    expect(buildSpatialLibrary([installed], []).find((item) => item.id === `saved:${installed.id}`)?.kind).toBe(
      "COMPOSITIONS",
    );
    expect(
      insertSavedComposition(createSpatialDraft(randomUUID()), installed.draft, randomUUID()).content.entities,
    ).toHaveLength(2);
    const changed = structuredClone(parent);
    changed.content.entities[0].content = "The private parent was revised.";
    expect(await saveSpatialDraft(ownerId, changed, 1)).toBe(2);
    await expect(preflightSpatialPublication(ownerId, input)).rejects.toThrow(/no longer matches its owned source/);
  }, 90_000);
});

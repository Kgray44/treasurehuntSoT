import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSpatialDraft } from "@/parallax/authoring";
import { builtinEnvironments, saveEnvironment } from "@/parallax/environment-service";
import { listSpatialItems, saveSpatialDraft } from "@/parallax/library-service";
import { installSpatialCommunityRelease, reviewSpatialInstallation } from "./spatial-installation";
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
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
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
    // Moderation is a separate Harborlight authority; this synthetic step
    // exercises the public installation state after that authority approves.
    await db.communityListing.update({
      where: { id: published.listingId },
      data: { publicationStatus: "PUBLISHED", publishedAt: new Date() },
    });
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
    expect(library[0].releases).toHaveLength(1);
    expect(library[0].draft.lineage?.versionId).toBe(published.releaseId);
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
    expect((await publishSpatialToCommunity(ownerId, update, updateReview.reviewDigest)).releaseId).toBe(
      nextRelease.releaseId,
    );
    const changedUpdate = { ...update, description: `${update.description} Revised while review is pending.` };
    const changedReview = await preflightSpatialPublication(ownerId, changedUpdate);
    await expect(publishSpatialToCommunity(ownerId, changedUpdate, changedReview.reviewDigest)).rejects.toThrow(
      /already awaiting review/,
    );
    expect((await db.communityPackageItem.findFirstOrThrow({ where: { id: itemBefore.id } })).metadata).toBe(
      immutablePayload,
    );
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
});

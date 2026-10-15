import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, editSpatialDraft } from "@/parallax/authoring";
import { createEmptyEnvironment } from "@/parallax/environment-library-authoring";
import { environmentReleaseReference, resolvePinnedEnvironment } from "@/parallax/environment-version-resolution";
import {
  copyLegacyEnvironment,
  releaseLegacyEnvironmentVersion,
  saveLegacyEnvironmentWorking,
} from "@/parallax/legacy-environment-service";
import legacyBuiltins from "@/parallax/builtin-environments.v1.json";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import {
  listEnvironmentDefinitions,
  releaseEnvironmentVersion,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
} from "@/parallax/library-lifecycle-service";
import { extractComposition, insertSavedComposition, insertSpatialElement } from "@/parallax/element-authoring";
import { buildSpatialContentCatalog } from "@/parallax/spatial-content-catalog";
import {
  archiveSpatialItem,
  listSpatialItems,
  releaseSpatialVersion,
  reuseInstalledSpatialComposition,
  reuseSpatialAsset,
  saveReusableAsset,
  saveSpatialDraft,
} from "@/parallax/library-service";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { installSpatialCommunityRelease, reviewSpatialInstallation } from "./spatial-installation";
import { readInstalledSpatialCommunitySummaryPage } from "./spatial-installed-catalog";
import { knownSpatialPublicationLimit } from "./spatial-publication-availability";
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

async function savedSyntheticEnvironment(ownerId: string, name: string) {
  const id = randomUUID();
  const room = createEmptyEnvironment(id);
  room.name = name;
  const document = createEnvironmentDraft(id, room);
  document.name = name;
  document.collection = "C:\\private\\room-photo.jpg";
  expect(await saveEnvironmentDraft(ownerId, document, 0)).toBe(1);
  const release = await releaseEnvironmentVersion(ownerId, id, 1);
  const row = await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: release.versionId } });
  return {
    id,
    room: document.room!,
    document,
    revision: release.revision,
    reference: environmentReleaseReference(row),
  };
}

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
    const animationTrack = {
      id: "fade-in",
      entityId: draft.content.entities[0].id,
      enabled: true,
      property: "OPACITY" as const,
      interpolation: "LINEAR" as const,
      keyframes: [
        { id: "hidden", atMs: 0, value: 0 },
        { id: "visible", atMs: 1000, value: 1 },
      ],
    };
    draft.content.studio!.animationTracks = [animationTrack];
    expect(await saveSpatialDraft(ownerId, draft, 0)).toBe(1);
    expect((await saveDefinitionToLibrary(ownerId, draft.content.definitionId, 1)).revision).toBe(2);
    expect((await listSpatialItems(ownerId))[0].releases).toHaveLength(0);
    const input = {
      source: { kind: "ASSET" as const, id: draft.content.definitionId, revision: 2 },
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
    expect(
      (preflight.included[0].preview as { content: { studio: { animationTracks: unknown[] } } }).content.studio
        .animationTracks,
    ).toEqual([animationTrack]);
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
    await db.communityPackage.update({ where: { id: packageRow.id }, data: { scanStatus: "PENDING" } });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community package is not finalized and clean/,
    );
    await db.communityPackage.update({ where: { id: packageRow.id }, data: { scanStatus: "CLEAN" } });
    await db.communityPackageItem.update({ where: { id: itemBefore.id }, data: { metadata: '{"schemaVersion":1}' } });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community package no longer matches your review/,
    );
    await db.communityPackageItem.update({ where: { id: itemBefore.id }, data: { metadata: immutablePayload } });
    const releaseBeforeRetry = await db.communityRelease.findUniqueOrThrow({ where: { id: published.releaseId } });
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { manifestChecksum: "0".repeat(64) },
    });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community package no longer matches your review/,
    );
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { manifestChecksum: releaseBeforeRetry.manifestChecksum },
    });
    await db.communityRelease.update({ where: { id: published.releaseId }, data: { manifest: "{" } });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community release cannot be verified for an exact retry/,
    );
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { manifest: releaseBeforeRetry.manifest },
    });
    const declaration = await db.communityOwnershipDeclaration.findFirstOrThrow({
      where: { listingId: published.listingId, releaseId: published.releaseId },
    });
    await db.communityOwnershipDeclaration.delete({ where: { id: declaration.id } });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community release has no rights declaration/,
    );
    await db.communityOwnershipDeclaration.create({ data: declaration });
    await db.communityListing.update({ where: { id: published.listingId }, data: { publicationStatus: "REJECTED" } });
    await expect(publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).rejects.toThrow(
      /recorded Community release is no longer available/,
    );
    await db.communityListing.update({
      where: { id: published.listingId },
      data: { publicationStatus: "READY_FOR_REVIEW" },
    });
    expect((await publishSpatialToCommunity(ownerId, input, preflight.reviewDigest)).releaseId).toBe(
      published.releaseId,
    );
    const changed = structuredClone(draft);
    changed.content.entities[0].content = "A new private working revision.";
    expect(await saveSpatialDraft(ownerId, changed, 2)).toBe(3);
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
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { packageChecksum: "0".repeat(64) },
    });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /release package is not finalized and clean/,
    );
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { packageChecksum: packageRow.packageChecksum },
    });
    const releaseBeforeInstall = await db.communityRelease.findUniqueOrThrow({ where: { id: published.releaseId } });
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: {
        attributionSnapshot: JSON.stringify([{ displayName: "Unreviewed credit", contributionType: "Creator" }]),
      },
    });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /does not match its immutable release/,
    );
    await db.communityRelease.update({
      where: { id: published.releaseId },
      data: { attributionSnapshot: releaseBeforeInstall.attributionSnapshot },
    });
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
    expect(installed.studioUrl).toBe(
      `/studio/parallax?${new URLSearchParams({ library: `saved:${installed.itemId}`, libraryKind: "ASSETS" })}`,
    );
    const library = await listSpatialItems(installerId);
    expect(library).toHaveLength(1);
    expect(library[0].readOnly).toBe(true);
    expect(library[0].draft.content.studio?.animationTracks).toEqual([animationTrack]);
    await expect(saveSpatialDraft(installerId, library[0].draft, library[0].revision)).rejects.toThrow(
      /Installed content is read-only/,
    );
    await expect(releaseSpatialVersion(installerId, library[0].id, library[0].revision)).rejects.toThrow(/read-only/i);
    await expect(archiveSpatialItem(installerId, library[0].id, library[0].revision)).rejects.toThrow(
      /changed in another window/,
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
    await db.reusableAuthoringItem.update({ where: { id: library[0].id }, data: { status: "ACTIVE" } });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /no longer has its pinned read-only Library content/,
    );
    await expect(
      installSpatialCommunityRelease({
        accountId: installerId,
        listingId: published.listingId,
        releaseId: published.releaseId,
        packageChecksum: review.packageChecksum,
        requestId: randomUUID(),
      }),
    ).rejects.toThrow(/no longer has its pinned read-only Library content/);
    await db.reusableAuthoringItem.update({
      where: { id: library[0].id },
      data: { status: "INSTALLED_READ_ONLY" },
    });
    const installationReceipt = await db.communityInstallation.findFirstOrThrow({
      where: { accountId: installerId, releaseId: published.releaseId, mode: "LIBRARY_REFERENCE" },
    });
    await db.communityInstallation.update({
      where: { id: installationReceipt.id },
      data: { installedPackageChecksum: "0".repeat(64) },
    });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /pinned Community installation receipt has changed/,
    );
    await db.communityInstallation.update({
      where: { id: installationReceipt.id },
      data: { installedPackageChecksum: installationReceipt.installedPackageChecksum },
    });
    await db.communityInstallOperation.update({
      where: { id: installationReceipt.operationId },
      data: { status: "FAILED" },
    });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /no longer has its pinned read-only Library content/,
    );
    await db.communityInstallOperation.update({
      where: { id: installationReceipt.operationId },
      data: { status: "COMMITTED" },
    });
    expect((await listOwnedSpatialPublications(ownerId, { ...input.source, revision: 3 }))[0].id).toBe(
      published.listingId,
    );
    const update = { ...input, source: { ...input.source, revision: 3 }, listingId: published.listingId };
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
    const environment = await savedSyntheticEnvironment(ownerId, "Imaginary harbor room");
    const scene = createSpatialDraft(randomUUID());
    scene.category = "SCENE_TEMPLATE";
    scene.content.environment = environment.reference;
    scene.content.studio!.environment = environment.room;
    scene.content.title = "Harbor scene";
    await saveSpatialDraft(ownerId, scene, 0);
    expect((await saveDefinitionToLibrary(ownerId, scene.content.definitionId, 1)).revision).toBe(2);
    const input = {
      source: { kind: "SCENE" as const, id: scene.content.definitionId, revision: 2 },
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
        source: {
          kind: "ENVIRONMENT",
          id: installedEnvironment.id,
          revision: 1,
          versionId: `${installedEnvironment.id}:v1`,
        },
        slug: `forbidden-republish-${suffix}`,
      }),
    ).rejects.toThrow(/Installed Community content/);
    await db.reusableAuthoringItem.update({ where: { id: installedEnvironment.id }, data: { status: "ACTIVE" } });
    await expect(reviewSpatialInstallation(installerId, published.listingId)).rejects.toThrow(
      /no longer has its pinned read-only Library content/,
    );
  }, 90_000);

  it("refuses a Scene when its pinned Environment is no longer owned at review or submission", async () => {
    const ownerId = randomUUID();
    const otherAccountId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: otherAccountId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Dependency Creator",
        handle: `dependency-${suffix}`,
        normalizedHandle: `dependency-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const environment = await savedSyntheticEnvironment(ownerId, "Imaginary shared room");
    const scene = createSpatialDraft(randomUUID());
    scene.category = "SCENE_TEMPLATE";
    scene.content.environment = environment.reference;
    scene.content.studio!.environment = environment.room;
    scene.content.title = "Private pinned Scene";
    expect(await saveSpatialDraft(ownerId, scene, 0)).toBe(1);
    expect((await saveDefinitionToLibrary(ownerId, scene.content.definitionId, 1)).revision).toBe(2);
    const input = {
      source: { kind: "SCENE" as const, id: scene.content.definitionId, revision: 2 },
      slug: `pinned-private-${suffix}`,
      title: scene.content.title,
      description: "An invented room that must retain its owner-scoped dependency.",
      tags: ["synthetic"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: true,
    };
    const reviewed = await preflightSpatialPublication(ownerId, input);
    expect(reviewed.dependencies).toHaveLength(1);

    await db.reusableAuthoringItem.update({
      where: { id: environment.id },
      data: { ownerAccountId: otherAccountId },
    });
    await expect(preflightSpatialPublication(ownerId, input)).rejects.toThrow(
      /pinned Environment is unavailable or invalid/,
    );
    await expect(publishSpatialToCommunity(ownerId, input, reviewed.reviewDigest)).rejects.toThrow(
      /pinned Environment is unavailable or invalid/,
    );
    expect(await db.communityListing.count({ where: { owner: { accountId: ownerId } } })).toBe(0);
    expect((await db.reusableAuthoringItem.findUniqueOrThrow({ where: { id: scene.content.definitionId } })).status).toBe(
      "SAVED",
    );
  });

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
    const environment = await savedSyntheticEnvironment(ownerId, "Imaginary pier");
    const input = {
      source: {
        kind: "ENVIRONMENT" as const,
        id: environment.id,
        revision: environment.revision,
        versionId: environment.reference.versionId,
      },
      slug: `imaginary-pier-${suffix}`,
      title: environment.document.name,
      description: "A wholly imagined room geometry.",
      tags: ["pier"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: true,
    };
    expect(environment.reference.revision).toBe(1);
    expect(environment.revision).toBe(2);
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
    const installedEnvironment = (await listEnvironmentDefinitions(installerId)).find(
      (item) => item.id === committed.itemId,
    )!;
    expect(installedEnvironment.readOnly).toBe(true);
    await expect(
      saveEnvironmentDraft(installerId, installedEnvironment.draft, installedEnvironment.revision),
    ).rejects.toThrow(/Installed content is read-only/);
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
      studioUrl: `/studio/parallax?${new URLSearchParams({ library: `environment:${committed.itemId}`, libraryKind: "ENVIRONMENTS" })}`,
    });
  }, 90_000);

  it("publishes and installs a legacy synthetic Environment without its private source frame", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const environmentId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Legacy Environment Creator",
        handle: `legacy-env-${suffix}`,
        normalizedHandle: `legacy-env-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const copied = await copyLegacyEnvironment(ownerId, {
      source: legacyBuiltins[0].reference,
      newId: environmentId,
      operationId: randomUUID(),
      name: "Imaginary legacy study",
      destination: "SAVED",
    });
    const working = structuredClone(copied.working!);
    working.content.evidence.frameId = "private-room-photo.jpg";
    working.content.sourceLabel = "C:\\private\\room-photo.jpg";
    const saved = await saveLegacyEnvironmentWorking(ownerId, working, copied.revision);
    const released = await releaseLegacyEnvironmentVersion(ownerId, {
      definitionId: environmentId,
      revision: saved.revision,
      operationId: randomUUID(),
      contentChecksum: canonicalChecksum(working.content),
    });
    const input = {
      source: {
        kind: "ENVIRONMENT" as const,
        id: environmentId,
        revision: released.revision,
        versionId: released.version.reference.versionId,
      },
      slug: `imaginary-legacy-study-${suffix}`,
      title: working.content.name,
      description: "A synthetic legacy room with no source-media metadata.",
      tags: ["study"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: true,
    };
    const review = await preflightSpatialPublication(ownerId, input);
    const packageJson = JSON.stringify(review.included);
    expect(packageJson).not.toContain("private-room-photo.jpg");
    expect(packageJson).not.toContain("room-photo.jpg");
    expect(packageJson).toContain("community-simulated");
    const published = await publishSpatialToCommunity(ownerId, input, review.reviewDigest);
    await db.communityListing.update({ where: { id: published.listingId }, data: { publicationStatus: "PUBLISHED" } });
    const installReview = await reviewSpatialInstallation(installerId, published.listingId);
    const installed = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: published.listingId,
      releaseId: published.releaseId,
      packageChecksum: installReview.packageChecksum,
      requestId: randomUUID(),
    });
    const installedRow = await db.reusableAuthoringItem.findUniqueOrThrow({ where: { id: installed.itemId! } });
    expect(installedRow.status).toBe("INSTALLED_READ_ONLY");
    const installedVersion = await db.reusableAuthoringItemVersion.findFirstOrThrow({
      where: { itemId: installed.itemId!, versionNumber: 1 },
    });
    const installedContent = JSON.parse(installedVersion.envelope).content;
    expect(installedContent.evidence.frameId).toBe("community-simulated");
    const original = await resolvePinnedEnvironment(ownerId, released.version.reference);
    expect(original.format).toBe("SC01_SCHEMA1");
    if (original.format !== "SC01_SCHEMA1") throw new Error("Expected legacy Environment source");
    expect(original.legacy.evidence.frameId).toBe("private-room-photo.jpg");
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
    expect((await saveDefinitionToLibrary(ownerId, parent.content.definitionId, 1)).revision).toBe(2);
    const composition = extractComposition(parent, parent.content.entities[0].id, randomUUID());
    composition.content.title = "Reusable desk clue";
    expect(await saveSpatialDraft(ownerId, composition, 0)).toBe(1);
    expect((await saveDefinitionToLibrary(ownerId, composition.content.definitionId, 1)).revision).toBe(2);
    const input = {
      source: { kind: "ASSET" as const, id: composition.content.definitionId, revision: 2 },
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
    expect(buildSpatialContentCatalog([installed], []).find((item) => item.id === `saved:${installed.id}`)?.kind).toBe(
      "COMPOSITIONS",
    );
    expect(
      insertSavedComposition(createSpatialDraft(randomUUID()), installed.draft, randomUUID()).content.entities,
    ).toHaveLength(2);
    const receiving = createSpatialDraft(randomUUID());
    expect(await saveSpatialDraft(installerId, receiving, 0)).toBe(1);
    const inserted = await reuseInstalledSpatialComposition(
      installerId,
      receiving,
      1,
      installed.id,
      installed.releases[0].id,
    );
    expect(inserted.draft.content.entities).toHaveLength(2);
    expect(inserted.draft.lineage?.definitionId).toBe(installed.id);
    expect((await listSpatialItems(installerId)).find((item) => item.id === installed.id)?.readOnly).toBe(true);
    const restrictedInput = {
      ...input,
      slug: `desk-composition-restricted-${suffix}`,
      licenseKey: "USE_IN_CHRONICLES_WITH_ATTRIBUTION",
    };
    const restrictedReview = await preflightSpatialPublication(ownerId, restrictedInput);
    const restrictedRelease = await publishSpatialToCommunity(ownerId, restrictedInput, restrictedReview.reviewDigest);
    await db.communityListing.update({
      where: { id: restrictedRelease.listingId },
      data: { publicationStatus: "PUBLISHED" },
    });
    const restrictedInstallReview = await reviewSpatialInstallation(installerId, restrictedRelease.listingId);
    const restrictedInstall = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: restrictedRelease.listingId,
      releaseId: restrictedRelease.releaseId,
      packageChecksum: restrictedInstallReview.packageChecksum,
      requestId: randomUUID(),
    });
    await expect(
      reuseInstalledSpatialComposition(
        installerId,
        receiving,
        1,
        restrictedInstall.itemId!,
        (await listSpatialItems(installerId)).find((item) => item.id === restrictedInstall.itemId)!.releases[0].id,
      ),
    ).rejects.toThrow(/does not allow modification or remixing/);
    const savedAsset = await saveReusableAsset(
      ownerId,
      parent,
      2,
      parent.content.entities[0].id,
      { name: "Restricted desk prop", description: "Synthetic prop", classification: "Map" },
      simulationEnvironments[0],
    );
    const asset = (await listSpatialItems(ownerId)).find((item) => item.id === savedAsset.definitionId)!;
    const assetInput = {
      ...input,
      source: { kind: "ASSET" as const, id: asset.id, revision: asset.revision },
      slug: `restricted-desk-prop-${suffix}`,
      title: "Restricted desk prop",
      licenseKey: "USE_IN_CHRONICLES_WITH_ATTRIBUTION",
    };
    const assetReview = await preflightSpatialPublication(ownerId, assetInput);
    const assetRelease = await publishSpatialToCommunity(ownerId, assetInput, assetReview.reviewDigest);
    await db.communityListing.update({
      where: { id: assetRelease.listingId },
      data: { publicationStatus: "PUBLISHED" },
    });
    const assetInstallReview = await reviewSpatialInstallation(installerId, assetRelease.listingId);
    const assetInstall = await installSpatialCommunityRelease({
      accountId: installerId,
      listingId: assetRelease.listingId,
      releaseId: assetRelease.releaseId,
      packageChecksum: assetInstallReview.packageChecksum,
      requestId: randomUUID(),
    });
    const installedAsset = (await listSpatialItems(installerId)).find((item) => item.id === assetInstall.itemId)!;
    await expect(
      reuseSpatialAsset(installerId, receiving, 1, installedAsset.id, installedAsset.releases[0].id),
    ).rejects.toThrow(/does not allow modification or remixing/);
    const changed = structuredClone(parent);
    changed.content.entities[0].content = "The private parent was revised.";
    expect(await saveSpatialDraft(ownerId, changed, 2)).toBe(3);
    await expect(preflightSpatialPublication(ownerId, input)).rejects.toThrow(/no longer matches its owned source/);
  }, 120_000);

  it("publishes a procedural spatial effect and restores its Effects Library identity", async () => {
    const ownerId = randomUUID();
    const installerId = randomUUID();
    const moderatorId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.userAccount.create({ data: { id: ownerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: installerId, status: "ACTIVE" } });
    await db.userAccount.create({ data: { id: moderatorId, status: "ACTIVE" } });
    await db.playerProfile.create({
      data: {
        accountId: ownerId,
        displayName: "Synthetic Effect Creator",
        handle: `effect-${suffix}`,
        normalizedHandle: `effect-${suffix}`,
        defaultVisibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    const baseline = createSpatialDraft(randomUUID());
    const effect = editSpatialDraft(insertSpatialElement(baseline, "mist", "mist-1"), {
      type: "DELETE",
      entityId: baseline.content.entities[0].id,
    });
    effect.category = "EFFECT";
    effect.content.title = "Imaginary mist";
    expect(await saveSpatialDraft(ownerId, effect, 0)).toBe(1);
    expect((await saveDefinitionToLibrary(ownerId, effect.content.definitionId, 1)).revision).toBe(2);
    expect(knownSpatialPublicationLimit(effect)).toBeNull();
    expect(
      buildSpatialContentCatalog(await listSpatialItems(ownerId), []).some((item) => item.kind === "EFFECTS"),
    ).toBe(true);
    const input = {
      source: { kind: "ASSET" as const, id: effect.content.definitionId, revision: 2 },
      slug: `imaginary-mist-${suffix}`,
      title: effect.content.title,
      description: "A reusable procedural mist effect with no binary media.",
      tags: ["mist", "effect"],
      visibility: "COMMUNITY" as const,
      locationClass: "FICTIONAL" as const,
      licenseKey: "REMIX_WITH_ATTRIBUTION",
      attribution: [],
      rightsAcknowledged: true as const,
      environmentPrivacyAcknowledged: false,
    };
    const review = await preflightSpatialPublication(ownerId, input);
    expect(review.included).toHaveLength(1);
    expect(review.included[0].preview).toMatchObject({
      category: "EFFECT",
      content: { entities: [expect.objectContaining({ element: expect.objectContaining({ kind: "ATMOSPHERE" }) })] },
    });
    const release = await publishSpatialToCommunity(ownerId, input, review.reviewDigest);
    const moderator = { accountId: moderatorId, roles: ["MODERATOR"], authorizationBasis: "isolated-test" };
    const moderationReview = await reviewSpatialPublicationForModeration(moderator, release.listingId);
    expect(
      await approveSpatialPublication(moderator, release.listingId, {
        releaseId: moderationReview.releaseId,
        packageChecksum: moderationReview.packageChecksum,
        packageReviewed: true,
      }),
    ).toMatchObject({ publicationStatus: "PUBLISHED" });
    expect(await getPublicListingBySlug(input.slug)).toMatchObject({ slug: input.slug });
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
    expect(installed.draft.content.entities.some((entity) => entity.element?.kind === "ATMOSPHERE")).toBe(true);
    expect(buildSpatialContentCatalog([installed], []).find((item) => item.id === `saved:${installed.id}`)?.kind).toBe(
      "EFFECTS",
    );
    expect((await readInstalledSpatialCommunitySummaryPage(installerId)).items).toMatchObject([
      { targetId: installed.id, sourceId: "spatial", kind: "EFFECTS", releaseId: release.releaseId, readOnly: true },
    ]);
  }, 90_000);
});

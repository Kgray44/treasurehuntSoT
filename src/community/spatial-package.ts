import { z } from "zod";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "@/parallax/authoring";
import { versionContentSchema } from "@/parallax/contracts";
import { roomEnvironmentSchema } from "@/parallax/environment-contracts";
import { environmentReferenceSchema } from "@/parallax/environment-reference";
import { environmentDraftSchema } from "@/parallax/library-lifecycle-contracts";
import { environmentContentSchema } from "@/parallax/legacy-scene-environment-contracts";
import { CommunityError, stableJson } from "./domain";
import {
  communityPackageManifestSchema,
  sha256,
  verifyCommunityPackage,
  type CommunityPackageFile,
  type CommunityPackageManifest,
} from "./package";

const sourceId = z.string().min(1).max(128);
const sourceRevision = z.number().int().positive();
export const spatialSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ASSET"), id: sourceId, revision: sourceRevision }),
  z.strictObject({ kind: z.literal("SCENE"), id: sourceId, revision: sourceRevision }),
  z.strictObject({
    kind: z.literal("ENVIRONMENT"),
    id: sourceId,
    revision: sourceRevision,
    versionId: environmentReferenceSchema.shape.versionId,
  }),
]);
export type SpatialSource = z.infer<typeof spatialSourceSchema>;
const resolvedEnvironmentSchema = z.discriminatedUnion("format", [
  z.strictObject({
    format: z.literal("SC01_SCHEMA1"),
    reference: environmentReferenceSchema,
    legacy: environmentContentSchema,
    room: z.null(),
  }),
  z.strictObject({
    format: z.literal("PARALLAX_ENVIRONMENT_VERSION_1"),
    reference: environmentReferenceSchema,
    document: environmentDraftSchema,
    room: roomEnvironmentSchema,
  }),
]);
type ResolvedEnvironment = z.infer<typeof resolvedEnvironmentSchema>;
export type SpatialPackageProjection = {
  itemType: "SPATIAL_ASSET" | "SPATIAL_SCENE" | "SPATIAL_ENVIRONMENT";
  category: string;
  title: string;
  sourceChecksum: string;
  dependencies: Array<{ type: string; name: string; revision: number; checksum: string }>;
  files: CommunityPackageFile[];
  warnings: string[];
};

function fail(code: string, message: string): never {
  throw new CommunityError(code, message);
}

function publicEnvironmentContent(content: z.infer<typeof environmentContentSchema>) {
  return environmentContentSchema.parse({
    schemaVersion: content.schemaVersion,
    id: content.id,
    name: content.name,
    description: content.description,
    origin: content.origin,
    sourceLabel: "Creator-authored synthetic Environment",
    width: content.width,
    depth: content.depth,
    horizontal: content.horizontal,
    vertical: content.vertical,
    light: content.light,
    clutter: content.clutter,
    tracking: content.tracking,
    evidence: {
      schemaVersion: content.evidence.schemaVersion,
      frameId: content.evidence.frameId,
      source: content.evidence.source,
      reliableTracking: content.evidence.reliableTracking,
      candidates: content.evidence.candidates,
    },
    fixtures: content.fixtures,
  });
}

function publicRichEnvironmentContent(
  environment: Extract<ResolvedEnvironment, { format: "PARALLAX_ENVIRONMENT_VERSION_1" }>,
) {
  const { document, room } = environment;
  if (document.lineage)
    fail(
      "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
      "This Environment's remix lineage needs verified redistribution rights.",
    );
  if (room.origin === "PHOTO_RECONSTRUCTION")
    fail(
      "COMMUNITY_PRIVATE_ENVIRONMENT",
      "A reconstructed real-world room cannot be distributed as a Community Environment.",
    );
  if (room.origin !== "MANUAL")
    fail("COMMUNITY_SOURCE_NOT_OWNED", "Create an owned synthetic Environment before distributing this room.");
  if (room.scaleReference)
    fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Measured room scale cannot enter a Community package.");
  if (
    room.features.some(
      (feature) =>
        feature.provenance.sourceMediaIds.length > 0 ||
        !["SIMULATED", "CREATOR_CONFIRMED"].includes(feature.provenance.basis),
    )
  )
    fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Observed or media-derived room features cannot enter a Community package.");
  if (!document.room || canonicalChecksum(document.room) !== canonicalChecksum(room))
    fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The Environment room no longer matches its pinned version.");
  const publicRoom = roomEnvironmentSchema.parse({
    schemaVersion: room.schemaVersion,
    id: room.id,
    name: room.name,
    width: room.width,
    depth: room.depth,
    height: room.height,
    origin: room.origin,
    ...(room.light && { light: room.light }),
    ...(room.exclusionZonesEnabled && { exclusionZonesEnabled: room.exclusionZonesEnabled }),
    ...(room.suppressedExclusions && { suppressedExclusions: room.suppressedExclusions }),
    ...(room.construction && { construction: room.construction }),
    features: room.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      classification: feature.classification,
      position: feature.position,
      yawDegrees: feature.yawDegrees,
      ...(feature.applianceShape && { applianceShape: feature.applianceShape }),
      ...(feature.openingState && { openingState: feature.openingState }),
      dimensions: feature.dimensions,
      ...(feature.exclusion && { exclusion: feature.exclusion }),
      provenance: {
        basis: feature.provenance.basis,
        confidence: feature.provenance.confidence,
        sourceMediaIds: [],
      },
      parts: feature.parts.map((part) => ({
        id: part.id,
        size: part.size,
        position: part.position,
        surface: part.surface,
        context: part.context,
        face: part.face,
        shape: part.shape,
        color: part.color,
      })),
    })),
  });
  return {
    schemaVersion: 2 as const,
    format: "PARALLAX_ENVIRONMENT_VERSION_1" as const,
    content: {
      id: document.id,
      name: document.name,
      description: document.description,
      category: document.category,
      room: publicRoom,
    },
  };
}

/** Only schema-validated authoring data crosses this boundary. Private draft,
 * Chronicle, calibration, Vision and protected-media fields never enter files. */
export function projectSpatialPackage(
  source: SpatialSource,
  raw: unknown,
  rawEnvironment?: unknown,
  verifiedOwnedComposition = false,
): SpatialPackageProjection {
  if (source.kind === "ENVIRONMENT") {
    const environment = resolvedEnvironmentSchema.parse(raw);
    if (environment.reference.environmentId !== source.id || environment.reference.versionId !== source.versionId)
      fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The selected Environment revision changed.");
    let payload: unknown;
    let title: string;
    if (environment.format === "SC01_SCHEMA1") {
      if (canonicalChecksum(environment.legacy) !== environment.reference.checksum)
        fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The Environment revision failed integrity verification.");
      if (environment.legacy.origin === "RECONSTRUCTED")
        fail(
          "COMMUNITY_PRIVATE_ENVIRONMENT",
          "A reconstructed real-world room cannot be distributed as a Community Environment. Create an owned synthetic Environment instead.",
        );
      if (environment.legacy.origin !== "MANUAL")
        fail("COMMUNITY_SOURCE_NOT_OWNED", "Built-in Environments cannot be republished as Creator-owned work.");
      if (environment.legacy.evidence.source !== "SIMULATED")
        fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Measured real-world room evidence cannot enter a Community package.");
      payload = { schemaVersion: 1, content: publicEnvironmentContent(environment.legacy) };
      title = environment.legacy.name;
    } else {
      payload = publicRichEnvironmentContent(environment);
      title = environment.document.name;
    }
    const bytes = new TextEncoder().encode(stableJson(JSON.parse(JSON.stringify(payload))));
    return {
      itemType: "SPATIAL_ENVIRONMENT",
      category: "ENVIRONMENT",
      title,
      sourceChecksum: environment.reference.checksum,
      dependencies: [],
      files: [{ path: "items/environment.json", mediaType: "application/json", bytes }],
      warnings: ["Review this geometry carefully. A home layout can remain sensitive even without photographs."],
    };
  }

  const draft = draftSchema.parse(raw);
  if (draft.content.definitionId !== source.id)
    fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The selected spatial item changed.");
  if (draft.scope !== "MY_LIBRARY")
    fail("COMMUNITY_SOURCE_NOT_SHAREABLE", "Save this content to My Spatial Library before publishing it.");
  const composition = draft.category === "SCENE_TEMPLATE" && draft.tags.includes("composition");
  if (draft.lineage && !(source.kind === "ASSET" && composition && verifiedOwnedComposition))
    fail("COMMUNITY_REDISTRIBUTION_UNVERIFIED", "This item's remix lineage needs a verified redistribution license.");
  if (draft.content.entities.some((entity) => entity.element?.kind === "PHYSICAL_ASSET"))
    fail(
      "COMMUNITY_ASSET_RIGHTS_UNVERIFIED",
      "SC-02 physical models require owner redistribution authorization and a resolved package dependency before publication.",
    );
  if (draft.content.studio?.assetInstances?.length)
    fail(
      "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
      "Placed reusable assets need verified source licenses and pinned package dependencies before publication.",
    );
  if (draft.content.studio?.assets.length)
    fail(
      "COMMUNITY_ASSET_RIGHTS_UNVERIFIED",
      "Referenced models, textures or audio need resolved bytes, scanner evidence and redistribution rights before publication.",
    );
  if (draft.content.studio?.visionReferences.length)
    fail("COMMUNITY_PRIVATE_REFERENCE", "Private Vision or calibration references cannot enter a Community package.");
  if (draft.content.adaptive?.calibration.enabled || draft.content.adaptive?.calibration.reviewReceiptId)
    fail("COMMUNITY_PRIVATE_CALIBRATION", "Calibration evidence cannot enter a Community package.");
  if (draft.content.placementPolicy === "CALIBRATED")
    fail("COMMUNITY_PRIVATE_CALIBRATION", "A calibrated private placement cannot be published as portable content.");
  if (draft.content.anchors.some((anchor) => anchor.kind === "FIXED_WORLDSPACE"))
    fail(
      "COMMUNITY_PRIVATE_WORLDSPACE",
      "A fixed real-world anchor can reveal location metadata. Replace it with a portable local or surface anchor before publishing.",
    );
  if (source.kind === "SCENE" && !draft.content.environment)
    fail("COMMUNITY_DEPENDENCY_MISSING", "Publishable Scenes require a pinned Environment revision.");
  if (source.kind === "ASSET" && draft.content.environment)
    fail("COMMUNITY_SOURCE_TYPE_MISMATCH", "This item is an Environment-bound Scene.");

  const dependencies: SpatialPackageProjection["dependencies"] = [];
  const files: CommunityPackageFile[] = [];
  let publicEnvironment: ResolvedEnvironment | undefined;
  if (source.kind === "SCENE") {
    publicEnvironment = resolvedEnvironmentSchema.parse(rawEnvironment);
    if (canonicalChecksum(publicEnvironment.reference) !== canonicalChecksum(draft.content.environment))
      fail("COMMUNITY_DEPENDENCY_MISSING", "The Scene's pinned Environment revision is unavailable or changed.");
    let payload: unknown;
    let name: string;
    if (publicEnvironment.format === "SC01_SCHEMA1") {
      if (canonicalChecksum(publicEnvironment.legacy) !== publicEnvironment.reference.checksum)
        fail("COMMUNITY_DEPENDENCY_MISSING", "The Scene's pinned Environment revision failed integrity verification.");
      if (publicEnvironment.legacy.origin === "RECONSTRUCTED")
        fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Scenes tied to reconstructed real-world rooms cannot be published.");
      if (publicEnvironment.legacy.origin !== "MANUAL")
        fail("COMMUNITY_ASSET_RIGHTS_UNVERIFIED", "Save an owned Environment copy before distributing this Scene.");
      if (publicEnvironment.legacy.evidence.source !== "SIMULATED")
        fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Measured real-world room evidence cannot enter a Community package.");
      payload = { schemaVersion: 1, content: publicEnvironmentContent(publicEnvironment.legacy) };
      name = publicEnvironment.legacy.name;
    } else {
      if (canonicalChecksum(draft.content.studio?.environment ?? null) !== canonicalChecksum(publicEnvironment.room))
        fail("COMMUNITY_DEPENDENCY_MISSING", "The Scene room no longer matches its pinned Environment version.");
      payload = publicRichEnvironmentContent(publicEnvironment);
      name = publicEnvironment.document.name;
    }
    files.push({
      path: "items/environment.json",
      mediaType: "application/json",
      bytes: new TextEncoder().encode(stableJson(JSON.parse(JSON.stringify(payload)))),
    });
    dependencies.push({
      type: "SPATIAL_ENVIRONMENT",
      name,
      revision: publicEnvironment.reference.revision,
      checksum: publicEnvironment.reference.checksum,
    });
  }
  const { content } = draft;
  // Construct only fields approved for Community. New source fields require an
  // explicit projection change; owner scope, Chronicle state and receipts stay out.
  const publicContent = versionContentSchema.parse({
    id: content.id,
    definitionId: content.definitionId,
    semanticVersion: content.semanticVersion,
    schemaVersion: content.schemaVersion,
    title: content.title,
    ...(content.studio && {
      studio: {
        schemaVersion: content.studio.schemaVersion,
        layers: content.studio.layers,
        behaviors: content.studio.behaviors,
        ...(content.studio.animationTracks && { animationTracks: content.studio.animationTracks }),
        assets: [],
        visionReferences: [],
        minimumRuntime: content.studio.minimumRuntime,
        capabilityDependencies: content.studio.capabilityDependencies,
        compatibilityNotes: content.studio.compatibilityNotes,
        provenance: {
          origin: content.studio.provenance.origin,
          generator: "Parallax Spatial Studio",
          license: content.studio.provenance.license,
        },
      },
    }),
    ...(content.environment && { environment: content.environment }),
    ...(content.sceneDescription !== undefined && { sceneDescription: content.sceneDescription }),
    ...(content.scenePresentation && { scenePresentation: content.scenePresentation }),
    ...(content.environmentPlacements && { environmentPlacements: content.environmentPlacements }),
    anchors: content.anchors,
    entities: content.entities,
    placementPolicy: content.placementPolicy,
    ...(content.adaptive && {
      adaptive: {
        schemaVersion: content.adaptive.schemaVersion,
        authoringApproach: content.adaptive.authoringApproach,
        lifecycle: content.adaptive.lifecycle,
        variation: content.adaptive.variation,
        variant: content.adaptive.variant,
        recipes: content.adaptive.recipes,
        relationships: content.adaptive.relationships,
        revealOrder: content.adaptive.revealOrder,
        budget: content.adaptive.budget,
        discovery: content.adaptive.discovery,
        calibration: {
          enabled: content.adaptive.calibration.enabled,
          maturity: content.adaptive.calibration.maturity,
          evidenceKind: content.adaptive.calibration.evidenceKind,
          automaticImages: content.adaptive.calibration.automaticImages,
          retentionDays: content.adaptive.calibration.retentionDays,
        },
      },
    }),
    privacyClass: content.privacyClass,
    fallback: content.fallback,
    accessibility: content.accessibility,
  });
  files.push({
    path: "items/spatial.json",
    mediaType: "application/json",
    bytes: new TextEncoder().encode(
      stableJson(
        JSON.parse(
          JSON.stringify({
            schemaVersion: 1,
            category: draft.category,
            ...(composition && { composition: true }),
            content: publicContent,
          }),
        ),
      ),
    ),
  });
  return {
    itemType: source.kind === "SCENE" ? "SPATIAL_SCENE" : "SPATIAL_ASSET",
    category: composition ? "COMPOSITION" : draft.category,
    title: content.title,
    sourceChecksum: canonicalChecksum(draft),
    dependencies,
    files,
    warnings: publicEnvironment
      ? [
          "Review the included Environment geometry. Removing room photographs does not make a home layout safe to share.",
        ]
      : [],
  };
}

export function spatialPackageManifest(input: {
  packageId: string;
  releaseId: string;
  semanticVersion: string;
  license: { key: string; version: number };
  attribution: Array<{ displayName: string; contributionType: string }>;
  projection: SpatialPackageProjection;
}): CommunityPackageManifest {
  const items = input.projection.files.map((file) => ({
    id: file.path === "items/environment.json" ? "environment" : "spatial",
    type: file.path === "items/environment.json" ? ("SPATIAL_ENVIRONMENT" as const) : input.projection.itemType,
    path: file.path,
    checksum: sha256(file.bytes),
    mediaType: file.mediaType,
    byteLength: file.bytes.byteLength,
    dependencies: file.path === "items/spatial.json" && input.projection.dependencies.length ? ["environment"] : [],
    accessibility: { description: input.projection.title },
  }));
  const manifest = communityPackageManifestSchema.parse({
    schemaVersion: 1,
    packageId: input.packageId,
    releaseId: input.releaseId,
    semanticVersion: input.semanticVersion,
    license: input.license,
    attribution: input.attribution,
    items,
  });
  verifyCommunityPackage(manifest, input.projection.files);
  return manifest;
}

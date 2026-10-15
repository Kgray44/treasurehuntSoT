import { z } from "zod";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "@/parallax/authoring";
import { versionContentSchema } from "@/parallax/contracts";
import {
  environmentContentSchema,
  environmentVersionSchema,
  type EnvironmentVersion,
} from "@/parallax/environment-contracts";
import { CommunityError, stableJson } from "./domain";
import {
  communityPackageManifestSchema,
  sha256,
  verifyCommunityPackage,
  type CommunityPackageFile,
  type CommunityPackageManifest,
} from "./package";

export const spatialSourceSchema = z.strictObject({
  kind: z.enum(["ASSET", "SCENE", "ENVIRONMENT"]),
  id: z.string().min(1).max(128),
  revision: z.number().int().positive(),
});
export type SpatialSource = z.infer<typeof spatialSourceSchema>;
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

function publicEnvironmentContent(environment: EnvironmentVersion) {
  const content = environment.content;
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

/** Only schema-validated authoring data crosses this boundary. Private draft,
 * Chronicle, calibration, Vision and protected-media fields never enter files. */
export function projectSpatialPackage(
  source: SpatialSource,
  raw: unknown,
  rawEnvironment?: unknown,
): SpatialPackageProjection {
  if (source.kind === "ENVIRONMENT") {
    const environment = environmentVersionSchema.parse(raw);
    if (environment.reference.environmentId !== source.id || environment.reference.revision !== source.revision)
      fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The selected Environment revision changed.");
    if (canonicalChecksum(environment.content) !== environment.reference.checksum)
      fail("COMMUNITY_SOURCE_VERSION_MISMATCH", "The Environment revision failed integrity verification.");
    if (environment.content.origin === "RECONSTRUCTED")
      fail(
        "COMMUNITY_PRIVATE_ENVIRONMENT",
        "A reconstructed real-world room cannot be distributed as a Community Environment. Create an owned synthetic Environment instead.",
      );
    if (environment.content.origin !== "MANUAL")
      fail("COMMUNITY_SOURCE_NOT_OWNED", "Built-in Environments cannot be republished as Creator-owned work.");
    if (environment.content.evidence.source !== "SIMULATED")
      fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Measured real-world room evidence cannot enter a Community package.");
    const publicContent = publicEnvironmentContent(environment);
    const bytes = new TextEncoder().encode(
      stableJson(JSON.parse(JSON.stringify({ schemaVersion: 1, content: publicContent }))),
    );
    return {
      itemType: "SPATIAL_ENVIRONMENT",
      category: "ENVIRONMENT",
      title: environment.content.name,
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
  if (draft.lineage)
    fail("COMMUNITY_REDISTRIBUTION_UNVERIFIED", "This item's remix lineage needs a verified redistribution license.");
  if (draft.content.entities.some((entity) => entity.element?.kind === "PHYSICAL_ASSET"))
    fail(
      "COMMUNITY_ASSET_RIGHTS_UNVERIFIED",
      "SC-02 physical models require owner redistribution authorization and a resolved package dependency before publication.",
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
  if (source.kind === "SCENE" && !draft.content.environment)
    fail("COMMUNITY_DEPENDENCY_MISSING", "Publishable Scenes require a pinned Environment revision.");
  if (source.kind === "ASSET" && draft.content.environment)
    fail("COMMUNITY_SOURCE_TYPE_MISMATCH", "This item is an Environment-bound Scene.");

  const dependencies: SpatialPackageProjection["dependencies"] = [];
  const files: CommunityPackageFile[] = [];
  let publicEnvironment: EnvironmentVersion | undefined;
  if (source.kind === "SCENE") {
    publicEnvironment = environmentVersionSchema.parse(rawEnvironment);
    if (
      canonicalChecksum(publicEnvironment.reference) !== canonicalChecksum(draft.content.environment) ||
      canonicalChecksum(publicEnvironment.content) !== publicEnvironment.reference.checksum
    )
      fail("COMMUNITY_DEPENDENCY_MISSING", "The Scene's pinned Environment revision is unavailable or changed.");
    if (publicEnvironment.content.origin === "RECONSTRUCTED")
      fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Scenes tied to reconstructed real-world rooms cannot be published.");
    if (publicEnvironment.content.origin !== "MANUAL")
      fail("COMMUNITY_ASSET_RIGHTS_UNVERIFIED", "Save an owned Environment copy before distributing this Scene.");
    if (publicEnvironment.content.evidence.source !== "SIMULATED")
      fail("COMMUNITY_PRIVATE_ENVIRONMENT", "Measured real-world room evidence cannot enter a Community package.");
    const publicContent = publicEnvironmentContent(publicEnvironment);
    files.push({
      path: "items/environment.json",
      mediaType: "application/json",
      bytes: new TextEncoder().encode(
        stableJson(JSON.parse(JSON.stringify({ schemaVersion: 1, content: publicContent }))),
      ),
    });
    dependencies.push({
      type: "SPATIAL_ENVIRONMENT",
      name: publicEnvironment.content.name,
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
      stableJson(JSON.parse(JSON.stringify({ schemaVersion: 1, category: draft.category, content: publicContent }))),
    ),
  });
  return {
    itemType: source.kind === "SCENE" ? "SPATIAL_SCENE" : "SPATIAL_ASSET",
    category: draft.category,
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

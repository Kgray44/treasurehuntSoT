import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "@/parallax/authoring";
import legacyBuiltins from "@/parallax/builtin-environments.v1.json";
import { createEmptyEnvironment } from "@/parallax/environment-library-authoring";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import { extractComposition, insertSpatialElement, matchesExtractedComposition } from "@/parallax/element-authoring";
import { spatialPackageManifest, projectSpatialPackage } from "./spatial-package";
import { knownSpatialPublicationLimit } from "./spatial-publication-availability";
import { verifyCommunityPackage } from "./package";

const environment = () => {
  const content = {
    ...structuredClone(legacyBuiltins[0].content),
    id: "my-environment",
    name: "Imaginary study",
    origin: "MANUAL" as const,
    sourceLabel: "C:\\private\\home-bedroom-photo.jpg",
  };
  return {
    format: "SC01_SCHEMA1" as const,
    legacy: content,
    room: null,
    reference: {
      environmentId: content.id,
      versionId: `${content.id}:e1`,
      revision: 1,
      checksum: canonicalChecksum(content),
    },
  };
};

const richEnvironment = () => {
  const room = createEmptyEnvironment("rich-environment");
  room.name = "Synthetic harbor room";
  const document = createEnvironmentDraft("rich-environment", room);
  document.name = room.name;
  document.collection = "Private workspace grouping";
  return {
    format: "PARALLAX_ENVIRONMENT_VERSION_1" as const,
    reference: {
      environmentId: document.id,
      versionId: `${document.id}:v1`,
      revision: 1,
      checksum: "a".repeat(64),
    },
    document,
    room,
  };
};

describe("spatial Community package projection", () => {
  it("excludes private draft context and source labels from a reviewed Environment", () => {
    const projection = projectSpatialPackage(
      { kind: "ENVIRONMENT", id: "my-environment", revision: 1, versionId: "my-environment:e1" },
      environment(),
    );
    const file = new TextDecoder().decode(projection.files[0].bytes);
    expect(file).not.toContain("home-bedroom-photo.jpg");
    expect(file).not.toContain("C:\\private");
    expect(file).toContain("Creator-authored synthetic Environment");
    expect(file).not.toContain("viewerPosition");
    const manifest = spatialPackageManifest({
      packageId: "package-1",
      releaseId: "release-1",
      semanticVersion: "1.0.0",
      license: { key: "REMIX_WITH_ATTRIBUTION", version: 1 },
      attribution: [],
      projection,
    });
    expect(verifyCommunityPackage(manifest, projection.files).manifest.items).toHaveLength(1);
  });

  it("blocks reconstructed geometry even when no photograph is attached", () => {
    const source = environment();
    source.legacy.origin = "RECONSTRUCTED" as never;
    source.reference.checksum = canonicalChecksum(source.legacy);
    expect(() =>
      projectSpatialPackage(
        { kind: "ENVIRONMENT", id: "my-environment", revision: 1, versionId: "my-environment:e1" },
        source,
      ),
    ).toThrow(/reconstructed real-world room/i);
  });

  it("blocks measured room evidence even when an Environment is marked manual", () => {
    const source = environment();
    source.legacy.evidence.source = "NATIVE_MEASURED";
    source.reference.checksum = canonicalChecksum(source.legacy);
    expect(() =>
      projectSpatialPackage(
        { kind: "ENVIRONMENT", id: "my-environment", revision: 1, versionId: "my-environment:e1" },
        source,
      ),
    ).toThrow(/Measured real-world room evidence/);
  });

  it("preserves rich synthetic geometry while excluding private Library organization", () => {
    const source = richEnvironment();
    const projection = projectSpatialPackage(
      { kind: "ENVIRONMENT", id: source.document.id, revision: 4, versionId: source.reference.versionId },
      source,
    );
    const payload = JSON.parse(new TextDecoder().decode(projection.files[0].bytes));
    expect(payload).toMatchObject({
      schemaVersion: 2,
      format: "PARALLAX_ENVIRONMENT_VERSION_1",
    });
    expect(payload.content.room.features[0]).toMatchObject({ classification: "FLOOR" });
    expect(payload.content.room.features.length).toBe(source.room.features.length);
    expect(payload.content).not.toHaveProperty("collection");
    expect(payload.content).not.toHaveProperty("favorite");
    expect(payload.content).not.toHaveProperty("lineage");
    expect(projection.sourceChecksum).toBe(source.reference.checksum);
  });

  it("rejects photo-derived rich room features before package bytes are emitted", () => {
    const source = richEnvironment();
    source.room.features[0].provenance.sourceMediaIds = ["private-room-photo"];
    source.document.room = source.room;
    expect(() =>
      projectSpatialPackage(
        { kind: "ENVIRONMENT", id: source.document.id, revision: 4, versionId: source.reference.versionId },
        source,
      ),
    ).toThrow(/Observed or media-derived room features/);
  });

  it("resolves a Scene's pinned Environment into the actual package dependency", () => {
    const source = environment();
    const draft = createSpatialDraft("scene-1");
    draft.content.environment = source.reference;
    const projection = projectSpatialPackage({ kind: "SCENE", id: "scene-1", revision: 1 }, draft, source);
    const manifest = spatialPackageManifest({
      packageId: "package-2",
      releaseId: "release-2",
      semanticVersion: "1.0.0",
      license: { key: "REMIX_WITH_ATTRIBUTION", version: 1 },
      attribution: [],
      projection,
    });
    expect(manifest.items.find((item) => item.id === "spatial")?.dependencies).toEqual(["environment"]);
    expect(projection.dependencies[0].checksum).toBe(source.reference.checksum);
    const spatial = new TextDecoder().decode(
      projection.files.find((file) => file.path === "items/spatial.json")!.bytes,
    );
    expect(spatial).not.toContain("chronicleId");
    expect(spatial).not.toContain("ownerAccountId");
    expect(spatial).not.toContain("home-bedroom-photo.jpg");
  });

  it("fails closed for unresolved media, private Vision references, and unverified remix rights", () => {
    const draft = createSpatialDraft("asset-1");
    draft.content.studio!.assets.push({
      id: "media-1",
      entityId: draft.content.entities[0].id,
      kind: "TEXTURE",
      assetId: "private-photo",
      checksum: "a".repeat(64),
      format: "PNG",
      bytes: 12,
      triangles: 0,
      texturePixels: 100,
      durationSeconds: 0,
      metersPerUnit: 1,
      alternativeText: "Private photo",
      license: "Creator owned",
      provenance: "CREATOR",
    });
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "asset-1", revision: 1 }, draft)).toThrow(
      /scanner evidence/i,
    );
    draft.content.studio!.assets = [];
    draft.content.studio!.visionReferences.push({
      entityId: draft.content.entities[0].id,
      waypointId: "private-waypoint",
      versionId: "private-version",
      checksum: "b".repeat(64),
      purpose: "RELOCALIZATION",
    });
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "asset-1", revision: 1 }, draft)).toThrow(
      /Private Vision/i,
    );
    draft.content.studio!.visionReferences = [];
    draft.lineage = { definitionId: "upstream", versionId: "v1" };
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "asset-1", revision: 1 }, draft)).toThrow(
      /redistribution license/i,
    );
  });

  it("refuses proprietary SC-02 model references without redistribution authorization", () => {
    const draft = insertSpatialElement(createSpatialDraft("asset-2"), "articulated-chest", "chest-1");
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "asset-2", revision: 1 }, draft)).toThrow(
      /owner redistribution authorization/,
    );
  });

  it("retains validated animation tracks in the installable package", () => {
    const draft = createSpatialDraft("animated-effect");
    const track = {
      id: "effect-opacity",
      entityId: draft.content.entities[0].id,
      enabled: true,
      property: "OPACITY" as const,
      interpolation: "LINEAR" as const,
      keyframes: [
        { id: "start", atMs: 0, value: 0 },
        { id: "finish", atMs: 1000, value: 1 },
      ],
    };
    draft.content.studio!.animationTracks = [track];
    const projection = projectSpatialPackage({ kind: "ASSET", id: "animated-effect", revision: 1 }, draft);
    const payload = JSON.parse(new TextDecoder().decode(projection.files[0].bytes));
    expect(payload.content.studio.animationTracks).toEqual([track]);
  });

  it("refuses placed reusable assets until their pinned source rights and dependencies are resolved", () => {
    const draft = createSpatialDraft("reused-asset");
    draft.content.studio!.assetInstances = [
      {
        id: "placed-copy",
        definitionId: "upstream-item",
        versionId: "upstream-version",
        checksum: "a".repeat(64),
        entityIds: [draft.content.entities[0].id],
      },
    ];
    expect(knownSpatialPublicationLimit(draft)).toMatch(/Placed reusable assets need verified source licenses/i);
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "reused-asset", revision: 1 }, draft)).toThrow(
      /Placed reusable assets need verified source licenses/i,
    );
  });

  it("keeps reused-asset rights visible through composition extraction and blocks republishing", () => {
    const parent = createSpatialDraft("scene-with-reuse");
    parent.content.studio!.assetInstances = [
      {
        id: "placed-upstream",
        definitionId: "upstream-item",
        versionId: "upstream-release",
        checksum: "b".repeat(64),
        entityIds: [parent.content.entities[0].id],
      },
    ];
    const composition = extractComposition(parent, parent.content.entities[0].id, "composition-with-reuse");
    expect(matchesExtractedComposition(parent, composition)).toBe(true);
    expect(composition.content.studio?.assetInstances).toHaveLength(1);
    expect(() =>
      projectSpatialPackage(
        { kind: "ASSET", id: composition.content.definitionId, revision: 1 },
        composition,
        undefined,
        true,
      ),
    ).toThrow(/Placed reusable assets need verified source licenses/i);
  });

  it("refuses a fixed worldspace anchor before its location identifier reaches public package bytes", () => {
    const draft = createSpatialDraft("private-worldspace");
    const anchor = draft.content.anchors[0];
    draft.content.anchors[0] = {
      id: anchor.id,
      kind: "FIXED_WORLDSPACE",
      frameId: anchor.frameId,
      worldspaceId: "private-home-location",
      transform: anchor.transform,
    };
    draft.content.entities[0].coordinateSpace = "WORLDSPACE";
    expect(knownSpatialPublicationLimit(draft)).toMatch(/fixed real-world anchor can reveal location metadata/i);
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "private-worldspace", revision: 1 }, draft)).toThrow(
      /fixed real-world anchor can reveal location metadata/i,
    );
  });

  it("marks a verified source-matched composition without admitting arbitrary remix lineage", () => {
    const parent = createSpatialDraft("owned-scene");
    const composition = extractComposition(parent, parent.content.entities[0].id, "owned-composition");
    expect(matchesExtractedComposition(parent, composition)).toBe(true);
    expect(() => projectSpatialPackage({ kind: "ASSET", id: "owned-composition", revision: 1 }, composition)).toThrow(
      /redistribution license/i,
    );
    const projection = projectSpatialPackage(
      { kind: "ASSET", id: "owned-composition", revision: 1 },
      composition,
      undefined,
      true,
    );
    expect(projection.category).toBe("COMPOSITION");
    const payload = JSON.parse(new TextDecoder().decode(projection.files[0].bytes));
    expect(payload).toMatchObject({ category: "SCENE_TEMPLATE", composition: true });
    expect(payload).not.toHaveProperty("lineage");
    const changed = structuredClone(composition);
    changed.content.entities[0].content = "Unverified replacement content";
    expect(matchesExtractedComposition(parent, changed)).toBe(false);
  });
});

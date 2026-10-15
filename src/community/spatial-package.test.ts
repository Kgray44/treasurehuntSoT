import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "@/parallax/authoring";
import { builtinEnvironments } from "@/parallax/environment-service";
import { extractComposition, insertSpatialElement, matchesExtractedComposition } from "@/parallax/element-authoring";
import { spatialPackageManifest, projectSpatialPackage } from "./spatial-package";
import { knownSpatialPublicationLimit } from "./spatial-publication-availability";
import { verifyCommunityPackage } from "./package";

const environment = () => {
  const content = {
    ...structuredClone(builtinEnvironments()[0].current.content),
    id: "my-environment",
    name: "Imaginary study",
    origin: "MANUAL" as const,
    sourceLabel: "C:\\private\\home-bedroom-photo.jpg",
  };
  return {
    content,
    reference: {
      environmentId: content.id,
      versionId: `${content.id}:e1`,
      revision: 1,
      checksum: canonicalChecksum(content),
    },
  };
};

describe("spatial Community package projection", () => {
  it("excludes private draft context and source labels from a reviewed Environment", () => {
    const projection = projectSpatialPackage({ kind: "ENVIRONMENT", id: "my-environment", revision: 1 }, environment());
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
    source.content.origin = "RECONSTRUCTED" as never;
    source.reference.checksum = canonicalChecksum(source.content);
    expect(() => projectSpatialPackage({ kind: "ENVIRONMENT", id: "my-environment", revision: 1 }, source)).toThrow(
      /reconstructed real-world room/i,
    );
  });

  it("blocks measured room evidence even when an Environment is marked manual", () => {
    const source = environment();
    source.content.evidence.source = "NATIVE_MEASURED";
    source.reference.checksum = canonicalChecksum(source.content);
    expect(() => projectSpatialPackage({ kind: "ENVIRONMENT", id: "my-environment", revision: 1 }, source)).toThrow(
      /Measured real-world room evidence/,
    );
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

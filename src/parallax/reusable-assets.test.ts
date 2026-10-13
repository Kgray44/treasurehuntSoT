import { describe, expect, it } from "vitest";
import { createSpatialDraft, editSpatialDraft, previewEntityTransform, draftSchema } from "./authoring";
import { createReusableSpatialAsset, insertReusableSpatialAsset, spatialLibraryKind } from "./reusable-assets";
import { simulationEnvironments } from "./studio-validation";
import { materializeSpatialVersion } from "./publication";
import { createRoomEnvironment } from "./environment-authoring";
import { placeOnRoomFeature } from "./room-placement";
import { insertSpatialPreset } from "./editor-assets";
import { evaluateSpatialScene } from "./behavior";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { spatialFootprintSide } from "./prop-style";

const room = simulationEnvironments[0],
  metadata = { name: "Captain's compass", description: "A reusable navigation clue", classification: "Navigation" };
function exported(source = createSpatialDraft("source", "Floating Compass")) {
  return createReusableSpatialAsset(source, source.content.entities[0].id, "asset", metadata, room);
}
function release(asset = exported()) {
  return materializeSpatialVersion({ ...asset.content, id: "asset:v1" });
}

describe("reusable objects and assembly definitions", () => {
  it.each([false, true])(
    "preserves right-foot appearance across duplication, definition and instance remapping (legacy %s)",
    (legacy) => {
      const source = createSpatialDraft("source", "Ghost Footprint Trail");
      const right = source.content.entities[1];
      if (legacy) delete right.footprintSide;
      const copied = editSpatialDraft(source, { type: "DUPLICATE", entityId: right.id, newId: "arbitrary-copy" });
      expect(copied.content.entities.at(-1)!.footprintSide).toBe("RIGHT");
      const asset = createReusableSpatialAsset(
        source,
        right.id,
        "boot",
        { name: "Boot clue", description: "A reusable right boot", classification: "Footprint" },
        room,
      );
      expect(asset.content.entities[0].id).not.toBe(right.id);
      expect(spatialFootprintSide(asset.content.entities[0])).toBe("RIGHT");
      const version = materializeSpatialVersion({ ...asset.content, id: "boot:v1" });
      const next = insertReusableSpatialAsset(createSpatialDraft("destination"), version, "new-instance");
      expect(next.content.entities.at(-1)!.footprintSide).toBe("RIGHT");
      expect(spatialFootprintSide(next.content.entities.at(-1)!)).toBe("RIGHT");
      expect(source.content.entities[1].footprintSide).toBe(legacy ? undefined : "RIGHT");
    },
  );
  it("extracts a room-bound object without copying room or source identity", () => {
    let source = createSpatialDraft("room-source");
    source.content.studio!.environment = createRoomEnvironment(room);
    source = placeOnRoomFeature(source, source.content.entities[0].id, {
      classification: "DESK",
      targetFeatureId: "reference-desk",
      nearFeatureId: "window",
    });
    const snapshot = JSON.stringify(source),
      asset = exported(source);
    expect(asset.scope).toBe("MY_LIBRARY");
    expect(asset.chronicleId).toBeNull();
    expect(asset.content.studio!.environment).toBeUndefined();
    expect(asset.content.studio!.surfacePreviewFrames).toBeUndefined();
    expect(asset.content.studio!.libraryDefinition).toMatchObject({
      kind: "ASSET",
      rootEntityId: "asset:entity-0",
      classification: "Navigation",
    });
    expect(asset.content.entities[0].transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(asset.content.entities[0].transform.rotation).toEqual(
      previewEntityTransform(source.content, source.content.entities[0].id, room.id).rotation,
    );
    expect(JSON.stringify(source)).toBe(snapshot);
  });
  it("preserves grouped geometry and internal behaviors while remapping every identity", () => {
    let source = createSpatialDraft("source", "Floating Compass");
    source = editSpatialDraft(source, { type: "DUPLICATE", entityId: source.content.entities[0].id, newId: "letter" });
    const root = source.content.entities[0].id,
      child = source.content.entities[1].id;
    source = editSpatialDraft(source, { type: "PARENT", entityId: child, parentId: root });
    source = editSpatialDraft(source, {
      type: "BEHAVIOR",
      behavior: {
        id: "show-letter",
        trigger: "INSPECT",
        sourceEntityId: root,
        targetEntityId: child,
        delayMs: 0,
        action: "SHOW",
      },
    });
    const asset = exported(source);
    expect(spatialLibraryKind(asset)).toBe("ASSEMBLIES");
    expect(asset.content.entities[1].parentEntityId).toBe(asset.content.entities[0].id);
    const oldRoot = previewEntityTransform(source.content, root),
      oldChild = previewEntityTransform(source.content, child);
    const newChild = previewEntityTransform(asset.content, asset.content.entities[1].id);
    expect(newChild.position.x).toBeCloseTo(oldChild.position.x - oldRoot.position.x);
    expect(newChild.position.y).toBeCloseTo(oldChild.position.y - oldRoot.position.y);
    expect(asset.content.studio!.behaviors[0]).toMatchObject({
      sourceEntityId: "asset:entity-0",
      targetEntityId: "asset:entity-1",
    });
  });
  it("preserves root animation from the old anchor frame", () => {
    const source = createSpatialDraft("source", "Floating Compass"),
      root = source.content.entities[0];
    source.content.anchors[0].transform.position = { x: 1, y: 2, z: 3 };
    source.content.studio!.animationTracks = [
      {
        id: "motion",
        entityId: root.id,
        property: "POSITION",
        enabled: true,
        interpolation: "LINEAR",
        keyframes: [
          { id: "start", atMs: 0, value: { x: 0, y: 0, z: 0 } },
          { id: "end", atMs: 1000, value: { x: 0.5, y: 0, z: 0 } },
        ],
      },
    ];
    const asset = exported(source);
    const at = evaluateSpatialScene(asset.content, [], 1000).states[asset.content.entities[0].id].transform;
    expect(at.position).toEqual({ x: 0.5, y: 0, z: 0 });
    expect(asset.content.studio!.animationTracks![0].id).not.toBe("motion");
  });
  it("refuses external behavior and media dependencies without truncating them", () => {
    const source = insertSpatialPreset(createSpatialDraft("source", "Floating Compass"), "Desk Map", "external");
    source.content.studio!.behaviors = [
      {
        id: "external-trigger",
        trigger: "INSPECT",
        sourceEntityId: source.content.entities[1].id,
        targetEntityId: source.content.entities[0].id,
        delayMs: 0,
        action: "SHOW",
      },
    ];
    expect(() => exported(source)).toThrow(/outside the selection/);
    source.content.studio!.behaviors = [];
    source.content.studio!.visionReferences = [
      {
        entityId: source.content.entities[0].id,
        waypointId: "private-waypoint",
        versionId: "private-v1",
        checksum: "a".repeat(64),
        purpose: "RELOCALIZATION",
      },
    ];
    expect(() => exported(source)).toThrow(/dependencies/);
  });
  it("creates independently editable pinned copies with unique identities and unchanged definitions", () => {
    const version = release(),
      snapshot = JSON.stringify(version),
      target = createSpatialDraft("target");
    const first = insertReusableSpatialAsset(target, version, "copy-a"),
      second = insertReusableSpatialAsset(first, version, "copy-b");
    expect(new Set(second.content.entities.map((e) => e.id)).size).toBe(3);
    expect(second.content.studio!.assetInstances).toHaveLength(2);
    expect(second.content.studio!.assetInstances![0]).toMatchObject({
      definitionId: "asset",
      versionId: "asset:v1",
      checksum: version.checksum,
    });
    const edited = editSpatialDraft(second, {
      type: "CONTENT",
      entityId: "copy-a:entity-0",
      patch: { name: "Local compass", widthMeters: 0.2 },
    });
    expect(edited.content.entities.find((e) => e.id === "copy-b:entity-0")!.name).toBe("Floating Compass");
    expect(JSON.stringify(version)).toBe(snapshot);
    expect(target.content.entities).toHaveLength(1);
  });
  it("cleans provenance on delete and preserves it on ordinary duplicate", () => {
    const copy = insertReusableSpatialAsset(createSpatialDraft("target"), release(), "instance");
    const duplicate = editSpatialDraft(copy, { type: "DUPLICATE", entityId: "instance:entity-0", newId: "duplicate" });
    expect(duplicate.content.studio!.assetInstances![1].entityIds).toEqual(["duplicate"]);
    const deleted = editSpatialDraft(copy, { type: "DELETE", entityId: "instance:entity-0" });
    expect(deleted.content.studio!.assetInstances).toEqual([]);
  });
  it("rejects missing instance bindings and false asset taxonomy", () => {
    const copy = insertReusableSpatialAsset(createSpatialDraft("target"), release(), "instance");
    copy.content.studio!.assetInstances![0].entityIds = ["missing"];
    expect(() => draftSchema.parse(copy)).toThrow(/INSTANCE_ENTITY_INVALID/);
    const asset = exported();
    asset.content.studio!.environment = createRoomEnvironment(room);
    expect(() => draftSchema.parse(asset)).toThrow(/NOT_SELF_CONTAINED/);
    expect(() =>
      insertReusableSpatialAsset(
        createSpatialDraft("target"),
        materializeSpatialVersion(createSpatialDraft("scene").content),
        "copy",
      ),
    ).toThrow(/released reusable/);
  });
  it("retains old optional shape and stops at bounded scene capacity", () => {
    const old = createSpatialDraft("old");
    expect(draftSchema.parse(old)).toEqual(old);
    expect(old.content.studio).not.toHaveProperty("assetInstances");
    let full = createSpatialDraft("full");
    for (let i = 0; i < 15; i++) full = insertSpatialPreset(full, "Floating Compass", `preset-${i}`);
    expect(() => insertReusableSpatialAsset(full, release(), "overflow")).toThrow(/anchor budget/);
    const adaptive = enableAdaptiveAuthoring(createSpatialDraft("adaptive"));
    expect(() => insertReusableSpatialAsset(adaptive, release(), "unsafe")).toThrow(/manual placement/);
  });
});

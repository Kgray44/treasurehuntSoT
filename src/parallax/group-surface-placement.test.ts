import { expect, it } from "vitest";
import { createSpatialDraft, previewEntityTransforms, changeHistory, editSpatialDraft, undo } from "./authoring";
import { simulationEnvironments } from "./studio-validation";
import { syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { saveEditingGroup } from "./editing-groups";
import { placeGroupOnSurface, placeSavedAssetOnSurface } from "./group-surface-placement";
import { createReusableSpatialAsset, insertReusableSpatialAsset } from "./reusable-assets";
import { materializeLibraryMoment } from "./library-service";
import { findSurfacePlacement } from "./surface-placement";
import { identityTransform } from "./contracts";
import { insertSpatialElement } from "./element-authoring";
import { createGenericRoomFeature } from "./room-feature-construction";
import type { PreviewEnvironment } from "./environment-authoring";

function fixture() {
  const draft = createSpatialDraft("five", "Ghost Footprint Trail");
  draft.content.entities.forEach((e, i) => {
    e.transform.position = { x: i * 0.15, y: 0.02, z: 0 };
  });
  const members = draft.content.entities.map((e) => ({ kind: "ASSET" as const, id: e.id }));
  const grouped = saveEditingGroup(draft, { id: "trail", name: "Five footprints", members }, true);
  const surface = {
    ...syntheticEnvironmentEvidence(simulationEnvironments[0]).candidates.find((c) => c.surface === "FLOOR")!,
    widthMeters: 20,
    depthMeters: 20,
    exclusions: [],
    safe: true,
  };
  return { grouped, members, surface };
}
it("surface click moves all five footprints rigidly, preserves membership and undoes as one edit", () => {
  const { grouped, members, surface } = fixture();
  const next = placeGroupOnSurface(grouped, members, surface, { x: 1, y: surface.position.y, z: 1.4 }, "bedroom");
  const before = previewEntityTransforms(grouped.content, "bedroom", simulationEnvironments[0]);
  const after = previewEntityTransforms(next.content, "bedroom", simulationEnvironments[0]);
  const delta = {
    x: after[members[0].id].position.x - before[members[0].id].position.x,
    z: after[members[0].id].position.z - before[members[0].id].position.z,
  };
  expect(delta.x).not.toBe(0);
  expect(delta.z).not.toBe(0);
  for (const member of members) {
    expect(after[member.id].position.x - before[member.id].position.x).toBeCloseTo(delta.x);
    expect(after[member.id].position.z - before[member.id].position.z).toBeCloseTo(delta.z);
  }
  expect(next.content.studio!.editingGroups).toEqual(grouped.content.studio!.editingGroups);
  expect(
    undo(changeHistory({ present: grouped, past: [], future: [] }, { type: "REPLACE", draft: next })).present,
  ).toEqual(grouped);
});
it("a blocked footprint rejects the entire group, and locked membership cannot move", () => {
  const { grouped, members, surface } = fixture();
  const before = structuredClone(grouped);
  expect(() =>
    placeGroupOnSurface(
      grouped,
      members,
      { ...surface, widthMeters: 0.1, depthMeters: 0.1 },
      surface.position,
      "bedroom",
    ),
  ).toThrow(/whole group/);
  expect(grouped).toEqual(before);
  grouped.content.studio!.layers.find((l) => l.entityId === members[2].id)!.locked = true;
  expect(() => placeGroupOnSurface(grouped, members, surface, surface.position, "bedroom")).toThrow(/[Uu]nlock/);
});
it("chooses a clear point on the named floor before placing a reusable asset copy", () => {
  const scene = createSpatialDraft("scene", "Desk Map");
  const asset = createReusableSpatialAsset(
    scene,
    scene.content.entities[0].id,
    "private-map",
    { name: "Private map", description: "Synthetic", classification: "Map" },
    simulationEnvironments[0],
  );
  const version = materializeLibraryMoment(asset, "creator", 1).version;
  const copied = insertReusableSpatialAsset(scene, version, "placed-copy");
  const member = { kind: "ASSET" as const, id: copied.content.entities.at(-1)!.id };
  const floor = syntheticEnvironmentEvidence(simulationEnvironments[0]).candidates.find(
    (candidate) => candidate.surface === "FLOOR" && candidate.safe && !candidate.occluded,
  )!;
  const target = findSurfacePlacement(
    { ...identityTransform(), position: floor.position },
    floor,
    copied.content.entities.at(-1)!.widthMeters,
  );
  expect(target).not.toBeNull();
  const placed = placeGroupOnSurface(copied, [member], floor, target!.position, simulationEnvironments[0].id);
  expect(placed.content.studio?.assetInstances?.[0]).toMatchObject({
    definitionId: asset.content.definitionId,
    versionId: version.id,
  });
  expect(placed.content.entities.at(-1)!.transform).not.toEqual(copied.content.entities.at(-1)!.transform);
});

it("preserves parented schematic children and their animation frames during placement", () => {
  let source = createSpatialDraft("animated", "Animated assembly");
  const clone = structuredClone(source.content.entities[0]);
  clone.id = "animated-child";
  clone.transform.position.x += 0.1;
  source.content.entities.push(clone);
  source.content.studio!.layers.push({ ...source.content.studio!.layers[0], entityId: clone.id });
  const [parent, child] = source.content.entities;
  source = editSpatialDraft(source, { type: "PARENT", entityId: child.id, parentId: parent.id });
  source.content.studio!.animationTracks = [
    {
      id: "child-motion",
      entityId: child.id,
      enabled: true,
      property: "POSITION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "start", atMs: 0, value: { ...child.transform.position } },
        { id: "end", atMs: 1000, value: { x: 0.1, y: 0, z: 0 } },
      ],
    },
  ];
  const floor = {
    ...syntheticEnvironmentEvidence(simulationEnvironments[0]).candidates.find((candidate) => candidate.surface === "FLOOR")!,
    widthMeters: 20,
    depthMeters: 20,
    exclusions: [],
  };
  const placed = placeGroupOnSurface(
    source,
    [parent, child].map((entity) => ({ kind: "ASSET" as const, id: entity.id })),
    floor,
    { x: 1, y: floor.position.y, z: 1 },
    simulationEnvironments[0],
  );
  expect(placed.content.entities.find((entity) => entity.id === child.id)?.parentEntityId).toBe(parent.id);
  expect(placed.content.studio?.animationTracks?.[0].entityId).toBe(child.id);
  expect(placed.content.studio?.animationTracks?.[0].keyframes).toEqual(source.content.studio?.animationTracks?.[0].keyframes);
});

function blankScene(id: string) {
  const scene = createSpatialDraft(id);
  scene.content.entities = [];
  scene.content.anchors = [];
  scene.content.studio!.layers = [];
  return scene;
}

function savedPhysicalCopy(modelId: "sofa" | "candelabra", room: PreviewEnvironment) {
  const source = insertSpatialElement(blankScene(`${modelId}-source`), modelId, `${modelId}-model`);
  const asset = createReusableSpatialAsset(
    source,
    source.content.entities[0].id,
    `${modelId}-asset`,
    { name: modelId, description: "Synthetic physical fixture", classification: "Fixture" },
    room,
  );
  const version = materializeLibraryMoment(asset, "creator", 1).version;
  const base = blankScene(`${modelId}-scene`);
  const copied = insertReusableSpatialAsset(base, version, `${modelId}-copy`);
  return { base, copied, member: { kind: "ASSET" as const, id: copied.content.entities[0].id } };
}

it("keeps a saved sofa Y-up and refuses an obstructed exact click", () => {
  const room: PreviewEnvironment = {
    ...simulationEnvironments[0],
    id: "saved-physical-room",
    width: 6,
    depth: 6,
    features: [
      createGenericRoomFeature({
        id: "floor",
        classification: "FLOOR",
        dimensions: [6, 0.16, 6],
        position: { x: 0, y: -0.08, z: 0 },
      }),
      createGenericRoomFeature({
        id: "blocker",
        classification: "OTHER",
        dimensions: [1, 1.4, 1],
        position: { x: 0, y: 0.7, z: 0 },
        yawDegrees: 37,
      }),
    ],
  };
  const { base, copied, member } = savedPhysicalCopy("sofa", room);
  const floor = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.surface === "FLOOR")!;
  expect(() => placeSavedAssetOnSurface(base, copied, [member], floor, floor.position, room, true)).toThrow();
  const placed = placeSavedAssetOnSurface(base, copied, [member], floor, { x: 1.8, y: 0, z: 1.8 }, room, true);
  const pose = previewEntityTransforms(placed.content, room.id, room)[member.id];
  expect(pose.position.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(pose.rotation.x)).toBeLessThan(1e-4);
  expect(placed.content.studio?.assetInstances?.[0]?.versionId).toBe(copied.content.studio?.assetInstances?.[0]?.versionId);
});

it("checks full saved model height above a table before installation", () => {
  const room: PreviewEnvironment = {
    ...simulationEnvironments[0],
    id: "saved-tall-room",
    features: [
      createGenericRoomFeature({
        id: "floor",
        classification: "FLOOR",
        dimensions: [4, 0.16, 4],
        position: { x: 0, y: -0.08, z: 0 },
      }),
      createGenericRoomFeature({
        id: "support",
        classification: "TABLE",
        dimensions: [1.4, 1, 0.9],
        position: { x: 0, y: 0.5, z: 0 },
      }),
      createGenericRoomFeature({
        id: "overhead",
        classification: "OTHER",
        dimensions: [2, 0.1, 1.3],
        position: { x: 0, y: 1.4, z: 0 },
      }),
    ],
  };
  const { base, copied, member } = savedPhysicalCopy("candelabra", room);
  const table = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.surface === "TABLE")!;
  expect(() => placeSavedAssetOnSurface(base, copied, [member], table, table.position, room, false)).toThrow(
    /No clear table support|No item was inserted/,
  );
  expect(base.content.entities).toHaveLength(0);
});

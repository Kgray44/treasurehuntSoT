import { expect, it } from "vitest";
import { createSpatialDraft, draftSchema, previewEntityTransforms, changeHistory, editSpatialDraft, undo, redo } from "./authoring";
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
import { evaluateSpatialScene } from "./behavior";
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
      id: "root-position",
      entityId: parent.id,
      enabled: true,
      property: "POSITION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "root-start", atMs: 0, value: { ...parent.transform.position } },
        { id: "root-end", atMs: 1000, value: { x: parent.transform.position.x + 0.2, y: parent.transform.position.y, z: parent.transform.position.z } },
      ],
    },
    {
      id: "root-rotation",
      entityId: parent.id,
      enabled: true,
      property: "ROTATION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "rotation-start", atMs: 0, value: { ...parent.transform.rotation } },
        { id: "rotation-end", atMs: 1000, value: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } },
      ],
    },
    {
      id: "root-scale",
      entityId: parent.id,
      enabled: true,
      property: "SCALE",
      interpolation: "LINEAR",
      keyframes: [
        { id: "scale-start", atMs: 0, value: parent.transform.scale },
        { id: "scale-end", atMs: 1000, value: parent.transform.scale * 1.2 },
      ],
    },
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
  const sourceBefore = structuredClone(source);
  const placed = placeGroupOnSurface(
    source,
    [parent, child].map((entity) => ({ kind: "ASSET" as const, id: entity.id })),
    floor,
    { x: 1, y: floor.position.y, z: 1 },
    simulationEnvironments[0],
  );
  expect(placed.content.entities.find((entity) => entity.id === child.id)?.parentEntityId).toBe(parent.id);
  const placedParent = placed.content.entities.find((entity) => entity.id === parent.id)!;
  const tracks = placed.content.studio!.animationTracks!;
  const startPosition = tracks.find((track) => track.id === "root-position")?.keyframes[0].value as typeof placedParent.transform.position;
  const startRotation = tracks.find((track) => track.id === "root-rotation")?.keyframes[0].value as typeof placedParent.transform.rotation;
  for (const axis of ["x", "y", "z"] as const)
    expect(startPosition?.[axis]).toBeCloseTo(placedParent.transform.position[axis]);
  for (const axis of ["x", "y", "z", "w"] as const)
    expect(startRotation?.[axis]).toBeCloseTo(placedParent.transform.rotation[axis]);
  expect(tracks.find((track) => track.id === "root-scale")?.keyframes[0].value).toBeCloseTo(placedParent.transform.scale);
  expect(tracks.find((track) => track.id === "child-motion")?.keyframes).toEqual(
    source.content.studio?.animationTracks?.find((track) => track.id === "child-motion")?.keyframes,
  );
  const evaluated = evaluateSpatialScene(placed.content, [], 0).states[parent.id].transform;
  for (const axis of ["x", "y", "z"] as const)
    expect(evaluated.position[axis]).toBeCloseTo(placedParent.transform.position[axis]);
  for (const axis of ["x", "y", "z", "w"] as const)
    expect(evaluated.rotation[axis]).toBeCloseTo(placedParent.transform.rotation[axis]);
  expect(evaluated.scale).toBeCloseTo(placedParent.transform.scale);
  expect(source).toEqual(sourceBefore);
  expect(draftSchema.parse(JSON.parse(JSON.stringify(placed)))).toEqual(placed);
  const history = changeHistory({ present: source, past: [], future: [] }, { type: "REPLACE", draft: placed });
  expect(undo(history).present).toEqual(source);
  expect(redo(undo(history)).present).toEqual(placed);
});

function blankScene(id: string) {
  const scene = createSpatialDraft(id);
  scene.content.entities = [];
  scene.content.anchors = [];
  scene.content.studio!.layers = [];
  return scene;
}

function savedPhysicalCopy(modelId: "sofa" | "candelabra", room: PreviewEnvironment, scale = 1) {
  const source = insertSpatialElement(blankScene(`${modelId}-source`), modelId, `${modelId}-model`);
  source.content.entities[0].transform.scale = scale;
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

it("fits the rendered scale of a saved physical root and rebases its animation path", () => {
  const room: PreviewEnvironment = {
    ...simulationEnvironments[0],
    id: "saved-scaled-room",
    width: 10,
    depth: 10,
    features: [
      createGenericRoomFeature({
        id: "floor",
        classification: "FLOOR",
        dimensions: [10, 0.16, 10],
        position: { x: 0, y: -0.08, z: 0 },
      }),
    ],
  };
  const { base, copied, member } = savedPhysicalCopy("sofa", room, 2);
  const root = copied.content.entities[0];
  copied.content.studio!.animationTracks = [
    {
      id: "root-motion",
      entityId: root.id,
      enabled: true,
      property: "POSITION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "start", atMs: 0, value: { ...root.transform.position } },
        { id: "end", atMs: 1000, value: { x: root.transform.position.x + 0.3, y: root.transform.position.y, z: root.transform.position.z } },
      ],
    },
    {
      id: "root-turn",
      entityId: root.id,
      enabled: true,
      property: "ROTATION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "start-turn", atMs: 0, value: { ...root.transform.rotation } },
        { id: "end-turn", atMs: 1000, value: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } },
      ],
    },
    {
      id: "root-grow",
      entityId: root.id,
      enabled: true,
      property: "SCALE",
      interpolation: "LINEAR",
      keyframes: [
        { id: "start-scale", atMs: 0, value: root.transform.scale },
        { id: "end-scale", atMs: 1000, value: root.transform.scale * 1.2 },
      ],
    },
  ];
  const floor = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.surface === "FLOOR")!;
  const copiedBefore = structuredClone(copied);
  const placed = placeSavedAssetOnSurface(base, copied, [member], floor, { x: 3, y: 0, z: 3 }, room, true);
  const pose = previewEntityTransforms(placed.content, room.id, room)[member.id];
  expect(pose.scale).toBeCloseTo(2);
  expect(placed.content.entities[0].transform.scale).toBeCloseTo(2);
  expect(placed.content.studio?.animationTracks?.[0].keyframes[0].value).toEqual(
    placed.content.entities[0].transform.position,
  );
  expect(placed.content.studio?.animationTracks?.[0].keyframes[1].value).not.toEqual(
    copied.content.studio?.animationTracks?.[0].keyframes[1].value,
  );
  const evaluated = evaluateSpatialScene(placed.content, [], 0).states[member.id].transform;
  for (const axis of ["x", "y", "z"] as const)
    expect(evaluated.position[axis]).toBeCloseTo(placed.content.entities[0].transform.position[axis]);
  expect(evaluated.scale).toBeCloseTo(placed.content.entities[0].transform.scale);
  for (const axis of ["x", "y", "z", "w"] as const)
    expect(evaluated.rotation[axis]).toBeCloseTo(placed.content.entities[0].transform.rotation[axis]);
  const end = evaluateSpatialScene(placed.content, [], 1000).states[member.id].transform;
  expect(Math.hypot(
    end.position.x - evaluated.position.x,
    end.position.y - evaluated.position.y,
    end.position.z - evaluated.position.z,
  )).toBeCloseTo(0.3);
  expect(end.scale).toBeCloseTo(2.4);
  expect(copied).toEqual(copiedBefore);
  expect(draftSchema.parse(JSON.parse(JSON.stringify(placed)))).toEqual(placed);
  const history = changeHistory({ present: base, past: [], future: [] }, { type: "REPLACE", draft: placed });
  expect(undo(history).present).toEqual(base);
  expect(redo(undo(history)).present).toEqual(placed);
  const cramped = { ...room, id: "saved-scaled-cramped-room", width: 6, depth: 6,
    features: [createGenericRoomFeature({ id: "floor", classification: "FLOOR", dimensions: [6, 0.16, 6], position: { x: 0, y: -0.08, z: 0 } })] };
  const crampedFloor = syntheticEnvironmentEvidence(cramped).candidates.find((candidate) => candidate.surface === "FLOOR")!;
  expect(() => placeSavedAssetOnSurface(base, copied, [member], crampedFloor, { x: 1.8, y: 0, z: 1.8 }, cramped, true)).toThrow();
});

it.each(["scaled physical child", "mixed physical and schematic parts"] as const)(
  "rejects %s without changing the saved copy or scene",
  (kind) => {
    const room = simulationEnvironments[0];
    let source = kind === "scaled physical child"
      ? createSpatialDraft("assembly-source")
      : insertSpatialElement(blankScene("assembly-source"), "sofa", "physical-root");
    if (kind === "scaled physical child") {
      const physical = insertSpatialElement(blankScene("physical-source"), "sofa", "physical-child");
      source.content.entities.push({ ...physical.content.entities[0], anchorId: source.content.entities[0].anchorId });
      source.content.studio!.layers.push(physical.content.studio!.layers[0]);
    }
    if (kind === "mixed physical and schematic parts") {
      source = editSpatialDraft(source, {
        type: "DUPLICATE", entityId: source.content.entities[0].id, newId: "schematic-child",
      });
      source.content.entities[1].element = undefined;
    }
    const [root, child] = source.content.entities;
    source = editSpatialDraft(source, { type: "PARENT", entityId: child.id, parentId: root.id });
    if (kind === "scaled physical child") source.content.entities[1].transform.scale = 2;
    const saved = createReusableSpatialAsset(source, root.id, "physical-assembly", {
      name: "Physical assembly", description: "Synthetic", classification: "Fixture",
    }, room);
    const version = materializeLibraryMoment(saved, "creator", 1).version;
    const base = blankScene("assembly-scene");
    const copied = insertReusableSpatialAsset(base, version, "assembly-copy");
    const members = copied.content.entities.map((entity) => ({ kind: "ASSET" as const, id: entity.id }));
    const floor = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.surface === "FLOOR")!;
    const beforeBase = structuredClone(base);
    const beforeCopy = structuredClone(copied);
    expect(() => placeSavedAssetOnSurface(base, copied, members, floor, floor.position, room, true))
      .toThrow(/reviewed placement.*No items were inserted/);
    expect(base).toEqual(beforeBase);
    expect(copied).toEqual(beforeCopy);
  },
);

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

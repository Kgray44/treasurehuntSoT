import { expect, it } from "vitest";
import { createSpatialDraft, previewEntityTransforms, changeHistory, undo } from "./authoring";
import { simulationEnvironments } from "./studio-validation";
import { syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { saveEditingGroup } from "./editing-groups";
import { placeGroupOnSurface } from "./group-surface-placement";
import { createReusableSpatialAsset, insertReusableSpatialAsset } from "./reusable-assets";
import { materializeLibraryMoment } from "./library-service";
import { findSurfacePlacement } from "./surface-placement";
import { identityTransform } from "./contracts";

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

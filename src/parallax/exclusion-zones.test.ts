import { expect, it } from "vitest";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { createGenericRoomFeature, removeRoomFeature } from "./parametric-room";
import { enableRoomExclusions, reconcileRoomExclusions, patchRoomExclusion } from "./exclusion-zones";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "./room-geometry";
import { identityTransform } from "./contracts";
import { findSurfacePlacement, placeOnSurface } from "./surface-placement";
import { verifyConstructedEnvironment } from "./construction-verification";
import { transformRoomFeature } from "./room-feature-transform";
import { candidateSchema } from "./adaptive";
import { roomEnvironmentSchema } from "./environment-contracts";
import { roomPerceptionContext } from "@/watchglass/room-perception";

function fixture() {
  const base = createRoomEnvironment(simulationEnvironments.find((room) => room.id === "empty")!);
  return {
    ...base,
    features: [
      ...base.features,
      createGenericRoomFeature({ id: "table", name: "Work table", classification: "TABLE", dimensions: [2, 0.8, 1.2] }),
      createGenericRoomFeature({
        id: "instrument",
        classification: "APPLIANCE",
        applianceShape: "GENERIC_BOX",
        dimensions: [0.4, 0.3, 0.4],
        position: { x: 0, y: 0.95, z: 0 },
      }),
    ],
  };
}
it.each(simulationEnvironments)("enables exclusions within existing geometry budgets for $name", (environment) => {
  const room = createRoomEnvironment(environment);
  const enabled = enableRoomExclusions(room);
  expect(roomEnvironmentSchema.safeParse(enabled).success).toBe(true);
  expect(enabled.features.filter((feature) => feature.classification !== "EXCLUSION_ZONE")).toEqual(room.features);
  expect(surfaces(enabled).every((surface) => candidateSchema.safeParse(surface).success)).toBe(true);
});
const surfaces = (room: ReturnType<typeof fixture>) =>
  discoverRoomSurfaces(syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }), {
    tracking: true,
    clutter: 0,
  });

it("does not change historic rooms until enabled, and derives scoped envelopes without inventing physical geometry", () => {
  const room = fixture();
  expect(reconcileRoomExclusions(room)).toBe(room);
  const enabled = enableRoomExclusions(room);
  const zone = enabled.features.find(
    (feature) => feature.exclusion?.sourceFeatureId === "instrument" && feature.exclusion.surfaceId === "table:top",
  )!;
  expect(zone.dimensions).toEqual([0.4, 0.3, 0.4]);
  expect(zone.position).toEqual({ x: 0, y: 0.95, z: 0 });
  expect(zone.parts.every((part) => part.surface === null)).toBe(true);
  const check = (input: typeof room) =>
    verifyConstructedEnvironment(input, syntheticRoomGeometry({ ...input, horizontal: true, vertical: true })).findings;
  expect(check(enabled)).toEqual(check(room));
  expect(surfaces(enabled).every((surface) => candidateSchema.safeParse(surface).success)).toBe(true);
  expect(reconcileRoomExclusions(enabled)).toEqual(enabled);
  expect(
    roomPerceptionContext({ images: [], existing: enabled }).existingRoom!.features.some(
      (feature) => String(feature.classification) === "EXCLUSION_ZONE",
    ),
  ).toBe(false);
});

it("reserves a clear tabletop and finds a nearby fit rather than passing through a zone", () => {
  const room = fixture();
  const manual = createGenericRoomFeature({
    id: "reserved",
    classification: "EXCLUSION_ZONE",
    name: "Reserved tabletop",
    position: { x: -0.6, y: 0.9, z: 0 },
    dimensions: [0.5, 0.2, 0.5],
    exclusion: { surfaceId: "table:top" },
  });
  const withZone = { ...room, features: [...room.features, manual] };
  const surface = surfaces(withZone).find((surface) => surface.id === "table:top")!;
  const desired = { ...identityTransform(), position: { x: -0.6, y: 0.8, z: 0 } };
  expect(placeOnSurface(desired, surface, 0.2)).toBeNull();
  const fitted = findSurfacePlacement(desired, surface, 0.2)!;
  expect(fitted).not.toBeNull();
  expect(placeOnSurface(fitted, surface, 0.2)).not.toBeNull();
  const released = removeRoomFeature(withZone, manual.id);
  expect(
    placeOnSurface(desired, surfaces(released).find((surface) => surface.id === "table:top")!, 0.2),
  ).not.toBeNull();
});

it("follows source transforms and keeps deleted or edited automatic zones from reappearing", () => {
  const enabled = enableRoomExclusions(fixture());
  const zone = enabled.features.find(
    (feature) => feature.exclusion?.sourceFeatureId === "instrument" && feature.exclusion.surfaceId === "table:top",
  )!;
  const moved = transformRoomFeature(enabled, "instrument", {
    position: { x: 0.25, y: 0.95, z: 0 },
    yawDegrees: 35,
    scale: 1.1,
  });
  expect(moved.features.find((feature) => feature.id === zone.id)!.position.x).toBeCloseTo(0.25);
  expect(moved.features.find((feature) => feature.id === zone.id)!.yawDegrees).toBe(35);
  const edited = patchRoomExclusion(enabled, zone.id, { dimensions: [0.6, 0.4, 0.6] });
  expect(edited.features.find((feature) => feature.id === zone.id)!.exclusion).not.toHaveProperty("sourceFeatureId");
  expect(reconcileRoomExclusions(edited).features.find((feature) => feature.id === zone.id)!.dimensions).toEqual([
    0.6, 0.4, 0.6,
  ]);
  const deleted = removeRoomFeature(enabled, zone.id);
  expect(reconcileRoomExclusions(deleted).features.some((feature) => feature.id === zone.id)).toBe(false);
  const removedSource = removeRoomFeature(enabled, "instrument");
  expect(removedSource.features.some((feature) => feature.exclusion?.sourceFeatureId === "instrument")).toBe(false);
});

it("rejects invalid references and permits a manual zone to survive a deleted support", () => {
  const room = fixture();
  const zone = createGenericRoomFeature({
    id: "reservation",
    classification: "EXCLUSION_ZONE",
    exclusion: { surfaceId: "table:top" },
  });
  expect(
    roomEnvironmentSchema.safeParse({
      ...room,
      features: [...room.features, { ...zone, exclusion: { surfaceId: "missing" } }],
    }).success,
  ).toBe(false);
  const after = removeRoomFeature({ ...room, features: [...room.features, zone] }, "table");
  expect(after.features.find((feature) => feature.id === zone.id)!.exclusion).toEqual({});
});

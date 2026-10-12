import { expect, it } from "vitest";
import { simulationEnvironments } from "./studio-validation";
import { createPresetConstruction } from "./preset-construction";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "./room-geometry";
import { verifyConstructedEnvironment } from "./construction-verification";
import { roomEnvironmentSchema } from "./environment-contracts";

it.each(simulationEnvironments)("constructs and independently checks the deterministic $name reference", (preset) => {
  const room = createPresetConstruction(preset),
    saved = roomEnvironmentSchema.parse(JSON.parse(JSON.stringify(room)));
  expect(saved).toEqual(createPresetConstruction(preset));
  const geometry = syntheticRoomGeometry({ ...saved, horizontal: true, vertical: true });
  expect(verifyConstructedEnvironment(saved, geometry)).toMatchObject({
    status: "CHECKS_PASSED",
    findings: [],
    physicalCalibration: false,
  });
  expect(new Set(geometry.map((p) => p.id)).size).toBe(geometry.length);
  expect(geometry.length).toBeLessThan(220);
  expect(discoverRoomSurfaces(geometry, preset).filter((c) => c.surface === "FLOOR")).toHaveLength(1);
  if (room.construction?.kind === "INDOOR") {
    expect(room.features.filter((f) => f.classification === "WALL")).toHaveLength(4);
    expect(room.features.filter((f) => f.classification === "CEILING")).toHaveLength(1);
  }
});
it("retains only architectural surfaces in Empty Room and real supported towers in Cluttered Room", () => {
  const empty = createPresetConstruction(simulationEnvironments[8]);
  expect(empty.features.every((f) => ["FLOOR", "WALL", "CEILING"].includes(f.classification))).toBe(true);
  const room = createPresetConstruction(simulationEnvironments[9]);
  expect(room.construction!.relationships.filter((r) => r.type === "SUPPORTED_BY")).toHaveLength(6);
  const top = room.features.find((f) => f.id === "stacked-box-2")!;
  top.position.y += 0.12;
  expect(
    verifyConstructedEnvironment(room, syntheticRoomGeometry({ ...room, horizontal: true, vertical: true })).findings,
  ).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_FEATURE", featureIds: [top.id] }));
});
it("detects a broken or obstructed trail rather than trusting the declared navigation polyline", () => {
  const room = createPresetConstruction(simulationEnvironments[6]),
    geometry = syntheticRoomGeometry({ ...room, horizontal: true, vertical: false });
  geometry.find((part) => part.shape === "PATH")!.size[2] = 2;
  expect(verifyConstructedEnvironment(room, geometry).findings).toContainEqual(
    expect.objectContaining({ code: "NAVIGATION_CONTINUITY" }),
  );
  const built = syntheticRoomGeometry({ ...room, horizontal: true, vertical: false });
  built.find((part) => part.id === "trail-sign")!.position[0] = 0;
  expect(verifyConstructedEnvironment(room, built).findings).toContainEqual(
    expect.objectContaining({ code: "NAVIGATION_CONTINUITY" }),
  );
});
it("requires matching constructed apertures and physical mount contact", () => {
  const room = createPresetConstruction(simulationEnvironments[0]),
    geometry = syntheticRoomGeometry({ ...room, horizontal: true, vertical: true });
  geometry.find((p) => p.id === "wall-window")!.openings = [];
  expect(verifyConstructedEnvironment(room, geometry).findings).toContainEqual(
    expect.objectContaining({ code: "OPENING_ATTACHMENT", featureIds: ["window"] }),
  );
  const gallery = createPresetConstruction(simulationEnvironments[5]);
  gallery.features.find((f) => f.id === "artwork-0")!.position.z += 0.2;
  expect(
    verifyConstructedEnvironment(gallery, syntheticRoomGeometry({ ...gallery, horizontal: true, vertical: true }))
      .findings,
  ).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_FEATURE", featureIds: ["artwork-0"] }));
});

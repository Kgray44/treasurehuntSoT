import { describe, it, expect } from "vitest";
import { createGenericRoomFeature } from "./parametric-room";
import { roomEnvironmentSchema } from "./environment-contracts";
import { syntheticRoomGeometry } from "./room-geometry";
import { verifyConstructedEnvironment } from "./construction-verification";

function room() {
  const feature = createGenericRoomFeature;
  return roomEnvironmentSchema.parse({
    schemaVersion: 1,
    id: "verification-room",
    name: "Construction fixture",
    width: 4,
    depth: 4,
    height: 2.8,
    origin: "MANUAL",
    features: [
      feature({ id: "floor", classification: "FLOOR", dimensions: [4, 0.12, 4], position: { x: 0, y: -0.06, z: 0 } }),
      feature({
        id: "ceiling",
        classification: "CEILING",
        dimensions: [4, 0.08, 4],
        position: { x: 0, y: 2.84, z: 0 },
      }),
      ...[
        { id: "back", x: 0, z: -2, yawDegrees: 0 },
        { id: "front", x: 0, z: 2, yawDegrees: 180 },
        { id: "left", x: -2, z: 0, yawDegrees: 90 },
        { id: "right", x: 2, z: 0, yawDegrees: -90 },
      ].map(({ id, x, z, yawDegrees }) =>
        feature({ id, classification: "WALL", dimensions: [4, 2.8, 0.12], position: { x, y: 1.4, z }, yawDegrees }),
      ),
      feature({ id: "desk", classification: "DESK", position: { x: 0, y: 0.375, z: 0 } }),
      feature({ id: "window", classification: "WINDOW", position: { x: 0, y: 1.7, z: -2 } }),
    ],
  });
}
describe("independent realized-construction verification", () => {
  it("validates a complete supported shell without treating confidence as calibration", () => {
    const spec = room();
    const result = verifyConstructedEnvironment(
      spec,
      syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true }),
    );
    expect(result.findings).toEqual([]);
    expect(result.status).toBe("CHECKS_PASSED");
    expect(result.physicalCalibration).toBe(false);
  });
  it("detects a missing realized part even when its specification and generator completed", () => {
    const spec = room(),
      built = syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true });
    const result = verifyConstructedEnvironment(
      spec,
      built.filter((part) => part.featureId !== "front"),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "MISSING_CONSTRUCTION_PART", featureIds: ["front"] }),
    );
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "INCOMPLETE_ROOM_SHELL" }));
    expect(result.findings.find((finding) => finding.code === "MISSING_CONSTRUCTION_PART")!.partIds).toEqual(
      spec.features.find((feature) => feature.id === "front")!.parts.map((part) => part.id),
    );
  });
  it("detects changed realized floor and invalid opening bounds independently of the input spec", () => {
    const spec = room(),
      built = syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true });
    built.find((part) => part.featureId === "floor")!.position[1] += 0.2;
    built.find((part) => part.featureId === "back")!.openings = [{ x: 2, y: 0, width: 2, depth: 1 }];
    const result = verifyConstructedEnvironment(spec, built);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["FLOOR_EXTENT", "OPENING_OUTSIDE_WALL", "UNSUPPORTED_FEATURE"]),
    );
  });
  it("rejects a ceiling that meets height but leaves the room uncovered", () => {
    const spec = room();
    const built = syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true });
    built.find((part) => part.featureId === "ceiling")!.size[0] = 1;
    expect(verifyConstructedEnvironment(spec, built).findings).toContainEqual(
      expect.objectContaining({ code: "CEILING_EXTENT", featureIds: ["ceiling"] }),
    );
  });
  it("reports actual furniture solids, not merely overlapping feature bounding boxes", () => {
    const spec = room();
    const stool = createGenericRoomFeature({
      id: "stool",
      classification: "OTHER",
      dimensions: [0.1, 0.1, 0.1],
      position: { x: 0, y: 0.05, z: 0 },
    });
    spec.features.push(stool);
    const free = verifyConstructedEnvironment(
      spec,
      syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true }),
    );
    expect(free.findings.filter((finding) => finding.code === "FEATURE_INTERPENETRATION")).toEqual([]);
    stool.position.y = 0.73;
    const collided = verifyConstructedEnvironment(
      spec,
      syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true }),
    );
    expect(collided.findings).toContainEqual(
      expect.objectContaining({ code: "FEATURE_INTERPENETRATION", featureIds: ["desk", "stool"] }),
    );
  });
  it("finds detached and floating features even when their provenance is fully confident", () => {
    const spec = room();
    const desk = spec.features.find((feature) => feature.id === "desk")!;
    desk.position.y += 0.3;
    desk.provenance.confidence = 1;
    const window = spec.features.find((feature) => feature.id === "window")!;
    window.position.z += 0.1;
    const result = verifyConstructedEnvironment(
      spec,
      syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "UNSUPPORTED_FEATURE", featureIds: ["desk"] }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "OPENING_ATTACHMENT", featureIds: ["window"] }),
    );
  });
  it("finds containment and invalid semantic support orientation at exact feature identities", () => {
    const spec = room(),
      desk = spec.features.find((feature) => feature.id === "desk")!;
    desk.position.x = 2;
    desk.parts.find((part) => part.surface === "DESK")!.face = "FRONT";
    const result = verifyConstructedEnvironment(
      spec,
      syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "FURNISHING_CONTAINMENT", featureIds: ["desk"] }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "ATTACHMENT_SURFACE_ORIENTATION", featureIds: ["desk"] }),
    );
  });
});

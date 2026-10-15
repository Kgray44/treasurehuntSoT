import { expect, it } from "vitest";
import { createRoomEnvironment } from "./environment-authoring";
import { createGenericRoomFeature } from "./parametric-room";
import { simulationEnvironments } from "./studio-validation";
import { transformRoomFeature } from "./room-feature-transform";

it("moves, rotates and scales the whole feature and its declared attachments without mutating the input", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const desk = room.features.find((feature) => feature.id === "reference-desk")!;
  const child = createGenericRoomFeature({
    id: "test-lamp",
    name: "Lamp",
    classification: "APPLIANCE",
    dimensions: [0.2, 0.4, 0.2],
    position: { x: desk.position.x + 0.2, y: desk.position.y + 0.7, z: desk.position.z },
    provenance: { basis: "INFERRED", confidence: 0.6, sourceMediaIds: [] },
  });
  room.features.push(child);
  room.construction!.relationships.push({ featureId: child.id, targetFeatureId: desk.id, type: "SUPPORTED_BY" });
  room.scaleReference = { featureId: desk.id, axis: "WIDTH", measuredMeters: desk.dimensions[0] };
  const snapshot = structuredClone(room);
  const next = transformRoomFeature(room, desk.id, {
    position: { x: 0, y: 1, z: 0 },
    yawDegrees: desk.yawDegrees + 90,
    scale: 2,
  });
  const moved = next.features.find((feature) => feature.id === desk.id)!;
  const lamp = next.features.find((feature) => feature.id === child.id)!;
  expect(moved.dimensions).toEqual(desk.dimensions.map((value) => value * 2));
  expect(moved.position).toEqual({ x: 0, y: 1, z: 0 });
  expect(lamp.position.x).toBeCloseTo(0);
  expect(lamp.position.y).toBeCloseTo(2.4);
  expect(lamp.position.z).toBeCloseTo(-0.4);
  expect(lamp.provenance.basis).toBe("CREATOR_CONFIRMED");
  expect(next.scaleReference).toBeUndefined();
  expect(room).toEqual(snapshot);
  expect(
    transformRoomFeature(room, desk.id, { position: desk.position, yawDegrees: desk.yawDegrees + 15, scale: 1 })
      .scaleReference,
  ).toEqual(room.scaleReference);
});

it("allows every architectural feature and rejects invalid transforms without dropping geometry", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  for (const feature of room.features) {
    const next = transformRoomFeature(room, feature.id, {
      position: { ...feature.position, x: feature.position.x + 0.1 },
      yawDegrees: feature.yawDegrees,
      scale: 1,
    });
    expect(next.features).toHaveLength(room.features.length);
    expect(next.features.find((entry) => entry.id === feature.id)!.position.x).toBeCloseTo(feature.position.x + 0.1);
  }
  const feature = room.features[0];
  expect(() =>
    transformRoomFeature(room, feature.id, { position: feature.position, yawDegrees: 0, scale: 0 }),
  ).toThrow();
  expect(() =>
    transformRoomFeature(room, feature.id, { position: { x: 101, y: 0, z: 0 }, yawDegrees: 0, scale: 1 }),
  ).toThrow();
});

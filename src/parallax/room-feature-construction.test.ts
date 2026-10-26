import { expect, it } from "vitest";
import { createGenericRoomFeature } from "./room-feature-construction";
it("represents a ceiling projector and bench instruments without cabinet doors or handles", () => {
  const projector = createGenericRoomFeature({
    id: "projector",
    classification: "APPLIANCE",
    applianceShape: "PROJECTOR",
    dimensions: [0.45, 0.7, 0.45],
  });
  expect(projector.parts.map((part) => part.id)).toEqual([
    "projector:mounting-pole",
    "projector:projector",
    "projector:lens",
  ]);
  expect(projector.parts.some((part) => part.id.includes("door") || part.id.includes("handle"))).toBe(false);
  const equipment = createGenericRoomFeature({
    id: "instruments",
    classification: "APPLIANCE",
    applianceShape: "EQUIPMENT",
  });
  expect(equipment.parts.filter((part) => part.id.includes("instrument-")).length).toBe(3);
  expect(equipment.parts.some((part) => part.id.includes("door"))).toBe(false);
});
it("keeps an open door's semantic frame and opening without inserting a closed leaf", () => {
  const open = createGenericRoomFeature({ id: "door", classification: "DOOR", openingState: "OPEN" });
  expect(open.parts.some((part) => part.id.endsWith(":panel"))).toBe(false);
  expect(open.parts.some((part) => part.id.includes("jamb"))).toBe(true);
  expect(open.parts.some((part) => part.id.includes("lintel"))).toBe(true);
  expect(
    createGenericRoomFeature({ id: "door", classification: "DOOR" }).parts.some((part) => part.id.endsWith(":panel")),
  ).toBe(true);
});

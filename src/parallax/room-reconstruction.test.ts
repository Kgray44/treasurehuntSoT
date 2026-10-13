import { expect, it } from "vitest";
import { roomObservationSchema, type RoomObservation } from "@/watchglass/room-observation";
import { reconstructRoomFromObservation } from "./room-reconstruction";
import { scaleRoomFromMeasurement } from "./parametric-room";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { createSpatialDraft, previewEntityTransform } from "./authoring";
import { placeOnRoomFeature } from "./room-placement";

const observation = (): RoomObservation => ({
  status: "OBSERVED",
  explanation: "Approximate synthetic room with a desk beside a window.",
  clarification: null,
  alignment: "INITIAL_ROOM",
  sharedFeatureId: null,
  roomDimensions: [6, 3, 5],
  dimensionBasis: "ESTIMATED",
  uncertainties: ["Hidden geometry is inferred."],
  features: [
    {
      matchedFeatureId: null,
      classification: "DESK",
      name: "Writing desk",
      position: { x: 1, y: 0.4, z: -1 },
      dimensions: [1.4, 0.8, 0.8],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    },
    {
      matchedFeatureId: null,
      classification: "WINDOW",
      name: "Desk window",
      position: { x: 1, y: 1.8, z: -2.5 },
      dimensions: [1.2, 1.1, 0.08],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    },
  ],
});
const propose = (obs = observation()) => {
  const result = reconstructRoomFromObservation({
    observation: obs,
    roomId: "photo-room",
    sourceMediaIds: ["media-one"],
  });
  if (result.status !== "PROPOSED") throw new Error("Expected editable room proposal");
  return result;
};
const refinement = () => {
  const room = propose().room;
  const desk = room.features.find((f) => f.classification === "DESK")!;
  const obs = observation();
  obs.alignment = "EXISTING_ROOM_FRAME";
  obs.sharedFeatureId = desk.id;
  obs.features = [
    { ...obs.features[0], matchedFeatureId: desk.id, position: { x: 0.5, y: 0.5, z: -1 }, dimensions: [1.5, 1, 0.8] },
  ];
  return {
    room,
    desk,
    input: {
      observation: obs,
      roomId: room.id,
      sourceMediaIds: ["media-two"],
      existing: room,
      sharedFeatureId: desk.id,
    },
  };
};

it("maps perception into one editable whole floor, complete inferred walls and real generic support geometry", () => {
  const { room, warnings } = propose();
  expect(room.origin).toBe("PHOTO_RECONSTRUCTION");
  expect(room.features.filter((f) => f.classification === "FLOOR")).toHaveLength(1);
  expect(room.features.filter((f) => f.classification === "WALL")).toHaveLength(4);
  expect(room.features.filter((f) => f.classification === "CEILING")).toHaveLength(1);
  expect(room.features.every((f) => f.provenance.sourceMediaIds[0] === "media-one")).toBe(true);
  expect(
    room.features
      .filter((f) => ["FLOOR", "WALL", "CEILING"].includes(f.classification))
      .every((f) => f.provenance.basis === "INFERRED"),
  ).toBe(true);
  const surfaces = discoverRoomSurfaces(syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }), {
    tracking: true,
    clutter: 0,
  });
  expect(surfaces.filter((s) => s.surface === "FLOOR")).toHaveLength(1);
  expect(surfaces.filter((s) => s.surface === "WALL")).toHaveLength(4);
  expect(warnings.join(" ")).toMatch(/estimates/);
});

it("refines the same support identity and preserves bound clue correspondence without rescaling the edited room", () => {
  const { room, desk, input } = refinement();
  let draft = createSpatialDraft("photo-clue");
  draft.content.studio!.environment = room;
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: desk.id,
    nearFeatureId: null,
  });
  input.observation.roomDimensions = [10, 8, 10];
  const result = reconstructRoomFromObservation(input);
  if (result.status !== "PROPOSED") throw new Error("Expected same room refinement");
  expect([result.room.width, result.room.height, result.room.depth]).toEqual([6, 3, 5]);
  const refined = result.room.features.find((f) => f.id === desk.id)!;
  expect(refined.parts).toEqual(desk.parts);
  expect(refined.provenance.sourceMediaIds).toEqual(["media-one", "media-two"]);
  draft.content.studio!.environment = result.room;
  const pose = previewEntityTransform(draft.content, draft.content.entities[0].id, room.id, {
    ...result.room,
    horizontal: true,
    vertical: true,
  });
  expect(pose.position.x).toBeCloseTo(0.5);
  expect(pose.position.y).toBeCloseTo(1.01);
  expect(room.features.find((f) => f.id === desk.id)).toEqual(desk);
});

it.each(["ABSTAINED", "ALIGNMENT_UNCERTAIN"] as const)(
  "returns useful clarification for %s without materializing a room",
  (status) => {
    const obs = observation();
    obs.status = status;
    obs.clarification = "Show the desk and window in the same view.";
    expect(reconstructRoomFromObservation({ observation: obs, roomId: "room", sourceMediaIds: ["media-one"] })).toEqual(
      { status: "CLARIFICATION", message: obs.clarification },
    );
  },
);

it("requires explicit shared-feature evidence before combining views", () => {
  const { input, room } = refinement();
  const before = structuredClone(room);
  input.observation.alignment = "UNKNOWN";
  expect(reconstructRoomFromObservation(input).status).toBe("CLARIFICATION");
  input.observation.alignment = "EXISTING_ROOM_FRAME";
  input.observation.features[0].confidence = 0.59;
  expect(reconstructRoomFromObservation(input).status).toBe("CLARIFICATION");
  expect(room).toEqual(before);
  expect(() => reconstructRoomFromObservation({ ...input, roomId: "other-room" })).toThrow(/same owned room/);
});

it("preserves Creator-confirmed geometry and known measurements when additional evidence disagrees", () => {
  const { input, room, desk } = refinement();
  const confirmed = structuredClone(room);
  confirmed.features.find((f) => f.id === desk.id)!.provenance.basis = "CREATOR_CONFIRMED";
  for (const existing of [confirmed, scaleRoomFromMeasurement(room, desk.id, "WIDTH", 2.1)]) {
    const result = reconstructRoomFromObservation({ ...input, existing });
    if (result.status !== "PROPOSED") throw new Error("Expected preserved refinement");
    expect(result.room.features.find((f) => f.id === desk.id)).toEqual(existing.features.find((f) => f.id === desk.id));
    expect(result.room.scaleReference).toEqual(existing.scaleReference);
    expect(result.warnings.join(" ")).toMatch(/Kept your confirmed/);
  }
});

it("rejects unknown, duplicate and conflicting matches instead of creating duplicate room identity", () => {
  const { input } = refinement();
  input.observation.features.push({ ...input.observation.features[0] });
  expect(() => reconstructRoomFromObservation(input)).toThrow(/repeated/);
  input.observation.features[1].matchedFeatureId = "unknown-feature";
  expect(() => reconstructRoomFromObservation(input)).toThrow(/unknown/);
  input.observation.features.pop();
  input.observation.features[0].classification = "TABLE";
  expect(() => reconstructRoomFromObservation(input)).toThrow(/different type/);
});

it.each(["DESK", "WINDOW"] as const)(
  "rejects %s geometry extending outside the room even when its center is inside",
  (classification) => {
    const obs = observation();
    obs.features = [
      { ...obs.features[0], classification, dimensions: [7, 0.8, 0.8], position: { x: 0, y: 0.4, z: 0 } },
    ];
    expect(() => propose(obs)).toThrow(/outside the room/);
  },
);

it("ignores model-supplied shell fragments and labels an empty reconstruction as inferred", () => {
  const obs = observation();
  obs.features = [{ ...obs.features[0], classification: "FLOOR" }];
  const result = propose(obs);
  expect(result.room.features).toHaveLength(6);
  expect(result.warnings.join(" ")).toMatch(/Only an inferred room shell/);
});

it("accepts only bounded opaque source references and evidence fields", () => {
  expect(() =>
    reconstructRoomFromObservation({ observation: observation(), roomId: "photo-room", sourceMediaIds: [] }),
  ).toThrow(/authorized/);
  expect(() =>
    reconstructRoomFromObservation({
      observation: observation(),
      roomId: "photo-room",
      sourceMediaIds: ["https://private.test/image"],
    }),
  ).toThrow();
  expect(roomObservationSchema.safeParse({ ...observation(), imageUrl: "https://private.test/image" }).success).toBe(
    false,
  );
  const obs = observation();
  obs.features = Array.from({ length: 49 }, () => ({ ...obs.features[0] }));
  expect(roomObservationSchema.safeParse(obs).success).toBe(false);
});
it("asks for geometric correction for confident floating furniture or detached openings", () => {
  for (const classification of ["DESK", "WINDOW"] as const) {
    const obs = observation();
    const item = obs.features.find((f) => f.classification === classification)!;
    if (classification === "DESK") item.position.y += 0.3;
    else item.position.z += 0.1;
    item.confidence = 1;
    const result = reconstructRoomFromObservation({
      observation: obs,
      roomId: "photo-room",
      sourceMediaIds: ["media-one"],
    });
    expect(result).toMatchObject({ status: "CLARIFICATION", message: expect.stringContaining("geometric correction") });
  }
});

it("constructs explicitly observed wall attachments and a ceiling assembly without inventing furniture", () => {
  const obs = observation();
  obs.features = obs.features.filter((f) => f.classification !== "WINDOW");
  obs.features.push({
    matchedFeatureId: null,
    classification: "OTHER",
    name: "Teaching board",
    position: { x: 0, y: 1.6, z: -2.42 },
    yawDegrees: 0,
    dimensions: [1.2, 0.8, 0.06],
    basis: "DIRECTLY_OBSERVED",
    confidence: 0.8,
    attachment: "WALL",
  });
  obs.features.push({
    matchedFeatureId: null,
    classification: "APPLIANCE",
    name: "Projector assembly",
    position: { x: 0, y: 2.7, z: 0 },
    yawDegrees: 0,
    dimensions: [0.4, 0.6, 0.3],
    basis: "DIRECTLY_OBSERVED",
    confidence: 0.8,
    attachment: "CEILING",
  });
  const result = propose(obs);
  expect(result.room.construction!.relationships).toHaveLength(2);
  expect(result.room.features.filter((f) => f.classification === "OTHER")).toHaveLength(1);
  expect(result.warnings.join(" ")).toContain("declared wall attachment");
});

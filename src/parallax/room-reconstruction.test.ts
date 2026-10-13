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
it("rejects confident orientation contradictions without silently rotating a table, and exposes ambiguous estimates", () => {
  const obs = observation();
  obs.features[0].orientationEvidence = [
    {
      imageIndex: 0,
      widthAxisRelation: "PERPENDICULAR_BACK_WALL",
      confidence: 0.9,
      cues: "Long edges follow the return-wall direction.",
    },
  ];
  expect(() => propose(obs)).toThrow("conflicting edge evidence and rotation");
  expect(obs.features[0].yawDegrees).toBe(0);
  obs.features[0].orientationEvidence[0] = {
    imageIndex: 0,
    widthAxisRelation: "UNRESOLVED",
    confidence: 0.4,
    cues: "Only one cropped edge is visible.",
  };
  const result = propose(obs);
  const desk = result.room.features.find((feature) => feature.classification === "DESK")!;
  expect(desk.yawDegrees).toBe(0);
  expect(desk.provenance.confidence).toBe(0.4);
  expect(result.warnings.join(" ")).toContain("orientation is uncertain");
  obs.features[0].orientationEvidence[0].imageIndex = 1;
  expect(() => propose(obs)).toThrow("distinct supplied photographs");
});
it("lets a clearer second photograph resolve a cropped first view without changing observed yaw", () => {
  const obs = observation();
  obs.features[0].orientationEvidence = [
    { imageIndex: 0, widthAxisRelation: "UNRESOLVED", confidence: 0.3, cues: "The tabletop is cropped." },
    {
      imageIndex: 1,
      widthAxisRelation: "PARALLEL_BACK_WALL",
      confidence: 0.9,
      cues: "Both long edges and all four legs are visible.",
    },
  ];
  const result = reconstructRoomFromObservation({
    observation: obs,
    roomId: "two-view-room",
    sourceMediaIds: ["photo-a", "photo-b"],
  });
  if (result.status !== "PROPOSED") throw new Error("Expected proposal");
  const desk = result.room.features.find((feature) => feature.classification === "DESK")!;
  expect(desk.provenance.confidence).toBe(0.8);
  expect(desk.yawDegrees).toBe(0);
  expect(result.warnings.join(" ")).not.toContain("orientation is uncertain");
  obs.features[0].orientationEvidence[1].widthAxisRelation = "OBLIQUE";
  expect(() =>
    reconstructRoomFromObservation({
      observation: obs,
      roomId: "two-view-room",
      sourceMediaIds: ["photo-a", "photo-b"],
    }),
  ).toThrow("conflicting edge evidence and rotation");
});
it("preserves explicit perpendicular wall assignments and refuses contradictory wall coordinates", () => {
  const obs = observation();
  const base = obs.features[1];
  obs.features = [
    {
      ...base,
      classification: "OTHER",
      name: "Teaching board",
      dimensions: [2, 1, 0.08],
      position: { x: 0, y: 1.6, z: -2.4 },
      attachment: "WALL",
      wallFace: "BACK",
    },
    {
      ...base,
      classification: "OTHER",
      name: "Equipment panel",
      dimensions: [1.4, 1, 0.08],
      position: { x: 2.9, y: 1.6, z: -0.6 },
      yawDegrees: -90,
      attachment: "WALL",
      wallFace: "RIGHT",
    },
  ];
  const room = propose(obs).room;
  const panel = room.features.find((feature) => feature.name === "Equipment panel")!;
  const relation = room.construction!.relationships.find((entry) => entry.featureId === panel.id)!;
  expect(relation.targetFeatureId).toBe("photo-room:right-wall");
  expect(panel.yawDegrees).toBe(-90);
  obs.features[1].wallFace = "BACK";
  expect(() => propose(obs)).toThrow();
});
it.each(["BACK", "FRONT", "LEFT", "RIGHT"] as const)(
  "recognizes open, closed and uncertain doorway geometry on the %s wall, including near a corner",
  (wallFace) => {
    for (const openingState of ["OPEN", "CLOSED", "UNKNOWN"] as const) {
      const obs = observation();
      const side = wallFace === "LEFT" || wallFace === "RIGHT";
      obs.features = [
        {
          ...obs.features[1],
          classification: "DOOR",
          name: "Observed doorway",
          attachment: "WALL",
          wallFace,
          openingState,
          position: side
            ? { x: wallFace === "LEFT" ? -3 : 3, y: 1.05, z: -1.75 }
            : { x: 2.25, y: 1.05, z: wallFace === "BACK" ? -2.5 : 2.5 },
          dimensions: [0.9, 2.1, 0.1],
          yawDegrees: side ? 90 : 0,
        },
      ];
      const room = propose(obs).room;
      const door = room.features.find((feature) => feature.classification === "DOOR")!;
      expect(door.openingState).toBe(openingState);
      expect(door.parts.some((part) => part.id.endsWith(":panel"))).toBe(openingState !== "OPEN");
      const geometry = syntheticRoomGeometry({ ...room, horizontal: true, vertical: true });
      expect(geometry.some((part) => part.classification === "WALL" && (part.openings?.length ?? 0) > 0)).toBe(true);
      expect(
        discoverRoomSurfaces(geometry, { tracking: true, clutter: 0 }).filter((surface) => surface.surface === "FLOOR"),
      ).toHaveLength(1);
    }
  },
);
it.each([0, 90, -90, 180, 35])(
  "retains independently observed table yaw %s rather than aligning furniture to a nearby wall",
  (yawDegrees) => {
    const obs = observation();
    obs.features = [
      {
        ...obs.features[0],
        classification: "TABLE",
        attachment: "FLOOR",
        position: { x: 0, y: 0.4, z: 0 },
        dimensions: [1.8, 0.8, 0.9],
        yawDegrees,
      },
    ];
    const room = propose(obs).room;
    expect(room.features.find((feature) => feature.classification === "TABLE")!.yawDegrees).toBe(yawDegrees);
  },
);
it("retains observed ceiling x/z independently of cabinet geometry and back-wall proximity", () => {
  const obs = observation();
  obs.features = [
    {
      ...obs.features[0],
      classification: "APPLIANCE",
      name: "Ceiling device",
      applianceShape: "PROJECTOR",
      attachment: "CEILING",
      position: { x: 0.7, y: 2.65, z: 1.4 },
      dimensions: [0.45, 0.7, 0.45],
    },
  ];
  const room = propose(obs).room;
  const projector = room.features.find((feature) => feature.applianceShape === "PROJECTOR")!;
  expect(projector.position).toEqual({ x: 0.7, y: 2.65, z: 1.4 });
  expect(
    room.construction!.relationships.find((relation) => relation.featureId === projector.id)!.targetFeatureId,
  ).toBe("photo-room:ceiling");
});
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

it("resolves supported observations in any output order while retaining canonical support identities", () => {
  const obs = observation();
  const desk = obs.features[0];
  const equipment = {
    ...desk,
    classification: "APPLIANCE" as const,
    name: "Monitor",
    position: { x: desk.position.x, y: 0.8 + 0.2, z: desk.position.z },
    dimensions: [0.3, 0.4, 0.2] as [number, number, number],
    attachment: "FURNITURE" as const,
  };
  obs.features = [equipment, desk];
  const result = propose(obs);
  const monitor = result.room.features.find((f) => f.name === "Monitor")!;
  expect(result.room.construction!.relationships).toContainEqual({
    featureId: monitor.id,
    targetFeatureId: result.room.features.find((f) => f.name === "Writing desk")!.id,
    type: "SUPPORTED_BY",
  });
});

it("checks an appliance footprint in its rotated supporting table frame", () => {
  const obs = observation(),
    desk = obs.features[0];
  desk.yawDegrees = 90;
  desk.dimensions = [2, 0.8, 1];
  desk.position = { x: 1, y: 0.4, z: 0 };
  obs.features = [
    {
      ...desk,
      classification: "APPLIANCE",
      name: "Side monitor",
      position: { x: 1.2, y: 1.1, z: -0.65 },
      dimensions: [0.55, 0.6, 0.25],
      attachment: "FURNITURE",
    },
    desk,
  ];
  expect(propose(obs).room.construction!.relationships[0].type).toBe("SUPPORTED_BY");
});

it("constructs an explicitly observed layered screen without flattening it into its board", () => {
  const obs = observation(),
    exemplar = obs.features[0];
  obs.features = [
    {
      ...exemplar,
      classification: "OTHER",
      name: "Projection screen",
      position: { x: 0, y: 1.6, z: -2.34 },
      dimensions: [1.5, 1.4, 0.08],
      yawDegrees: 0,
      attachment: "WALL",
      attachmentTargetIndex: 1,
    },
    {
      ...exemplar,
      classification: "OTHER",
      name: "Whiteboard",
      position: { x: 0, y: 1.6, z: -2.44 },
      dimensions: [3, 1.15, 0.06],
      yawDegrees: 0,
      attachment: "WALL",
      attachmentTargetIndex: null,
    },
  ];
  const result = propose(obs);
  const screen = result.room.features.find((f) => f.name === "Projection screen")!;
  const board = result.room.features.find((f) => f.name === "Whiteboard")!;
  expect(screen.position.z - screen.dimensions[2] / 2).toBeCloseTo(board.position.z + board.dimensions[2] / 2);
  expect(result.room.construction!.relationships).toContainEqual({
    featureId: screen.id,
    targetFeatureId: board.id,
    type: "MOUNTED_ON",
  });
  expect(result.room.features.filter((f) => f.classification === "OTHER")).toHaveLength(2);
  // Absence of explicit observed topology must not turn arbitrary overlap into fabricated support.
  delete obs.features[0].attachmentTargetIndex;
  expect(
    reconstructRoomFromObservation({ observation: obs, roomId: "photo-room", sourceMediaIds: ["media-one"] }),
  ).toMatchObject({ status: "CLARIFICATION" });
});

it("rejects cyclic, missing and disjoint declared wall attachments", () => {
  const obs = observation(),
    exemplar = obs.features[0];
  obs.features = [
    {
      ...exemplar,
      classification: "OTHER",
      name: "Panel",
      position: { x: -1.5, y: 1.5, z: -2.4 },
      dimensions: [0.5, 0.5, 0.06],
      attachment: "WALL",
      attachmentTargetIndex: 1,
    },
    {
      ...exemplar,
      classification: "OTHER",
      name: "Board",
      position: { x: 1.5, y: 1.5, z: -2.4 },
      dimensions: [0.5, 0.5, 0.06],
      attachment: "WALL",
      attachmentTargetIndex: 0,
    },
  ];
  expect(() => propose(obs)).toThrow(/cycle/);
  obs.features[1].attachmentTargetIndex = null;
  expect(
    reconstructRoomFromObservation({ observation: obs, roomId: "photo-room", sourceMediaIds: ["media-one"] }),
  ).toMatchObject({ status: "CLARIFICATION", message: expect.stringContaining("no ground or modeled support") });
  obs.features[0].attachmentTargetIndex = 23;
  expect(() => propose(obs)).toThrow(/invalid observed attachment/);
});

it("normalizes a near-wall mounted estimate before checking its constructed containment", () => {
  const obs = observation(),
    exemplar = obs.features[0];
  obs.features = [
    {
      ...exemplar,
      classification: "OTHER",
      name: "Wall display",
      position: { x: 0, y: 1.6, z: -2.54 },
      dimensions: [2, 1, 0.08],
      yawDegrees: 0,
      attachment: "WALL",
    },
  ];
  expect(propose(obs).room.features.find((f) => f.name === "Wall display")!.position.z).toBeCloseTo(-2.4);
  obs.features[0].dimensions[0] = 9;
  expect(
    reconstructRoomFromObservation({ observation: obs, roomId: "photo-room", sourceMediaIds: ["media-one"] }),
  ).toMatchObject({ status: "CLARIFICATION", message: expect.stringContaining("extends outside") });
});

it("uses observed chair-facing topology without moving its estimated position or removing collision checks", () => {
  const obs = observation(),
    desk = obs.features[0];
  obs.features = [
    desk,
    {
      ...desk,
      classification: "CHAIR",
      name: "Facing chair",
      dimensions: [0.5, 0.95, 0.55],
      position: { x: desk.position.x, y: 0.475, z: desk.position.z + 1.2 },
      yawDegrees: 0,
      facesFeatureIndex: 0,
    },
  ];
  const room = propose(obs).room,
    chair = room.features.find((f) => f.name === "Facing chair")!;
  expect(chair.yawDegrees).toBe(180);
  expect(chair.position).toEqual(obs.features[1].position);
  obs.features[1].position.z = desk.position.z;
  expect(() => propose(obs)).toThrow(/distinct furnishing/);
  obs.features[1].facesFeatureIndex = 1;
  expect(() => propose(obs)).toThrow(/invalid observed facing/);
});

it("fits a small observed chair/table leg contact with explicit estimated-placement feedback", () => {
  const obs = observation(),
    desk = obs.features[0];
  desk.dimensions = [1.2, 0.8, 0.8];
  desk.position = { x: 0, y: 0.4, z: 0 };
  obs.features = [
    desk,
    {
      ...desk,
      classification: "CHAIR",
      name: "Side chair",
      dimensions: [0.75, 0.95, 0.55],
      position: { x: 0.725, y: 0.475, z: 0 },
      yawDegrees: -90,
      facesFeatureIndex: 0,
    },
  ];
  const before = structuredClone(obs),
    result = propose(obs);
  const chair = result.room.features.find((feature) => feature.name === "Side chair")!;
  expect(chair.position.x).toBeGreaterThan(0.725);
  expect(chair.position.x - 0.725).toBeLessThanOrEqual(0.11);
  expect(chair.dimensions).toEqual(obs.features[1].dimensions);
  expect(chair.provenance.basis).toBe("INFERRED");
  expect(result.warnings.join(" ")).toContain("Review this fitted placement");
  expect(obs).toEqual(before);
  // A substantial intrusion remains rejected; no replacement geometry or larger search is allowed.
  obs.features[1].position.x = 0.3;
  expect(
    reconstructRoomFromObservation({ observation: obs, roomId: "photo-room", sourceMediaIds: ["media-one"] }),
  ).toMatchObject({ status: "CLARIFICATION" });
});

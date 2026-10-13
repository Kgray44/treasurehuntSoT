import { expect, it } from "vitest";
import { buildRoomPerceptionRequest, roomPerceptionContext } from "./room-perception";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { defaultAIGlobalPolicy } from "@/parallax/ai-policy";
import { roomObservationSchema, roomObservationResponseSchema, roomObservationWireSchema } from "./room-observation";
it("sends item-defined fixed-length arrays accepted by Structured Outputs while preserving canonical axis validation", () => {
  const body = buildRoomPerceptionRequest({
    model: "gpt-6-luna",
    policy: defaultAIGlobalPolicy,
    images: [{ mediaId: "synthetic", bytes: Buffer.from([1]), mediaType: "image/webp", width: 1, height: 1 }],
  });
  const schema = body.text.format.schema as Record<string, unknown>;
  let arrays = 0;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.type === "array") {
      arrays++;
      expect(node.items).toBeDefined();
      expect(node.prefixItems).toBeUndefined();
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(schema);
  expect(arrays).toBeGreaterThanOrEqual(2);
  const valid = {
    status: "OBSERVED",
    explanation: "Approximate synthetic room",
    clarification: null,
    alignment: "INITIAL_ROOM",
    sharedFeatureId: null,
    roomDimensions: [6, 3, 5],
    dimensionBasis: "ESTIMATED",
    features: [],
    uncertainties: [],
  };
  expect(roomObservationSchema.parse(valid).roomDimensions).toEqual([6, 3, 5]);
  expect(() => roomObservationSchema.parse({ ...valid, roomDimensions: [6, 21, 5] })).toThrow();
  expect(() => roomObservationSchema.parse({ ...valid, roomDimensions: [6, 3] })).toThrow();
});
it("includes both views in one request without putting raw image bytes in semantic context", () => {
  const images = ["first", "second"].map((mediaId) => ({
    mediaId,
    bytes: Buffer.from([1, 2, 3]),
    mediaType: "image/webp" as const,
    width: 1,
    height: 1,
  }));
  const body = buildRoomPerceptionRequest({ model: "gpt-6-luna", policy: defaultAIGlobalPolicy, images });
  expect(body.input[0].content.filter((part) => part.type === "input_image")).toHaveLength(2);
  const context = body.input[0].content[0] as { text: string };
  expect(JSON.parse(context.text).images).toHaveLength(2);
  expect(context.text).not.toContain("base64");
  expect(body.store).toBe(false);
  expect(body.tools).toEqual([]);
});
it("bounds actual semantic room context independently of mesh complexity and retains observed shape corrections", () => {
  const room = createRoomEnvironment(simulationEnvironments.find((environment) => environment.id === "cluttered")!);
  room.features[0].name = "Structured room feature";
  const semantic = roomPerceptionContext({ images: [], existing: room });
  expect(Buffer.byteLength(JSON.stringify(semantic))).toBeLessThan(24_000);
  expect(semantic.existingRoom!.features.every((feature) => !("parts" in feature))).toBe(true);
  expect(semantic.existingRoom!.features.map((feature) => feature.id)).toEqual(
    room.features.map((feature) => feature.id),
  );
  room.features[0].parts = Array.from({ length: 64 }, (_, index) => ({
    ...room.features[0].parts[0],
    id: `detail-${index}`,
  }));
  expect(roomPerceptionContext({ images: [], existing: room })).toEqual(semantic);
});

it("normalizes explicitly named axes without swapping room height/depth", () => {
  const wire = {
    status: "OBSERVED",
    explanation: "Synthetic layout",
    clarification: null,
    alignment: "INITIAL_ROOM",
    sharedFeatureId: null,
    roomDimensions: { widthMeters: 8, heightMeters: 3.1, depthMeters: 7 },
    dimensionBasis: "ESTIMATED",
    features: [],
    uncertainties: [],
  };
  expect(roomObservationResponseSchema.parse(wire).roomDimensions).toEqual([8, 3.1, 7]);
  expect(() =>
    roomObservationWireSchema.parse({ ...wire, roomDimensions: { widthMeters: 8, heightMeters: 21, depthMeters: 7 } }),
  ).toThrow();
});

it("resolves named observation relationships in any order and rejects unknown or duplicate keys", () => {
  const feature = {
    matchedFeatureId: null,
    classification: "CHAIR",
    name: "Seat",
    position: { x: 0, y: 0.5, z: 1 },
    yawDegrees: 0,
    orientationEvidence: null,
    dimensions: { widthMeters: 0.5, heightMeters: 1, depthMeters: 0.5 },
    basis: "DIRECTLY_OBSERVED",
    confidence: 0.8,
    attachment: "FLOOR",
    wallFace: null,
    applianceShape: null,
    openingState: null,
    observationKey: "seat",
    attachmentTargetKey: null,
    facesFeatureKey: "table",
  };
  const wire = {
    status: "OBSERVED",
    explanation: "Synthetic room",
    clarification: null,
    alignment: "INITIAL_ROOM",
    sharedFeatureId: null,
    roomDimensions: { widthMeters: 6, heightMeters: 3, depthMeters: 5 },
    dimensionBasis: "ESTIMATED",
    uncertainties: [],
    features: [
      feature,
      { ...feature, classification: "TABLE", name: "Table", observationKey: "table", facesFeatureKey: null },
    ],
  };
  const parsed = roomObservationResponseSchema.parse(wire);
  expect(parsed.features[0].facesFeatureIndex).toBe(1);
  expect(parsed.features[0].chairSideEvidence).toBeNull();
  expect(parsed.features[0]).not.toHaveProperty("observationKey");
  expect(
    roomObservationResponseSchema.parse({ ...wire, features: [...wire.features].reverse() }).features[1]
      .facesFeatureIndex,
  ).toBe(0);
  expect(() => roomObservationResponseSchema.parse({ ...wire, features: [feature] })).toThrow();
  expect(() => roomObservationResponseSchema.parse({ ...wire, features: [feature, feature] })).toThrow();
  const withSides = structuredClone(wire) as typeof wire & {
    features: (typeof feature & { chairSideEvidence?: unknown })[];
  };
  withSides.features[0].chairSideEvidence = [
    {
      imageIndex: 0,
      tableSide: "DEPTH_POSITIVE",
      confidence: 0.8,
      cues: "Seat is hidden by the near tabletop edge; its backrest is in front.",
    },
  ];
  withSides.features[1].chairSideEvidence = null;
  expect(roomObservationResponseSchema.parse(withSides).features[0].chairSideEvidence![0].tableSide).toBe(
    "DEPTH_POSITIVE",
  );
  withSides.features[1].chairSideEvidence = withSides.features[0].chairSideEvidence;
  expect(() => roomObservationResponseSchema.parse(withSides)).toThrow("Chair-side evidence needs a chair");
});

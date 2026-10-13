import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/);
const point = z.strictObject({
  x: z.number().finite().min(-100).max(100),
  y: z.number().finite().min(-20).max(20),
  z: z.number().finite().min(-100).max(100),
});
const dimensions = z.tuple([
  z.number().finite().positive().max(100),
  z.number().finite().positive().max(20),
  z.number().finite().positive().max(100),
]);
export const roomFeatureClasses = [
  "FLOOR",
  "WALL",
  "CEILING",
  "DOOR",
  "WINDOW",
  "TABLE",
  "DESK",
  "CHAIR",
  "SOFA",
  "BED",
  "CABINET",
  "WARDROBE",
  "SHELF",
  "APPLIANCE",
  "TREE",
  "OTHER",
  "EXCLUSION_ZONE",
] as const;
// Watchglass observes physical features; placement zones are authored by Parallax.
export const observedRoomFeatureClasses = roomFeatureClasses.filter(
  (classification) => classification !== "EXCLUSION_ZONE",
);
export const roomFeatureSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(120),
  classification: z.enum(roomFeatureClasses),
  position: point,
  yawDegrees: z.number().finite().min(-180).max(180),
  applianceShape: z.enum(["PROJECTOR", "EQUIPMENT", "WALL_PANEL", "GENERIC_BOX"]).optional(),
  openingState: z.enum(["OPEN", "CLOSED", "UNKNOWN"]).optional(),
  dimensions,
  exclusion: z.strictObject({ surfaceId: id.optional(), sourceFeatureId: id.optional() }).optional(),
  provenance: z.strictObject({
    basis: z.enum(["SIMULATED", "DIRECTLY_OBSERVED", "INFERRED", "PLACEHOLDER", "CREATOR_CONFIRMED"]),
    confidence: z.number().finite().min(0).max(1),
    // Opaque protected-media identities only; never URLs, paths, bytes or location metadata.
    sourceMediaIds: z.array(id).max(8),
  }),
  parts: z
    .array(
      z.strictObject({
        id,
        // Dimensionless coordinates relative to the feature's bounding box.
        size: z.tuple([z.number().positive().max(2), z.number().positive().max(2), z.number().positive().max(2)]),
        position: z.tuple([z.number().min(-2).max(2), z.number().min(-2).max(2), z.number().min(-2).max(2)]),
        surface: z.enum(["FLOOR", "WALL", "TABLE", "DESK", "SHELF"]).nullable(),
        context: z
          .array(z.enum(["FURNITURE", "WINDOW", "ENTRANCE", "WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"]))
          .max(7),
        face: z.enum(["TOP", "FRONT", "RIGHT"]),
        shape: z.enum([
          "BOX",
          "ROUNDED_BOX",
          "CYLINDER",
          "ELLIPSOID",
          "TREE",
          "WINDOW",
          "TERRAIN",
          "PATH",
          "PICTURE",
          "CLOCK",
        ]),
        color: z.number().int().min(0).max(0xffffff),
      }),
    )
    .min(1)
    .max(64),
});
export const roomEnvironmentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    name: z.string().trim().min(1).max(120),
    width: z.number().finite().min(1).max(100),
    depth: z.number().finite().min(1).max(100),
    height: z.number().finite().min(1).max(20),
    origin: z.enum(["PRESET", "MANUAL", "PHOTO_RECONSTRUCTION"]),
    exclusionZonesEnabled: z.literal(true).optional(),
    // Deleted automatic envelopes stay deleted; actual modeled solids still block placement.
    suppressedExclusions: z
      .array(z.strictObject({ sourceFeatureId: id, surfaceId: id }))
      .max(256)
      .optional(),
    // Optional: historic scenes keep their exact published representation.
    construction: z
      .strictObject({
        revision: z.literal(1),
        kind: z.enum(["INDOOR", "OUTDOOR"]),
        relationships: z
          .array(
            z.strictObject({
              featureId: id,
              targetFeatureId: id,
              type: z.enum(["SUPPORTED_BY", "MOUNTED_ON"]),
            }),
          )
          .max(256),
        navigation: z
          .strictObject({
            widthMeters: z.number().finite().min(0.3).max(10),
            points: z.array(point).min(2).max(64),
          })
          .optional(),
      })
      .optional(),
    // Optional to preserve historic authored/published shapes. Approximate model scale, not physical calibration.
    scaleReference: z
      .strictObject({
        featureId: id,
        axis: z.enum(["WIDTH", "HEIGHT", "DEPTH"]),
        measuredMeters: z.number().finite().min(0.05).max(100),
      })
      .optional(),
    features: z.array(roomFeatureSchema).min(1).max(256),
  })
  .superRefine((room, context) => {
    const features = room.features.map((f) => f.id),
      parts = room.features.flatMap((f) => f.parts.map((p) => p.id));
    if (new Set(features).size !== features.length || new Set(parts).size !== parts.length)
      context.addIssue({ code: "custom", message: "PARALLAX_ROOM_ID_DUPLICATE" });
    if (parts.length > 512) context.addIssue({ code: "custom", message: "PARALLAX_ROOM_GEOMETRY_BUDGET" });
    const surfaces = new Set(
      room.features.flatMap((feature) => feature.parts.filter((part) => part.surface).map((part) => part.id)),
    );
    for (const feature of room.features) {
      if (feature.classification === "EXCLUSION_ZONE") {
        if (!feature.exclusion || feature.parts.some((part) => part.surface !== null))
          context.addIssue({ code: "custom", message: "PARALLAX_EXCLUSION_INVALID" });
        if (feature.exclusion?.surfaceId && !surfaces.has(feature.exclusion.surfaceId))
          context.addIssue({ code: "custom", message: "PARALLAX_EXCLUSION_SURFACE_MISSING" });
        if (
          feature.exclusion?.sourceFeatureId &&
          !room.features.some(
            (source) => source.id === feature.exclusion!.sourceFeatureId && source.classification !== "EXCLUSION_ZONE",
          )
        )
          context.addIssue({ code: "custom", message: "PARALLAX_EXCLUSION_SOURCE_MISSING" });
      } else if (feature.exclusion) context.addIssue({ code: "custom", message: "PARALLAX_EXCLUSION_INVALID" });
    }
    if (room.scaleReference) {
      const reference = room.features.find((f) => f.id === room.scaleReference!.featureId);
      const axis = ({ WIDTH: 0, HEIGHT: 1, DEPTH: 2 } as const)[room.scaleReference.axis];
      if (!reference || Math.abs(reference.dimensions[axis] - room.scaleReference.measuredMeters) > 1e-6)
        context.addIssue({ code: "custom", message: "PARALLAX_ROOM_SCALE_REFERENCE_INVALID" });
    }
  });
export type RoomFeature = z.infer<typeof roomFeatureSchema>;
export type RoomEnvironment = z.infer<typeof roomEnvironmentSchema>;

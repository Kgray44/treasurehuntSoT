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
] as const;
export const roomFeatureSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(120),
  classification: z.enum(roomFeatureClasses),
  position: point,
  yawDegrees: z.number().finite().min(-180).max(180),
  dimensions,
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
        shape: z.enum(["BOX", "TREE", "WINDOW"]),
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
    features: z.array(roomFeatureSchema).min(1).max(256),
  })
  .superRefine((room, context) => {
    const features = room.features.map((f) => f.id),
      parts = room.features.flatMap((f) => f.parts.map((p) => p.id));
    if (new Set(features).size !== features.length || new Set(parts).size !== parts.length)
      context.addIssue({ code: "custom", message: "PARALLAX_ROOM_ID_DUPLICATE" });
    if (parts.length > 512) context.addIssue({ code: "custom", message: "PARALLAX_ROOM_GEOMETRY_BUDGET" });
  });
export type RoomFeature = z.infer<typeof roomFeatureSchema>;
export type RoomEnvironment = z.infer<typeof roomEnvironmentSchema>;

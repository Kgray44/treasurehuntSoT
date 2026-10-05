import { z } from "zod";

const plain = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !/[<>]/.test(value) && !Array.from(value).some((character) => character.charCodeAt(0) < 32));
export const remoteGeoPointSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export type RemoteGeoPoint = z.infer<typeof remoteGeoPointSchema>;
const bounds = z
  .strictObject({
    west: z.number().finite().min(-180).max(180),
    east: z.number().finite().min(-180).max(180),
    south: z.number().finite().min(-90).max(90),
    north: z.number().finite().min(-90).max(90),
  })
  .refine((value) => value.west < value.east && value.south < value.north);
export const remoteDataRequestSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("STATUS") }),
  z.strictObject({
    operation: z.literal("SEARCH"),
    consent: z.literal(true),
    query: plain,
    limit: z.number().int().min(1).max(5),
    bounds: bounds.optional(),
    proximity: remoteGeoPointSchema.optional(),
  }),
  z.strictObject({ operation: z.literal("REVERSE"), consent: z.literal(true), point: remoteGeoPointSchema }),
  z.strictObject({
    operation: z.literal("ROUTE"),
    consent: z.literal(true),
    from: remoteGeoPointSchema,
    to: remoteGeoPointSchema,
    mode: z.enum(["WALKING", "CYCLING", "DRIVING"]),
  }),
  z.strictObject({ operation: z.literal("ELEVATION"), consent: z.literal(true), point: remoteGeoPointSchema }),
]);
export type RemoteDataRequest = z.infer<typeof remoteDataRequestSchema>;
export const remoteServiceKindSchema = z.enum(["NOMINATIM", "OSRM", "OPEN_ELEVATION"]);
export type RemoteServiceKind = z.infer<typeof remoteServiceKindSchema>;
export const remoteServiceSummarySchema = z.strictObject({
  id: z.enum(["configured-geocoder", "configured-router", "configured-elevation"]),
  family: z.enum(["GEOCODING", "ROUTING", "ELEVATION"]),
  state: z.enum(["NOT_CONFIGURED", "CONFIGURED", "READY", "RATE_LIMITED", "UNAVAILABLE"]),
  recipient: z.string().min(1).max(253),
  attributionLabel: plain,
  attributionUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }),
  license: plain,
  cacheRights: z.literal("PROHIBITED"),
  offlineRights: z.literal("PROHIBITED"),
  authoringRights: z.enum(["ALLOWED", "PROHIBITED"]),
  mode: z.enum(["WALKING", "CYCLING", "DRIVING"]).optional(),
  retryAfterSeconds: z.number().int().min(1).max(60).optional(),
});
export type RemoteServiceSummary = z.infer<typeof remoteServiceSummarySchema>;
export const remotePlaceSchema = z.strictObject({
  id: z.string().min(1).max(128),
  label: plain,
  point: remoteGeoPointSchema,
  source: z.literal("EXTERNAL"),
  authoritative: z.literal(false),
  accuracy: z.literal("UNKNOWN"),
});
export type RemotePlace = z.infer<typeof remotePlaceSchema>;
export const remoteRouteSchema = z.strictObject({
  points: z.array(remoteGeoPointSchema).min(2).max(1024),
  distanceMeters: z.number().finite().nonnegative().max(40_000_000),
  durationSeconds: z.number().finite().nonnegative().max(10_000_000),
  mode: z.enum(["WALKING", "CYCLING", "DRIVING"]),
  source: z.literal("EXTERNAL"),
  authoritative: z.literal(false),
  safety: z.literal("REVIEW_REQUIRED"),
  accessibility: z.literal("NOT_ASSESSED"),
});
export const remoteElevationSchema = z.strictObject({
  point: remoteGeoPointSchema,
  meters: z.number().finite().min(-12000).max(100000),
  source: z.literal("EXTERNAL"),
  authoritative: z.literal(false),
  uncertainty: z.literal("UNKNOWN"),
  floorConfirmed: z.literal(false),
  missingCoveragePossible: z.literal(true),
});
export const remoteDataResponseSchema = z
  .discriminatedUnion("state", [
    z.strictObject({ state: z.literal("STATUS"), services: z.array(remoteServiceSummarySchema).max(3) }),
    z.strictObject({
      state: z.literal("RESULT"),
      service: remoteServiceSummarySchema,
      places: z.array(remotePlaceSchema).max(5).optional(),
      route: remoteRouteSchema.optional(),
      elevation: remoteElevationSchema.optional(),
      canComplete: z.literal(false),
    }),
    z.strictObject({
      state: z.enum(["NOT_CONFIGURED", "RATE_LIMITED", "UNAVAILABLE"]),
      canComplete: z.literal(false),
      retryAfterSeconds: z.number().int().min(1).max(60).optional(),
    }),
  ])
  .superRefine((value, context) => {
    const services = value.state === "STATUS" ? value.services : value.state === "RESULT" ? [value.service] : [];
    const families = {
      "configured-geocoder": "GEOCODING",
      "configured-router": "ROUTING",
      "configured-elevation": "ELEVATION",
    } as const;
    if (
      new Set(services.map((service) => service.id)).size !== services.length ||
      services.some((service) => families[service.id] !== service.family)
    )
      context.addIssue({ code: "custom", message: "Invalid service metadata" });
    if (value.state === "RESULT") {
      const count =
        Number(value.places !== undefined) + Number(value.route !== undefined) + Number(value.elevation !== undefined);
      if (
        count !== 1 ||
        (value.service.family === "GEOCODING" && value.places === undefined) ||
        (value.service.family === "ROUTING" && (!value.route || value.route.mode !== value.service.mode)) ||
        (value.service.family === "ELEVATION" && !value.elevation)
      )
        context.addIssue({ code: "custom", message: "Invalid result capability" });
    }
  });
export type RemoteDataResponse = z.infer<typeof remoteDataResponseSchema>;

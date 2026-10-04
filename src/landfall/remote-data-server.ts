import { z } from "zod";
import {
  RemoteDataFailure,
  isRemoteServiceUrl,
  requestRemoteJson,
  type RemoteJsonTransport,
} from "./remote-network-server";
import {
  remoteDataRequestSchema,
  remoteDataResponseSchema,
  remoteGeoPointSchema,
  remotePlaceSchema,
  remoteRouteSchema,
  remoteElevationSchema,
  type RemoteDataRequest,
  type RemoteDataResponse,
  type RemoteGeoPoint,
  type RemoteServiceKind,
  type RemoteServiceSummary,
} from "./remote-data";

const text = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !/[<>\r\n\x00-\x1f]/.test(value));
const common = {
  baseUrl: z.string().max(2048).refine(isRemoteServiceUrl),
  userAgent: text,
  license: text,
  attributionLabel: text,
  attributionUrl: z.string().max(2048).refine(isRemoteServiceUrl),
  usageAgreementAccepted: z.literal(true),
  authoringRights: z.enum(["ALLOWED", "PROHIBITED"]).default("PROHIBITED"),
  authentication: z.enum(["NONE", "BEARER"]),
  bearerEnvironmentKey: z
    .string()
    .regex(/^LANDFALL_[A-Z0-9_]{2,80}$/)
    .optional(),
};
export const remoteServiceConfigurationSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ ...common, kind: z.literal("NOMINATIM") }),
    z.strictObject({
      ...common,
      kind: z.literal("OSRM"),
      mode: z.enum(["WALKING", "CYCLING", "DRIVING"]),
      profile: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
    }),
    z.strictObject({ ...common, kind: z.literal("OPEN_ELEVATION") }),
  ])
  .refine((value) => (value.authentication === "BEARER") === Boolean(value.bearerEnvironmentKey));
type Configuration = z.infer<typeof remoteServiceConfigurationSchema>;
type Service = {
  configuration: Configuration;
  bearerToken?: string;
  state: RemoteServiceSummary["state"];
  lastStartedAt: number;
  retryUntil: number;
  inFlight: boolean;
  readyUntil: number;
};
const ids = {
  NOMINATIM: "configured-geocoder",
  OSRM: "configured-router",
  OPEN_ELEVATION: "configured-elevation",
} as const;
const families = { NOMINATIM: "GEOCODING", OSRM: "ROUTING", OPEN_ELEVATION: "ELEVATION" } as const;

/** Server-only deployment inputs; clients never select URLs, authorization headers or profile names. */
export function configuredRemoteServices(env: Record<string, string | undefined>) {
  try {
    if (env.LANDFALL_REMOTE_DATA_MODE !== "ephemeral-instance") return [];
    const raw = env.LANDFALL_REMOTE_DATA_CONFIG;
    if (!raw || raw.length > 8192) return [];
    const values = z.array(remoteServiceConfigurationSchema).max(3).parse(JSON.parse(raw));
    if (new Set(values.map((value) => value.kind)).size !== values.length) return [];
    return values.map((configuration) => {
      const bearerToken = configuration.bearerEnvironmentKey ? env[configuration.bearerEnvironmentKey] : undefined;
      if (
        configuration.authentication === "BEARER" &&
        (!bearerToken || !/^[A-Za-z0-9._~+/=-]{1,4096}$/.test(bearerToken))
      )
        throw new Error("CREDENTIAL_UNAVAILABLE");
      return { configuration, bearerToken };
    });
  } catch {
    return [];
  }
}
function summary(service: Service, now: number): RemoteServiceSummary {
  const config = service.configuration;
  const retry = Math.max(0, Math.min(60, Math.ceil((service.retryUntil - now) / 1000)));
  return {
    id: ids[config.kind],
    family: families[config.kind],
    state: retry ? service.state : service.readyUntil > now ? "READY" : "CONFIGURED",
    recipient: new URL(config.baseUrl).hostname,
    attributionLabel: config.attributionLabel,
    attributionUrl: config.attributionUrl,
    license: config.license,
    cacheRights: "PROHIBITED",
    offlineRights: "PROHIBITED",
    authoringRights: config.authoringRights,
    ...(config.kind === "OSRM" ? { mode: config.mode } : {}),
    ...(retry ? { retryAfterSeconds: retry } : {}),
  };
}
const decimal = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .max(32)
  .transform(Number);
const place = z.object({
  display_name: z.string().min(1).max(2000),
  lat: decimal,
  lon: decimal,
  osm_type: z.enum(["node", "way", "relation"]),
  osm_id: z.union([z.number().int().nonnegative(), z.string().regex(/^\d{1,20}$/)]),
});
function places(raw: unknown, reverse: boolean, limit: number) {
  const values = reverse ? [place.parse(raw)] : z.array(place).max(5).parse(raw);
  return values.slice(0, limit).map((value) =>
    remotePlaceSchema.parse({
      id: `nominatim:${value.osm_type}:${value.osm_id}`,
      label: value.display_name.trim().slice(0, 240),
      point: { latitude: value.lat, longitude: value.lon },
      source: "EXTERNAL",
      authoritative: false,
      accuracy: "UNKNOWN",
    }),
  );
}
function route(raw: unknown, config: Extract<Configuration, { kind: "OSRM" }>) {
  const parsed = z
    .object({
      code: z.literal("Ok"),
      routes: z
        .array(
          z.object({
            distance: z.number().finite().nonnegative(),
            duration: z.number().finite().nonnegative(),
            geometry: z.object({
              type: z.literal("LineString"),
              coordinates: z
                .array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]))
                .min(2)
                .max(1024),
            }),
          }),
        )
        .min(1)
        .max(1),
    })
    .parse(raw).routes[0];
  return remoteRouteSchema.parse({
    points: parsed.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    distanceMeters: parsed.distance,
    durationSeconds: parsed.duration,
    mode: config.mode,
    source: "EXTERNAL",
    authoritative: false,
    safety: "REVIEW_REQUIRED",
    accessibility: "NOT_ASSESSED",
  });
}
function elevation(raw: unknown, point: RemoteGeoPoint) {
  const parsed = z
    .object({
      results: z
        .array(z.object({ ...remoteGeoPointSchema.shape, elevation: z.number().finite().min(-12000).max(100000) }))
        .length(1),
    })
    .parse(raw).results[0];
  if (
    Math.abs(parsed.latitude - point.latitude) > 0.0000001 ||
    Math.abs(parsed.longitude - point.longitude) > 0.0000001
  )
    throw new Error("ELEVATION_POINT_MISMATCH");
  return remoteElevationSchema.parse({
    point,
    meters: parsed.elevation,
    source: "EXTERNAL",
    authoritative: false,
    uncertainty: "UNKNOWN",
    floorConfirmed: false,
    missingCoveragePossible: true,
  });
}

/** Bounded optional online data only. Authored routes and One Voyage remain unchanged. */
export class RemoteLandfallDataService {
  private readonly services: Service[];
  private lastClock = -1;
  constructor(
    inputs: ReturnType<typeof configuredRemoteServices>,
    private readonly transport: RemoteJsonTransport = requestRemoteJson,
    private readonly now = Date.now,
  ) {
    this.services = inputs.map((input) => ({
      ...input,
      state: "CONFIGURED",
      lastStartedAt: -Infinity,
      retryUntil: 0,
      inFlight: false,
      readyUntil: 0,
    }));
  }
  status(): RemoteDataResponse {
    return { state: "STATUS", services: this.services.map((service) => summary(service, this.now())) };
  }
  recipient(operation: RemoteDataRequest["operation"]): string | null {
    if (operation === "STATUS") return null;
    const kind = operation === "ROUTE" ? "OSRM" : operation === "ELEVATION" ? "OPEN_ELEVATION" : "NOMINATIM";
    const service = this.services.find((value) => value.configuration.kind === kind);
    return service ? new URL(service.configuration.baseUrl).hostname : null;
  }
  async execute(input: RemoteDataRequest, signal?: AbortSignal): Promise<RemoteDataResponse> {
    const command = remoteDataRequestSchema.parse(input);
    if (command.operation === "STATUS") return this.status();
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0 || now < this.lastClock)
      return { state: "UNAVAILABLE", canComplete: false };
    this.lastClock = now;
    const kind: RemoteServiceKind =
      command.operation === "ROUTE" ? "OSRM" : command.operation === "ELEVATION" ? "OPEN_ELEVATION" : "NOMINATIM";
    const service = this.services.find((value) => value.configuration.kind === kind);
    if (!service) return { state: "NOT_CONFIGURED", canComplete: false };
    const config = service.configuration;
    if (command.operation === "ROUTE" && (config.kind !== "OSRM" || command.mode !== config.mode))
      return { state: "NOT_CONFIGURED", canComplete: false };
    if (service.inFlight || now - service.lastStartedAt < 1000 || now < service.retryUntil)
      return {
        state: service.state === "UNAVAILABLE" ? "UNAVAILABLE" : "RATE_LIMITED",
        canComplete: false,
        retryAfterSeconds: Math.max(1, Math.min(60, Math.ceil(Math.max(service.retryUntil - now, 1000) / 1000))),
      };
    const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
    let url: URL, body: string | undefined;
    if (command.operation === "SEARCH") {
      url = new URL("search", base);
      url.search = new URLSearchParams({
        q: command.query,
        format: "jsonv2",
        limit: String(command.limit),
        addressdetails: "0",
        extratags: "0",
        namedetails: "0",
      }).toString();
      const bias = command.proximity;
      const box =
        command.bounds ??
        (bias
          ? {
              west: Math.max(-180, bias.longitude - 0.05),
              east: Math.min(180, bias.longitude + 0.05),
              south: Math.max(-90, bias.latitude - 0.05),
              north: Math.min(90, bias.latitude + 0.05),
            }
          : null);
      if (box) {
        url.searchParams.set("viewbox", [box.west, box.south, box.east, box.north].join(","));
        url.searchParams.set("bounded", command.bounds ? "1" : "0");
      }
    } else if (command.operation === "REVERSE") {
      url = new URL("reverse", base);
      url.search = new URLSearchParams({
        lat: String(command.point.latitude),
        lon: String(command.point.longitude),
        format: "jsonv2",
        addressdetails: "0",
      }).toString();
    } else if (command.operation === "ROUTE" && config.kind === "OSRM") {
      const point = (value: RemoteGeoPoint) => `${value.longitude.toFixed(7)},${value.latitude.toFixed(7)}`;
      url = new URL(`route/v1/${config.profile}/${point(command.from)};${point(command.to)}`, base);
      url.search = "geometries=geojson&overview=simplified&steps=false&alternatives=false";
    } else if (command.operation === "ELEVATION") {
      url = new URL("api/v1/lookup", base);
      body = JSON.stringify({ locations: [command.point] });
    } else return { state: "NOT_CONFIGURED", canComplete: false };
    service.inFlight = true;
    service.lastStartedAt = now;
    try {
      const raw = await this.transport({
        url,
        method: body ? "POST" : "GET",
        userAgent: config.userAgent,
        bearerToken: service.bearerToken,
        body,
        signal,
      });
      if (signal?.aborted) throw new RemoteDataFailure("UNAVAILABLE");
      const result =
        command.operation === "SEARCH" || command.operation === "REVERSE"
          ? { places: places(raw, command.operation === "REVERSE", command.operation === "SEARCH" ? command.limit : 1) }
          : command.operation === "ROUTE" && config.kind === "OSRM"
            ? { route: route(raw, config) }
            : command.operation === "ELEVATION"
              ? { elevation: elevation(raw, command.point) }
              : {};
      if (command.operation === "SEARCH" && command.bounds && "places" in result) {
        const box = command.bounds;
        if (
          result.places?.some(
            ({ point }) =>
              point.longitude < box.west ||
              point.longitude > box.east ||
              point.latitude < box.south ||
              point.latitude > box.north,
          )
        )
          throw new RemoteDataFailure("UNAVAILABLE");
      }
      service.state = "READY";
      service.readyUntil = this.now() + 300000;
      service.retryUntil = 0;
      return remoteDataResponseSchema.parse({
        state: "RESULT",
        service: summary(service, this.now()),
        ...result,
        canComplete: false,
      });
    } catch (error) {
      const state = error instanceof RemoteDataFailure ? error.state : "UNAVAILABLE";
      const retryAfterSeconds = error instanceof RemoteDataFailure ? (error.retryAfterSeconds ?? 10) : 10;
      service.state = state;
      service.readyUntil = 0;
      service.retryUntil = this.now() + retryAfterSeconds * 1000;
      return { state, canComplete: false, retryAfterSeconds: Math.max(1, Math.min(60, retryAfterSeconds)) };
    } finally {
      service.inFlight = false;
    }
  }
}

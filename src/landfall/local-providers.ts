import { assertCoordinateInWorldspace, distance } from "@/landfall/geometry";
import { coordinateSchema, landfallId, type LandfallCoordinate, type LandfallRoute } from "@/landfall/schema";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export type LandfallPlace = Readonly<{ id: string; label: string; coordinate: LandfallCoordinate }>;
type ReleasedDomain = PlayerLandfallBootstrap["runtimeDefinition"];

/** Construct only from the authorized released bootstrap, never the full Creator definition. */
export class AuthoredGeocodingProvider {
  private readonly places: LandfallPlace[];
  constructor(private readonly domain: ReleasedDomain) {
    this.places = domain.waypoints.flatMap((waypoint) => {
      if (!["POINT_RADIUS", "APPROXIMATE_REGION"].includes(waypoint.geometry.type)) return [];
      const geometry = waypoint.geometry as Extract<typeof waypoint.geometry, { center: LandfallCoordinate }>;
      return [{ id: waypoint.id, label: waypoint.name, coordinate: geometry.center }];
    });
  }
  forward(input: {
    query: string;
    worldspaceId: string;
    proximity?: LandfallCoordinate;
    bounds?: { minX: number; minY: number; maxX: number; maxY: number };
    limit?: number;
  }): LandfallPlace[] {
    const world = this.requireWorld(input.worldspaceId);
    if (input.query.length > 240 || !input.query.trim()) return [];
    const query = input.query.trim().normalize("NFKC").toLocaleLowerCase();
    if (input.proximity) assertCoordinateInWorldspace(coordinateSchema.parse(input.proximity), world);
    const bounds = input.bounds;
    if (
      bounds &&
      (!Object.values(bounds).every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY)
    )
      throw new Error("LANDFALL_LOOKUP_BOUNDS_INVALID");
    const results = this.places.filter((place) => {
      if (
        place.coordinate.worldspaceId !== world.id ||
        !place.label.normalize("NFKC").toLocaleLowerCase().includes(query)
      )
        return false;
      if (!bounds) return true;
      const point = place.coordinate;
      const x = point.type === "WGS84" ? point.longitude : point.x;
      const y = point.type === "WGS84" ? point.latitude : point.y;
      return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    });
    results.sort((a, b) =>
      input.proximity
        ? distance(input.proximity, a.coordinate, world) - distance(input.proximity, b.coordinate, world) ||
          a.id.localeCompare(b.id)
        : a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
    );
    return structuredClone(results.slice(0, this.limit(input.limit)));
  }
  reverse(coordinate: LandfallCoordinate, maximumDistance: number, limit = 5): LandfallPlace[] {
    const point = coordinateSchema.parse(coordinate);
    const world = this.requireWorld(point.worldspaceId);
    assertCoordinateInWorldspace(point, world);
    if (!Number.isFinite(maximumDistance) || maximumDistance < 0 || maximumDistance > 100_000)
      throw new Error("LANDFALL_LOOKUP_DISTANCE_INVALID");
    return structuredClone(
      this.places
        .filter(
          (place) =>
            place.coordinate.worldspaceId === world.id && distance(point, place.coordinate, world) <= maximumDistance,
        )
        .sort(
          (a, b) =>
            distance(point, a.coordinate, world) - distance(point, b.coordinate, world) || a.id.localeCompare(b.id),
        )
        .slice(0, this.limit(limit)),
    );
  }
  private limit(value = 10) {
    if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("LANDFALL_LOOKUP_LIMIT_INVALID");
    return value;
  }
  private requireWorld(worldspaceId: string) {
    const world = this.domain.worldspaces.find((item) => item.id === worldspaceId);
    if (!world) throw new Error("LANDFALL_LOOKUP_WORLDSPACE_UNAVAILABLE");
    return world;
  }
}

export type LandfallRouteSuggestion = Readonly<{
  source: "AUTHORED" | "EXTERNAL";
  authoritative: false;
  route: LandfallRoute;
  accessibility: "DECLARED_LIMITED" | "NOT_ASSESSED";
  safety: "REVIEW_REQUIRED";
}>;
export class AuthoredRoutingProvider {
  constructor(private readonly domain: ReleasedDomain) {}
  routes(worldspaceId: string, mode?: LandfallRoute["travelMode"]): LandfallRouteSuggestion[] {
    if (!this.domain.worldspaces.some((world) => world.id === worldspaceId))
      throw new Error("LANDFALL_ROUTE_WORLDSPACE_UNAVAILABLE");
    const releasedIds = new Set(this.domain.waypoints.map((item) => item.id));
    return this.domain.routes
      .filter(
        (route) =>
          route.worldspaceId === worldspaceId &&
          (!mode || route.travelMode === mode) &&
          route.waypointIds.every((waypointId) => releasedIds.has(waypointId)),
      )
      .map((route) => ({
        source: "AUTHORED",
        authoritative: false,
        route: structuredClone(route),
        accessibility: this.domain.waypoints.some(
          (waypoint) => route.waypointIds.includes(waypoint.id) && waypoint.safety.accessibilityLimited,
        )
          ? "DECLARED_LIMITED"
          : "NOT_ASSESSED",
        safety: "REVIEW_REQUIRED",
      }));
  }
}

export class AuthoredElevationProvider {
  constructor(private readonly domain: ReleasedDomain) {}
  floor(regionId: string): { level: string | null; meters: null; uncertainty: "AUTHORED_LABEL_ONLY" } {
    const region = this.domain.context?.regions.find((item) => item.id === regionId);
    if (!region) throw new Error("LANDFALL_FLOOR_UNAVAILABLE");
    return { level: region.level ?? null, meters: null, uncertainty: "AUTHORED_LABEL_ONLY" };
  }
}

export type PackagedElevationSample = { coordinate: LandfallCoordinate; meters: number; accuracyMeters: number };
/** Licensed, integrity-verified local samples retain uncertainty; nearest sample never confirms a floor. */
export class PackagedElevationProvider {
  private readonly samples: PackagedElevationSample[];
  constructor(
    private readonly domain: ReleasedDomain,
    samples: readonly PackagedElevationSample[],
  ) {
    if (samples.length > 4096) throw new Error("LANDFALL_ELEVATION_LIMIT");
    this.samples = samples.map((sample) => {
      const coordinate = coordinateSchema.parse(sample.coordinate);
      const world = domain.worldspaces.find((item) => item.id === coordinate.worldspaceId);
      if (!world || world.kind !== "PHYSICAL") throw new Error("LANDFALL_ELEVATION_WORLDSPACE");
      assertCoordinateInWorldspace(coordinate, world);
      if (
        !Number.isFinite(sample.meters) ||
        sample.meters < -12000 ||
        sample.meters > 100000 ||
        !Number.isFinite(sample.accuracyMeters) ||
        sample.accuracyMeters <= 0 ||
        sample.accuracyMeters > 100000
      )
        throw new Error("LANDFALL_ELEVATION_INVALID");
      return { coordinate, meters: sample.meters, accuracyMeters: sample.accuracyMeters };
    });
  }
  lookup(coordinate: LandfallCoordinate, maximumDistanceMeters: number) {
    const point = coordinateSchema.parse(coordinate);
    const world = this.domain.worldspaces.find((item) => item.id === point.worldspaceId);
    if (
      !world ||
      world.kind !== "PHYSICAL" ||
      !Number.isFinite(maximumDistanceMeters) ||
      maximumDistanceMeters < 0 ||
      maximumDistanceMeters > 10000
    )
      throw new Error("LANDFALL_ELEVATION_QUERY_INVALID");
    assertCoordinateInWorldspace(point, world);
    const nearby = this.samples
      .filter((sample) => sample.coordinate.worldspaceId === world.id)
      .map((sample) => ({ sample, gap: distance(point, sample.coordinate, world) }))
      .filter((item) => item.gap <= maximumDistanceMeters)
      .sort((a, b) => a.gap - b.gap);
    if (!nearby.length) return { state: "UNAVAILABLE" as const };
    const { sample, gap } = nearby[0];
    return {
      state: "AVAILABLE" as const,
      meters: sample.meters,
      accuracyMeters: sample.accuracyMeters + gap,
      floorConfirmed: false as const,
    };
  }
}

/** A virtual manual position is deliberately labeled human input and never fabricated game telemetry. */
export function authoredVirtualPosition(
  domain: ReleasedDomain,
  input: { worldspaceId: string; coordinate: LandfallCoordinate; uncertaintyUnits: number },
) {
  const world = domain.worldspaces.find((item) => item.id === landfallId.parse(input.worldspaceId));
  if (!world || world.kind !== "VIRTUAL") throw new Error("LANDFALL_VIRTUAL_PROVIDER_WORLDSPACE");
  const coordinate = coordinateSchema.parse(input.coordinate);
  assertCoordinateInWorldspace(coordinate, world);
  if (!Number.isFinite(input.uncertaintyUnits) || input.uncertaintyUnits < 0 || input.uncertaintyUnits > 100000)
    throw new Error("LANDFALL_VIRTUAL_UNCERTAINTY_INVALID");
  return {
    coordinate,
    uncertaintyUnits: input.uncertaintyUnits,
    source: "PLAYER_CONFIRMATION" as const,
    automatic: false as const,
  };
}

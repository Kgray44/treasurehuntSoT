import { z } from "zod";
import {
  assertCoordinateInWorldspace,
  distance,
  geometryMatch,
  routeSegmentMatches,
  toWgs84,
} from "@/landfall/geometry";
import { observationSchema, validateObservationForWorldspace, type LandfallObservation } from "@/landfall/observation";
import { landfallId, type LandfallDefinition, type LandfallRegion } from "@/landfall/schema";

const common = {
  id: landfallId,
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  observedAt: z.string().datetime({ offset: true }),
};
export const contextualEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("HEADING"),
    degrees: z.number().finite().min(0).max(360),
    accuracyDegrees: z.number().finite().min(0).max(180),
  }),
  z.strictObject({ ...common, kind: z.literal("MOTION"), moving: z.boolean() }),
  z.strictObject({
    ...common,
    kind: z.literal("ELEVATION"),
    meters: z.number().finite().min(-12000).max(100000),
    accuracyMeters: z.number().finite().positive().max(100000),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("LANDMARK"),
    landmarkId: landfallId,
    regionId: landfallId,
    result: z.enum(["unavailable", "insufficient", "possible", "likely", "confirmed"]),
    frameCount: z.number().int().min(0).max(5),
  }),
  z.strictObject({ ...common, kind: z.literal("OBSERVATION"), regionId: landfallId }),
]);
export type ContextualEvidence = z.infer<typeof contextualEvidenceSchema>;
export type ContextualSnapshot = {
  state: "KNOWN" | "LIKELY" | "NEARBY" | "INFERRED" | "UNCERTAIN" | "UNAVAILABLE" | "CONFIRMED";
  regionId: string | null;
  mapId: string | null;
  level: string | null;
  reasons: string[];
  evidenceCategories: string[];
  eligibleLandmarkIds: string[];
  routeMatch: null | {
    routeId: string;
    segmentIndex: number;
    fraction: number;
    distance: number;
    direction: "FORWARD" | "BACKWARD" | "STATIONARY" | "UNKNOWN";
    ambiguous: boolean;
  };
  expiresAt: number | null;
  rejection?: string;
};
type PhysicalPosition = Extract<LandfallObservation, { kind: "PHYSICAL_POSITION" }>;
type RouteMemory = NonNullable<ContextualSnapshot["routeMatch"]> & { distanceAlong: number; observedAt: number };
const POSITION_AGE = 15_000,
  CONTINUITY_GRACE = 10_000,
  HINT_AGE = 10_000,
  INDEPENDENT_AGE = 30_000;
const broad = (region: LandfallRegion) => ["SITE", "BUILDING", "OUTDOOR_COMPACT"].includes(region.kind);
const empty = (): ContextualSnapshot => ({
  state: "UNAVAILABLE",
  regionId: null,
  mapId: null,
  level: null,
  reasons: ["No current regional evidence."],
  evidenceCategories: [],
  eligibleLandmarkIds: [],
  routeMatch: null,
  expiresAt: null,
});

/** Transient foreground guidance. These claims never write Voyage progression. */
export class ContextualLandfallEngine {
  private position: PhysicalPosition | null = null;
  private hints = new Map<ContextualEvidence["kind"], ContextualEvidence>();
  private seen: string[] = [];
  private clocks = new Map<string, number>();
  private worldspaceId: string | null = null;
  private regionId: string | null = null;
  private pendingRegion: string | null = null;
  private pendingCount = 0;
  private route: RouteMemory | null = null;
  private verticalTransitionAt = 0;
  private current = empty();
  constructor(
    private readonly definition: Pick<LandfallDefinition, "worldspaces" | "waypoints" | "routes" | "context">,
    private readonly identity: { sessionId: string; publishedVersionId: string },
  ) {}

  reset(): void {
    this.position = null;
    this.hints.clear();
    this.seen = [];
    this.clocks.clear();
    this.worldspaceId = null;
    this.regionId = null;
    this.pendingRegion = null;
    this.pendingCount = 0;
    this.route = null;
    this.verticalTransitionAt = 0;
    this.current = empty();
  }
  private reject(code: string, now: number): ContextualSnapshot {
    return { ...this.snapshot(now), rejection: code };
  }
  private identityCheck(
    input: { id: string; sessionId: string; publishedVersionId: string; worldspaceId: string; observedAt: string },
    now: number,
    key: string,
    maximumAge: number,
  ): string | null {
    if (!Number.isFinite(now)) return "INVALID";
    if (input.sessionId !== this.identity.sessionId) return "WRONG_SESSION";
    if (input.publishedVersionId !== this.identity.publishedVersionId) return "WRONG_VERSION";
    if (
      !this.definition.worldspaces.some((world) => world.id === input.worldspaceId) ||
      (this.worldspaceId && input.worldspaceId !== this.worldspaceId)
    )
      return "WRONG_WORLDSPACE";
    const at = Date.parse(input.observedAt);
    if (at > now + 1000) return "FUTURE";
    if (now - at > maximumAge) return "STALE";
    if (this.seen.includes(input.id)) return "DUPLICATE";
    if (at <= (this.clocks.get(key) ?? -Infinity)) return "OUT_OF_ORDER";
    return null;
  }
  private accept(input: { id: string; worldspaceId: string; observedAt: string }, key: string): void {
    this.worldspaceId = input.worldspaceId;
    this.seen.push(input.id);
    if (this.seen.length > 128) this.seen.shift();
    this.clocks.set(key, Date.parse(input.observedAt));
  }
  ingestPosition(input: PhysicalPosition, now: number): ContextualSnapshot {
    const parsed = observationSchema.safeParse(input);
    if (!parsed.success || parsed.data.kind !== "PHYSICAL_POSITION") return this.reject("INVALID", now);
    const position = parsed.data,
      world = this.definition.worldspaces.find((item) => item.id === position.worldspaceId);
    const rejection = this.identityCheck(position, now, "POSITION", POSITION_AGE);
    if (rejection) return this.reject(rejection, now);
    if (position.expiresAt && Date.parse(position.expiresAt) <= now) return this.reject("STALE", now);
    try {
      validateObservationForWorldspace(position, world!);
      assertCoordinateInWorldspace(position.coordinate, world!);
    } catch {
      return this.reject("POSITION_KIND_MISMATCH", now);
    }
    if (position.accuracyMeters > 100) return this.reject("WEAK_ACCURACY", now);
    if (this.position) {
      const elapsed = (Date.parse(position.observedAt) - Date.parse(this.position.observedAt)) / 1000;
      const travelled = distance(this.position.coordinate, position.coordinate, world!);
      if (travelled > 12 * elapsed + this.position.accuracyMeters + position.accuracyMeters)
        return this.reject("IMPOSSIBLE_SPEED", now);
    }
    this.accept(position, "POSITION");
    this.position = position;
    const hintIdentity = {
      sessionId: position.sessionId,
      publishedVersionId: position.publishedVersionId,
      worldspaceId: position.worldspaceId,
      observedAt: position.observedAt,
    };
    const normalized: ContextualEvidence[] = [];
    if (position.speedMetersPerSecond !== undefined)
      normalized.push({
        ...hintIdentity,
        id: `${position.id.slice(0, 110)}:motion`,
        kind: "MOTION",
        moving: position.speedMetersPerSecond >= 0.7,
      });
    if (position.headingDegrees !== undefined && (position.speedMetersPerSecond ?? 0) >= 1.5)
      normalized.push({
        ...hintIdentity,
        id: `${position.id.slice(0, 110)}:heading`,
        kind: "HEADING",
        degrees: position.headingDegrees,
        accuracyDegrees: 30,
      });
    if (position.altitudeMeters !== undefined && position.altitudeAccuracyMeters !== undefined)
      normalized.push({
        ...hintIdentity,
        id: `${position.id.slice(0, 110)}:elevation`,
        kind: "ELEVATION",
        meters: position.altitudeMeters,
        accuracyMeters: position.altitudeAccuracyMeters,
      });
    for (const hint of normalized) {
      if (Date.parse(hint.observedAt) <= (this.clocks.get(hint.kind) ?? -Infinity)) continue;
      if (hint.kind === "ELEVATION" && !this.qualifyElevation(hint)) continue;
      this.accept(hint, hint.kind);
      this.hints.set(hint.kind, hint);
    }
    this.recompute(now, true);
    return this.snapshot(now);
  }
  ingestEvidence(input: unknown, now: number): ContextualSnapshot {
    const parsed = contextualEvidenceSchema.safeParse(input);
    if (!parsed.success) return this.reject("INVALID", now);
    const evidence = parsed.data;
    const maximumAge = ["LANDMARK", "OBSERVATION"].includes(evidence.kind) ? INDEPENDENT_AGE : HINT_AGE;
    const rejection = this.identityCheck(evidence, now, evidence.kind, maximumAge);
    if (rejection) return this.reject(rejection, now);
    if (
      "regionId" in evidence &&
      !this.definition.context?.regions.some(
        (region) => region.id === evidence.regionId && region.worldspaceId === evidence.worldspaceId,
      )
    )
      return this.reject("UNKNOWN_REGION", now);
    if (evidence.kind === "LANDMARK") {
      const landmark = this.definition.context?.landmarks.find((item) => item.id === evidence.landmarkId);
      if (!landmark || landmark.regionId !== evidence.regionId) return this.reject("UNKNOWN_LANDMARK", now);
      if (!this.snapshot(now).eligibleLandmarkIds.includes(landmark.id))
        return this.reject("REGION_NOT_PLAUSIBLE", now);
      if (["likely", "confirmed"].includes(evidence.result) && evidence.frameCount < landmark.minimumFrames)
        return this.reject("INSUFFICIENT_FRAMES", now);
    }
    if (evidence.kind === "ELEVATION" && !this.qualifyElevation(evidence))
      return this.reject("IMPOSSIBLE_ELEVATION", now);
    this.accept(evidence, evidence.kind);
    this.hints.set(evidence.kind, evidence);
    this.recompute(now, false);
    return this.snapshot(now);
  }
  private ancestry(id: string): string[] {
    const ids: string[] = [];
    let region = this.definition.context?.regions.find((item) => item.id === id);
    while (region && !ids.includes(region.id)) {
      ids.push(region.id);
      region = this.definition.context?.regions.find((item) => item.id === region?.parentId);
    }
    return ids;
  }
  private qualifyElevation(evidence: Extract<ContextualEvidence, { kind: "ELEVATION" }>): boolean {
    const previous = this.hints.get("ELEVATION");
    if (previous?.kind !== "ELEVATION") return true;
    const delta = Math.abs(evidence.meters - previous.meters),
      uncertainty = evidence.accuracyMeters + previous.accuracyMeters;
    if (delta > 6 * ((Date.parse(evidence.observedAt) - Date.parse(previous.observedAt)) / 1000) + uncertainty)
      return false;
    if (evidence.accuracyMeters <= 3 && previous.accuracyMeters <= 3 && delta > uncertainty + 2)
      this.verticalTransitionAt = Date.parse(evidence.observedAt);
    return true;
  }
  private fresh(kind: ContextualEvidence["kind"], now: number): ContextualEvidence | null {
    const hint = this.hints.get(kind);
    if (!hint) return null;
    return now - Date.parse(hint.observedAt) <=
      (["LANDMARK", "OBSERVATION"].includes(kind) ? INDEPENDENT_AGE : HINT_AGE)
      ? hint
      : null;
  }
  private matchRegion(region: LandfallRegion): { inside: boolean; boundaryDistance: number } {
    const world = this.definition.worldspaces.find((item) => item.id === region.worldspaceId)!;
    if (region.geometry.type === "ENTRANCE_GATE") {
      const match = routeSegmentMatches(
        this.position!.coordinate,
        [region.geometry.start, region.geometry.end],
        world,
      )[0];
      return { inside: match.distance <= 1, boundaryDistance: match.distance };
    }
    return geometryMatch(this.position!.coordinate, region.geometry, world);
  }
  private plausible(region: LandfallRegion, now: number): boolean {
    const observation = this.fresh("OBSERVATION", now);
    if (observation?.kind === "OBSERVATION" && this.ancestry(observation.regionId).includes(region.id)) return true;
    if (!this.position || now - Date.parse(this.position.observedAt) > POSITION_AGE) return false;
    const world = this.definition.worldspaces.find((item) => item.id === region.worldspaceId);
    if (!world || world.id !== this.position.worldspaceId) return false;
    return this.ancestry(region.id).every((id) => {
      const ancestor = this.definition.context!.regions.find((item) => item.id === id)!;
      const match = this.matchRegion(ancestor);
      return (
        match.inside ||
        match.boundaryDistance <=
          this.position!.accuracyMeters + toWgs84(this.position!.coordinate, world).uncertaintyMeters
      );
    });
  }
  private recompute(now: number, newPosition: boolean): void {
    const regions = (this.definition.context?.regions ?? []).filter(
      (region) => region.worldspaceId === this.worldspaceId,
    );
    if (!regions.length) {
      this.current = empty();
      return;
    }
    if (newPosition) this.matchRoute(now);
    const categories: string[] = [...this.hints.keys()].filter((kind) => this.fresh(kind, now));
    if (this.position && now - Date.parse(this.position.observedAt) <= POSITION_AGE) categories.unshift("POSITION");
    const observation = this.fresh("OBSERVATION", now),
      landmarkEvidence = this.fresh("LANDMARK", now);
    const candidates = regions.filter((region) => this.plausible(region, now));
    const deepest = candidates.filter(
      (region) => !candidates.some((other) => other.id !== region.id && this.ancestry(other.id).includes(region.id)),
    );
    let region = deepest.length === 1 ? deepest[0] : undefined;
    let ambiguous = deepest.length > 1;
    if (!observation && this.route && !this.route.ambiguous) {
      const route = this.definition.routes.find((item) => item.id === this.route!.routeId);
      const segmentRegionId = route?.segmentRegionIds?.[this.route.segmentIndex];
      const segmentRegion = candidates.find((item) => item.id === segmentRegionId);
      if (
        segmentRegion &&
        (["FORWARD", "BACKWARD"].includes(this.route.direction) || this.regionId === segmentRegion.id)
      ) {
        region = segmentRegion;
        ambiguous = false;
      }
    }
    if (observation?.kind === "OBSERVATION") {
      region = regions.find((item) => item.id === observation.regionId);
      ambiguous = false;
    }
    if (ambiguous) {
      const commonId = this.ancestry(deepest[0].id).find((id) =>
        deepest.every((item) => this.ancestry(item.id).includes(id)),
      );
      region = regions.find((item) => item.id === commonId);
    }
    const previous = regions.find((item) => item.id === this.regionId);
    if (
      newPosition &&
      previous &&
      region &&
      previous.id !== region.id &&
      this.plausible(previous, now) &&
      !observation
    ) {
      if (this.pendingRegion === region.id) this.pendingCount++;
      else {
        this.pendingRegion = region.id;
        this.pendingCount = 1;
      }
      if (this.pendingCount < 2) {
        region = previous;
        ambiguous = true;
      }
    } else if (
      !newPosition &&
      previous &&
      this.pendingCount === 1 &&
      this.pendingRegion &&
      this.plausible(previous, now) &&
      !observation
    ) {
      region = previous;
      ambiguous = true;
    } else if (region?.id === this.regionId) {
      this.pendingRegion = null;
      this.pendingCount = 0;
    }
    this.regionId = region?.id ?? null;
    let state: ContextualSnapshot["state"] = region
      ? ambiguous
        ? "UNCERTAIN"
        : broad(region)
          ? "KNOWN"
          : "INFERRED"
      : candidates.length
        ? "UNCERTAIN"
        : "UNAVAILABLE";
    const reasons = ambiguous
      ? ["Regional footprints overlap; level or independent verification is needed."]
      : region
        ? [
            broad(region)
              ? "Position supports this broad region."
              : "Position supports a regional inference, not exact arrival.",
          ]
        : ["No current regional evidence."];
    if (region && observation?.kind === "OBSERVATION" && observation.regionId === region.id) {
      state = "CONFIRMED";
      reasons.splice(0, reasons.length, "Independent regional observation supports this region.");
    }
    if (
      region &&
      landmarkEvidence?.kind === "LANDMARK" &&
      this.plausible(regions.find((item) => item.id === landmarkEvidence.regionId)!, now)
    ) {
      if (["likely", "confirmed"].includes(landmarkEvidence.result)) {
        region = regions.find((item) => item.id === landmarkEvidence.regionId)!;
        state = landmarkEvidence.result === "confirmed" ? "CONFIRMED" : "LIKELY";
        reasons.splice(0, reasons.length, "Regional context and multiple landmark frames agree.");
      } else
        reasons.push(
          landmarkEvidence.result === "unavailable"
            ? "Landmark recognition unavailable; use the readable fallback."
            : "Landmark evidence is insufficient for confirmation.",
        );
    }
    const motion = this.fresh("MOTION", now),
      heading = this.fresh("HEADING", now);
    let headingAligned = false;
    if (this.route && this.position && heading?.kind === "HEADING" && heading.accuracyDegrees <= 30) {
      const route = this.definition.routes.find((item) => item.id === this.route!.routeId);
      if (route?.geometry && "points" in route.geometry) {
        const world = this.definition.worldspaces.find((item) => item.id === route.worldspaceId)!;
        const segment = routeSegmentMatches(this.position.coordinate, route.geometry.points, world)[
          this.route.segmentIndex
        ];
        const expected = (segment.bearing + (this.route.direction === "BACKWARD" ? 180 : 0)) % 360;
        headingAligned = Math.abs(((heading.degrees - expected + 540) % 360) - 180) <= heading.accuracyDegrees + 20;
      }
    }
    if (
      region &&
      state === "INFERRED" &&
      this.route &&
      !this.route.ambiguous &&
      ["FORWARD", "BACKWARD"].includes(this.route.direction) &&
      motion?.kind === "MOTION" &&
      motion.moving &&
      headingAligned
    ) {
      state = "LIKELY";
      reasons.push("Bounded foreground hints support continuity; exact context remains unverified.");
    }
    if (region && this.position && !observation && broad(region)) {
      const match = this.matchRegion(region);
      const world = this.definition.worldspaces.find((item) => item.id === region!.worldspaceId)!;
      if (
        !match.inside ||
        match.boundaryDistance <
          this.position.accuracyMeters + toWgs84(this.position.coordinate, world).uncertaintyMeters
      )
        state = "NEARBY";
    }
    if (
      region &&
      !broad(region) &&
      this.verticalTransitionAt &&
      now - this.verticalTransitionAt <= HINT_AGE &&
      (!observation || Date.parse(observation.observedAt) < this.verticalTransitionAt)
    ) {
      const ancestor = this.ancestry(region.id)
        .map((id) => regions.find((item) => item.id === id)!)
        .find(broad);
      region = ancestor;
      state = "UNCERTAIN";
      reasons.push("Elevation suggests a level transition; independent verification is needed for the floor.");
    }
    const eligibleLandmarkIds = (this.definition.context?.landmarks ?? [])
      .filter((item) => {
        const candidate = regions.find((value) => value.id === item.regionId);
        return !!candidate && this.plausible(candidate, now);
      })
      .map((item) => item.id);
    const deadlines = [...this.hints.keys()]
      .map((kind) => this.fresh(kind, now))
      .filter((item): item is ContextualEvidence => !!item)
      .map(
        (item) =>
          Date.parse(item.observedAt) + (["OBSERVATION", "LANDMARK"].includes(item.kind) ? INDEPENDENT_AGE : HINT_AGE),
      );
    if (this.position) deadlines.push(Date.parse(this.position.observedAt) + POSITION_AGE);
    const currentDeadlines = deadlines.filter((at) => at >= now);
    this.current = {
      state,
      regionId: region?.id ?? null,
      mapId: region?.mapId ?? null,
      level: region
        ? (this.ancestry(region.id)
            .map((id) => regions.find((item) => item.id === id)?.level)
            .find((level) => !!level) ?? null)
        : null,
      reasons,
      evidenceCategories: categories,
      eligibleLandmarkIds,
      routeMatch:
        this.route && this.position && now - Date.parse(this.position.observedAt) <= POSITION_AGE
          ? {
              routeId: this.route.routeId,
              segmentIndex: this.route.segmentIndex,
              fraction: this.route.fraction,
              distance: this.route.distance,
              direction: this.route.direction,
              ambiguous: this.route.ambiguous,
            }
          : null,
      expiresAt: currentDeadlines.length ? Math.min(...currentDeadlines) : null,
    };
  }
  private matchRoute(now: number): void {
    if (!this.position) return;
    const world = this.definition.worldspaces.find((item) => item.id === this.position!.worldspaceId)!;
    const uncertainty = this.position.accuracyMeters + toWgs84(this.position.coordinate, world).uncertaintyMeters;
    const previous = this.route && now - this.route.observedAt < POSITION_AGE ? this.route : null;
    const heading = this.fresh("HEADING", now);
    const matches = this.definition.routes
      .filter(
        (route) =>
          route.worldspaceId === world.id &&
          route.semantics === "NAVIGATIONAL" &&
          route.geometry &&
          ["ROUTE_LINE", "CORRIDOR"].includes(route.geometry.type),
      )
      .flatMap((route) => {
        if (!route.geometry || !("points" in route.geometry)) return [];
        const segments = routeSegmentMatches(this.position!.coordinate, route.geometry.points, world);
        const totalDistance = segments.reduce((sum, segment) => sum + segment.length, 0);
        const looping =
          route.model === "LOOP" && distance(route.geometry.points[0], route.geometry.points.at(-1)!, world) <= 1;
        return segments
          .filter(
            (match) =>
              match.distance <=
              route.offRouteTolerance +
                (route.geometry?.type === "CORRIDOR" ? route.geometry.width / 2 : 0) +
                uncertainty,
          )
          .map((match) => {
            let score = match.distance;
            const segmentDelta = previous ? Math.abs(match.segmentIndex - previous.segmentIndex) : 0;
            const adjacent = segmentDelta <= 1 || (looping && segmentDelta === segments.length - 1);
            let change = previous?.routeId === route.id ? match.distanceAlong - previous.distanceAlong : null;
            if (looping && change !== null && Math.abs(change) > totalDistance / 2)
              change += change > 0 ? -totalDistance : totalDistance;
            if (previous && (route.id !== previous.routeId || !adjacent)) score += uncertainty + 8;
            if (
              previous &&
              route.id === previous.routeId &&
              Math.abs(change ?? 0) > 12 * ((now - previous.observedAt) / 1000) + uncertainty * 2
            )
              score += 1000;
            if (heading?.kind === "HEADING" && heading.accuracyDegrees <= 30) {
              const delta = Math.abs(((match.bearing - heading.degrees + 540) % 360) - 180);
              score += Math.min(delta, 180 - delta) / 15;
            }
            return { ...match, routeId: route.id, score, change, looping, segmentCount: segments.length };
          });
      })
      .sort((a, b) => a.score - b.score || a.routeId.localeCompare(b.routeId) || a.segmentIndex - b.segmentIndex);
    const best = matches[0];
    if (!best || best.score >= 1000) {
      this.route = null;
      return;
    }
    const ambiguous = matches.some(
      (other, index) =>
        index > 0 &&
        (other.routeId !== best.routeId ||
          (Math.abs(other.segmentIndex - best.segmentIndex) > 1 &&
            !(best.looping && Math.abs(other.segmentIndex - best.segmentIndex) === best.segmentCount - 1))) &&
        Math.abs(other.distance - best.distance) <= uncertainty,
    );
    const change = best.change;
    this.route = {
      routeId: best.routeId,
      segmentIndex: best.segmentIndex,
      fraction: best.fraction,
      distance: best.distance,
      distanceAlong: best.distanceAlong,
      observedAt: now,
      ambiguous,
      direction:
        change === null
          ? "UNKNOWN"
          : Math.abs(change) <= Math.max(1, uncertainty / 2)
            ? "STATIONARY"
            : change > 0
              ? "FORWARD"
              : "BACKWARD",
    };
  }
  snapshot(now: number): ContextualSnapshot {
    const latestIndependent = Math.max(
      ...["LANDMARK", "OBSERVATION"].map((kind) => {
        const hint = this.fresh(kind as ContextualEvidence["kind"], now);
        return hint ? Date.parse(hint.observedAt) + INDEPENDENT_AGE : 0;
      }),
    );
    const positionExpiry = this.position ? Date.parse(this.position.observedAt) + POSITION_AGE : 0;
    if (latestIndependent <= now && positionExpiry < now) {
      if (positionExpiry && now <= positionExpiry + CONTINUITY_GRACE && this.current.regionId)
        return {
          ...structuredClone(this.current),
          state: "UNCERTAIN",
          reasons: ["Position expired; brief continuity grace requires a fresh fix."],
          evidenceCategories: [],
          eligibleLandmarkIds: [],
          routeMatch: null,
          expiresAt: positionExpiry + CONTINUITY_GRACE,
        };
      return empty();
    }
    this.recompute(now, false);
    return structuredClone(this.current);
  }
}

import {
  crossesGate,
  distance,
  geometryMatch,
  LandfallGeometryError,
  routeProgress,
  toWgs84,
} from "@/landfall/geometry";
import {
  observationSchema,
  sanitizeObservation,
  validateObservationForWorldspace,
  type LandfallObservation,
  type ObservationRejection,
  type LandfallProviderRegistry,
} from "@/landfall/observation";
import type {
  LandfallCoordinate,
  LandfallDefinition,
  LandfallRoute,
  LandfallTransition,
  LandfallWaypoint,
  LandfallWorldspace,
} from "@/landfall/schema";
import { createLandfallCompletionRequest, type LandfallCompletionRequest } from "@/landfall/progression-boundary";

export type LandfallConfidence = "UNAVAILABLE" | "WEAK" | "OUTSIDE" | "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED";
export type LandfallSyncState = "LOCAL_OBSERVED" | "QUEUED" | "SERVER_CONFIRMED" | "REJECTED";
export type LandfallFailure =
  | "PERMISSION_DENIED"
  | "LOCATION_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "WEAK_ACCURACY"
  | "STALE_EVIDENCE"
  | "ROUTE_MISMATCH"
  | "TRANSFORM_FAILED"
  | "OFFLINE"
  | "SERVER_REJECTED"
  | "DESTINATION_ASSETS_UNAVAILABLE";
export type LandfallOutcome = Readonly<{
  confidence: LandfallConfidence;
  rejection?: ObservationRejection;
  failure?: LandfallFailure;
  observationId?: string;
  targetId?: string;
  sync: LandfallSyncState | null;
  retryable: boolean;
}>;
export type JourneySegment = Readonly<{
  id: string;
  worldspaceId: string;
  kind: "VISIT" | "ROUTE" | "TRANSITION";
  targetId: string;
  confirmedAt: string;
  fromWorldspaceId?: string;
}>;
export type LandfallExactLocationConsent = Readonly<{
  sessionId: string;
  purpose: "LIVE_CAPTAIN_VIEW";
  grantedAt: number;
  expiresAt: number;
  revokedAt?: number;
}>;
export type LandfallCanonicalReceipt = Readonly<{
  sessionId: string;
  evidenceId: string;
  publishedVersionId: string;
  waypointId: string;
  status: "CONFIRMED" | "REJECTED";
  confirmedAt: string;
  canonicalEventId?: string;
  canonicalSequence?: number;
}>;
type QualifiedFix = { id: string; observedAt: number; coordinate: LandfallCoordinate; accuracy: number };
type PendingEvidence = {
  id: string;
  waypointId: string;
  worldspaceId: string;
  publishedVersionId: string;
  observedAt: string;
  source: LandfallObservation["source"];
  state: LandfallSyncState;
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
function stabilizedCoordinate(fixes: QualifiedFix[]): LandfallCoordinate {
  const recent = fixes.slice(-5).map((fix) => fix.coordinate);
  const latest = recent.at(-1)!;
  if (latest.type === "WGS84") {
    const geographic = recent.filter(
      (item): item is Extract<LandfallCoordinate, { type: "WGS84" }> => item.type === "WGS84",
    );
    const origin = geographic[0].longitude;
    const longitude = median(geographic.map((item) => origin + (((item.longitude - origin + 540) % 360) - 180)));
    return {
      ...latest,
      latitude: median(geographic.map((item) => item.latitude)),
      longitude: ((longitude + 540) % 360) - 180,
    };
  }
  const planar = recent.filter((item) => item.type === latest.type) as Extract<
    LandfallCoordinate,
    { x: number; y: number }
  >[];
  return { ...latest, x: median(planar.map((item) => item.x)), y: median(planar.map((item) => item.y)) };
}

export class LandfallRuntime {
  readonly sessionId: string;
  readonly publishedVersionId: string;
  private readonly worldspaces: Map<string, LandfallWorldspace>;
  private readonly waypoints: Map<string, LandfallWaypoint>;
  private readonly routes: Map<string, LandfallRoute>;
  private readonly transitions: LandfallTransition[];
  private fixes: QualifiedFix[] = [];
  private seenObservationIds: string[] = [];
  private pending = new Map<string, PendingEvidence>();
  private journey: JourneySegment[] = [];
  private visited = new Set<string>();
  private discovered = new Set<string>();
  private canonicalSequence = 0;
  private lastObservationAt = 0;
  private consecutive = 0;
  private dwellStart: number | null = null;
  private lastStableAt = 0;
  private lastStableCoordinate: LandfallCoordinate | null = null;
  private lastSafeOutcome: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  private currentOutcome: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  activeWorldspaceId: string;
  activeWaypointId: string | null = null;
  activeRouteId: string | null = null;
  permissionState: "PROMPT" | "GRANTED" | "DENIED" | "UNAVAILABLE" = "PROMPT";
  trackingState: "IDLE" | "ACQUIRING" | "TRACKING" | "PAUSED" | "FAILED" = "IDLE";
  offlineState: "ONLINE" | "OFFLINE_READY" | "OFFLINE_PARTIAL" | "OFFLINE_UNAVAILABLE" = "ONLINE";
  routeFraction: number | null = null;

  constructor(
    definition: Pick<LandfallDefinition, "worldspaces" | "waypoints" | "routes" | "transitions">,
    identity: { sessionId: string; publishedVersionId: string },
    private readonly providers: LandfallProviderRegistry,
  ) {
    this.sessionId = identity.sessionId;
    this.publishedVersionId = identity.publishedVersionId;
    this.worldspaces = new Map(definition.worldspaces.map((item) => [item.id, item]));
    this.waypoints = new Map(definition.waypoints.map((item) => [item.id, item]));
    this.routes = new Map(definition.routes.map((item) => [item.id, item]));
    this.transitions = definition.transitions;
    this.activeWorldspaceId = definition.worldspaces[0].id;
  }

  setActiveWaypoint(id: string | null): void {
    if (id && this.waypoints.get(id)?.worldspaceId !== this.activeWorldspaceId)
      throw new Error("LANDFALL_WRONG_WORLDSPACE");
    this.activeWaypointId = id;
    this.resetEvidence();
  }
  setActiveRoute(id: string | null): void {
    if (id && this.routes.get(id)?.worldspaceId !== this.activeWorldspaceId)
      throw new Error("LANDFALL_WRONG_WORLDSPACE");
    this.activeRouteId = id;
    this.routeFraction = null;
  }
  pause(): void {
    this.trackingState = "PAUSED";
    this.resetEvidence();
  }
  resume(): void {
    this.trackingState = "ACQUIRING";
    this.resetEvidence();
  }
  setPermission(state: typeof this.permissionState): void {
    this.permissionState = state;
    if (state === "DENIED" || state === "UNAVAILABLE") {
      this.trackingState = "FAILED";
      this.resetEvidence();
    }
  }
  setOffline(state: typeof this.offlineState): void {
    this.offlineState = state;
  }
  private resetEvidence(): void {
    this.fixes = [];
    this.consecutive = 0;
    this.dwellStart = null;
    this.lastStableAt = 0;
    this.lastStableCoordinate = null;
    this.lastSafeOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
    this.currentOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  }
  private reject(rejection: ObservationRejection, now: number, failure?: LandfallFailure): LandfallOutcome {
    const result: LandfallOutcome = {
      confidence:
        this.lastStableAt && now - this.lastStableAt < 10_000 ? this.lastSafeOutcome.confidence : "UNAVAILABLE",
      rejection,
      failure,
      sync: null,
      retryable: !["WRONG_SESSION", "WRONG_VERSION", "WRONG_WORLDSPACE"].includes(rejection),
    };
    this.currentOutcome = result;
    return result;
  }

  ingest(input: unknown, now: number): LandfallOutcome {
    if (this.trackingState === "PAUSED") return this.reject("PAUSED", now);
    const parsed = observationSchema.safeParse(input);
    if (!parsed.success) return this.reject("INVALID", now);
    const observation = parsed.data;
    if (
      observation.kind === "PHYSICAL_POSITION" &&
      (this.permissionState === "DENIED" || this.permissionState === "UNAVAILABLE")
    )
      return this.reject(
        "PERMISSION_UNAVAILABLE",
        now,
        this.permissionState === "DENIED" ? "PERMISSION_DENIED" : "LOCATION_UNAVAILABLE",
      );
    if (observation.sessionId !== this.sessionId) return this.reject("WRONG_SESSION", now);
    if (observation.publishedVersionId !== this.publishedVersionId) return this.reject("WRONG_VERSION", now);
    if (observation.worldspaceId !== this.activeWorldspaceId) return this.reject("WRONG_WORLDSPACE", now);
    const worldspace = this.worldspaces.get(this.activeWorldspaceId);
    if (!worldspace) return this.reject("WRONG_WORLDSPACE", now);
    if (!worldspace.observationPolicy.allowedSources.includes(observation.source))
      return this.reject("SOURCE_NOT_ALLOWED", now);
    if (!this.providers.supports(observation.providerId, observation.source, worldspace.kind))
      return this.reject("UNAVAILABLE_PROVIDER", now, "PROVIDER_UNAVAILABLE");
    try {
      validateObservationForWorldspace(observation, worldspace);
    } catch {
      return this.reject("POSITION_KIND_MISMATCH", now);
    }
    const waypoint = this.activeWaypointId ? this.waypoints.get(this.activeWaypointId) : null;
    if (!waypoint) return { confidence: "UNAVAILABLE", sync: null, retryable: true };
    if (!waypoint.evidenceProfile.acceptedSources.includes(observation.source))
      return this.reject("SOURCE_NOT_ALLOWED", now);
    const observedAt = Date.parse(observation.observedAt);
    if (observedAt > now + 5_000) return this.reject("FUTURE", now);
    if (
      now - observedAt > waypoint.evidenceProfile.maximumAgeSeconds * 1000 ||
      (observation.expiresAt && Date.parse(observation.expiresAt) < now)
    )
      return this.reject("STALE", now, "STALE_EVIDENCE");
    if (this.seenObservationIds.includes(observation.id)) return this.reject("DUPLICATE", now);
    if (observedAt <= this.lastObservationAt) return this.reject("OUT_OF_ORDER", now);
    if (this.lastObservationAt && observedAt - this.lastObservationAt < 250) return this.reject("TOO_FREQUENT", now);
    this.seenObservationIds.push(observation.id);
    if (this.seenObservationIds.length > 64) this.seenObservationIds.shift();
    this.lastObservationAt = observedAt;
    this.trackingState = "TRACKING";
    let outcome: LandfallOutcome;
    try {
      outcome =
        observation.kind === "SEMANTIC_LOCATION"
          ? this.evaluateSemantic(observation, waypoint, worldspace, now)
          : this.evaluatePosition(observation, waypoint, worldspace, now);
    } catch (cause) {
      return this.reject(
        "INVALID",
        now,
        cause instanceof LandfallGeometryError && cause.code === "TRANSFORM_FAILED" ? "TRANSFORM_FAILED" : undefined,
      );
    }
    const qualifiedOutcome =
      outcome.confidence === "CONFIRMED" && this.offlineState === "OFFLINE_UNAVAILABLE"
        ? { ...outcome, sync: null, failure: "OFFLINE" as const }
        : outcome;
    this.currentOutcome = qualifiedOutcome;
    if (
      qualifiedOutcome.confidence === "CONFIRMED" &&
      qualifiedOutcome.failure !== "OFFLINE" &&
      waypoint.completion.mode === "OBSERVED"
    ) {
      this.pending.set(observation.id, {
        id: observation.id,
        waypointId: waypoint.id,
        worldspaceId: worldspace.id,
        publishedVersionId: this.publishedVersionId,
        observedAt: observation.observedAt,
        source: observation.source,
        state: this.offlineState === "ONLINE" ? "LOCAL_OBSERVED" : "QUEUED",
      });
      while (this.pending.size > 64) this.pending.delete(this.pending.keys().next().value!);
    }
    if (["LIKELY_INSIDE", "CONFIRMED"].includes(qualifiedOutcome.confidence)) {
      this.lastStableAt = now;
      this.lastSafeOutcome = qualifiedOutcome;
    }
    return qualifiedOutcome;
  }

  private evaluatePosition(
    observation: Extract<LandfallObservation, { kind: "PHYSICAL_POSITION" | "VIRTUAL_POSITION" }>,
    waypoint: LandfallWaypoint,
    worldspace: LandfallWorldspace,
    now: number,
  ): LandfallOutcome {
    const physical = observation.kind === "PHYSICAL_POSITION";
    if (!physical && observation.confidence < 0.8) {
      this.consecutive = 0;
      this.dwellStart = null;
      return { confidence: "WEAK", observationId: observation.id, targetId: waypoint.id, sync: null, retryable: true };
    }
    const uncertainty = physical ? observation.accuracyMeters : observation.uncertaintyUnits;
    if (physical && uncertainty > (waypoint.evidenceProfile.requiredAccuracyMeters ?? 50)) {
      this.consecutive = 0;
      this.dwellStart = null;
      return {
        confidence: "WEAK",
        failure: "WEAK_ACCURACY",
        observationId: observation.id,
        targetId: waypoint.id,
        sync: null,
        retryable: true,
      };
    }
    const previous = this.fixes.at(-1);
    if (previous && physical) {
      const seconds = (Date.parse(observation.observedAt) - previous.observedAt) / 1000;
      if (
        seconds > 0 &&
        distance(previous.coordinate, observation.coordinate, worldspace) / seconds >
          (waypoint.evidenceProfile.maximumSpeedMetersPerSecond ?? 45)
      )
        return this.reject("IMPOSSIBLE_SPEED", now);
    }
    this.fixes.push({
      id: observation.id,
      observedAt: Date.parse(observation.observedAt),
      coordinate: observation.coordinate,
      accuracy: uncertainty,
    });
    if (this.fixes.length > 12) this.fixes.shift();
    const stableCoordinate = stabilizedCoordinate(this.fixes);
    if (this.activeRouteId) {
      const route = this.routes.get(this.activeRouteId);
      if (route?.geometry && (route.geometry.type === "ROUTE_LINE" || route.geometry.type === "CORRIDOR")) {
        const progress = routeProgress(stableCoordinate, route.geometry.points, worldspace);
        this.routeFraction = progress.fraction;
        if (route.semantics === "NAVIGATIONAL" && progress.offRouteDistance > route.offRouteTolerance + uncertainty) {
          this.consecutive = 0;
          this.dwellStart = null;
          return {
            confidence: "OUTSIDE",
            failure: "ROUTE_MISMATCH",
            observationId: observation.id,
            targetId: waypoint.id,
            sync: null,
            retryable: true,
          };
        }
      }
    }
    let match: { inside: boolean; boundaryDistance: number };
    if (waypoint.geometry.type === "ENTRANCE_GATE") {
      match = {
        inside: !!previous && crossesGate(previous.coordinate, observation.coordinate, waypoint.geometry, worldspace),
        boundaryDistance: 0,
      };
    } else match = geometryMatch(stableCoordinate, waypoint.geometry, worldspace);
    const transformUncertainty = physical ? toWgs84(observation.coordinate, worldspace).uncertaintyMeters : 0;
    const totalUncertainty = uncertainty + transformUncertainty;
    if (!match.inside) {
      this.consecutive = 0;
      this.dwellStart = null;
      return {
        confidence:
          match.boundaryDistance <= totalUncertainty + waypoint.evidenceProfile.exitHysteresis ? "NEARBY" : "OUTSIDE",
        observationId: observation.id,
        targetId: waypoint.id,
        sync: null,
        retryable: true,
      };
    }
    if (
      match.boundaryDistance < totalUncertainty + waypoint.evidenceProfile.enterHysteresis &&
      waypoint.geometry.type !== "ENTRANCE_GATE"
    ) {
      this.consecutive = 0;
      this.dwellStart = null;
      return {
        confidence: "LIKELY_INSIDE",
        observationId: observation.id,
        targetId: waypoint.id,
        sync: null,
        retryable: true,
      };
    }
    this.consecutive++;
    this.dwellStart ??= now;
    this.lastStableCoordinate = stableCoordinate;
    const samplesNeeded = Math.max(
      physical ? 2 : 1,
      waypoint.evidenceProfile.requiredSamples,
      waypoint.evidenceProfile.minimumCorroboration,
    );
    const confirmed =
      this.consecutive >= samplesNeeded && now - this.dwellStart >= waypoint.evidenceProfile.dwellSeconds * 1000;
    return {
      confidence: confirmed ? "CONFIRMED" : "LIKELY_INSIDE",
      observationId: observation.id,
      targetId: waypoint.id,
      sync: confirmed ? (this.offlineState === "ONLINE" ? "LOCAL_OBSERVED" : "QUEUED") : null,
      retryable: true,
    };
  }

  private evaluateSemantic(
    observation: Extract<LandfallObservation, { kind: "SEMANTIC_LOCATION" }>,
    waypoint: LandfallWaypoint,
    _worldspace: LandfallWorldspace,
    now: number,
  ): LandfallOutcome {
    if (observation.targetLocationId !== waypoint.id || observation.assertion === "ABSENT") {
      this.consecutive = 0;
      this.dwellStart = null;
      return {
        confidence: "OUTSIDE",
        observationId: observation.id,
        targetId: waypoint.id,
        sync: null,
        retryable: true,
      };
    }
    if (observation.assertion === "UNCERTAIN" || observation.confidence < 0.8)
      return { confidence: "WEAK", observationId: observation.id, targetId: waypoint.id, sync: null, retryable: true };
    if (observation.source === "STORY_PROGRESSION")
      return {
        confidence: "LIKELY_INSIDE",
        observationId: observation.id,
        targetId: waypoint.id,
        sync: null,
        retryable: true,
      };
    this.consecutive++;
    this.dwellStart ??= now;
    const confirmed =
      this.consecutive >=
        Math.max(waypoint.evidenceProfile.requiredSamples, waypoint.evidenceProfile.minimumCorroboration) &&
      now - this.dwellStart >= waypoint.evidenceProfile.dwellSeconds * 1000;
    return {
      confidence: confirmed ? "CONFIRMED" : "LIKELY_INSIDE",
      observationId: observation.id,
      targetId: waypoint.id,
      sync: confirmed ? (this.offlineState === "ONLINE" ? "LOCAL_OBSERVED" : "QUEUED") : null,
      retryable: true,
    };
  }

  completionRequest(
    observationId: string,
    expectedSequence: number,
    idempotencyKey: string,
  ): LandfallCompletionRequest {
    const evidence = this.pending.get(observationId);
    if (!evidence || evidence.state === "REJECTED") throw new Error("LANDFALL_EVIDENCE_UNAVAILABLE");
    const waypoint = this.waypoints.get(evidence.waypointId)!;
    if (waypoint.completion.mode !== "OBSERVED") throw new Error("LANDFALL_STORY_ORDER_OWNED_BY_ONE_VOYAGE");
    if (waypoint.expiresAt && Date.parse(waypoint.expiresAt) <= Date.parse(evidence.observedAt))
      throw new Error("LANDFALL_WAYPOINT_EXPIRED");
    if (!waypoint.sequence.afterWaypointIds.every((id) => this.visited.has(id)))
      throw new Error("LANDFALL_PREREQUISITE_UNMET");
    return createLandfallCompletionRequest({
      schemaVersion: 1,
      sessionId: this.sessionId,
      publishedVersionId: this.publishedVersionId,
      worldspaceId: evidence.worldspaceId,
      waypointId: evidence.waypointId,
      evidenceId: evidence.id,
      expectedSequence,
      idempotencyKey,
      method: evidence.source,
      outcome: "CONFIRMED",
      observedAt: evidence.observedAt,
    });
  }
  markQueued(observationId: string): void {
    const evidence = this.pending.get(observationId);
    if (evidence && evidence.state !== "SERVER_CONFIRMED") evidence.state = "QUEUED";
  }
  reconcile(observationId: string, receipt: LandfallCanonicalReceipt): LandfallSyncState {
    const evidence = this.pending.get(observationId);
    if (
      !evidence ||
      receipt.sessionId !== this.sessionId ||
      receipt.evidenceId !== observationId ||
      receipt.publishedVersionId !== this.publishedVersionId ||
      receipt.waypointId !== evidence.waypointId
    )
      throw new Error("LANDFALL_RECONCILIATION_MISMATCH");
    if (evidence.state === "SERVER_CONFIRMED" || evidence.state === "REJECTED") return evidence.state;
    if (
      receipt.status === "CONFIRMED" &&
      (!receipt.canonicalEventId ||
        !Number.isSafeInteger(receipt.canonicalSequence) ||
        receipt.canonicalSequence! <= this.canonicalSequence ||
        Date.parse(receipt.confirmedAt) < Date.parse(evidence.observedAt))
    )
      throw new Error("LANDFALL_STALE_RECONCILIATION");
    evidence.state = receipt.status === "CONFIRMED" ? "SERVER_CONFIRMED" : "REJECTED";
    if (evidence.state === "SERVER_CONFIRMED") this.canonicalSequence = receipt.canonicalSequence!;
    if (evidence.state === "SERVER_CONFIRMED" && !this.visited.has(evidence.waypointId)) {
      this.visited.add(evidence.waypointId);
      this.discovered.add(evidence.waypointId);
      this.journey.push({
        id: receipt.canonicalEventId!,
        worldspaceId: evidence.worldspaceId,
        kind: "VISIT",
        targetId: evidence.waypointId,
        confirmedAt: receipt.confirmedAt,
      });
      if (this.journey.length > 256) this.journey.shift();
    }
    return evidence.state;
  }
  transition(toWorldspaceId: string, eventId: string, confirmedAt: string, destinationReady: boolean): void {
    if (!destinationReady) throw new Error("LANDFALL_DESTINATION_ASSETS_UNAVAILABLE");
    if (
      !this.worldspaces.has(toWorldspaceId) ||
      !this.transitions.some(
        (item) => item.fromWorldspaceId === this.activeWorldspaceId && item.toWorldspaceId === toWorldspaceId,
      )
    )
      throw new Error("LANDFALL_INVALID_TRANSITION");
    if (this.journey.some((item) => item.id === eventId)) return;
    const fromWorldspaceId = this.activeWorldspaceId;
    this.activeWorldspaceId = toWorldspaceId;
    this.activeWaypointId = null;
    this.activeRouteId = null;
    this.routeFraction = null;
    this.resetEvidence();
    this.lastStableCoordinate = null;
    this.journey.push({
      id: eventId,
      worldspaceId: toWorldspaceId,
      fromWorldspaceId,
      kind: "TRANSITION",
      targetId: toWorldspaceId,
      confirmedAt,
    });
    if (this.journey.length > 256) this.journey.shift();
  }
  projection(
    audience: "PLAYER" | "CAPTAIN" | "CREATOR_TEST" | "REPLAY" | "PUBLIC",
    now: number,
    exactLocationConsent?: LandfallExactLocationConsent,
  ) {
    const worldspace = this.worldspaces.get(this.activeWorldspaceId)!;
    const exactAllowed =
      audience === "PLAYER" ||
      audience === "CREATOR_TEST" ||
      (audience === "CAPTAIN" &&
        exactLocationConsent?.sessionId === this.sessionId &&
        exactLocationConsent.purpose === "LIVE_CAPTAIN_VIEW" &&
        exactLocationConsent.grantedAt <= now &&
        exactLocationConsent.expiresAt > now &&
        (exactLocationConsent.revokedAt === undefined || exactLocationConsent.revokedAt > now));
    const publicSafe = audience === "PUBLIC";
    const publicWorldspace =
      ["FICTIONAL", "PUBLIC_REAL_WORLD"].includes(worldspace.privacyPolicy.classification) &&
      worldspace.privacyPolicy.allowPublicGeometry;
    const redactWorldspace = publicSafe && !publicWorldspace;
    const visible = [...this.waypoints.values()].filter(
      (waypoint) =>
        waypoint.worldspaceId === worldspace.id &&
        (!waypoint.visibility.hiddenUntilRevealed || (!publicSafe && this.discovered.has(waypoint.id))) &&
        (!publicSafe ||
          (publicWorldspace &&
            (waypoint.privacyClassification === "FICTIONAL" ||
              waypoint.privacyClassification === "PUBLIC_REAL_WORLD"))),
    );
    const activeRoute = this.activeRouteId ? this.routes.get(this.activeRouteId) : null;
    const visibleRouteId =
      activeRoute &&
      (!publicSafe || ["FICTIONAL", "PUBLIC_REAL_WORLD"].includes(activeRoute.privacyClassification)) &&
      (activeRoute.model !== "HIDDEN" || activeRoute.waypointIds.every((id) => this.discovered.has(id))) &&
      activeRoute.waypointIds.every((id) => visible.some((waypoint) => waypoint.id === id))
        ? activeRoute.id
        : null;
    const currentContext =
      this.lastStableCoordinate && exactAllowed && this.lastStableAt && now - this.lastStableAt < 10_000
        ? { kind: "EXACT" as const, coordinate: this.lastStableCoordinate }
        : this.activeWaypointId &&
            this.visited.has(this.activeWaypointId) &&
            visible.some((item) => item.id === this.activeWaypointId)
          ? { kind: "NAMED_LOCATION" as const, locationId: this.activeWaypointId }
          : this.lastStableCoordinate && this.lastStableAt && now - this.lastStableAt < 10_000
            ? { kind: "LAST_KNOWN" as const }
            : { kind: "UNAVAILABLE" as const };
    return {
      audience,
      sessionId: publicSafe ? undefined : this.sessionId,
      activeWorldspaceId: redactWorldspace ? "private-worldspace" : worldspace.id,
      worldspaceKind: worldspace.kind,
      activeWaypointId:
        !publicSafe && visible.some((item) => item.id === this.activeWaypointId) ? this.activeWaypointId : null,
      activeRouteId: publicSafe ? null : visibleRouteId,
      currentContext: publicSafe ? { kind: "UNAVAILABLE" as const } : currentContext,
      confidence: publicSafe ? ("UNAVAILABLE" as const) : this.currentOutcome.confidence,
      visitedLocationIds: publicSafe
        ? []
        : [...this.visited].filter((id) => visible.some((waypoint) => waypoint.id === id)),
      discoveredLocationIds: publicSafe
        ? []
        : [...this.discovered].filter((id) => visible.some((waypoint) => waypoint.id === id)),
      availableLocations: visible.map((waypoint) => ({
        id: waypoint.id,
        name: waypoint.visibility.publicLabel ?? waypoint.name,
        type: waypoint.type,
      })),
      journeyPath: publicSafe ? [] : this.journey,
      routeProgress: publicSafe ? null : visibleRouteId ? this.routeFraction : null,
      offlineState: this.offlineState,
      pendingEvidence:
        publicSafe || audience === "REPLAY"
          ? []
          : [...this.pending.values()].map(({ id, waypointId, state }) => ({ id, waypointId, state })),
    };
  }
  /** Foreground Player-only fix. Never persist or include it in a server/public projection. */
  currentPosition(
    now: number,
  ): Readonly<{ coordinate: LandfallCoordinate; accuracy: number; observedAt: number }> | null {
    const latest = this.fixes.at(-1);
    const waypoint = this.activeWaypointId ? this.waypoints.get(this.activeWaypointId) : null;
    if (
      !latest ||
      !waypoint ||
      this.trackingState !== "TRACKING" ||
      Boolean(this.currentOutcome.rejection) ||
      this.currentOutcome.failure === "WEAK_ACCURACY" ||
      now - latest.observedAt > Math.min(10_000, waypoint.evidenceProfile.maximumAgeSeconds * 1000)
    )
      return null;
    return { coordinate: { ...latest.coordinate }, accuracy: latest.accuracy, observedAt: latest.observedAt };
  }
  diagnostics() {
    return {
      sessionId: this.sessionId,
      activeWorldspaceId: this.activeWorldspaceId,
      fixCount: this.fixes.length,
      seenCount: this.seenObservationIds.length,
      pendingCount: this.pending.size,
      journeyCount: this.journey.length,
      lastOutcome: this.currentOutcome.confidence,
    };
  }
  safeObservationReceipt(observation: LandfallObservation) {
    return sanitizeObservation(observation);
  }
}

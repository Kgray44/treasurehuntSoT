import { projectLandfallJourney, type LandfallJourneyProjection } from "@/landfall/journey-projection";
import { LandfallProviderRegistry, type LandfallObservation } from "@/landfall/observation";
import { LandfallRuntime, type LandfallConfidence } from "@/landfall/runtime";
import type { LandfallDefinition } from "@/landfall/schema";
import { verifyLandmarkReceipt, landmarkDefinitionHash } from "@/landfall/landmark-receipt";

import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
export { playerLandfallEvidenceSchema, type PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";

export type QualifiedLandfallEvidence = Readonly<{
  waypointId: string;
  worldspaceId: string;
  evidenceId: string;
  method: "BROWSER_GEOLOCATION" | "PLAYER_CONFIRMATION" | "VISION_WAYPOINT";
  outcome: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED";
  observedAt: string;
  confidenceClass: "LOW" | "MEDIUM" | "HIGH";
  accuracyBand?: "HIGH" | "MEDIUM" | "LOW";
  contextualArrival?: boolean;
  contextualSummary?: {
    state: string;
    regionId: string | null;
    mapId: string | null;
    level: string | null;
    evidenceCategories: string[];
    landmarkId?: string;
    fallbackUsed?: boolean;
  };
}>;

const rank: Record<"NEARBY" | "LIKELY_INSIDE" | "CONFIRMED", number> = {
  NEARBY: 1,
  LIKELY_INSIDE: 2,
  CONFIRMED: 3,
};

function outcomeOf(confidence: LandfallConfidence): keyof typeof rank | null {
  return confidence === "NEARBY" || confidence === "LIKELY_INSIDE" || confidence === "CONFIRMED" ? confidence : null;
}

/** Server side qualification. Raw fixes are bounded input and never enter a durable receipt. */
export function qualifyPlayerLandfallEvidence(input: {
  definition: LandfallDefinition;
  request: PlayerLandfallEvidence;
  journey: LandfallJourneyProjection;
  now: number;
  minimumDwellSeconds?: number;
  minimumOutcome?: keyof typeof rank;
  observationRevisit?: boolean;
  playerProfileId?: string;
}): QualifiedLandfallEvidence {
  const { definition, request, journey, now } = input;
  if (request.worldspaceId !== journey.activeWorldspaceId) throw new Error("LANDFALL_WRONG_WORLDSPACE");
  if (journey.paused) throw new Error("LANDFALL_PROGRESS_PAUSED");
  const waypoint = journey.availableWaypoints.find((item) => item.id === request.waypointId);
  if (
    !waypoint ||
    (journey.visitedIds.includes(waypoint.id) && !input.observationRevisit) ||
    journey.skippedIds.includes(waypoint.id)
  )
    throw new Error("LANDFALL_WAYPOINT_UNAVAILABLE");
  if (waypoint.id !== journey.activeWaypointId && !waypoint.sequence.optional)
    throw new Error("LANDFALL_WRONG_WAYPOINT");
  const route = journey.activeRoute;
  if (
    !input.observationRevisit &&
    route &&
    route.waypointIds.includes(waypoint.id) &&
    !["FLEXIBLE", "BRANCHING"].includes(route.model)
  ) {
    const next = route.waypointIds.find((id) => !journey.visitedIds.includes(id) && !journey.skippedIds.includes(id));
    if (next !== waypoint.id) throw new Error("LANDFALL_ROUTE_SEQUENCE_CONFLICT");
  }
  const worldspace = definition.worldspaces.find((item) => item.id === request.worldspaceId)!;
  if (request.method !== "LANDMARK" && request.landmarkReceipt) throw new Error("LANDFALL_UNEXPECTED_LANDMARK_RECEIPT");
  if (request.contextualEvidence?.some((item) => item.kind === "LANDMARK" || item.kind === "OBSERVATION"))
    throw new Error("LANDFALL_UNTRUSTED_CONTEXT_CONFIRMATION");
  if (request.method === "LANDMARK") {
    if (
      !waypoint.evidenceProfile.acceptedSources.includes("VISION_WAYPOINT") ||
      !worldspace.observationPolicy.allowedSources.includes("VISION_WAYPOINT")
    )
      throw new Error("LANDFALL_LANDMARK_SOURCE_UNAVAILABLE");
    if (!request.landmarkReceipt || !input.playerProfileId) throw new Error("LANDFALL_LANDMARK_RECEIPT_REQUIRED");
    const receipt = verifyLandmarkReceipt(request.landmarkReceipt, now);
    const landmark = definition.context?.landmarks.find((item) => item.id === receipt.landmarkId);
    if (
      receipt.sessionId !== request.sessionId ||
      receipt.playerProfileId !== input.playerProfileId ||
      receipt.publishedVersionId !== request.publishedVersionId ||
      receipt.expectedSequence !== request.expectedSequence ||
      receipt.worldspaceId !== request.worldspaceId ||
      receipt.waypointId !== request.waypointId ||
      receipt.definitionHash !== landmarkDefinitionHash(definition) ||
      !landmark ||
      landmark.regionId !== receipt.regionId ||
      landmark.waypointId !== waypoint.id
    )
      throw new Error("LANDFALL_LANDMARK_RECEIPT_SCOPE_MISMATCH");
    const region = definition.context!.regions.find((item) => item.id === landmark.regionId)!;
    return {
      waypointId: waypoint.id,
      worldspaceId: worldspace.id,
      evidenceId: request.evidenceId,
      method: "VISION_WAYPOINT",
      outcome: "CONFIRMED",
      observedAt: new Date(receipt.issuedAt).toISOString(),
      confidenceClass: "HIGH",
      contextualSummary: {
        state: "CONFIRMED",
        regionId: region.id,
        mapId: region.mapId,
        level: region.level ?? null,
        evidenceCategories: ["POSITION", "LANDMARK"],
        landmarkId: landmark.id,
      },
    };
  }
  if (request.method === "PLAYER_FALLBACK") {
    if (request.observations?.length || request.contextualEvidence?.length)
      throw new Error("LANDFALL_FALLBACK_MUST_NOT_CLAIM_SENSOR");
    if (
      waypoint.fallback.mode !== "PLAYER" ||
      !waypoint.evidenceProfile.allowManualFallback ||
      !waypoint.evidenceProfile.acceptedSources.includes("PLAYER_CONFIRMATION") ||
      !worldspace.observationPolicy.allowedSources.includes("PLAYER_CONFIRMATION")
    )
      throw new Error("LANDFALL_PLAYER_FALLBACK_UNAVAILABLE");
    return {
      waypointId: waypoint.id,
      worldspaceId: worldspace.id,
      evidenceId: request.evidenceId,
      method: "PLAYER_CONFIRMATION",
      outcome: "CONFIRMED",
      observedAt: new Date(now).toISOString(),
      confidenceClass: "MEDIUM",
      ...(waypoint.regionId
        ? {
            contextualSummary: {
              state: "CONFIRMED",
              regionId: waypoint.regionId,
              mapId: waypoint.mapId,
              level: definition.context?.regions.find((item) => item.id === waypoint.regionId)?.level ?? null,
              evidenceCategories: ["PLAYER_CONFIRMATION"],
              fallbackUsed: true,
            },
          }
        : {}),
    };
  }
  if (worldspace.kind !== "PHYSICAL" || !waypoint.evidenceProfile.acceptedSources.includes("BROWSER_GEOLOCATION"))
    throw new Error("LANDFALL_LOCATION_PROVIDER_UNAVAILABLE");
  const observations = request.observations ?? [];
  if (!observations.length || observations.length > 20 || observations.at(-1)?.id !== request.evidenceId)
    throw new Error("LANDFALL_EVIDENCE_INCOMPLETE");
  if (
    observations.some(
      (item) =>
        item.kind !== "PHYSICAL_POSITION" ||
        item.source !== "BROWSER_GEOLOCATION" ||
        item.providerId !== "browser-geolocation" ||
        item.sessionId !== request.sessionId ||
        item.publishedVersionId !== request.publishedVersionId ||
        item.worldspaceId !== request.worldspaceId,
    )
  )
    throw new Error("LANDFALL_EVIDENCE_IDENTITY_MISMATCH");
  const providers = new LandfallProviderRegistry();
  providers.register({
    id: "browser-geolocation",
    source: "BROWSER_GEOLOCATION",
    worldspaceKinds: ["PHYSICAL"],
    state: "AVAILABLE",
  });
  const effectiveWaypoint =
    input.minimumDwellSeconds === undefined
      ? waypoint
      : {
          ...waypoint,
          evidenceProfile: {
            ...waypoint.evidenceProfile,
            dwellSeconds: Math.max(waypoint.evidenceProfile.dwellSeconds, input.minimumDwellSeconds),
          },
        };
  const runtime = new LandfallRuntime(
    {
      worldspaces: [worldspace],
      waypoints: [effectiveWaypoint],
      routes: route ? [route] : [],
      transitions: [],
      context: definition.context,
    },
    { sessionId: request.sessionId, publishedVersionId: request.publishedVersionId },
    providers,
  );
  runtime.setActiveWaypoint(waypoint.id);
  if (route) runtime.setActiveRoute(route.id);
  runtime.setPermission("GRANTED");
  runtime.resume();
  let final: ReturnType<typeof runtime.ingest> | null = null;
  for (const observation of observations) {
    final = runtime.ingest(observation, now);
    if (final.rejection) throw new Error(`LANDFALL_EVIDENCE_${final.rejection}`);
  }
  for (const hint of request.contextualEvidence ?? []) {
    const result = runtime.ingestContext(hint, now);
    if (result.rejection) throw new Error(`LANDFALL_CONTEXT_${result.rejection}`);
  }
  const outcome = outcomeOf(final?.confidence ?? "UNAVAILABLE");
  if (
    !outcome ||
    rank[outcome] <
      Math.max(
        rank[
          input.observationRevisit && waypoint.evidenceProfile.precisionProfile === "EXACT_OBJECT"
            ? "LIKELY_INSIDE"
            : waypoint.completion.requiredOutcome
        ],
        rank[
          input.minimumOutcome ??
            (input.observationRevisit && waypoint.evidenceProfile.precisionProfile === "EXACT_OBJECT"
              ? "LIKELY_INSIDE"
              : waypoint.completion.requiredOutcome)
        ],
      )
  )
    throw new Error("LANDFALL_EVIDENCE_NOT_QUALIFIED");
  const last = observations.at(-1) as Extract<LandfallObservation, { kind: "PHYSICAL_POSITION" }>;
  const context = runtime.contextSnapshot(now);
  return {
    waypointId: waypoint.id,
    worldspaceId: worldspace.id,
    evidenceId: request.evidenceId,
    method: "BROWSER_GEOLOCATION",
    outcome,
    observedAt: last.observedAt,
    confidenceClass: outcome === "CONFIRMED" ? "HIGH" : "MEDIUM",
    accuracyBand: last.accuracyMeters <= 15 ? "HIGH" : last.accuracyMeters <= 50 ? "MEDIUM" : "LOW",
    ...(input.observationRevisit && waypoint.evidenceProfile.precisionProfile === "EXACT_OBJECT"
      ? { contextualArrival: true }
      : {}),
    ...(context.regionId
      ? {
          contextualSummary: {
            state: context.state,
            regionId: context.regionId,
            mapId: context.mapId,
            level: context.level,
            evidenceCategories: context.evidenceCategories,
          },
        }
      : {}),
  };
}

export function emptyLandfallJourney(definition: LandfallDefinition) {
  return projectLandfallJourney(definition, []);
}

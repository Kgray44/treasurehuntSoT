import { z } from "zod";
import { projectLandfallJourney, type LandfallJourneyProjection } from "@/landfall/journey-projection";
import { LandfallProviderRegistry, observationSchema, type LandfallObservation } from "@/landfall/observation";
import { LandfallRuntime, type LandfallConfidence } from "@/landfall/runtime";
import { landfallId, type LandfallDefinition } from "@/landfall/schema";

export const playerLandfallEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
  evidenceId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  idempotencyKey: landfallId,
  method: z.enum(["FOREGROUND_LOCATION", "PLAYER_FALLBACK"]),
  observations: z.array(observationSchema).max(20).optional(),
});
export type PlayerLandfallEvidence = z.infer<typeof playerLandfallEvidenceSchema>;

export type QualifiedLandfallEvidence = Readonly<{
  waypointId: string;
  worldspaceId: string;
  evidenceId: string;
  method: "BROWSER_GEOLOCATION" | "PLAYER_CONFIRMATION";
  outcome: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED";
  observedAt: string;
  confidenceClass: "LOW" | "MEDIUM" | "HIGH";
  accuracyBand?: "HIGH" | "MEDIUM" | "LOW";
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
}): QualifiedLandfallEvidence {
  const { definition, request, journey, now } = input;
  if (request.worldspaceId !== journey.activeWorldspaceId) throw new Error("LANDFALL_WRONG_WORLDSPACE");
  if (journey.paused) throw new Error("LANDFALL_PROGRESS_PAUSED");
  const waypoint = journey.availableWaypoints.find((item) => item.id === request.waypointId);
  if (!waypoint || journey.visitedIds.includes(waypoint.id) || journey.skippedIds.includes(waypoint.id))
    throw new Error("LANDFALL_WAYPOINT_UNAVAILABLE");
  if (waypoint.id !== journey.activeWaypointId && !waypoint.sequence.optional)
    throw new Error("LANDFALL_WRONG_WAYPOINT");
  const route = journey.activeRoute;
  if (route && route.waypointIds.includes(waypoint.id) && !["FLEXIBLE", "BRANCHING"].includes(route.model)) {
    const next = route.waypointIds.find((id) => !journey.visitedIds.includes(id) && !journey.skippedIds.includes(id));
    if (next !== waypoint.id) throw new Error("LANDFALL_ROUTE_SEQUENCE_CONFLICT");
  }
  const worldspace = definition.worldspaces.find((item) => item.id === request.worldspaceId)!;
  if (request.method === "PLAYER_FALLBACK") {
    if (request.observations?.length) throw new Error("LANDFALL_FALLBACK_MUST_NOT_CLAIM_SENSOR");
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
  const outcome = outcomeOf(final?.confidence ?? "UNAVAILABLE");
  if (!outcome || rank[outcome] < rank[waypoint.completion.requiredOutcome])
    throw new Error("LANDFALL_EVIDENCE_NOT_QUALIFIED");
  const last = observations.at(-1) as Extract<LandfallObservation, { kind: "PHYSICAL_POSITION" }>;
  return {
    waypointId: waypoint.id,
    worldspaceId: worldspace.id,
    evidenceId: request.evidenceId,
    method: "BROWSER_GEOLOCATION",
    outcome,
    observedAt: last.observedAt,
    confidenceClass: outcome === "CONFIRMED" ? "HIGH" : "MEDIUM",
    accuracyBand: last.accuracyMeters <= 15 ? "HIGH" : last.accuracyMeters <= 50 ? "MEDIUM" : "LOW",
  };
}

export function emptyLandfallJourney(definition: LandfallDefinition) {
  return projectLandfallJourney(definition, []);
}

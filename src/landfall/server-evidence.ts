import { readWatchglassHandoff, type WatchglassEvidenceProvider } from "@/landfall/watchglass-handoff";
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
  method: "BROWSER_GEOLOCATION" | "PLAYER_CONFIRMATION" | "VISION_WAYPOINT" | "WATCHGLASS";
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
  watchglassProvider?: WatchglassEvidenceProvider;
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
  if (request.method !== "WATCHGLASS" && request.watchglassReceipt)
    throw new Error("LANDFALL_UNEXPECTED_WATCHGLASS_RECEIPT");
  if (request.method === "WATCHGLASS") {
    if (request.observations?.length || request.contextualEvidence?.length || request.landmarkReceipt)
      throw new Error("LANDFALL_WATCHGLASS_UNTRUSTED_INPUT");
    if (!input.playerProfileId) throw new Error("LANDFALL_WATCHGLASS_ACTOR_REQUIRED");
    const handoff = readWatchglassHandoff(
      input.watchglassProvider,
      request.watchglassReceipt ?? "",
      {
        sessionId: request.sessionId,
        playerProfileId: input.playerProfileId,
        publishedVersionId: request.publishedVersionId,
        expectedSequence: request.expectedSequence,
        worldspaceId: worldspace.id,
        worldspaceVersion: worldspace.version,
        waypointId: waypoint.id,
        definitionHash: landmarkDefinitionHash(definition),
      },
      worldspace.kind,
      now,
    );
    if (handoff.state !== "AVAILABLE") throw new Error("LANDFALL_WATCHGLASS_UNAVAILABLE");
    if (
      handoff.observations.some(
        (item) => now - Date.parse(item.observedAt) > waypoint.evidenceProfile.maximumAgeSeconds * 1000,
      )
    )
      throw new Error("LANDFALL_WATCHGLASS_STALE");
    const landmark = definition.context?.landmarks.find((item) => item.id === waypoint.landmarkId);
    if (landmark && handoff.observations.length < landmark.minimumFrames)
      throw new Error("LANDFALL_WATCHGLASS_SUPPORT_REQUIRED");
    const providers = new LandfallProviderRegistry();
    providers.register({
      id: handoff.observation.providerId,
      source: "WATCHGLASS",
      worldspaceKinds: [worldspace.kind],
      state: "AVAILABLE",
    });
    const runtime = new LandfallRuntime(
      definition,
      { sessionId: request.sessionId, publishedVersionId: request.publishedVersionId },
      providers,
    );
    if (runtime.projection("CREATOR_TEST", now).activeWorldspaceId !== worldspace.id)
      runtime.transition(worldspace.id, "watchglass-qualification", new Date(now).toISOString(), true);
    runtime.setActiveWaypoint(waypoint.id);
    if (input.minimumDwellSeconds) {
      // Qualified signed observations must also satisfy the Passage's stronger dwell contract.
      const elapsed =
        Date.parse(handoff.observations.at(-1)!.observedAt) - Date.parse(handoff.observations[0].observedAt);
      if (elapsed < input.minimumDwellSeconds * 1000) throw new Error("LANDFALL_WATCHGLASS_DWELL_REQUIRED");
    }
    let outcome = runtime.ingest(handoff.observations[0], Date.parse(handoff.observations[0].observedAt));
    for (const observation of handoff.observations.slice(1))
      outcome = runtime.ingest(observation, Date.parse(observation.observedAt));
    if (outcome.rejection || outcome.confidence !== "CONFIRMED") throw new Error("LANDFALL_WATCHGLASS_NOT_QUALIFIED");
    const region = definition.context?.regions.find((item) => item.id === waypoint.regionId);
    return {
      waypointId: waypoint.id,
      worldspaceId: worldspace.id,
      evidenceId: request.evidenceId,
      method: "WATCHGLASS",
      outcome: "CONFIRMED",
      observedAt: handoff.observation.observedAt,
      confidenceClass: "HIGH",
      ...(region
        ? {
            contextualSummary: {
              state: "CONFIRMED",
              regionId: region.id,
              mapId: region.mapId,
              level: region.level ?? null,
              evidenceCategories: ["WATCHGLASS"],
            },
          }
        : {}),
    };
  }
  if (request.method === "LANDMARK") {
    // The regional prior gates the comparison; it is not another independent verifier.
    if ((waypoint.evidenceProfile.fusionPolicy?.minimumIndependentSources ?? 1) > 1)
      throw new Error("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
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

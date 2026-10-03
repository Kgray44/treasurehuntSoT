import { createHash } from "node:crypto";
import { LandfallEvidenceFusion } from "@/landfall/evidence-fusion";
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
  method: "BROWSER_GEOLOCATION" | "PLAYER_CONFIRMATION" | "VISION_WAYPOINT" | "WATCHGLASS" | "FUSED";
  outcome: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED";
  observedAt: string;
  confidenceClass: "LOW" | "MEDIUM" | "HIGH";
  accuracyBand?: "HIGH" | "MEDIUM" | "LOW";
  contextualArrival?: boolean;
  evidenceCategories?: string[];
  fallbackUsed?: boolean;
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
function qualifyEvidence(
  input: {
    definition: LandfallDefinition;
    request: PlayerLandfallEvidence;
    journey: LandfallJourneyProjection;
    now: number;
    minimumDwellSeconds?: number;
    minimumOutcome?: keyof typeof rank;
    observationRevisit?: boolean;
    playerProfileId?: string;
    watchglassProvider?: WatchglassEvidenceProvider;
  },
  authoredDefinitionHash = landmarkDefinitionHash(input.definition),
): QualifiedLandfallEvidence {
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
  if (request.method === "EVIDENCE_BUNDLE") return qualifyBundle(input, waypoint.id);
  if (request.sources) throw new Error("LANDFALL_UNEXPECTED_EVIDENCE_BUNDLE");
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
        definitionHash: authoredDefinitionHash,
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
      receipt.definitionHash !== authoredDefinitionHash ||
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
  if (final?.confidence === "OUTSIDE") throw new Error("LANDFALL_EVIDENCE_CONTRADICTION");
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

export function qualifyPlayerLandfallEvidence(input: Parameters<typeof qualifyEvidence>[0]): QualifiedLandfallEvidence {
  return qualifyEvidence(input);
}

export function emptyLandfallJourney(definition: LandfallDefinition) {
  return projectLandfallJourney(definition, []);
}

/** Source roots are assigned only after independent server qualification. No raw
 * packet, signature, provider certification or provenance enters canonical history. */
function qualifyBundle(
  input: Parameters<typeof qualifyPlayerLandfallEvidence>[0],
  waypointId: string,
): QualifiedLandfallEvidence {
  const { definition, request, now } = input;
  if (
    !input.playerProfileId ||
    !request.sources?.length ||
    request.sources.length > 4 ||
    request.observations?.length ||
    request.contextualEvidence?.length ||
    request.landmarkReceipt ||
    request.watchglassReceipt
  )
    throw new Error("LANDFALL_EVIDENCE_BUNDLE_INVALID");
  const waypoint = definition.waypoints.find((item) => item.id === waypointId)!;
  const world = definition.worldspaces.find((item) => item.id === request.worldspaceId)!;
  const singleDefinition = {
    ...definition,
    waypoints: definition.waypoints.map((item) =>
      item.id === waypoint.id
        ? {
            ...item,
            evidenceProfile: {
              ...item.evidenceProfile,
              fusionPolicy: { version: 1 as const, minimumIndependentSources: 1 },
            },
          }
        : item,
    ),
  };
  const singleJourney = {
    ...input.journey,
    availableWaypoints: input.journey.availableWaypoints.map((item) =>
      item.id === waypoint.id ? singleDefinition.waypoints.find((candidate) => candidate.id === waypoint.id)! : item,
    ),
  };
  const rootHash = (value: string) => createHash("sha256").update(value).digest("hex");
  const signals: {
    observation: LandfallObservation;
    present: boolean | null;
    qualified?: QualifiedLandfallEvidence;
  }[] = [];
  for (const packet of request.sources) {
    const member: PlayerLandfallEvidence = {
      schemaVersion: 1,
      sessionId: request.sessionId,
      publishedVersionId: request.publishedVersionId,
      worldspaceId: request.worldspaceId,
      waypointId,
      expectedSequence: request.expectedSequence,
      idempotencyKey: request.idempotencyKey,
      ...packet,
    };
    const source: LandfallObservation["source"] =
      packet.method === "FOREGROUND_LOCATION"
        ? "BROWSER_GEOLOCATION"
        : packet.method === "LANDMARK"
          ? "VISION_WAYPOINT"
          : packet.method === "WATCHGLASS"
            ? "WATCHGLASS"
            : "PLAYER_CONFIRMATION";
    let observedAt = new Date(now).toISOString();
    let expiresAt = new Date(now + waypoint.evidenceProfile.maximumAgeSeconds * 1000).toISOString();
    let root = rootHash(
      `${source}:${input.playerProfileId}:${request.sessionId}:${request.publishedVersionId}:${request.expectedSequence}:${waypointId}`,
    );
    let contexts: string[] = [];
    let presence: boolean | null = true;
    if (packet.method === "WATCHGLASS") {
      if (
        !waypoint.evidenceProfile.acceptedSources.includes("WATCHGLASS") ||
        !world.observationPolicy.allowedSources.includes("WATCHGLASS")
      )
        throw new Error("LANDFALL_WATCHGLASS_SOURCE_UNAVAILABLE");
      try {
        const handoff = readWatchglassHandoff(
          input.watchglassProvider,
          packet.watchglassReceipt,
          {
            sessionId: request.sessionId,
            playerProfileId: input.playerProfileId,
            publishedVersionId: request.publishedVersionId,
            expectedSequence: request.expectedSequence,
            worldspaceId: world.id,
            worldspaceVersion: world.version,
            waypointId,
            definitionHash: landmarkDefinitionHash(definition),
          },
          world.kind,
          now,
        );
        if (handoff.state !== "AVAILABLE") continue;
        if (
          handoff.observations.some(
            (item) => now - Date.parse(item.observedAt) > waypoint.evidenceProfile.maximumAgeSeconds * 1000,
          )
        )
          continue;
        const landmark = definition.context?.landmarks.find((item) => item.id === waypoint.landmarkId);
        if (landmark && handoff.observations.length < landmark.minimumFrames) continue;
        const item = handoff.observation;
        if (item.kind !== "SEMANTIC_LOCATION") throw new Error("LANDFALL_WATCHGLASS_RECEIPT_INVALID");
        observedAt = item.observedAt;
        expiresAt = item.expiresAt!;
        root = item.provenance!.independentEvidenceRef;
        contexts = item.provenance!.contextEvidenceRefs;
        presence =
          item.assertion === "ABSENT" && item.confidence >= 0.8
            ? false
            : item.assertion === "PRESENT" && item.confidence >= 0.8
              ? true
              : null;
      } catch (error) {
        if (error instanceof Error && error.message === "LANDFALL_WATCHGLASS_STALE") continue;
        throw error;
      }
    }
    let qualified: QualifiedLandfallEvidence | undefined;
    if (presence === true) {
      try {
        qualified = qualifyEvidence(
          { ...input, definition: singleDefinition, journey: singleJourney, request: member },
          landmarkDefinitionHash(definition),
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        if (error.message === "LANDFALL_EVIDENCE_CONTRADICTION") presence = false;
        else if (
          [
            "LANDFALL_EVIDENCE_NOT_QUALIFIED",
            "LANDFALL_WATCHGLASS_NOT_QUALIFIED",
            "LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED",
          ].includes(error.message)
        )
          presence = null;
        else if (error.message.includes("STALE") || error.message === "LANDFALL_LANDMARK_RECEIPT_EXPIRED") continue;
        else throw error;
      }
    }
    if (packet.method === "FOREGROUND_LOCATION") {
      // Qualifier checked every sample's identity, source, bounds, freshness and travel.
      observedAt = packet.observations.at(-1)!.observedAt;
      expiresAt = new Date(Date.parse(observedAt) + waypoint.evidenceProfile.maximumAgeSeconds * 1000).toISOString();
      root = rootHash(
        `browser:${request.sessionId}:${request.publishedVersionId}:${packet.observations.map((item) => item.id).join(":")}`,
      );
    }
    if (packet.method === "LANDMARK" && qualified) {
      const receipt = verifyLandmarkReceipt(packet.landmarkReceipt, now);
      // Same immutable definition hash was already checked against the one-source policy.
      observedAt = new Date(receipt.issuedAt).toISOString();
      expiresAt = new Date(receipt.expiresAt).toISOString();
      root = rootHash(`landmark:${packet.landmarkReceipt}`);
    }
    signals.push({
      observation: {
        schemaVersion: 1,
        id: packet.evidenceId,
        sessionId: request.sessionId,
        publishedVersionId: request.publishedVersionId,
        worldspaceId: world.id,
        providerId: `qualified-${source}`,
        source,
        kind: "SEMANTIC_LOCATION",
        targetLocationId: waypointId,
        observedAt,
        expiresAt,
        confidence: presence === null ? 0 : 1,
        assertion: presence === true ? "PRESENT" : presence === false ? "ABSENT" : "UNCERTAIN",
        provenance: { independentEvidenceRef: root, contextEvidenceRefs: contexts },
      },
      present: presence,
      qualified,
    });
  }
  const byRoot = new Map(
    signals.map((signal) => [
      signal.observation.provenance!.independentEvidenceRef,
      signal.observation.provenance!.contextEvidenceRefs,
    ]),
  );
  const visit = (root: string, active: Set<string>): void => {
    if (active.has(root)) throw new Error("LANDFALL_CIRCULAR_EVIDENCE");
    for (const prior of byRoot.get(root) ?? []) visit(prior, new Set([...active, root]));
  };
  for (const root of byRoot.keys()) visit(root, new Set());
  const fusion = new LandfallEvidenceFusion();
  for (const signal of signals) fusion.consider(signal.observation, signal.present, waypoint.evidenceProfile, now);
  const decision = fusion.status(waypoint.evidenceProfile, now);
  if (decision === "CONFLICT") throw new Error("LANDFALL_EVIDENCE_CONFLICT");
  if (decision !== "SUPPORTED") throw new Error("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
  const qualified = signals.filter((signal) => signal.present === true && signal.qualified);
  const categories = [...new Set(qualified.map((signal) => signal.observation.source))];
  const last = qualified.at(-1)!.qualified!;
  return {
    ...last,
    evidenceId: request.evidenceId,
    method: "FUSED",
    observedAt: new Date(now).toISOString(),
    evidenceCategories: categories,
    fallbackUsed: categories.includes("PLAYER_CONFIRMATION"),
    ...(last.contextualSummary
      ? {
          contextualSummary: {
            ...last.contextualSummary,
            evidenceCategories: categories,
            fallbackUsed: categories.includes("PLAYER_CONFIRMATION"),
          },
        }
      : {}),
  };
}

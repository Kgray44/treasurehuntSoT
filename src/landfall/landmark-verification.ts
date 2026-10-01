import { randomUUID } from "node:crypto";
import { ContextualLandfallEngine } from "@/landfall/contextual";
import { observationSchema, validateObservationForWorldspace } from "@/landfall/observation";
import { landmarkDefinitionHash, signLandmarkReceipt } from "@/landfall/landmark-receipt";
import { compareVisionWaypoint, visionWaypointProviderOutcome } from "@/landfall/vision-waypoint";
import type { LandmarkComparison } from "@/landfall/landmark-contract";
import type { LandfallDefinition } from "@/landfall/schema";
import { projectLandfallJourney, type LandfallJourneyEvent } from "@/landfall/journey-projection";

/** Reconstructs plausible regional evidence server-side; client region assertions cannot unlock a camera match. */
export async function verifyPlayerLandmark(input: {
  definition: LandfallDefinition;
  request: LandmarkComparison;
  playerProfileId: string;
  events: readonly LandfallJourneyEvent[];
  chapterId: string | null;
  blockId: string | null;
  now: number;
  readReference: (assetId: string) => Promise<Buffer>;
}) {
  const { definition, request, now } = input;
  const journey = projectLandfallJourney(definition, input.events, {
    chapterId: input.chapterId,
    blockId: input.blockId,
    now,
  });
  const waypoint = journey.availableWaypoints.find((item) => item.id === request.waypointId);
  const landmark = definition.context?.landmarks.find(
    (item) => item.id === request.landmarkId && item.waypointId === waypoint?.id,
  );
  const worldspace = definition.worldspaces.find((item) => item.id === request.worldspaceId);
  if (
    journey.paused ||
    !waypoint ||
    (waypoint.id !== journey.activeWaypointId && !waypoint.sequence.optional) ||
    journey.visitedIds.includes(waypoint.id) ||
    !landmark ||
    waypoint.landmarkId !== landmark.id ||
    !worldspace ||
    worldspace.kind !== "PHYSICAL" ||
    journey.activeWorldspaceId !== worldspace.id ||
    waypoint.worldspaceId !== worldspace.id
  )
    throw new Error("LANDFALL_LANDMARK_UNAVAILABLE");
  if (
    !waypoint.evidenceProfile.acceptedSources.includes("VISION_WAYPOINT") ||
    !worldspace.observationPolicy.allowedSources.includes("VISION_WAYPOINT")
  )
    throw new Error("LANDFALL_LANDMARK_SOURCE_UNAVAILABLE");
  const engine = new ContextualLandfallEngine(definition, {
    sessionId: request.sessionId,
    publishedVersionId: request.publishedVersionId,
  });
  let previousAt = 0;
  for (const raw of request.observations) {
    const observation = observationSchema.parse(raw);
    if (
      observation.kind !== "PHYSICAL_POSITION" ||
      observation.source !== "BROWSER_GEOLOCATION" ||
      observation.providerId !== "browser-geolocation" ||
      observation.sessionId !== request.sessionId ||
      observation.publishedVersionId !== request.publishedVersionId ||
      observation.worldspaceId !== worldspace.id
    )
      throw new Error("LANDFALL_EVIDENCE_IDENTITY_MISMATCH");
    validateObservationForWorldspace(observation, worldspace);
    const at = Date.parse(observation.observedAt);
    if (at > now + 5000 || now - at > 30_000 || at <= previousAt || observation.accuracyMeters > 150)
      throw new Error("LANDFALL_LANDMARK_CONTEXT_STALE");
    previousAt = at;
    const result = engine.ingestPosition(observation, now);
    if ("rejection" in result && result.rejection) throw new Error("LANDFALL_LANDMARK_CONTEXT_REJECTED");
  }
  if (!engine.snapshot(now).eligibleLandmarkIds.includes(landmark.id))
    throw new Error("LANDFALL_LANDMARK_REGION_UNQUALIFIED");
  const result = await compareVisionWaypoint({
    frames: request.frames.map((frame) => Buffer.from(frame.slice(frame.indexOf(",") + 1), "base64")),
    references: await Promise.all(landmark.referenceAssetIds.map(input.readReference)),
    negatives: await Promise.all(landmark.negativeReferenceAssetIds.map(input.readReference)),
    minimumFrames: landmark.minimumFrames,
  });
  const provider = { providerId: "visionLocation", providerOutcome: visionWaypointProviderOutcome(result.result) };
  if (result.result !== "confirmed") return { ...result, ...provider };
  return {
    ...result,
    ...provider,
    receipt: signLandmarkReceipt({
      id: randomUUID(),
      sessionId: request.sessionId,
      playerProfileId: input.playerProfileId,
      publishedVersionId: request.publishedVersionId,
      expectedSequence: request.expectedSequence,
      worldspaceId: worldspace.id,
      waypointId: waypoint.id,
      landmarkId: landmark.id,
      regionId: landmark.regionId,
      definitionHash: landmarkDefinitionHash(definition),
      frameCount: result.frameCount,
      result: "confirmed",
      issuedAt: now,
      expiresAt: now + 30_000,
    }),
  };
}

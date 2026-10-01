import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseStoredLandfallDefinition } from "@/landfall/definition";
import { LandfallProviderRegistry, observationSchema } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";
import { contextualEvidenceSchema } from "@/landfall/contextual";
import { landfallId } from "@/landfall/schema";

export const fieldTestSubmissionSchema = z.strictObject({
  sourceVersion: z.number().int().positive(),
  worldspaceId: landfallId,
  mapId: landfallId,
  waypointId: landfallId.optional(),
  routeId: landfallId.optional(),
  mode: z.enum(["PHYSICAL_WALK", "VIRTUAL_PREVIEW", "FALLBACK_PREVIEW"]),
  permission: z.enum(["PROMPT", "GRANTED", "DENIED", "UNAVAILABLE"]),
  networkState: z.enum(["ONLINE", "OFFLINE"]),
  observations: z.array(observationSchema).max(20),
  contextualEvidence: z.array(contextualEvidenceSchema).max(40).optional(),
});
export type FieldTestSubmission = z.infer<typeof fieldTestSubmissionSchema>;

async function currentDraft(taleId: string) {
  const draft = await db.taleDraft.findFirst({
    where: { taleId },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, autosaveVersion: true, landfallDefinition: true },
  });
  if (!draft) throw new Error("LANDFALL_DRAFT_UNAVAILABLE");
  const definition = parseStoredLandfallDefinition(draft.landfallDefinition);
  if (!definition) throw new Error("LANDFALL_DEFINITION_UNAVAILABLE");
  const hash = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
  return { draft, definition, hash };
}

export async function listLandfallFieldTests(taleId: string) {
  const { draft, hash } = await currentDraft(taleId);
  const records = await db.landfallFieldTestReceipt.findMany({
    where: { draftId: draft.id },
    orderBy: { testedAt: "desc" },
    take: 20,
  });
  return {
    sourceVersion: draft.autosaveVersion,
    receipts: records.map((record) => ({
      id: record.id,
      testedAt: record.testedAt.toISOString(),
      sourceVersion: record.sourceVersion,
      stale: record.definitionHash !== hash || record.sourceVersion !== draft.autosaveVersion,
      worldspaceId: record.worldspaceId,
      mapId: record.mapId,
      waypointId: record.waypointId,
      routeId: record.routeId,
      providerClass: record.providerClass,
      result: record.result,
      permission: record.permission,
      accuracyBand: record.accuracyBand,
      confidence: record.confidence,
      sampleCount: record.sampleCount,
      dwellSeconds: record.dwellSeconds,
      networkState: record.networkState,
      warnings: JSON.parse(record.warnings) as string[],
    })),
  };
}

/** Raw fixes, hints and recognition outcomes are evaluated in memory, never persisted. */
export async function recordLandfallFieldTest(taleId: string, input: FieldTestSubmission) {
  const { draft, definition, hash } = await currentDraft(taleId);
  if (draft.autosaveVersion !== input.sourceVersion) throw new Error("LANDFALL_FIELD_TEST_SOURCE_CHANGED");
  const worldspace = definition.worldspaces.find((item) => item.id === input.worldspaceId);
  const map = definition.maps.find((item) => item.id === input.mapId && item.worldspaceId === worldspace?.id);
  const waypoint = definition.waypoints.find(
    (item) => item.id === input.waypointId && item.worldspaceId === worldspace?.id,
  );
  const route = definition.routes.find((item) => item.id === input.routeId && item.worldspaceId === worldspace?.id);
  if (!worldspace || !map || (input.waypointId && !waypoint) || (input.routeId && !route))
    throw new Error("LANDFALL_FIELD_TEST_TARGET_CHANGED");
  if (input.mode === "PHYSICAL_WALK" && (worldspace.kind !== "PHYSICAL" || !waypoint))
    throw new Error("LANDFALL_FIELD_TEST_REQUIRES_PHYSICAL_WAYPOINT");
  if (input.mode !== "PHYSICAL_WALK" && (input.observations.length || input.contextualEvidence?.length))
    throw new Error("LANDFALL_FIELD_TEST_UNEXPECTED_SENSOR_DATA");

  const warnings: string[] = [];
  let confidence = "UNAVAILABLE";
  let accuracyBand: "HIGH" | "MEDIUM" | "LOW" | null = null;
  let dwellSeconds = 0;
  if (input.mode === "PHYSICAL_WALK" && waypoint) {
    const registry = new LandfallProviderRegistry();
    registry.register({
      id: "browser-geolocation",
      source: "BROWSER_GEOLOCATION",
      worldspaceKinds: ["PHYSICAL"],
      state: "AVAILABLE",
    });
    const runtime = new LandfallRuntime(
      {
        worldspaces: [worldspace],
        waypoints: [waypoint],
        routes: route ? [route] : [],
        transitions: [],
        context: definition.context,
      },
      { sessionId: `field-test-${draft.id}`, publishedVersionId: `draft-${draft.id}-${draft.autosaveVersion}` },
      registry,
    );
    runtime.setActiveWaypoint(waypoint.id);
    if (route) runtime.setActiveRoute(route.id);
    runtime.setPermission(input.permission);
    runtime.resume();
    let firstAccepted: number | null = null;
    let lastAccepted: number | null = null;
    const collected = [
      ...input.observations.map((evidence) => ({ type: "POSITION" as const, evidence })),
      ...(input.contextualEvidence ?? []).map((evidence) => ({ type: "CONTEXT" as const, evidence })),
    ].sort((a, b) => Date.parse(a.evidence.observedAt) - Date.parse(b.evidence.observedAt));
    for (const reading of collected) {
      if (reading.type === "CONTEXT") {
        const evidence = reading.evidence;
        if (
          evidence.worldspaceId !== worldspace.id ||
          evidence.sessionId !== `field-test-${draft.id}` ||
          evidence.publishedVersionId !== `draft-${draft.id}-${draft.autosaveVersion}`
        )
          throw new Error("LANDFALL_FIELD_TEST_CONTEXT_IDENTITY_MISMATCH");
        const outcome = runtime.ingestContext(evidence, Date.now());
        if (outcome.rejection)
          warnings.push(`Context reading rejected: ${outcome.rejection.toLowerCase().replaceAll("_", " ")}.`);
        continue;
      }
      const observation = reading.evidence;
      if (
        observation.kind !== "PHYSICAL_POSITION" ||
        observation.source !== "BROWSER_GEOLOCATION" ||
        observation.providerId !== "browser-geolocation" ||
        observation.worldspaceId !== worldspace.id ||
        observation.sessionId !== `field-test-${draft.id}` ||
        observation.publishedVersionId !== `draft-${draft.id}-${draft.autosaveVersion}`
      )
        throw new Error("LANDFALL_FIELD_TEST_SENSOR_IDENTITY_MISMATCH");
      const outcome = runtime.ingest(observation, Date.now());
      confidence = outcome.confidence;
      if (outcome.rejection)
        warnings.push(`Reading rejected: ${outcome.rejection.toLowerCase().replaceAll("_", " ")}.`);
      else {
        const observed = Date.parse(observation.observedAt);
        firstAccepted ??= observed;
        lastAccepted = observed;
        accuracyBand = observation.accuracyMeters <= 15 ? "HIGH" : observation.accuracyMeters <= 50 ? "MEDIUM" : "LOW";
        if (waypoint.geometry.type === "POINT_RADIUS" && observation.accuracyMeters * 2 > waypoint.geometry.radius)
          warnings.push(
            "The arrival radius is smaller than twice the observed accuracy; nearby arrivals may be missed.",
          );
      }
    }
    if (definition.context) {
      const snapshot = runtime.contextSnapshot(Date.now());
      const landmark = definition.context.landmarks.find((item) => item.waypointId === waypoint.id);
      warnings.unshift(
        `Context: ${snapshot.state.toLowerCase()}; region ${snapshot.regionId ?? "unavailable"}; map ${snapshot.mapId ?? "unavailable"}.`,
        `Evidence categories: ${snapshot.evidenceCategories.join(", ").toLowerCase() || "unavailable"}.`,
        snapshot.routeMatch
          ? `Context route: ${snapshot.routeMatch.routeId}; segment ${snapshot.routeMatch.segmentIndex + 1}; ${snapshot.routeMatch.direction.toLowerCase()}; ${snapshot.routeMatch.ambiguous ? "uncertain" : "matched"}.`
          : "Context route: unavailable.",
        `Landmark recognition: unavailable; readable fallback: ${(landmark?.fallback.mode ?? waypoint.fallback.mode).toLowerCase().replaceAll("_", " ")}.`,
      );
    }
    dwellSeconds =
      firstAccepted !== null && lastAccepted !== null
        ? Math.max(0, Math.floor((lastAccepted - firstAccepted) / 1000))
        : 0;
    if (input.permission !== "GRANTED") warnings.push("Browser location permission is unavailable or was not granted.");
    if (!input.observations.length) warnings.push("No browser location readings were collected.");
    if (waypoint.evidenceProfile.dwellSeconds > dwellSeconds)
      warnings.push("The test did not cover the configured dwell time.");
    if (route?.semantics === "NAVIGATIONAL" && !route.geometry)
      warnings.push("The navigational route has no drawn geometry to test against.");
  } else {
    warnings.push(
      input.mode === "VIRTUAL_PREVIEW"
        ? "Virtual layout preview does not verify a live virtual position provider."
        : "Fallback preview does not prove Player or Captain confirmation in a Voyage.",
    );
  }
  if (input.networkState === "OFFLINE")
    warnings.push("Network was offline; server synchronization could not be tested.");
  if (map.offlinePolicy !== "OFFLINE_READY") warnings.push("This map is not declared fully available offline.");
  const result = input.mode === "PHYSICAL_WALK" && confidence === "CONFIRMED" ? "PASS" : "INCOMPLETE";
  const receipt = await db.landfallFieldTestReceipt.create({
    data: {
      draftId: draft.id,
      sourceVersion: draft.autosaveVersion,
      definitionHash: hash,
      worldspaceId: worldspace.id,
      mapId: map.id,
      waypointId: waypoint?.id,
      routeId: route?.id,
      providerClass: input.mode === "PHYSICAL_WALK" ? "BROWSER_REPORTED_GEOLOCATION" : input.mode,
      result,
      permission: input.permission,
      accuracyBand,
      confidence,
      sampleCount: input.observations.length,
      dwellSeconds,
      networkState: input.networkState,
      warnings: JSON.stringify([...new Set(warnings)].slice(0, 12)),
    },
  });
  const old = await db.landfallFieldTestReceipt.findMany({
    where: { draftId: draft.id },
    orderBy: { testedAt: "desc" },
    skip: 20,
    select: { id: true },
  });
  if (old.length) await db.landfallFieldTestReceipt.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
  return {
    id: receipt.id,
    result,
    confidence,
    accuracyBand,
    sampleCount: input.observations.length,
    dwellSeconds,
    warnings: [...new Set(warnings)].slice(0, 12),
    stale: false,
  };
}

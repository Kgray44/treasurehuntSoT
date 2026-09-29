import { LandfallProviderRegistry, LandfallSimulationProvider, type LandfallObservation } from "@/landfall/observation";
import { LandfallRuntime, type LandfallOutcome } from "@/landfall/runtime";
import { validateLandfallDefinition } from "@/landfall/definition";
import type { LandfallDefinition } from "@/landfall/schema";

export type DrydockLandfallResult = Readonly<{
  outcome: "MATCH" | "NO_MATCH" | "UNCERTAIN";
  confidence: LandfallOutcome["confidence"];
  reason?: string;
}>;

/** Drydock uses real Landfall evaluation with a deterministic clock and no live progression. */
export function simulateLandfallObservation(input: {
  definition: LandfallDefinition;
  sessionId: string;
  publishedVersionId: string;
  worldspaceId: string;
  waypointId: string;
  observations: readonly LandfallObservation[];
  now: readonly number[];
}): DrydockLandfallResult {
  const definition = validateLandfallDefinition(input.definition);
  if (input.observations.length !== input.now.length || input.observations.length > 128)
    throw new Error("LANDFALL_SIMULATION_LIMIT");
  const worldspace = definition.worldspaces.find((item) => item.id === input.worldspaceId);
  if (
    !worldspace ||
    !definition.waypoints.some((item) => item.id === input.waypointId && item.worldspaceId === worldspace.id)
  )
    throw new Error("LANDFALL_SIMULATION_TARGET_UNAVAILABLE");
  const registry = new LandfallProviderRegistry();
  for (const observation of input.observations)
    if (!registry.capability(observation.providerId))
      registry.register({
        id: observation.providerId,
        source: observation.source,
        worldspaceKinds: [worldspace.kind],
        state: "AVAILABLE",
      });
  const runtime = new LandfallRuntime(
    definition,
    { sessionId: input.sessionId, publishedVersionId: input.publishedVersionId },
    registry,
  );
  if (runtime.activeWorldspaceId !== worldspace.id)
    runtime.transition(worldspace.id, "drydock-worldspace-enter", new Date(input.now[0] ?? 0).toISOString(), true);
  runtime.setActiveWaypoint(input.waypointId);
  const simulation = new LandfallSimulationProvider(input.observations);
  let last: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  input.now.forEach((clock) => {
    last = runtime.ingest(simulation.next(), clock);
  });
  const outcome = last.confidence === "CONFIRMED" ? "MATCH" : last.confidence === "OUTSIDE" ? "NO_MATCH" : "UNCERTAIN";
  return {
    outcome,
    confidence: last.confidence,
    ...(last.rejection ? { reason: last.rejection } : last.failure ? { reason: last.failure } : {}),
  };
}

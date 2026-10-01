import { z } from "zod";
import {
  coordinateSchema,
  landfallId,
  observationSourceSchema,
  type LandfallCoordinate,
  type LandfallWorldspace,
} from "@/landfall/schema";
import { assertCoordinateInWorldspace } from "@/landfall/geometry";

const common = {
  schemaVersion: z.literal(1),
  id: landfallId,
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  providerId: landfallId,
  source: observationSourceSchema,
  observedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
};
export const observationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("PHYSICAL_POSITION"),
    coordinate: coordinateSchema,
    accuracyMeters: z.number().finite().positive().max(100_000),
    headingDegrees: z.number().finite().min(0).max(360).optional(),
    speedMetersPerSecond: z.number().finite().nonnegative().max(100).optional(),
    altitudeMeters: z.number().finite().min(-12000).max(100000).optional(),
    altitudeAccuracyMeters: z.number().finite().positive().max(100000).optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("VIRTUAL_POSITION"),
    coordinate: coordinateSchema,
    uncertaintyUnits: z.number().finite().nonnegative().max(100_000),
    confidence: z.number().finite().min(0).max(1),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("SEMANTIC_LOCATION"),
    targetLocationId: landfallId,
    assertion: z.enum(["PRESENT", "ABSENT", "UNCERTAIN"]),
    confidence: z.number().finite().min(0).max(1),
    evidenceRef: landfallId.optional(),
  }),
]);
export type LandfallObservation = z.infer<typeof observationSchema>;
export type ObservationRejection =
  | "INVALID"
  | "WRONG_SESSION"
  | "WRONG_VERSION"
  | "WRONG_WORLDSPACE"
  | "SOURCE_NOT_ALLOWED"
  | "UNAVAILABLE_PROVIDER"
  | "STALE"
  | "FUTURE"
  | "DUPLICATE"
  | "OUT_OF_ORDER"
  | "TOO_FREQUENT"
  | "WEAK_ACCURACY"
  | "IMPOSSIBLE_SPEED"
  | "POSITION_KIND_MISMATCH"
  | "PAUSED"
  | "PERMISSION_UNAVAILABLE";

export type ProviderCapability = Readonly<{
  id: string;
  source: LandfallObservation["source"];
  worldspaceKinds: readonly LandfallWorldspace["kind"][];
  state: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";
}>;

export class LandfallProviderRegistry {
  private readonly providers = new Map<string, ProviderCapability>();
  register(capability: ProviderCapability): void {
    if (this.providers.has(capability.id)) throw new Error("LANDFALL_PROVIDER_DUPLICATE");
    this.providers.set(capability.id, Object.freeze({ ...capability }));
  }
  capability(id: string): ProviderCapability | null {
    return this.providers.get(id) ?? null;
  }
  supports(id: string, source: LandfallObservation["source"], kind: LandfallWorldspace["kind"]): boolean {
    const capability = this.providers.get(id);
    return (
      !!capability &&
      capability.state === "AVAILABLE" &&
      capability.source === source &&
      capability.worldspaceKinds.includes(kind)
    );
  }
  list(): readonly ProviderCapability[] {
    return [...this.providers.values()];
  }
}

export function validateObservationForWorldspace(
  observation: LandfallObservation,
  worldspace: LandfallWorldspace,
): void {
  if (observation.worldspaceId !== worldspace.id) throw new Error("LANDFALL_WRONG_WORLDSPACE");
  if (!worldspace.observationPolicy.allowedSources.includes(observation.source))
    throw new Error("LANDFALL_SOURCE_NOT_ALLOWED");
  if (observation.kind === "PHYSICAL_POSITION") {
    if (worldspace.kind !== "PHYSICAL" || !["BROWSER_GEOLOCATION", "NATIVE_LOCATION"].includes(observation.source))
      throw new Error("LANDFALL_POSITION_KIND_MISMATCH");
    assertCoordinateInWorldspace(observation.coordinate, worldspace);
  } else if (observation.kind === "VIRTUAL_POSITION") {
    if (worldspace.kind !== "VIRTUAL" || ["BROWSER_GEOLOCATION", "NATIVE_LOCATION"].includes(observation.source))
      throw new Error("LANDFALL_POSITION_KIND_MISMATCH");
    assertCoordinateInWorldspace(observation.coordinate, worldspace);
  } else if (["BROWSER_GEOLOCATION", "NATIVE_LOCATION"].includes(observation.source)) {
    throw new Error("LANDFALL_POSITION_KIND_MISMATCH");
  }
}

/** A finite replay source for unit tests and Drydock. It has no browser or network dependency. */
export class LandfallSimulationProvider {
  private index = 0;
  constructor(private readonly observations: readonly LandfallObservation[]) {}
  next(): LandfallObservation | null {
    return this.observations[this.index++] ?? null;
  }
  reset(): void {
    this.index = 0;
  }
}

export function sanitizeObservation(observation: LandfallObservation): Readonly<{
  id: string;
  source: LandfallObservation["source"];
  kind: LandfallObservation["kind"];
  observedAt: string;
  worldspaceId: string;
  accuracyBand?: "HIGH" | "MEDIUM" | "LOW";
}> {
  return {
    id: observation.id,
    source: observation.source,
    kind: observation.kind,
    observedAt: observation.observedAt,
    worldspaceId: observation.worldspaceId,
    ...(observation.kind === "PHYSICAL_POSITION"
      ? {
          accuracyBand:
            observation.accuracyMeters <= 15
              ? ("HIGH" as const)
              : observation.accuracyMeters <= 50
                ? ("MEDIUM" as const)
                : ("LOW" as const),
        }
      : {}),
  };
}

export function cloneCoordinate(coordinate: LandfallCoordinate): LandfallCoordinate {
  return { ...coordinate };
}

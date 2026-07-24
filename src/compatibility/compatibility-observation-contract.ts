/**
 * Shared Phase 2 contract for safe compatibility-use observation. It is kept
 * free of HTTP and database details so adapters cannot accidentally couple
 * telemetry availability to the authoritative command path.
 */
export const compatibilityOperations = [
  "LEGACY_ACCESS_EXCHANGE",
  "LEGACY_PLAYER_READ",
  "LEGACY_PLAYER_EVENT_STREAM",
  "LEGACY_QUARTERMASTER_COMMAND",
  "LEGACY_QUARTERMASTER_REDIRECT",
] as const;

export type CompatibilityOperation = (typeof compatibilityOperations)[number];
export type CompatibilityDisposition = "ADAPTED" | "REDIRECTED" | "DENIED" | "UNMAPPED";

export type CompatibilityObservation = Readonly<{
  correlationId: string;
  operation: CompatibilityOperation;
  routeKey: string;
  disposition: CompatibilityDisposition;
  canonicalSessionId?: string;
  canonicalAccountId?: string;
  testTraffic: boolean;
}>;

export type CompatibilityObservationResult =
  | Readonly<{ recorded: true }>
  | Readonly<{ recorded: false; reason: "BEST_EFFORT_FAILURE" }>;

export function isCompatibilityOperation(value: string): value is CompatibilityOperation {
  return (compatibilityOperations as readonly string[]).includes(value);
}

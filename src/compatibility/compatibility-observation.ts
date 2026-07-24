import { db } from "@/lib/db";
import type {
  CompatibilityObservation,
  CompatibilityObservationResult,
} from "@/compatibility/compatibility-observation-contract";

/**
 * Deliberately outside an adapter's authoritative transaction. Observation is
 * evidence, not a command precondition: an unavailable telemetry store cannot
 * prevent or retry a canonical command that has already committed.
 */
export async function recordCompatibilityObservation(
  observation: CompatibilityObservation,
): Promise<CompatibilityObservationResult> {
  try {
    await db.compatibilityObservation.create({ data: observation });
    return { recorded: true };
  } catch {
    return { recorded: false, reason: "BEST_EFFORT_FAILURE" };
  }
}

export function compatibilityTestTraffic() {
  return process.env.NODE_ENV === "test" || process.env.PROJECT_ONE_VOYAGE_TEST_TRAFFIC === "true";
}

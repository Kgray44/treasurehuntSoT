import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { canonicalChecksum } from "@/drydock/canonical";

/**
 * Simulation source identity intentionally excludes the publication timestamp.
 * Studio creates that timestamp while projecting a draft, so including it would
 * make an unchanged Scenario stale on every request.
 */
export function drydockSimulationSourceChecksum(snapshot: PublishedTaleSnapshot) {
  const { publishedAt, ...stableSnapshot } = snapshot;
  void publishedAt;
  return canonicalChecksum(stableSnapshot);
}

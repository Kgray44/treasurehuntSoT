import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { canonicalChecksum } from "@/drydock/canonical";
import { createDrydockCoverageReport } from "@/drydock/simulation/coverage";
import { runDrydockScenario, type DrydockSimulationResult } from "@/drydock/simulation/engine";
import type { DrydockScenario, DrydockScenarioInput } from "@/drydock/simulation/model";

export type DrydockExplorationProfile = Readonly<{
  inputs: readonly DrydockScenarioInput[];
  maxDepth: number;
  maxStates: number;
  maxTransitions: number;
}>;

export type DrydockExplorationResult = Readonly<{
  status: "COMPLETE" | "INCOMPLETE_PROOF";
  exploredStates: number;
  exploredTransitions: number;
  results: readonly DrydockSimulationResult[];
  coverage: ReturnType<typeof createDrydockCoverageReport>;
}>;

/**
 * Deterministic finite exploration over an explicit input domain. It hashes
 * only redacted state/trace digests and stops at declared bounds rather than
 * attempting an unbounded search space.
 */
export function exploreDrydockScenario(
  snapshot: PublishedTaleSnapshot,
  scenario: DrydockScenario,
  profile: DrydockExplorationProfile,
): DrydockExplorationResult {
  const pending: DrydockScenarioInput[][] = [[]];
  const visited = new Set<string>();
  const results: DrydockSimulationResult[] = [];
  let transitions = 0;
  let incomplete = false;
  while (pending.length) {
    const inputs = pending.shift()!;
    const result = runDrydockScenario(snapshot, {
      ...scenario,
      inputs,
      limits: { ...scenario.limits, maxSteps: Math.min(scenario.limits.maxSteps, profile.maxDepth) },
    });
    const key = canonicalChecksum({ status: result.status, trace: result.trace.map((entry) => entry.stateDigest) });
    if (visited.has(key)) continue;
    visited.add(key);
    results.push(result);
    if (visited.size >= profile.maxStates) {
      incomplete = pending.length > 0;
      break;
    }
    if (inputs.length >= profile.maxDepth || result.status !== "ACTIVE") continue;
    for (const input of profile.inputs) {
      transitions += 1;
      if (transitions > profile.maxTransitions) {
        incomplete = true;
        break;
      }
      pending.push([...inputs, input]);
    }
    if (incomplete) break;
  }
  const coverage = createDrydockCoverageReport(snapshot, results);
  return {
    status: incomplete ? "INCOMPLETE_PROOF" : "COMPLETE",
    exploredStates: visited.size,
    exploredTransitions: transitions,
    results,
    coverage,
  };
}

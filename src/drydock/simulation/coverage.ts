import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { enabledSnapshotBlocks } from "@/chronicle/runtime-semantics";
import { DRYDOCK_FAULT_CATALOG } from "@/drydock/simulation/faults";
import type { DrydockSimulationResult } from "@/drydock/simulation/engine";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

export type DrydockCoverageReport = Readonly<{
  sourceChecksum: string;
  executedScenarioIds: readonly string[];
  expectedBlockIds: readonly string[];
  coveredBlockIds: readonly string[];
  uncoveredBlockIds: readonly string[];
  expectedEdgeIds: readonly string[];
  coveredEdgeIds: readonly string[];
  uncoveredEdgeIds: readonly string[];
  cataloguedFaults: readonly string[];
  coveredFaultIds: readonly string[];
  assertionCount: number;
  failedAssertionCount: number;
  proofStatus: "COMPLETE" | "INCOMPLETE_PROOF";
}>;

/**
 * Produces a redacted, source-scoped coverage ledger. It does not infer that
 * an unexecuted branch or fault was safe; those remain explicitly uncovered.
 */
export function createDrydockCoverageReport(snapshot: PublishedTaleSnapshot, results: readonly DrydockSimulationResult[]): DrydockCoverageReport {
  const sourceChecksum = drydockSimulationSourceChecksum(snapshot);
  if (results.some((result) => result.sourceChecksum !== sourceChecksum))
    throw new Error("DRYDOCK_COVERAGE_SOURCE_MISMATCH");
  const expectedBlockIds = enabledSnapshotBlocks(snapshot).map((block) => block.id).sort();
  const expectedEdgeIds = enabledSnapshotBlocks(snapshot)
    .flatMap((block) => block.connections.filter((connection) => enabledSnapshotBlocks(snapshot).some((target) => target.id === connection.targetBlockId)).map((connection) => `${block.id}->${connection.targetBlockId}`))
    .sort();
  const coveredBlockIds = [...new Set(results.flatMap((result) => result.coverage.blockIds))].sort();
  const coveredEdgeIds = [...new Set(results.flatMap((result) => result.coverage.edgeIds))].sort();
  const coveredFaultIds = [...new Set(results.flatMap((result) => result.coverage.faultIds))].sort();
  const assertionCount = results.reduce((count, result) => count + result.assertions.length, 0);
  const failedAssertionCount = results.reduce((count, result) => count + result.assertions.filter((assertion) => !assertion.passed).length, 0);
  const uncoveredBlockIds = expectedBlockIds.filter((id) => !coveredBlockIds.includes(id));
  const uncoveredEdgeIds = expectedEdgeIds.filter((id) => !coveredEdgeIds.includes(id));
  return {
    sourceChecksum,
    executedScenarioIds: results.map((result) => result.scenarioId).sort(),
    expectedBlockIds,
    coveredBlockIds,
    uncoveredBlockIds,
    expectedEdgeIds,
    coveredEdgeIds,
    uncoveredEdgeIds,
    cataloguedFaults: DRYDOCK_FAULT_CATALOG.map((fault) => `${fault.family}:${fault.code}`),
    coveredFaultIds,
    assertionCount,
    failedAssertionCount,
    proofStatus: uncoveredBlockIds.length || uncoveredEdgeIds.length || failedAssertionCount || results.some((result) => result.status !== "COMPLETED") ? "INCOMPLETE_PROOF" : "COMPLETE",
  };
}

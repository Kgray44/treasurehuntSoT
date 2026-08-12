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
  expectedEndingBlockIds: readonly string[];
  coveredEndingBlockIds: readonly string[];
  uncoveredEndingBlockIds: readonly string[];
  coveredStateDigests: readonly string[];
  coveredProviderOutcomes: readonly string[];
  coveredEnvironmentModes: readonly string[];
  cataloguedFaults: readonly string[];
  coveredFaultIds: readonly string[];
  assertionCount: number;
  failedAssertionCount: number;
  proofStatus: "COMPLETE" | "INCOMPLETE_PROOF";
}>;

export type DrydockScenarioSuggestion = Readonly<{
  id: string;
  kind: "UNCOVERED_BLOCK" | "UNCOVERED_EDGE" | "UNCOVERED_ENDING" | "UNCOVERED_FAULT";
  sourceChecksum: string;
  target: string;
  safeHint: string;
}>;

/**
 * Produces a redacted, source-scoped coverage ledger. It does not infer that
 * an unexecuted branch or fault was safe; those remain explicitly uncovered.
 */
export function createDrydockCoverageReport(
  snapshot: PublishedTaleSnapshot,
  results: readonly DrydockSimulationResult[],
): DrydockCoverageReport {
  const sourceChecksum = drydockSimulationSourceChecksum(snapshot);
  if (results.some((result) => result.sourceChecksum !== sourceChecksum))
    throw new Error("DRYDOCK_COVERAGE_SOURCE_MISMATCH");
  const expectedBlockIds = enabledSnapshotBlocks(snapshot)
    .map((block) => block.id)
    .sort();
  const expectedEdgeIds = enabledSnapshotBlocks(snapshot)
    .flatMap((block) =>
      block.connections
        .filter((connection) =>
          enabledSnapshotBlocks(snapshot).some((target) => target.id === connection.targetBlockId),
        )
        .map((connection) => `${block.id}->${connection.targetBlockId}`),
    )
    .sort();
  const expectedEndingBlockIds = enabledSnapshotBlocks(snapshot)
    .filter((block) => block.blockType === "taleComplete")
    .map((block) => block.id)
    .sort();
  const coveredBlockIds = [...new Set(results.flatMap((result) => result.coverage.blockIds))].sort();
  const coveredEdgeIds = [...new Set(results.flatMap((result) => result.coverage.edgeIds))].sort();
  const coveredFaultIds = [...new Set(results.flatMap((result) => result.coverage.faultIds))].sort();
  const coveredEndingBlockIds = [...new Set(results.flatMap((result) => result.coverage.endingBlockIds))].sort();
  const coveredStateDigests = [...new Set(results.flatMap((result) => result.coverage.stateDigests))].sort();
  const coveredProviderOutcomes = [...new Set(results.flatMap((result) => result.coverage.providerOutcomes))].sort();
  const coveredEnvironmentModes = [...new Set(results.flatMap((result) => result.coverage.environmentModes))].sort();
  const assertionCount = results.reduce((count, result) => count + result.assertions.length, 0);
  const failedAssertionCount = results.reduce(
    (count, result) => count + result.assertions.filter((assertion) => !assertion.passed).length,
    0,
  );
  const uncoveredBlockIds = expectedBlockIds.filter((id) => !coveredBlockIds.includes(id));
  const uncoveredEdgeIds = expectedEdgeIds.filter((id) => !coveredEdgeIds.includes(id));
  const uncoveredEndingBlockIds = expectedEndingBlockIds.filter((id) => !coveredEndingBlockIds.includes(id));
  return {
    sourceChecksum,
    executedScenarioIds: results.map((result) => result.scenarioId).sort(),
    expectedBlockIds,
    coveredBlockIds,
    uncoveredBlockIds,
    expectedEdgeIds,
    coveredEdgeIds,
    uncoveredEdgeIds,
    expectedEndingBlockIds,
    coveredEndingBlockIds,
    uncoveredEndingBlockIds,
    coveredStateDigests,
    coveredProviderOutcomes,
    coveredEnvironmentModes,
    cataloguedFaults: DRYDOCK_FAULT_CATALOG.map((fault) => `${fault.family}:${fault.code}`),
    coveredFaultIds,
    assertionCount,
    failedAssertionCount,
    proofStatus:
      uncoveredBlockIds.length ||
      uncoveredEdgeIds.length ||
      uncoveredEndingBlockIds.length ||
      failedAssertionCount ||
      results.some((result) => result.status !== "COMPLETED")
        ? "INCOMPLETE_PROOF"
        : "COMPLETE",
  };
}

/** Safe, unsaved prompts for a Creator to turn visible coverage gaps into Scenarios. */
export function createDrydockScenarioSuggestions(report: DrydockCoverageReport): DrydockScenarioSuggestion[] {
  return [
    ...report.uncoveredBlockIds.map((target) => ({
      id: `block:${target}`,
      kind: "UNCOVERED_BLOCK" as const,
      sourceChecksum: report.sourceChecksum,
      target,
      safeHint: "Add a bounded Scenario that reaches this Passage.",
    })),
    ...report.uncoveredEdgeIds.map((target) => ({
      id: `edge:${target}`,
      kind: "UNCOVERED_EDGE" as const,
      sourceChecksum: report.sourceChecksum,
      target,
      safeHint: "Add a bounded Scenario that takes this authored edge.",
    })),
    ...report.uncoveredEndingBlockIds.map((target) => ({
      id: `ending:${target}`,
      kind: "UNCOVERED_ENDING" as const,
      sourceChecksum: report.sourceChecksum,
      target,
      safeHint: "Add a bounded Scenario that reaches this ending.",
    })),
    ...report.cataloguedFaults
      .filter((target) => !report.coveredFaultIds.includes(target))
      .map((target) => ({
        id: `fault:${target}`,
        kind: "UNCOVERED_FAULT" as const,
        sourceChecksum: report.sourceChecksum,
        target,
        safeHint: "Add this catalogued fault to a synthetic Scenario.",
      })),
  ];
}

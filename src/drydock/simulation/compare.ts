import type { DrydockSimulationTraceEntry } from "@/drydock/simulation/engine";

export type DrydockComparableReceipt = Readonly<{
  summary: Readonly<{ runId: string; sourceChecksum: string; status: string }>;
  result: Readonly<{
    runtimeAdapterVersion?: string;
    traceDigest?: string;
    coverage?: Readonly<{ blockIds?: readonly string[]; edgeIds?: readonly string[]; faultIds?: readonly string[] }>;
    assertions?: readonly Readonly<{ kind: string; passed: boolean }>[];
  }>;
  trace: readonly DrydockSimulationTraceEntry[];
}>;

export type DrydockStateDiff = Readonly<{
  from: Pick<DrydockSimulationTraceEntry, "ordinal" | "blockId" | "status" | "stateDigest">;
  to: Pick<DrydockSimulationTraceEntry, "ordinal" | "blockId" | "status" | "stateDigest">;
  changed: ReadonlyArray<"currentPassage" | "completionState" | "canonicalState" | "eventIntents" | "faults">;
  eventIntents: Readonly<{ before: readonly string[]; after: readonly string[] }>;
  faults: Readonly<{ before: readonly string[]; after: readonly string[] }>;
}>;

function semanticTraceEntry(entry: DrydockSimulationTraceEntry) {
  return {
    blockId: entry.blockId,
    inputKind: entry.inputKind,
    intentTypes: entry.intentTypes,
    faultIds: entry.faultIds,
    status: entry.status,
    stateDigest: entry.stateDigest,
  };
}

function setDifference(before: readonly string[] = [], after: readonly string[] = []) {
  return {
    added: after.filter((value) => !before.includes(value)),
    removed: before.filter((value) => !after.includes(value)),
  };
}

/**
 * Produces a semantic-only receipt comparison. Run IDs and timestamps are
 * deliberately excluded; source and adapter differences remain visible rather
 * than being normalized away.
 */
export function compareDrydockReceipts(left: DrydockComparableReceipt, right: DrydockComparableReceipt) {
  const length = Math.max(left.trace.length, right.trace.length);
  let firstDivergence: { ordinal: number; kind: "TRACE_MISMATCH" | "TRACE_LENGTH_MISMATCH" } | null = null;
  for (let index = 0; index < length; index += 1) {
    const before = left.trace[index];
    const after = right.trace[index];
    if (!before || !after) {
      firstDivergence = { ordinal: index + 1, kind: "TRACE_LENGTH_MISMATCH" };
      break;
    }
    if (JSON.stringify(semanticTraceEntry(before)) !== JSON.stringify(semanticTraceEntry(after))) {
      firstDivergence = { ordinal: index + 1, kind: "TRACE_MISMATCH" };
      break;
    }
  }
  const leftCoverage = left.result.coverage ?? {};
  const rightCoverage = right.result.coverage ?? {};
  const assertionChanged =
    JSON.stringify(left.result.assertions ?? []) !== JSON.stringify(right.result.assertions ?? []);
  return {
    source: {
      left: left.summary.sourceChecksum,
      right: right.summary.sourceChecksum,
      same: left.summary.sourceChecksum === right.summary.sourceChecksum,
    },
    adapter: {
      left: left.result.runtimeAdapterVersion ?? "unknown",
      right: right.result.runtimeAdapterVersion ?? "unknown",
      same: left.result.runtimeAdapterVersion === right.result.runtimeAdapterVersion,
    },
    result: {
      left: left.summary.status,
      right: right.summary.status,
      same: left.summary.status === right.summary.status,
    },
    trace: {
      leftDigest: left.result.traceDigest ?? "unknown",
      rightDigest: right.result.traceDigest ?? "unknown",
      same: left.result.traceDigest === right.result.traceDigest,
      firstDivergence,
    },
    coverage: {
      blocks: setDifference(leftCoverage.blockIds, rightCoverage.blockIds),
      edges: setDifference(leftCoverage.edgeIds, rightCoverage.edgeIds),
      faults: setDifference(leftCoverage.faultIds, rightCoverage.faultIds),
    },
    assertionsChanged: assertionChanged,
    compatible: left.summary.sourceChecksum === right.summary.sourceChecksum,
  };
}

/** A privacy-safe before/after projection for the Trace Inspector. */
export function diffDrydockTraceStates(
  trace: readonly DrydockSimulationTraceEntry[],
  fromOrdinal: number,
  toOrdinal: number,
): DrydockStateDiff {
  const from = trace.find((entry) => entry.ordinal === fromOrdinal);
  const to = trace.find((entry) => entry.ordinal === toOrdinal);
  if (!from || !to) throw new Error("DRYDOCK_TRACE_STATE_UNAVAILABLE");
  const changed: Array<DrydockStateDiff["changed"][number]> = [];
  if (from.blockId !== to.blockId) changed.push("currentPassage");
  if (from.status !== to.status) changed.push("completionState");
  if (from.stateDigest !== to.stateDigest) changed.push("canonicalState");
  if (JSON.stringify(from.intentTypes) !== JSON.stringify(to.intentTypes)) changed.push("eventIntents");
  if (JSON.stringify(from.faultIds) !== JSON.stringify(to.faultIds)) changed.push("faults");
  return {
    from: { ordinal: from.ordinal, blockId: from.blockId, status: from.status, stateDigest: from.stateDigest },
    to: { ordinal: to.ordinal, blockId: to.blockId, status: to.status, stateDigest: to.stateDigest },
    changed,
    eventIntents: { before: from.intentTypes, after: to.intentTypes },
    faults: { before: from.faultIds, after: to.faultIds },
  };
}

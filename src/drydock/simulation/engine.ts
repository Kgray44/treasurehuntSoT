import type { JsonObject, PublishedTaleSnapshot } from "@/chronicle/types";
import { enabledSnapshotBlocks, planCanonicalCompletion, type CanonicalRuntimeState } from "@/chronicle/runtime-semantics";
import { canonicalChecksum } from "@/drydock/canonical";
import { advanceDrydockVirtualClock, createDrydockVirtualClock, type DrydockVirtualClock } from "@/drydock/simulation/clock";
import type { DrydockFaultScheduleEntry, DrydockScenario, DrydockScenarioAssertion, DrydockScenarioInput } from "@/drydock/simulation/model";
import { createDrydockSeededRandom, type DrydockSeededRandom } from "@/drydock/simulation/random";
import { parseDrydockScenario } from "@/drydock/simulation/schema";

export const DRYDOCK_SIMULATION_ENGINE_VERSION = "drydock-simulation-v1";
export const ONE_VOYAGE_TRANSITION_ADAPTER_VERSION = "one-voyage-transition-v1";

export type DrydockSimulationStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "INCOMPLETE_PROOF" | "CANCELLED" | "FAILED";

export type DrydockSimulationTraceEntry = Readonly<{
  ordinal: number;
  virtualAt: string;
  blockId: string | null;
  inputKind: DrydockScenarioInput["kind"] | "FAULT" | "CANCELLED";
  intentTypes: readonly string[];
  faultIds: readonly string[];
  status: DrydockSimulationStatus;
  stateDigest: string;
}>;

export type DrydockSimulationCoverage = Readonly<{
  blockIds: readonly string[];
  edgeIds: readonly string[];
  eventTypes: readonly string[];
  faultIds: readonly string[];
  environmentModes: readonly string[];
}>;

export type DrydockAssertionResult = Readonly<{
  kind: DrydockScenarioAssertion["kind"];
  passed: boolean;
}>;

export type DrydockSimulationResult = Readonly<{
  engineVersion: typeof DRYDOCK_SIMULATION_ENGINE_VERSION;
  runtimeAdapterVersion: typeof ONE_VOYAGE_TRANSITION_ADAPTER_VERSION;
  sourceChecksum: string;
  scenarioId: string;
  scenarioRevision: number;
  status: DrydockSimulationStatus;
  clock: DrydockVirtualClock;
  random: DrydockSeededRandom;
  trace: readonly DrydockSimulationTraceEntry[];
  coverage: DrydockSimulationCoverage;
  assertions: readonly DrydockAssertionResult[];
  traceDigest: string;
}>;

type MutableSimulation = {
  snapshot: PublishedTaleSnapshot;
  state: CanonicalRuntimeState;
  status: DrydockSimulationStatus;
  clock: DrydockVirtualClock;
  random: DrydockSeededRandom;
  trace: DrydockSimulationTraceEntry[];
  coveredBlocks: Set<string>;
  coveredEdges: Set<string>;
  eventTypes: Set<string>;
  faultIds: Set<string>;
  environmentModes: Set<string>;
  seenStates: Set<string>;
};

function stateDigest(state: CanonicalRuntimeState) {
  return canonicalChecksum({
    currentBlockId: state.currentBlockId,
    inventory: [...state.inventory].sort((left, right) => left.localeCompare(right, "en")),
    status: state.status,
    variables: state.variables,
  });
}

function simulationStatus(state: CanonicalRuntimeState): Extract<DrydockSimulationStatus, "ACTIVE" | "PAUSED" | "COMPLETED"> {
  return state.status;
}

function appendTrace(
  runtime: MutableSimulation,
  scenario: DrydockScenario,
  inputKind: DrydockSimulationTraceEntry["inputKind"],
  intentTypes: readonly string[],
  faultIds: readonly string[],
) {
  if (runtime.trace.length >= scenario.limits.maxTraceEntries) {
    runtime.status = "INCOMPLETE_PROOF";
    return false;
  }
  runtime.trace.push({
    ordinal: runtime.trace.length + 1,
    virtualAt: runtime.clock.currentAt,
    blockId: runtime.state.currentBlockId,
    inputKind,
    intentTypes,
    faultIds,
    status: runtime.status,
    stateDigest: stateDigest(runtime.state),
  });
  return true;
}

function recordState(runtime: MutableSimulation, scenario: DrydockScenario) {
  const digest = stateDigest(runtime.state);
  runtime.seenStates.add(digest);
  if (runtime.seenStates.size > scenario.limits.maxStates) runtime.status = "INCOMPLETE_PROOF";
}

function dueFaults(scenario: DrydockScenario, inputIndex: number) {
  return scenario.faults.filter((fault) => fault.beforeInput === inputIndex);
}

function applyFaults(runtime: MutableSimulation, scenario: DrydockScenario, faults: readonly DrydockFaultScheduleEntry[]) {
  for (const fault of faults) {
    runtime.faultIds.add(fault.id);
    runtime.eventTypes.add(`fault:${fault.family}:${fault.code}`);
    if (fault.family === "RUNTIME" && fault.code === "CANCEL") runtime.status = "CANCELLED";
    if (fault.family === "NETWORK" && fault.code === "OFFLINE") runtime.status = "PAUSED";
  }
  if (faults.length) appendTrace(runtime, scenario, "FAULT", faults.map((fault) => `fault:${fault.family}:${fault.code}`), faults.map((fault) => fault.id));
}

function rejectsCompletion(input: DrydockScenarioInput) {
  if (input.kind === "TEXT_ANSWER") return input.outcome !== "MATCH";
  if (input.kind === "CAPTAIN") return input.outcome === "REJECT";
  if (input.kind === "PROVIDER") return input.outcome !== "MATCH";
  return false;
}

function executeCompletion(runtime: MutableSimulation, scenario: DrydockScenario, input: DrydockScenarioInput) {
  const beforeBlockId = runtime.state.currentBlockId;
  if (!beforeBlockId) {
    runtime.status = "FAILED";
    appendTrace(runtime, scenario, input.kind, ["error:current-block-unavailable"], []);
    return;
  }
  if (input.kind === "CHOICE") {
    const current = enabledSnapshotBlocks(runtime.snapshot).find((block) => block.id === beforeBlockId);
    if (!current || !current.connections.some((connection) => connection.connectionType === "CHOICE" && connection.targetBlockId === input.targetBlockId)) {
      runtime.status = "FAILED";
      appendTrace(runtime, scenario, input.kind, ["error:choice-target-unavailable"], []);
      return;
    }
  }
  const selectedTargetId = input.kind === "CHOICE" ? input.targetBlockId : undefined;
  const plan = planCanonicalCompletion(runtime.snapshot, runtime.state, {
    selectedTargetId,
  });
  runtime.state = plan.state;
  runtime.status = simulationStatus(plan.state);
  for (const intent of plan.intents) {
    runtime.eventTypes.add(intent.eventType);
    if (intent.blockId) runtime.coveredBlocks.add(intent.blockId);
  }
  if (beforeBlockId && plan.nextBlockId) runtime.coveredEdges.add(`${beforeBlockId}->${plan.nextBlockId}`);
  recordState(runtime, scenario);
  appendTrace(runtime, scenario, input.kind, plan.intents.map((intent) => intent.eventType), []);
}

function applyInput(runtime: MutableSimulation, scenario: DrydockScenario, input: DrydockScenarioInput) {
  if (input.kind === "ADVANCE_TIME") {
    try {
      runtime.clock = advanceDrydockVirtualClock(runtime.clock, input.milliseconds, scenario.limits.maxVirtualMilliseconds);
      appendTrace(runtime, scenario, input.kind, ["virtualTimeAdvanced"], []);
    } catch {
      runtime.status = "INCOMPLETE_PROOF";
      appendTrace(runtime, scenario, input.kind, ["virtualTimeLimitExceeded"], []);
    }
    return;
  }
  if (input.kind === "PRESENTATION") {
    runtime.eventTypes.add(`presentation:${input.outcome}`);
    appendTrace(runtime, scenario, input.kind, [`presentation:${input.outcome}`], []);
    return;
  }
  if (rejectsCompletion(input)) {
    const eventType = input.kind === "PROVIDER" && input.outcome === "UNCERTAIN" ? "verificationUncertain" : "verificationRejected";
    runtime.eventTypes.add(eventType);
    appendTrace(runtime, scenario, input.kind, [eventType], []);
    return;
  }
  executeCompletion(runtime, scenario, input);
}

function evaluateAssertions(runtime: MutableSimulation, assertions: readonly DrydockScenarioAssertion[]): DrydockAssertionResult[] {
  return assertions.map((assertion) => {
    if (assertion.kind === "CURRENT_BLOCK") return { kind: assertion.kind, passed: runtime.state.currentBlockId === assertion.blockId };
    if (assertion.kind === "STATUS") return { kind: assertion.kind, passed: runtime.status === assertion.status };
    if (assertion.kind === "EVENT_COUNT")
      return {
        kind: assertion.kind,
        passed: runtime.trace.flatMap((entry) => entry.intentTypes).filter((eventType) => eventType === assertion.eventType).length === assertion.count,
      };
    return { kind: assertion.kind, passed: runtime.coveredBlocks.has(assertion.blockId) };
  });
}

export function runDrydockScenario(
  snapshot: PublishedTaleSnapshot,
  uncheckedScenario: unknown,
  options: Readonly<{ cancelled?: () => boolean }> = {},
): DrydockSimulationResult {
  const scenario = parseDrydockScenario(uncheckedScenario);
  const sourceChecksum = canonicalChecksum(snapshot);
  if (scenario.sourceChecksum !== sourceChecksum) throw new Error("Scenario source checksum is stale.");
  const enabledBlocks = enabledSnapshotBlocks(snapshot);
  const first = scenario.initialState.startBlockId
    ? enabledBlocks.find((block) => block.id === scenario.initialState.startBlockId)
    : enabledBlocks[0];
  if (!first) throw new Error("Simulation source has no enabled Passage.");
  const runtime: MutableSimulation = {
    snapshot,
    state: {
      currentBlockId: first.id,
      variables: { ...scenario.initialState.variables } as JsonObject,
      inventory: [...scenario.initialState.inventory],
      status: "ACTIVE",
    },
    status: "ACTIVE",
    clock: createDrydockVirtualClock(scenario.environment.virtualStart),
    random: createDrydockSeededRandom(scenario.seed),
    trace: [],
    coveredBlocks: new Set([first.id]),
    coveredEdges: new Set(),
    eventTypes: new Set(["blockEntered"]),
    faultIds: new Set(),
    environmentModes: new Set([
      `viewport:${scenario.environment.viewport}`,
      `reducedMotion:${scenario.environment.reducedMotion}`,
      `sound:${scenario.environment.soundEnabled}`,
      `keyboard:${scenario.environment.keyboardOnly}`,
    ]),
    seenStates: new Set(),
  };
  recordState(runtime, scenario);

  for (let inputIndex = 0; inputIndex < scenario.inputs.length && runtime.status === "ACTIVE"; inputIndex += 1) {
    if (inputIndex >= scenario.limits.maxSteps) {
      runtime.status = "INCOMPLETE_PROOF";
      break;
    }
    if (options.cancelled?.()) {
      runtime.status = "CANCELLED";
      appendTrace(runtime, scenario, "CANCELLED", ["simulationCancelled"], []);
      break;
    }
    const faults = dueFaults(scenario, inputIndex);
    applyFaults(runtime, scenario, faults);
    if (runtime.status !== "ACTIVE") break;
    applyInput(runtime, scenario, scenario.inputs[inputIndex]!);
  }

  const assertions = evaluateAssertions(runtime, scenario.assertions);
  const trace = runtime.trace.map((entry) => ({ ...entry }));
  return {
    engineVersion: DRYDOCK_SIMULATION_ENGINE_VERSION,
    runtimeAdapterVersion: ONE_VOYAGE_TRANSITION_ADAPTER_VERSION,
    sourceChecksum,
    scenarioId: scenario.id,
    scenarioRevision: scenario.revision,
    status: runtime.status,
    clock: runtime.clock,
    random: runtime.random,
    trace,
    coverage: {
      blockIds: [...runtime.coveredBlocks].sort((left, right) => left.localeCompare(right, "en")),
      edgeIds: [...runtime.coveredEdges].sort((left, right) => left.localeCompare(right, "en")),
      eventTypes: [...runtime.eventTypes].sort((left, right) => left.localeCompare(right, "en")),
      faultIds: [...runtime.faultIds].sort((left, right) => left.localeCompare(right, "en")),
      environmentModes: [...runtime.environmentModes].sort((left, right) => left.localeCompare(right, "en")),
    },
    assertions,
    traceDigest: canonicalChecksum(trace),
  };
}

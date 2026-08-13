import type { JsonObject, PublishedTaleSnapshot } from "@/chronicle/types";
import {
  enabledSnapshotBlocks,
  planCanonicalCompletion,
  type CanonicalRuntimeState,
} from "@/chronicle/runtime-semantics";
import { canonicalChecksum } from "@/drydock/canonical";
import {
  advanceDrydockVirtualClock,
  createDrydockVirtualClock,
  type DrydockVirtualClock,
} from "@/drydock/simulation/clock";
import type {
  DrydockFaultScheduleEntry,
  DrydockScenario,
  DrydockScenarioAssertion,
  DrydockScenarioInput,
} from "@/drydock/simulation/model";
import { createDrydockSeededRandom, type DrydockSeededRandom } from "@/drydock/simulation/random";
import { drydockFaultDefinition } from "@/drydock/simulation/faults";
import { parseDrydockScenario } from "@/drydock/simulation/schema";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

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
  endingBlockIds: readonly string[];
  stateDigests: readonly string[];
  providerOutcomes: readonly string[];
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
  currentBlockEnteredAt: string;
};

function stateDigest(state: CanonicalRuntimeState) {
  return canonicalChecksum({
    currentBlockId: state.currentBlockId,
    inventory: [...state.inventory].sort((left, right) => left.localeCompare(right, "en")),
    status: state.status,
    variables: state.variables,
  });
}

function simulationStatus(
  state: CanonicalRuntimeState,
): Extract<DrydockSimulationStatus, "ACTIVE" | "PAUSED" | "COMPLETED"> {
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

function applyFaults(
  runtime: MutableSimulation,
  scenario: DrydockScenario,
  faults: readonly DrydockFaultScheduleEntry[],
) {
  for (const fault of faults) {
    const definition = drydockFaultDefinition(fault.family, fault.code);
    if (!definition) {
      runtime.status = "FAILED";
      continue;
    }
    runtime.faultIds.add(fault.id);
    runtime.eventTypes.add(definition.safeEventType);
    if (definition.effect === "CANCEL") runtime.status = "CANCELLED";
    if (definition.effect === "PAUSE") runtime.status = "PAUSED";
    if (definition.effect === "INCOMPLETE_PROOF") runtime.status = "INCOMPLETE_PROOF";
    if (definition.effect === "PRESENTATION_FALLBACK") runtime.eventTypes.add("presentation:FALLBACK");
    if (definition.effect === "VERIFICATION_UNCERTAIN") runtime.eventTypes.add("verificationUncertain");
  }
  if (faults.length)
    appendTrace(
      runtime,
      scenario,
      "FAULT",
      faults.map((fault) => drydockFaultDefinition(fault.family, fault.code)?.safeEventType ?? "faultRejected"),
      faults.map((fault) => fault.id),
    );
}

function rejectsCompletion(input: DrydockScenarioInput) {
  if (input.kind === "TEXT_ANSWER") return input.outcome !== "MATCH";
  if (input.kind === "CAPTAIN") return input.outcome === "REJECT";
  if (input.kind === "PROVIDER") return input.outcome !== "MATCH";
  return false;
}

function blockAtCursor(runtime: MutableSimulation) {
  return runtime.state.currentBlockId
    ? (enabledSnapshotBlocks(runtime.snapshot).find((block) => block.id === runtime.state.currentBlockId) ?? null)
    : null;
}

function requiredInputKind(block: NonNullable<ReturnType<typeof blockAtCursor>>) {
  const provider = String(
    block.completion?.mode ??
      block.configuration.verificationProvider ??
      block.configuration.completionMode ??
      "playerConfirmation",
  );
  if (block.blockType === "choice") return "CHOICE" as const;
  if (provider === "textAnswer" || ["riddle", "textAnswer"].includes(block.blockType)) return "TEXT_ANSWER" as const;
  if (provider === "captainManual" || block.blockType === "captainApproval") return "CAPTAIN" as const;
  if (provider === "timer" || block.blockType === "wait") return "ADVANCE_TIME" as const;
  if (provider === "visionLocation") return "PROVIDER" as const;
  return "CONTINUE" as const;
}

function inputMatchesCurrentBlock(runtime: MutableSimulation, input: DrydockScenarioInput) {
  const block = blockAtCursor(runtime);
  if (!block) return false;
  return requiredInputKind(block) === input.kind;
}

function executeCompletion(runtime: MutableSimulation, scenario: DrydockScenario, input: DrydockScenarioInput) {
  const beforeBlockId = runtime.state.currentBlockId;
  if (!beforeBlockId) {
    runtime.status = "FAILED";
    appendTrace(runtime, scenario, input.kind, ["error:current-block-unavailable"], []);
    return;
  }
  if (!inputMatchesCurrentBlock(runtime, input)) {
    runtime.eventTypes.add("inputRejected");
    appendTrace(runtime, scenario, input.kind, ["inputRejected"], []);
    return;
  }
  if (input.kind === "CHOICE") {
    const current = enabledSnapshotBlocks(runtime.snapshot).find((block) => block.id === beforeBlockId);
    if (
      !current ||
      !current.connections.some(
        (connection) => connection.connectionType === "CHOICE" && connection.targetBlockId === input.targetBlockId,
      )
    ) {
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
  runtime.currentBlockEnteredAt = runtime.clock.currentAt;
  for (const intent of plan.intents) {
    runtime.eventTypes.add(intent.eventType);
    if (intent.blockId) runtime.coveredBlocks.add(intent.blockId);
  }
  if (beforeBlockId && plan.nextBlockId) runtime.coveredEdges.add(`${beforeBlockId}->${plan.nextBlockId}`);
  recordState(runtime, scenario);
  appendTrace(
    runtime,
    scenario,
    input.kind,
    plan.intents.map((intent) => intent.eventType),
    [],
  );
}

function applyInput(runtime: MutableSimulation, scenario: DrydockScenario, input: DrydockScenarioInput) {
  if (input.kind === "ADVANCE_TIME") {
    try {
      runtime.clock = advanceDrydockVirtualClock(
        runtime.clock,
        input.milliseconds,
        scenario.limits.maxVirtualMilliseconds,
      );
      const current = blockAtCursor(runtime);
      const requiredMilliseconds = Number(current?.configuration.durationSeconds ?? 0) * 1_000;
      const elapsedMilliseconds = Date.parse(runtime.clock.currentAt) - Date.parse(runtime.currentBlockEnteredAt);
      if (current && requiredInputKind(current) === "ADVANCE_TIME" && elapsedMilliseconds >= requiredMilliseconds)
        executeCompletion(runtime, scenario, input);
      else appendTrace(runtime, scenario, input.kind, ["virtualTimeAdvanced"], []);
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
  if (input.kind === "PROVIDER") runtime.eventTypes.add(`providerOutcome:${input.outcome}`);
  if (rejectsCompletion(input)) {
    const eventType =
      input.kind === "PROVIDER" && input.outcome === "UNCERTAIN" ? "verificationUncertain" : "verificationRejected";
    runtime.eventTypes.add(eventType);
    appendTrace(runtime, scenario, input.kind, [eventType], []);
    return;
  }
  executeCompletion(runtime, scenario, input);
}

function evaluateAssertions(
  runtime: MutableSimulation,
  assertions: readonly DrydockScenarioAssertion[],
): DrydockAssertionResult[] {
  const eventTypes = runtime.trace.flatMap((entry) => entry.intentTypes);
  const observedEventTypes = runtime.eventTypes;
  const currentBlock = blockAtCursor(runtime);
  const serializedTrace = JSON.stringify(runtime.trace);
  const countEvents = (eventType: string) => eventTypes.filter((value) => value === eventType).length;
  const inventoryContains = (artifactId: string) => runtime.state.inventory.includes(artifactId);
  return assertions.map((assertion) => {
    if (assertion.kind === "CURRENT_BLOCK")
      return { kind: assertion.kind, passed: runtime.state.currentBlockId === assertion.blockId };
    if (assertion.kind === "STATUS") return { kind: assertion.kind, passed: runtime.status === assertion.status };
    if (assertion.kind === "EVENT_COUNT")
      return {
        kind: assertion.kind,
        passed: countEvents(assertion.eventType) === assertion.count,
      };
    if (assertion.kind === "COVERED_BLOCK")
      return { kind: assertion.kind, passed: runtime.coveredBlocks.has(assertion.blockId) };
    if (assertion.kind === "CURRENT_BLOCK_IS")
      return { kind: assertion.kind, passed: runtime.state.currentBlockId === assertion.blockId };
    if (assertion.kind === "CURRENT_CHAPTER_IS")
      return { kind: assertion.kind, passed: currentBlock?.chapterId === assertion.chapterId };
    if (assertion.kind === "FINAL_OUTCOME_IS")
      return { kind: assertion.kind, passed: runtime.status === assertion.status };
    if (assertion.kind === "VARIABLE_EQUALS")
      return { kind: assertion.kind, passed: runtime.state.variables[assertion.variable] === assertion.expected };
    if (assertion.kind === "VARIABLE_NOT_EXPOSED")
      return { kind: assertion.kind, passed: !serializedTrace.includes(assertion.variable) };
    if (
      assertion.kind === "INVENTORY_CONTAINS" ||
      assertion.kind === "ARTIFACT_GRANTED" ||
      assertion.kind === "REVEAL_EXISTS"
    )
      return {
        kind: assertion.kind,
        passed: inventoryContains(assertion.kind === "REVEAL_EXISTS" ? assertion.revealId : assertion.artifactId),
      };
    if (assertion.kind === "INVENTORY_DOES_NOT_CONTAIN")
      return { kind: assertion.kind, passed: !inventoryContains(assertion.artifactId) };
    if (assertion.kind === "ARTIFACT_NOT_DUPLICATED")
      return {
        kind: assertion.kind,
        passed: runtime.state.inventory.filter((artifactId) => artifactId === assertion.artifactId).length <= 1,
      };
    if (assertion.kind === "SIDE_EFFECT_COUNT" || assertion.kind === "EVENT_INTENT_COUNT")
      return { kind: assertion.kind, passed: countEvents(assertion.eventType) === assertion.count };
    if (assertion.kind === "EVENT_INTENT_ORDER")
      return {
        kind: assertion.kind,
        passed:
          JSON.stringify(eventTypes.slice(0, assertion.eventTypes.length)) === JSON.stringify(assertion.eventTypes),
      };
    if (assertion.kind === "EVENT_INTENT_TYPE")
      return { kind: assertion.kind, passed: eventTypes.includes(assertion.eventType) };
    if (assertion.kind === "IDEMPOTENCY_PRESERVED")
      return { kind: assertion.kind, passed: runtime.state.inventory.length === new Set(runtime.state.inventory).size };
    if (assertion.kind === "PROVIDER_REQUESTED")
      return {
        kind: assertion.kind,
        passed: [...observedEventTypes].some((eventType) => eventType.startsWith("providerOutcome:")),
      };
    if (assertion.kind === "PROVIDER_OUTCOME")
      return { kind: assertion.kind, passed: observedEventTypes.has(`providerOutcome:${assertion.outcome}`) };
    if (assertion.kind === "PLAYER_SAFE_FIELD_PRESENT")
      return {
        kind: assertion.kind,
        passed: assertion.field === "status" || runtime.trace.every((entry) => Boolean(entry.stateDigest)),
      };
    if (assertion.kind === "PROTECTED_FIELD_ABSENT")
      return { kind: assertion.kind, passed: !serializedTrace.includes(assertion.field) };
    if (assertion.kind === "PRESENTATION_OUTCOME")
      return { kind: assertion.kind, passed: eventTypes.includes(`presentation:${assertion.outcome}`) };
    if (assertion.kind === "COVERAGE_THRESHOLD") {
      const count =
        assertion.domain === "BLOCKS"
          ? runtime.coveredBlocks.size
          : assertion.domain === "EDGES"
            ? runtime.coveredEdges.size
            : assertion.domain === "FAULTS"
              ? runtime.faultIds.size
              : runtime.environmentModes.size;
      return { kind: assertion.kind, passed: count >= assertion.minimum };
    }
    if (assertion.kind === "TRACE_STEP_LIMIT")
      return { kind: assertion.kind, passed: runtime.trace.length <= assertion.maximum };
    if (assertion.kind === "RUN_COMPLETES") return { kind: assertion.kind, passed: runtime.status === "COMPLETED" };
    if (assertion.kind === "RUN_REMAINS_INCOMPLETE")
      return { kind: assertion.kind, passed: runtime.status === "INCOMPLETE_PROOF" };
    return {
      kind: assertion.kind,
      passed: eventTypes.includes(`error:${assertion.code}`) || eventTypes.includes(assertion.code),
    };
  });
}

export function runDrydockScenario(
  snapshot: PublishedTaleSnapshot,
  uncheckedScenario: unknown,
  options: Readonly<{ cancelled?: () => boolean }> = {},
): DrydockSimulationResult {
  const scenario = parseDrydockScenario(uncheckedScenario);
  const sourceChecksum = drydockSimulationSourceChecksum(snapshot);
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
    currentBlockEnteredAt: scenario.environment.virtualStart,
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
      endingBlockIds:
        runtime.status === "COMPLETED" && runtime.state.currentBlockId ? [runtime.state.currentBlockId] : [],
      stateDigests: [...runtime.seenStates].sort((left, right) => left.localeCompare(right, "en")),
      providerOutcomes: [...runtime.eventTypes]
        .filter((eventType) => eventType.startsWith("providerOutcome:"))
        .sort((left, right) => left.localeCompare(right, "en")),
      eventTypes: [...runtime.eventTypes].sort((left, right) => left.localeCompare(right, "en")),
      faultIds: [...runtime.faultIds].sort((left, right) => left.localeCompare(right, "en")),
      environmentModes: [...runtime.environmentModes].sort((left, right) => left.localeCompare(right, "en")),
    },
    assertions,
    traceDigest: canonicalChecksum(trace),
  };
}

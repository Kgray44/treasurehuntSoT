export const DRYDOCK_SCENARIO_SCHEMA_VERSION = 1;

export type DrydockSimulationLimits = Readonly<{
  maxSteps: number;
  maxStates: number;
  maxTraceEntries: number;
  maxVirtualMilliseconds: number;
}>;

export type DrydockScenarioEnvironment = Readonly<{
  virtualStart: string;
  locale: string;
  viewport: "DESKTOP" | "MOBILE" | "NARROW";
  reducedMotion: boolean;
  soundEnabled: boolean;
  keyboardOnly: boolean;
}>;

export type DrydockScenarioInput =
  | Readonly<{ kind: "CONTINUE" }>
  | Readonly<{ kind: "CHOICE"; targetBlockId: string }>
  | Readonly<{ kind: "TEXT_ANSWER"; outcome: "MATCH" | "NO_MATCH" | "EXHAUSTED" }>
  | Readonly<{ kind: "CAPTAIN"; outcome: "APPROVE" | "REJECT" | "OVERRIDE" }>
  | Readonly<{
      kind: "PROVIDER";
      outcome: "MATCH" | "NO_MATCH" | "UNCERTAIN" | "UNAVAILABLE" | "STALE" | "DUPLICATE" | "CANCELLED";
    }>
  | Readonly<{ kind: "ADVANCE_TIME"; milliseconds: number }>
  | Readonly<{ kind: "PRESENTATION"; outcome: "PRESENTED" | "FALLBACK" | "SKIPPED" | "INTERRUPTED" | "FAILED" }>;

export type DrydockFaultFamily =
  | "NETWORK"
  | "ASSET"
  | "PROVIDER"
  | "RUNTIME"
  | "PRESENTATION"
  | "DEVICE"
  | "ACCESSIBILITY"
  | "TIME";

export type DrydockFaultScheduleEntry = Readonly<{
  id: string;
  family: DrydockFaultFamily;
  code: string;
  beforeInput: number;
}>;

export type DrydockScenarioAssertion =
  | Readonly<{ kind: "CURRENT_BLOCK"; blockId: string }>
  | Readonly<{
      kind: "STATUS";
      status: "ACTIVE" | "PAUSED" | "COMPLETED" | "INCOMPLETE_PROOF" | "CANCELLED" | "FAILED";
    }>
  | Readonly<{ kind: "EVENT_COUNT"; eventType: string; count: number }>
  | Readonly<{ kind: "COVERED_BLOCK"; blockId: string }>
  | Readonly<{ kind: "CURRENT_BLOCK_IS"; blockId: string }>
  | Readonly<{ kind: "CURRENT_CHAPTER_IS"; chapterId: string }>
  | Readonly<{
      kind: "FINAL_OUTCOME_IS";
      status: "ACTIVE" | "PAUSED" | "COMPLETED" | "INCOMPLETE_PROOF" | "CANCELLED" | "FAILED";
    }>
  | Readonly<{ kind: "VARIABLE_EQUALS"; variable: string; expected: boolean | number | string }>
  | Readonly<{ kind: "VARIABLE_NOT_EXPOSED"; variable: string }>
  | Readonly<{ kind: "INVENTORY_CONTAINS"; artifactId: string }>
  | Readonly<{ kind: "INVENTORY_DOES_NOT_CONTAIN"; artifactId: string }>
  | Readonly<{ kind: "ARTIFACT_GRANTED"; artifactId: string }>
  | Readonly<{ kind: "ARTIFACT_NOT_DUPLICATED"; artifactId: string }>
  | Readonly<{ kind: "REVEAL_EXISTS"; revealId: string }>
  | Readonly<{ kind: "SIDE_EFFECT_COUNT"; eventType: string; count: number }>
  | Readonly<{ kind: "EVENT_INTENT_COUNT"; eventType: string; count: number }>
  | Readonly<{ kind: "EVENT_INTENT_ORDER"; eventTypes: string[] }>
  | Readonly<{ kind: "EVENT_INTENT_TYPE"; eventType: string }>
  | Readonly<{ kind: "IDEMPOTENCY_PRESERVED" }>
  | Readonly<{ kind: "PROVIDER_REQUESTED" }>
  | Readonly<{
      kind: "PROVIDER_OUTCOME";
      outcome: "MATCH" | "NO_MATCH" | "UNCERTAIN" | "UNAVAILABLE" | "STALE" | "DUPLICATE" | "CANCELLED";
    }>
  | Readonly<{ kind: "PLAYER_SAFE_FIELD_PRESENT"; field: "stateDigest" | "status" }>
  | Readonly<{ kind: "PROTECTED_FIELD_ABSENT"; field: string }>
  | Readonly<{ kind: "PRESENTATION_OUTCOME"; outcome: "PRESENTED" | "FALLBACK" | "SKIPPED" | "INTERRUPTED" | "FAILED" }>
  | Readonly<{ kind: "COVERAGE_THRESHOLD"; domain: "BLOCKS" | "EDGES" | "FAULTS" | "ENVIRONMENT"; minimum: number }>
  | Readonly<{ kind: "TRACE_STEP_LIMIT"; maximum: number }>
  | Readonly<{ kind: "RUN_COMPLETES" }>
  | Readonly<{ kind: "RUN_REMAINS_INCOMPLETE" }>
  | Readonly<{ kind: "ERROR_CLASS_IS"; code: string }>;

export type DrydockScenario = Readonly<{
  schemaVersion: typeof DRYDOCK_SCENARIO_SCHEMA_VERSION;
  id: string;
  revision: number;
  sourceChecksum: string;
  title: string;
  purpose: string;
  seed: string;
  initialState: Readonly<{
    startBlockId?: string;
    variables: Record<string, boolean | number | string | string[]>;
    inventory: string[];
    actorMode: "PLAYER" | "CAPTAIN" | "CREATOR";
  }>;
  environment: DrydockScenarioEnvironment;
  limits: DrydockSimulationLimits;
  inputs: readonly DrydockScenarioInput[];
  faults: readonly DrydockFaultScheduleEntry[];
  assertions: readonly DrydockScenarioAssertion[];
  tags: readonly string[];
}>;

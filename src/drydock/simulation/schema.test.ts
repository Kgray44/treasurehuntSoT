import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { parseDrydockScenario } from "@/drydock/simulation/schema";

const scenario = () => ({
  schemaVersion: 1,
  id: "scenario-linear",
  revision: 1,
  sourceChecksum: canonicalChecksum({ synthetic: true }),
  title: "Synthetic linear trial",
  purpose: "Prove deterministic safe scenario parsing.",
  seed: "sea-trial-seed",
  initialState: { variables: { counter: 1 }, inventory: [], actorMode: "CREATOR" },
  environment: {
    virtualStart: "2026-08-12T00:00:00.000Z",
    locale: "en-US",
    viewport: "DESKTOP",
    reducedMotion: true,
    soundEnabled: false,
    keyboardOnly: true,
  },
  limits: { maxSteps: 20, maxStates: 20, maxTraceEntries: 20, maxVirtualMilliseconds: 10_000 },
  inputs: [{ kind: "CONTINUE" }],
  faults: [],
  assertions: [{ kind: "STATUS", status: "ACTIVE" }],
  tags: ["synthetic"],
});

describe("Drydock Scenario schema", () => {
  it("accepts a bounded versioned Scenario with outcome tokens only", () => {
    expect(parseDrydockScenario(scenario())).toMatchObject({ id: "scenario-linear", schemaVersion: 1 });
  });

  it("rejects executable or raw-answer-shaped Scenario content", () => {
    expect(() => parseDrydockScenario({ ...scenario(), script: "process.exit(1)" })).toThrow();
    expect(() =>
      parseDrydockScenario({ ...scenario(), inputs: [{ kind: "TEXT_ANSWER", answer: "secret" }] }),
    ).toThrow();
  });

  it("fails closed when trace limits cannot retain the declared Scenario", () => {
    expect(() =>
      parseDrydockScenario({ ...scenario(), limits: { ...scenario().limits, maxTraceEntries: 0 } }),
    ).toThrow();
  });

  it("fails closed when a Scenario names a fault outside the governed catalog", () => {
    expect(() =>
      parseDrydockScenario({
        ...scenario(),
        faults: [{ id: "fault", family: "NETWORK", code: "UNKNOWN", beforeInput: 0 }],
      }),
    ).toThrow(/registered Drydock fault catalog/u);
  });

  it("accepts the governed assertion vocabulary while keeping values bounded and typed", () => {
    const assertions = [
      { kind: "CURRENT_BLOCK_IS", blockId: "block" },
      { kind: "CURRENT_CHAPTER_IS", chapterId: "chapter" },
      { kind: "FINAL_OUTCOME_IS", status: "COMPLETED" },
      { kind: "VARIABLE_EQUALS", variable: "counter", expected: 1 },
      { kind: "VARIABLE_NOT_EXPOSED", variable: "secret" },
      { kind: "INVENTORY_CONTAINS", artifactId: "artifact" },
      { kind: "INVENTORY_DOES_NOT_CONTAIN", artifactId: "artifact" },
      { kind: "ARTIFACT_GRANTED", artifactId: "artifact" },
      { kind: "ARTIFACT_NOT_DUPLICATED", artifactId: "artifact" },
      { kind: "REVEAL_EXISTS", revealId: "artifact" },
      { kind: "SIDE_EFFECT_COUNT", eventType: "blockCompleted", count: 1 },
      { kind: "EVENT_INTENT_COUNT", eventType: "blockCompleted", count: 1 },
      { kind: "EVENT_INTENT_ORDER", eventTypes: ["blockCompleted"] },
      { kind: "EVENT_INTENT_TYPE", eventType: "blockCompleted" },
      { kind: "IDEMPOTENCY_PRESERVED" },
      { kind: "PROVIDER_REQUESTED" },
      { kind: "PROVIDER_OUTCOME", outcome: "MATCH" },
      { kind: "PLAYER_SAFE_FIELD_PRESENT", field: "stateDigest" },
      { kind: "PROTECTED_FIELD_ABSENT", field: "private-prose" },
      { kind: "PRESENTATION_OUTCOME", outcome: "PRESENTED" },
      { kind: "COVERAGE_THRESHOLD", domain: "BLOCKS", minimum: 1 },
      { kind: "TRACE_STEP_LIMIT", maximum: 20 },
      { kind: "RUN_COMPLETES" },
      { kind: "RUN_REMAINS_INCOMPLETE" },
      { kind: "ERROR_CLASS_IS", code: "inputRejected" },
    ];

    expect(parseDrydockScenario({ ...scenario(), assertions }).assertions).toHaveLength(assertions.length);
  });
});

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
    expect(() => parseDrydockScenario({ ...scenario(), inputs: [{ kind: "TEXT_ANSWER", answer: "secret" }] })).toThrow();
  });

  it("fails closed when trace limits cannot retain the declared Scenario", () => {
    expect(() => parseDrydockScenario({ ...scenario(), limits: { ...scenario().limits, maxTraceEntries: 0 } })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultReachRuntimePolicy,
  defaultReachRuntimePolicyEnvelope,
  reachRuntimePolicySchema,
  reachRuntimePolicyEnvelopeSchema,
} from "./runtime-policy";

describe("strict Reach administrative policy boundary", () => {
  it("preserves the agreed defaults without exposing recognition or accuracy knobs", () => {
    expect(reachRuntimePolicyEnvelopeSchema.parse(defaultReachRuntimePolicyEnvelope)).toEqual({
      schemaVersion: 1,
      revision: 0,
      policy: {
        featureEnabled: true,
        normalMaximumHz: 15,
        modelMaximumHz: 60,
        calibrationMaximumHz: 60,
        unfocusedMaximumHz: 8,
        telemetryEnabled: true,
        telemetryRetentionDays: 30,
        localRecorderEnabled: true,
      },
    });
    expect(
      reachRuntimePolicySchema.safeParse({ ...defaultReachRuntimePolicy, maximumObservationAgeMs: 300 }).success,
    ).toBe(false);
  });
  it.each([
    { normalMaximumHz: 4 },
    { normalMaximumHz: 31 },
    { modelMaximumHz: 4 },
    { modelMaximumHz: 61 },
    { calibrationMaximumHz: 61 },
    { calibrationMaximumHz: 14 },
    { unfocusedMaximumHz: 9 },
    { normalMaximumHz: 5, unfocusedMaximumHz: 6 },
    { telemetryRetentionDays: 6 },
    { telemetryRetentionDays: 91 },
    { featureEnabled: "true" },
    { normalMaximumHz: 15.5 },
    { localRecorderEnabled: null },
  ])("rejects invalid or contradictory values %j", (change) => {
    expect(reachRuntimePolicySchema.safeParse({ ...defaultReachRuntimePolicy, ...change }).success).toBe(false);
  });
  it("accepts bounded mandatory availability and lower ceilings without loosening safety", () => {
    expect(
      reachRuntimePolicySchema.parse({
        ...defaultReachRuntimePolicy,
        featureEnabled: false,
        normalMaximumHz: 5,
        calibrationMaximumHz: 5,
        unfocusedMaximumHz: 1,
        telemetryEnabled: false,
      }),
    ).toMatchObject({ featureEnabled: false, normalMaximumHz: 5 });
  });
  it.each([{ schemaVersion: 2 }, { revision: -1 }, { revision: Infinity }, { source: "UNTRUSTED" }])(
    "rejects an invalid public envelope %j",
    (change) => {
      expect(
        reachRuntimePolicyEnvelopeSchema.safeParse({ ...defaultReachRuntimePolicyEnvelope, ...change }).success,
      ).toBe(false);
    },
  );
});

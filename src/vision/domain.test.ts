import { describe, expect, it } from "vitest";
import {
  assertAttemptTransition,
  defaultDraftConfiguration,
  scenarioOutcome,
  terminalStateForResult,
  visionWaypointDraftConfigurationSchema,
  VisionDomainError,
} from "@/vision/domain";

describe("Vision Waypoint domain", () => {
  it("creates a model-agnostic, versioned draft configuration", () => {
    const draft = defaultDraftConfiguration("EXACT_LANDMARK", "STORY_CRITICAL");
    expect(visionWaypointDraftConfigurationSchema.parse(draft)).toMatchObject({
      schemaVersion: 1,
      waypointType: "EXACT_LANDMARK",
      verificationProfile: "STORY_CRITICAL",
    });
    expect(JSON.stringify(draft)).not.toMatch(/LightGlue|DINO|COLMAP|ONNX/i);
  });

  it("enforces the governed attempt graph", () => {
    expect(() => assertAttemptTransition("IDLE", "ARMED")).not.toThrow();
    expect(() => assertAttemptTransition("ARMED", "CAPTURING")).not.toThrow();
    expect(() => assertAttemptTransition("IDLE", "VERIFIED")).toThrow(VisionDomainError);
    expect(() => assertAttemptTransition("CLOSED", "CAPTURING")).toThrow(/cannot move/i);
  });

  it("maps every deterministic scenario to a governed result and terminal state", () => {
    expect(Object.keys(scenarioOutcome)).toHaveLength(9);
    expect(scenarioOutcome.verified.result).toBe("VERIFIED");
    expect(scenarioOutcome.duplicate_result_delivery.result).toBe("VERIFIED");
    for (const outcome of Object.values(scenarioOutcome)) expect(terminalStateForResult(outcome.result)).toBeTruthy();
    expect(terminalStateForResult("INSUFFICIENT_VISUAL_EVIDENCE")).toBe("INSUFFICIENT");
  });
});

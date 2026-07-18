import { describe, expect, it } from "vitest";
import {
  effectiveRuntimeMode,
  guidanceForResult,
  issueStageToken,
  offlineReconciliationSchema,
  runtimeResultPayloadHash,
  sanitizeRuntimeDiagnostics,
  verifyStageToken,
  type StageTokenContext,
} from "@/vision/runtime-contract";

const context: StageTokenContext = {
  attemptId: "att_runtime_0001",
  playerId: "player_00000001",
  sessionId: "session_0000001",
  storyId: "story_00000001",
  publishedVersionId: "version_000001",
  stageId: "stage_00000001",
  storyBindingId: "binding_000001",
  waypointVersionId: "waypoint_version_01",
  packageHash: `sha256:${"a".repeat(64)}`,
  companionInstanceId: "companion_000001",
  storyStateVersion: 7,
  runtimeMode: "CAPTAIN_CONFIRMED",
};
const secret = "test-stage-token-secret-that-is-more-than-32-characters";

describe("B-5 runtime contract", () => {
  it("binds a short-lived signed token to the complete story and package context", () => {
    const issued = issueStageToken(context, { secret, now: 1_000, ttlMs: 60_000 });
    expect(issued.token).toMatch(/^stg_/);
    expect(verifyStageToken(issued.token, context, { secret, now: 2_000 }).valid).toBe(true);
    expect(verifyStageToken(issued.token, { ...context, stageId: "stage_changed_01" }, { secret, now: 2_000 })).toEqual(
      { valid: false, reason: "SIGNATURE" },
    );
    expect(verifyStageToken(issued.token, context, { secret, now: 70_000 })).toEqual({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("never enables automatic mode without every certification and field-evidence gate", () => {
    const base = {
      configuredMode: "AUTOMATIC" as const,
      shadowEnabled: true,
      automaticEnabled: true,
      automaticEligibility: true,
      certificationApprovedModes: ["AUTOMATIC"],
      fieldEvidenceStatus: "PASSED",
    };
    expect(effectiveRuntimeMode(base).mode).toBe("AUTOMATIC");
    expect(effectiveRuntimeMode({ ...base, automaticEligibility: false })).toEqual({
      mode: "CAPTAIN_CONFIRMED",
      reason: "AUTOMATIC_NOT_CERTIFIED",
    });
    expect(effectiveRuntimeMode({ ...base, automaticPaused: true }).mode).toBe("CAPTAIN_CONFIRMED");
  });

  it("preserves result distinctions and strips raw frame material from diagnostics", () => {
    expect(guidanceForResult("INSUFFICIENT_VISUAL_EVIDENCE").message).not.toContain("wrong");
    expect(guidanceForResult("AMBIGUOUS").retry).toBe(true);
    expect(sanitizeRuntimeDiagnostics({ frames: [{ pixels: "secret", score: 0.9 }], rawFrames: ["secret"] })).toEqual({
      frames: [{ score: 0.9 }],
    });
  });

  it("creates a stable payload hash for offline replay protection", () => {
    expect(runtimeResultPayloadHash({ b: 2, a: 1 })).toBe(runtimeResultPayloadHash({ a: 1, b: 2 }));
    expect(() =>
      offlineReconciliationSchema.parse({
        sessionId: "session_0000001",
        events: [
          {
            eventId: "event_000000001",
            idempotencyKey: "offline:event_000000001",
            eventType: "vision.result",
            storyStateVersion: 1,
            payloadHash: `sha256:${"a".repeat(64)}`,
            observedAt: new Date().toISOString(),
            payload: {},
          },
        ],
      }),
    ).toThrow();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SceneInstanceId } from "./animation-types";
import {
  createSceneFinalStateHandoff,
  defaultSceneCleanupPolicy,
  normalizeFinalStatePolicy,
} from "./final-state-handoff";

const instanceId = "scene-instance-a" as SceneInstanceId;

describe("final-state handoff", () => {
  it("maps all five Phase 1 aliases to the canonical policy vocabulary", () => {
    expect(normalizeFinalStatePolicy({ kind: "revert-immediately" })).toEqual({ kind: "revert-immediately" });
    expect(normalizeFinalStatePolicy({ kind: "hold-until-unmount", semanticState: "open" })).toEqual({
      kind: "hold-final-until-unmount",
      semanticState: "open",
    });
    expect(normalizeFinalStatePolicy({ kind: "commit-semantic-pose", semanticState: "accepted" })).toEqual({
      kind: "commit-final-state",
      semanticState: "accepted",
    });
    expect(normalizeFinalStatePolicy({ kind: "reconcile-then-revert", semanticState: "visible" })).toEqual({
      kind: "reconcile-then-revert",
      semanticState: "visible",
      handoffTargetKey: "legacy-handoff-target",
    });
    expect(
      normalizeFinalStatePolicy({ kind: "readable-static-fallback", semanticState: "readable", fallback: "static" }),
    ).toEqual({ kind: "fallback-to-static-state", semanticState: "readable", fallback: "static" });
  });

  it("commits and verifies semantic truth before cleanup releases resources and claims", async () => {
    const order: string[] = [];
    const handoff = createSceneFinalStateHandoff({
      sceneInstanceId: instanceId,
      policy: { kind: "commit-final-state", semanticState: "access-accepted" },
      runtime: {
        commitFinalState: (state) => {
          order.push(`commit:${state}`);
        },
        verifyReadableState: (state) => {
          order.push(`verify:${state}`);
          return true;
        },
        cleanup: (step) => {
          order.push(`cleanup:${step}`);
        },
      },
    });

    const receipt = await handoff.begin();
    expect(order).toEqual([
      "commit:access-accepted",
      "verify:access-accepted",
      ...defaultSceneCleanupPolicy.releaseOrder.map((step) => `cleanup:${step}`),
    ]);
    expect(receipt).toEqual({
      finalStatePolicy: "commit-final-state",
      finalStateCommitted: true,
      handoffStarted: true,
      handoffCompleted: true,
      cleanupStarted: true,
      cleanupCompleted: true,
      cleanupResult: "completed",
    });
    await expect(handoff.begin()).resolves.toBe(receipt);
  });

  it("holds a safe pose on handoff failure before cleanup and records the bounded failure", async () => {
    const order: string[] = [];
    const handoff = createSceneFinalStateHandoff({
      sceneInstanceId: instanceId,
      policy: {
        kind: "reconcile-then-revert",
        semanticState: "route-visible",
        handoffTargetKey: "permanent-route",
      },
      runtime: {
        reconcileFinalState: () => {
          order.push("reconcile");
          throw new Error("private runtime error");
        },
        holdSafePose: (state) => {
          order.push(`hold:${state}`);
        },
        verifyReadableState: () => {
          order.push("verify");
          return true;
        },
        cleanup: (step) => {
          order.push(`cleanup:${step}`);
        },
      },
    });

    const receipt = await handoff.begin();
    expect(order.slice(0, 3)).toEqual(["reconcile", "hold:route-visible", "verify"]);
    expect(order.indexOf("verify")).toBeLessThan(order.indexOf("cleanup:ownership-claims"));
    expect(receipt).toMatchObject({
      finalStatePolicy: "reconcile-then-revert",
      finalStateCommitted: true,
      handoffCompleted: true,
      handoffFailure: "handoff-runtime-failed",
      cleanupCompleted: true,
      cleanupResult: "completed-with-fallback",
    });
  });

  it("does not release claims when neither handoff nor its safe fallback becomes readable", async () => {
    const cleanup = vi.fn();
    const receipt = await createSceneFinalStateHandoff({
      sceneInstanceId: instanceId,
      policy: { kind: "hold-final-until-unmount", semanticState: "accepted" },
      runtime: { verifyReadableState: () => false, cleanup },
    }).begin();

    expect(receipt).toMatchObject({
      finalStateCommitted: false,
      handoffCompleted: false,
      cleanupStarted: false,
      cleanupCompleted: false,
      handoffFailure: "handoff-target-missing",
    });
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("reports cleanup errors without exposing thrown runtime details", async () => {
    const receipt = await createSceneFinalStateHandoff({
      sceneInstanceId: instanceId,
      policy: { kind: "fallback-to-static-state", semanticState: "journal-readable", fallback: "static-reader" },
      runtime: {
        renderStaticFallback: () => undefined,
        verifyReadableState: () => true,
        cleanup: (step) => {
          if (step === "external-handles") throw new Error("secret payload");
        },
      },
    }).begin();

    expect(receipt.cleanupResult).toBe("completed-with-errors");
    expect(JSON.stringify(receipt)).not.toContain("secret payload");
  });
});

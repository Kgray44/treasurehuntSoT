import {
  defaultSceneCleanupReleaseOrder,
  type ExternalSceneTargetId,
  type SceneCleanupPolicy,
  type SceneCleanupReleaseStep,
  type SceneFinalStatePolicy,
  type SceneFinalStatePolicyV2,
  type SceneFinalizationReceipt,
  type SceneInstanceId,
  type SceneSafeFailureCode,
} from "./animation-types";

export const defaultSceneCleanupPolicy: SceneCleanupPolicy = Object.freeze({
  cleanupTimeoutMs: 1_500,
  onHandoffFailure: "hold-safe-pose",
  releaseOrder: defaultSceneCleanupReleaseOrder,
});

export function normalizeFinalStatePolicy(
  policy: SceneFinalStatePolicy | SceneFinalStatePolicyV2,
): SceneFinalStatePolicyV2 {
  switch (policy.kind) {
    case "revert-immediately":
      return Object.freeze({ kind: "revert-immediately" });
    case "hold-until-unmount":
      return Object.freeze({ kind: "hold-final-until-unmount", semanticState: policy.semanticState });
    case "commit-semantic-pose":
      return Object.freeze({ kind: "commit-final-state", semanticState: policy.semanticState });
    case "readable-static-fallback":
      return Object.freeze({
        kind: "fallback-to-static-state",
        semanticState: policy.semanticState,
        fallback: policy.fallback,
      });
    case "reconcile-then-revert":
      return Object.freeze({
        kind: "reconcile-then-revert",
        semanticState: policy.semanticState,
        handoffTargetKey: "handoffTargetKey" in policy ? policy.handoffTargetKey : "legacy-handoff-target",
      });
    default:
      return Object.freeze({ ...policy });
  }
}

export type SceneFinalStateHandoffRuntime = Readonly<{
  commitFinalState?: (semanticState: string) => void | Promise<void>;
  reconcileFinalState?: (semanticState: string, targetKey: string) => void | Promise<void>;
  renderStaticFallback?: (semanticState: string, fallback: string) => void | Promise<void>;
  holdSafePose?: (semanticState: string) => void | Promise<void>;
  verifyReadableState?: (semanticState: string) => boolean | Promise<boolean>;
  cleanup?: (step: SceneCleanupReleaseStep) => void | Promise<void>;
}>;

export type SceneFinalStateHandoffInput = Readonly<{
  sceneInstanceId: SceneInstanceId;
  policy: SceneFinalStatePolicy | SceneFinalStatePolicyV2;
  semanticState?: string;
  handoffTargetId?: ExternalSceneTargetId;
  cleanupPolicy?: SceneCleanupPolicy;
  runtime?: SceneFinalStateHandoffRuntime;
}>;

export type SceneFinalStateHandoff = Readonly<{
  sceneInstanceId: SceneInstanceId;
  policy: SceneFinalStatePolicyV2;
  semanticState: string;
  handoffTargetId?: ExternalSceneTargetId;
  begin: () => Promise<SceneFinalizationReceipt>;
}>;

function safeSemanticState(input: string | undefined) {
  const value = input?.normalize("NFKC").trim() ?? "";
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/u.test(value) ? value : "";
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, code: SceneSafeFailureCode): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HandoffFailure(code)), Math.max(1, timeoutMs));
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

class HandoffFailure extends Error {
  constructor(readonly code: SceneSafeFailureCode) {
    super(code);
    this.name = "HandoffFailure";
  }
}

async function executeHandoff(input: SceneFinalStateHandoffInput): Promise<SceneFinalizationReceipt> {
  const policy = normalizeFinalStatePolicy(input.policy);
  const runtime = input.runtime ?? {};
  const cleanupPolicy = input.cleanupPolicy ?? defaultSceneCleanupPolicy;
  const declaredState = policy.kind === "revert-immediately" ? "" : policy.semanticState;
  const semanticState = safeSemanticState(input.semanticState ?? declaredState);
  let finalStateCommitted = policy.kind === "revert-immediately";
  let handoffStarted = false;
  let handoffCompleted = policy.kind === "revert-immediately";
  let handoffFailure: SceneSafeFailureCode | undefined;
  let cleanupStarted = false;
  let cleanupCompleted = false;
  let cleanupErrors = 0;
  let fallbackApplied = false;

  const handoff = async () => {
    if (policy.kind === "revert-immediately") return;
    if (!semanticState) throw new HandoffFailure("handoff-rejected");
    handoffStarted = true;
    switch (policy.kind) {
      case "hold-final-until-unmount":
        await runtime.holdSafePose?.(semanticState);
        break;
      case "commit-final-state":
        if (!runtime.commitFinalState) throw new HandoffFailure("handoff-target-missing");
        await runtime.commitFinalState(semanticState);
        break;
      case "reconcile-then-revert":
        if (!runtime.reconcileFinalState) throw new HandoffFailure("handoff-target-missing");
        await runtime.reconcileFinalState(semanticState, policy.handoffTargetKey);
        break;
      case "fallback-to-static-state":
        if (!runtime.renderStaticFallback) throw new HandoffFailure("handoff-target-missing");
        await runtime.renderStaticFallback(semanticState, policy.fallback);
        fallbackApplied = true;
        break;
    }
    const readable = await runtime.verifyReadableState?.(semanticState);
    if (readable === false) throw new HandoffFailure("handoff-rejected");
    finalStateCommitted = true;
    handoffCompleted = true;
  };

  try {
    await withTimeout(Promise.resolve().then(handoff), cleanupPolicy.cleanupTimeoutMs, "handoff-timeout");
  } catch (error) {
    handoffFailure = error instanceof HandoffFailure ? error.code : "handoff-runtime-failed";
    try {
      if (cleanupPolicy.onHandoffFailure === "render-static-fallback") {
        const fallback = policy.kind === "fallback-to-static-state" ? policy.fallback : "readable-static-state";
        if (!runtime.renderStaticFallback || !semanticState) throw new HandoffFailure("handoff-target-missing");
        await runtime.renderStaticFallback(semanticState, fallback);
        const readable = await runtime.verifyReadableState?.(semanticState);
        if (readable === false) throw new HandoffFailure("handoff-rejected");
        finalStateCommitted = true;
        handoffCompleted = true;
        fallbackApplied = true;
      } else if (cleanupPolicy.onHandoffFailure === "hold-safe-pose") {
        if (!runtime.holdSafePose || !semanticState) throw new HandoffFailure("handoff-target-missing");
        await runtime.holdSafePose(semanticState);
        const readable = await runtime.verifyReadableState?.(semanticState);
        if (readable === false) throw new HandoffFailure("handoff-rejected");
        finalStateCommitted = true;
        handoffCompleted = true;
        fallbackApplied = true;
      }
    } catch (fallbackError) {
      handoffFailure = fallbackError instanceof HandoffFailure ? fallbackError.code : "handoff-runtime-failed";
    }
  }

  // Claims and target capabilities are deliberately released only after a readable handoff or
  // explicit report-failure policy. Destructive cleanup cannot race ahead of semantic truth.
  if (handoffCompleted || cleanupPolicy.onHandoffFailure === "report-failure") {
    cleanupStarted = true;
    for (const step of cleanupPolicy.releaseOrder) {
      try {
        await withTimeout(
          Promise.resolve().then(() => runtime.cleanup?.(step)),
          cleanupPolicy.cleanupTimeoutMs,
          "cleanup-failed",
        );
      } catch {
        cleanupErrors += 1;
      }
    }
    cleanupCompleted = true;
  }

  return Object.freeze({
    finalStatePolicy: policy.kind,
    finalStateCommitted,
    ...(input.handoffTargetId ? { handoffTargetId: input.handoffTargetId } : {}),
    handoffStarted,
    handoffCompleted,
    ...(handoffFailure ? { handoffFailure } : {}),
    cleanupStarted,
    cleanupCompleted,
    cleanupResult:
      cleanupErrors > 0 ? "completed-with-errors" : fallbackApplied ? "completed-with-fallback" : "completed",
  });
}

export function createSceneFinalStateHandoff(input: SceneFinalStateHandoffInput): SceneFinalStateHandoff {
  const policy = normalizeFinalStatePolicy(input.policy);
  const semanticState = safeSemanticState(
    input.semanticState ?? (policy.kind === "revert-immediately" ? "" : policy.semanticState),
  );
  let result: Promise<SceneFinalizationReceipt> | undefined;
  return Object.freeze({
    sceneInstanceId: input.sceneInstanceId,
    policy,
    semanticState,
    ...(input.handoffTargetId ? { handoffTargetId: input.handoffTargetId } : {}),
    begin: () => (result ??= executeHandoff(input)),
  });
}

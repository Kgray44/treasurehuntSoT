"use client";

import type {
  AnimationSceneName,
  DirectorSnapshot,
  MotionMode,
  PlaySceneOptions,
  PresentationFallbackContext,
  PresentationFallbackResult,
  PresentationFallbackTrigger,
  PresentationOutcome,
  PresentationReceipt,
  ResolvedMotionPolicy,
  SceneBuildContext,
  SceneFinalStatePolicy,
  ScenePreflightReport,
  SceneTargetContract,
  SceneTimeline,
} from "../core/animation-types";
import { changeMountedMetric } from "../core/metrics";
import { recordPresentationTelemetry } from "../core/presentation-telemetry";
import { resolveMotionPolicy } from "../core/quality";
import { preflightSceneTargets, type SceneTargetPreflightResult } from "../core/target-preflight";
import { observeDocumentVisibility } from "../core/visibility";
import { gsap } from "../core/gsap-client";
import { getSceneDefinition } from "./scene-registry";

type LegacyOperationFields<T> = [T] extends [never] ? object : T extends object ? T : object;
type CompatiblePresentationReceipt<T> = PresentationReceipt<T> & LegacyOperationFields<T>;

type ExternalTerminal = { kind: "aborted"; reason: string } | { kind: "interrupted"; reason: string };

type StageResult<T> =
  | { kind: "completed"; value: T }
  | { kind: "failed"; error: unknown }
  | { kind: "timed-out" }
  | ExternalTerminal;

const initialSnapshot = (mode: MotionMode): DirectorSnapshot => ({
  isPlaying: false,
  isPaused: false,
  scene: null,
  label: "idle",
  progress: 0,
  speed: 1,
  mode,
  phase: "idle",
  queueDepth: 0,
  error: null,
});

function nowMs() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function sanitizeReason(reason: string) {
  return (
    reason
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "interrupted"
  );
}

function emptyTargetReport(
  sceneName: AnimationSceneName,
  sceneInstanceId: string,
  hostId: string,
  at: number,
): ScenePreflightReport {
  return {
    sceneName,
    sceneInstanceId,
    hostId,
    startedAt: at,
    completedAt: at,
    durationMs: 0,
    requiredSatisfied: false,
    observations: [],
    failures: [],
  };
}

function preflightOutcome(report: ScenePreflightReport): PresentationFallbackTrigger {
  const codes = new Set(report.failures.map((failure) => failure.code));
  if (codes.has("ownership-rejected")) return "ownership-rejected";
  if (codes.has("duplicate-required-target")) return "duplicate-required-target";
  return "missing-required-target";
}

function semanticStateFor(policy: SceneFinalStatePolicy) {
  return policy.kind === "revert-immediately" ? undefined : policy.semanticState;
}

function hasSemanticCompletion(labels: string[]) {
  return labels.includes("scene-complete");
}

function resolvedHostIdentity<T>(contract: SceneTargetContract, sceneInstanceId: string, options: PlaySceneOptions<T>) {
  const explicitHostId = options.hostId?.trim() ?? "";
  const explicitHostKind = options.hostKind?.trim() ?? "";
  const rootHostId = options.root.dataset.sceneHostId?.trim() ?? "";
  const rootHostKind = options.root.dataset.sceneHostKind?.trim() ?? "";
  const hostId = explicitHostId || rootHostId || `unverified-${sceneInstanceId}`;
  const hostKind = explicitHostKind || rootHostKind || "unverified";
  const requestSource = options.requestSource ?? contract.playbackPolicy.source;
  const explicitIdentityComplete = Boolean(explicitHostId && explicitHostKind);
  const explicitIdentityAbsent = !explicitHostId && !explicitHostKind;
  const rootFallbackComplete = explicitIdentityAbsent && Boolean(rootHostId && rootHostKind);
  // Development and legacy scenes are the bounded Phase 1 compatibility adapter. Production
  // scenes must match their declared host kind until the persistent Phase 2 host exists.
  const expectedKindSatisfied =
    contract.reachability !== "production" || requestSource === "development" || hostKind === contract.expectedHostKind;
  return {
    hostId,
    hostKind,
    requestSource,
    valid: (explicitIdentityComplete || rootFallbackComplete) && expectedKindSatisfied,
  };
}

function resolvedTelemetryContext<T>(options: PlaySceneOptions<T>) {
  const route =
    options.telemetryContext?.route ?? (typeof window === "undefined" ? undefined : window.location.pathname);
  return {
    ...options.telemetryContext,
    ...(route ? { route } : {}),
  };
}

function acknowledgmentAllowed(contract: SceneTargetContract, outcome: PresentationOutcome, fallbackReadable: boolean) {
  const acknowledgeOn = contract.acknowledgmentPolicy.acknowledgeOn as PresentationOutcome[];
  if (!acknowledgeOn.includes(outcome)) return false;
  if (outcome === "presented-fallback" && contract.acknowledgmentPolicy.fallbackMustBeReadable) {
    return fallbackReadable;
  }
  return true;
}

function isFallbackTrigger(outcome: PresentationOutcome): outcome is PresentationFallbackTrigger {
  return [
    "timed-out",
    "missing-required-target",
    "duplicate-required-target",
    "ownership-rejected",
    "runtime-failed",
  ].includes(outcome);
}

function withLegacyOperationResult<T>(receipt: PresentationReceipt<T>): CompatiblePresentationReceipt<T> {
  const operationResult = receipt.operationResult;
  if (operationResult !== null && typeof operationResult === "object" && !Array.isArray(operationResult)) {
    return { ...(operationResult as object), ...receipt } as CompatiblePresentationReceipt<T>;
  }
  return receipt as CompatiblePresentationReceipt<T>;
}

export class AnimationDirector {
  private snapshot: DirectorSnapshot;
  private motionPolicy: ResolvedMotionPolicy;
  private listeners = new Set<() => void>();
  private currentTimeline: SceneTimeline | null = null;
  private currentResolve: (() => void) | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private skipRequested = false;
  private userPaused = false;
  private visibilityCleanup: () => void;
  private destroyed = false;
  private activeTerminal: ((terminal: ExternalTerminal) => void) | null = null;
  private activeAllowsUserSkip = false;
  private activePriority: number | null = null;
  // Phase 1 compatibility holds last until this root plays again or the provider destroys the director.
  private heldContexts = new Map<HTMLElement, () => void>();
  private instanceCounter = 0;

  constructor(mode: MotionMode = "full") {
    this.motionPolicy = resolveMotionPolicy(mode, false);
    this.snapshot = initialSnapshot(this.motionPolicy.level);
    this.visibilityCleanup = observeDocumentVisibility((visible) => {
      if (!this.currentTimeline) return;
      if (!visible) this.currentTimeline.pause();
      else if (!this.userPaused && this.snapshot.phase !== "await-server") this.currentTimeline.resume();
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<DirectorSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  setMode(mode: MotionMode) {
    this.setMotionPolicy(resolveMotionPolicy(mode, this.motionPolicy.source.browserPrefersReduced));
  }

  setMotionPolicy(policy: ResolvedMotionPolicy) {
    const becameReduced = this.motionPolicy.level !== "reduced" && policy.level === "reduced";
    this.motionPolicy = policy;
    this.update({ mode: policy.level });
    if (becameReduced && this.activeTerminal) {
      this.activeTerminal({ kind: "interrupted", reason: "motion-policy-reduced" });
      this.stopCurrentTimeline();
      this.update({ error: "motion-policy-reduced", isPaused: false, label: "interrupted" });
    }
  }

  setSpeed(multiplier: number) {
    const speed = Math.min(2, Math.max(0.25, multiplier));
    this.currentTimeline?.timeScale(speed);
    this.update({ speed });
  }

  pause() {
    this.userPaused = true;
    this.currentTimeline?.pause();
    this.update({ isPaused: true });
  }

  resume() {
    this.userPaused = false;
    this.currentTimeline?.resume();
    this.update({ isPaused: false });
  }

  seek(labelOrProgress: string | number) {
    const timeline = this.currentTimeline;
    if (!timeline) return;
    if (typeof labelOrProgress === "number") timeline.progress(Math.max(0, Math.min(1, labelOrProgress)));
    else if (timeline.labels[labelOrProgress] !== undefined) timeline.seek(labelOrProgress);
    this.update({
      progress: timeline.progress(),
      label: typeof labelOrProgress === "string" ? labelOrProgress : this.snapshot.label,
    });
  }

  reverse() {
    const scene = this.snapshot.scene;
    if (!scene || !getSceneDefinition(scene).reversible || !this.currentTimeline) return false;
    this.currentTimeline.reverse();
    return true;
  }

  skip() {
    if (!this.activeAllowsUserSkip || !this.activeTerminal) return false;
    this.skipRequested = true;
    this.currentTimeline?.progress(1, false);
    return true;
  }

  cancel(reason = "cancelled") {
    if (!this.activeTerminal) return;
    const safeReason = sanitizeReason(reason);
    this.activeTerminal({ kind: "interrupted", reason: safeReason });
    this.stopCurrentTimeline();
    this.update({ error: safeReason, isPaused: false, label: "interrupted" });
  }

  kill() {
    this.destroyed = true;
    this.cancel("director-killed");
    this.visibilityCleanup();
    this.releaseAllHeldContexts();
    this.listeners.clear();
  }

  play<T = void>(name: AnimationSceneName, options: PlaySceneOptions<T>): Promise<CompatiblePresentationReceipt<T>> {
    const definition = getSceneDefinition(name);
    const priority = definition.contract.playbackPolicy.priority;
    if (this.destroyed) {
      return Promise.resolve(this.terminalReceipt(name, options, "interrupted", "director-killed"));
    }
    if (this.activePriority !== null && priority > this.activePriority) {
      this.cancel("higher-priority-scene");
    } else if (options.queue === false && (this.snapshot.isPlaying || this.snapshot.queueDepth > 0)) {
      return Promise.resolve(this.terminalReceipt(name, options, "interrupted", "conflicting-scene"));
    }
    this.update({ queueDepth: this.snapshot.queueDepth + 1 });
    const scheduled = this.tail
      .catch(() => undefined)
      .then(async () => {
        this.update({ queueDepth: Math.max(0, this.snapshot.queueDepth - 1) });
        if (this.destroyed) return this.terminalReceipt(name, options, "interrupted", "director-killed");
        return this.execute(name, options);
      });
    this.tail = scheduled.catch(() => undefined);
    return scheduled;
  }

  private async execute<T>(
    name: AnimationSceneName,
    options: PlaySceneOptions<T>,
  ): Promise<CompatiblePresentationReceipt<T>> {
    const definition = getSceneDefinition(name);
    const contract = definition.contract;
    const startedAt = nowMs();
    const deadline = startedAt + Math.max(1, contract.timeoutMs);
    const sceneInstanceId = this.createSceneInstanceId(name);
    const host = resolvedHostIdentity(contract, sceneInstanceId, options);
    const { hostId, hostKind, requestSource } = host;
    const motionPolicy = this.motionPolicy;
    const semanticLabelsReached: string[] = [];
    const sceneCleanups: Array<() => void> = [];
    let targetPreflight: SceneTargetPreflightResult | undefined;
    let targetReport = emptyTargetReport(name, sceneInstanceId, hostId, startedAt);
    let contextRevert: (() => void) | undefined;
    let operationResult: T | undefined;
    let fallbackUsed: string | undefined;
    let fallbackReadable = false;
    let finalSemanticState: string | undefined;
    let interruptionReason: string | undefined;
    let outcome: PresentationOutcome = "runtime-failed";
    let errorCode: string | null = null;
    let operationFailed = false;
    let runtimeFailed = false;
    let cleanupErrors = this.releaseHeldContext(options.root) ? 1 : 0;
    let terminalSettled = false;
    let resolveTerminal!: (terminal: ExternalTerminal) => void;
    const terminalPromise = new Promise<ExternalTerminal>((resolve) => {
      resolveTerminal = resolve;
    });
    this.activeTerminal = (terminal) => {
      if (terminalSettled) return;
      terminalSettled = true;
      resolveTerminal(terminal);
    };
    this.activePriority = contract.playbackPolicy.priority;
    const onAbort = () => this.activeTerminal?.({ kind: "aborted", reason: "abort-signal" });
    options.signal?.addEventListener("abort", onAbort, { once: true });

    this.skipRequested = false;
    this.userPaused = false;
    this.activeAllowsUserSkip = contract.playbackPolicy.allowUserSkip;
    this.update({
      isPlaying: true,
      isPaused: false,
      scene: name,
      label: "scene-start",
      progress: 0,
      phase: "opening",
      error: null,
    });

    try {
      if (!host.valid) {
        outcome = "runtime-failed";
        errorCode = "scene-host-contract-rejected";
      } else if (contract.reachability === "deprecated" && requestSource !== "development") {
        outcome = "skipped-by-policy";
      } else if (options.signal?.aborted) {
        outcome = "aborted";
        interruptionReason = "abort-signal";
      } else {
        try {
          targetPreflight = preflightSceneTargets({
            root: options.root,
            contract,
            sceneInstanceId,
            hostId,
          });
          targetReport = targetPreflight.report;
        } catch {
          outcome = "runtime-failed";
          errorCode = "target-preflight-failed";
        }

        if (targetPreflight && !targetReport.requiredSatisfied) {
          outcome = preflightOutcome(targetReport);
          errorCode = "target-preflight-rejected";
        } else if (targetPreflight) {
          const sceneContext: SceneBuildContext = {
            root: options.root,
            mode: motionPolicy.level,
            motionPolicy,
            sceneName: name,
            display: options.display ?? {},
            emitLabel: (label) => {
              if (!semanticLabelsReached.includes(label)) semanticLabelsReached.push(label);
              this.update({ label });
            },
            addCleanup: (cleanup) => sceneCleanups.push(cleanup),
          };
          let opening!: SceneTimeline;
          let success!: SceneTimeline;
          let failure: SceneTimeline | undefined;
          let idle: SceneTimeline | undefined;

          try {
            const gsapContext = gsap.context(() => {
              opening = definition.buildOpening(sceneContext);
              success = definition.buildSuccess(sceneContext);
              failure = definition.buildFailure?.(sceneContext);
              idle = definition.buildIdle?.(sceneContext);
            }, options.root);
            contextRevert = () => gsapContext.revert();
          } catch {
            outcome = "runtime-failed";
            errorCode = "scene-builder-failed";
          }

          if (contextRevert) {
            let operationSettled = false;
            const operation = options.operation
              ? Promise.resolve()
                  .then(() => options.operation!())
                  .then(
                    (value) => ({ ok: true as const, value }),
                    (error: unknown) => ({ ok: false as const, error }),
                  )
                  .finally(() => {
                    operationSettled = true;
                  })
              : undefined;
            const openingResult = await this.awaitStage(
              this.runTimeline(opening, "opening"),
              deadline,
              terminalPromise,
            );
            outcome = this.stageOutcome(openingResult);
            if (openingResult.kind === "failed") errorCode = "opening-runtime-failed";
            if (openingResult.kind === "timed-out") errorCode = "presentation-timed-out";
            if (openingResult.kind === "completed") {
              if (operation) {
                this.update({ phase: "await-server", label: "await-server", progress: 1 });
                if (!operationSettled && idle) {
                  try {
                    this.startIdle(idle);
                  } catch {
                    runtimeFailed = true;
                    outcome = "runtime-failed";
                    errorCode = "idle-runtime-failed";
                  }
                }
                const operationStage = await this.awaitStage(operation, deadline, terminalPromise);
                cleanupErrors += this.stopCurrentTimeline() ? 1 : 0;
                if (operationStage.kind === "completed" && operationStage.value.ok) {
                  operationResult = operationStage.value.value;
                } else if (
                  operationStage.kind === "failed" ||
                  (operationStage.kind === "completed" && !operationStage.value.ok)
                ) {
                  operationFailed = true;
                  outcome = "runtime-failed";
                  errorCode = "authoritative-operation-failed";
                  this.update({ phase: "failure", label: "failure-branch", progress: 0 });
                  if (failure) {
                    const failureStage = await this.awaitStage(
                      this.runTimeline(failure, "failure"),
                      deadline,
                      terminalPromise,
                    );
                    if (failureStage.kind === "aborted" || failureStage.kind === "interrupted") {
                      outcome = failureStage.kind;
                      interruptionReason = failureStage.reason;
                    }
                  }
                } else if (operationStage.kind === "timed-out") {
                  outcome = "timed-out";
                  errorCode = "presentation-timed-out";
                } else if (operationStage.kind === "aborted" || operationStage.kind === "interrupted") {
                  outcome = operationStage.kind;
                  interruptionReason = operationStage.reason;
                }
              }

              if (!operationFailed && !runtimeFailed && !["aborted", "interrupted", "timed-out"].includes(outcome)) {
                this.update({ phase: "success", label: "success-branch", progress: 0 });
                const successLabelStart = semanticLabelsReached.length;
                if (this.skipRequested) {
                  try {
                    success.timeScale(this.snapshot.speed).progress(1, false);
                    const skippedSemanticState =
                      contract.playbackPolicy.userSkipFinalState ?? semanticStateFor(contract.finalStatePolicy);
                    if (
                      skippedSemanticState?.trim() &&
                      hasSemanticCompletion(semanticLabelsReached.slice(successLabelStart))
                    ) {
                      outcome = "skipped-by-user";
                      finalSemanticState = skippedSemanticState;
                    } else {
                      outcome = "runtime-failed";
                      errorCode = skippedSemanticState?.trim()
                        ? "semantic-checkpoint-missing"
                        : "final-semantic-state-unresolved";
                    }
                  } catch {
                    outcome = "runtime-failed";
                    errorCode = "scene-skip-failed";
                  }
                } else {
                  const successResult = await this.awaitStage(
                    this.runTimeline(success, "success"),
                    deadline,
                    terminalPromise,
                  );
                  outcome = this.stageOutcome(successResult);
                  if (successResult.kind === "completed") {
                    const declaredSemanticState = semanticStateFor(contract.finalStatePolicy);
                    if (
                      declaredSemanticState?.trim() &&
                      hasSemanticCompletion(semanticLabelsReached.slice(successLabelStart))
                    ) {
                      outcome = "presented";
                      finalSemanticState = declaredSemanticState;
                    } else {
                      outcome = "runtime-failed";
                      errorCode = declaredSemanticState?.trim()
                        ? "semantic-checkpoint-missing"
                        : "final-semantic-state-unresolved";
                    }
                  } else if (successResult.kind === "failed") {
                    errorCode = "success-runtime-failed";
                  } else if (successResult.kind === "timed-out") {
                    errorCode = "presentation-timed-out";
                  } else if (successResult.kind === "aborted" || successResult.kind === "interrupted") {
                    interruptionReason = successResult.reason;
                  }
                }
              }
            } else if (openingResult.kind === "aborted" || openingResult.kind === "interrupted") {
              interruptionReason = openingResult.reason;
            }
          }
        }

        if (isFallbackTrigger(outcome) && !operationFailed) {
          const fallbackAttempt = await this.tryFallback(
            name,
            sceneInstanceId,
            hostId,
            hostKind,
            outcome,
            motionPolicy,
            contract,
            options,
            deadline,
            terminalPromise,
          );
          if (fallbackAttempt?.kind === "completed") {
            const fallback = fallbackAttempt.value;
            if (fallback.completed && fallback.readable && fallback.semanticState.trim()) {
              outcome = "presented-fallback";
              fallbackUsed = contract.playbackPolicy.allowedFallback;
              fallbackReadable = true;
              finalSemanticState = fallback.semanticState;
              errorCode = null;
            }
          } else if (fallbackAttempt?.kind === "aborted" || fallbackAttempt?.kind === "interrupted") {
            outcome = fallbackAttempt.kind;
            interruptionReason = fallbackAttempt.reason;
          } else if (fallbackAttempt?.kind === "timed-out") {
            outcome = "timed-out";
          }
        }
      }
    } finally {
      cleanupErrors += this.stopCurrentTimeline() ? 1 : 0;
      for (const cleanup of sceneCleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
          cleanupErrors += 1;
        }
      }
      const preserveContext =
        contextRevert &&
        (outcome === "presented" || outcome === "skipped-by-user") &&
        ["hold-until-unmount", "commit-semantic-pose"].includes(contract.finalStatePolicy.kind);
      if (contextRevert) {
        if (preserveContext) this.heldContexts.set(options.root, contextRevert);
        else {
          try {
            contextRevert();
          } catch {
            cleanupErrors += 1;
          }
        }
      }
      if (targetPreflight) {
        try {
          targetPreflight.release();
        } catch {
          cleanupErrors += 1;
        }
      }
      options.signal?.removeEventListener("abort", onAbort);
      this.activeTerminal = null;
      this.activeAllowsUserSkip = false;
      this.activePriority = null;
      this.update({
        isPlaying: false,
        isPaused: false,
        scene: null,
        label: "idle",
        progress: 0,
        phase: "idle",
        error: errorCode,
      });
    }

    const completedAt = nowMs();
    const receipt: PresentationReceipt<T> = {
      sceneName: name,
      sceneInstanceId,
      hostId,
      hostKind,
      requestSource,
      ...(options.eventOrActionId ? { eventOrActionId: options.eventOrActionId } : {}),
      outcome,
      motionPolicy,
      startedAt,
      completedAt,
      durationMs: Math.max(0, completedAt - startedAt),
      semanticLabelsReached,
      targetReport,
      ...(fallbackUsed ? { fallbackUsed } : {}),
      ...(interruptionReason ? { interruptionReason } : {}),
      ...(finalSemanticState ? { finalSemanticState } : {}),
      acknowledgmentAllowed: acknowledgmentAllowed(contract, outcome, fallbackReadable),
      cleanup: cleanupErrors === 0 ? "completed" : "completed-with-errors",
      ...(operationResult === undefined ? {} : { operationResult }),
    };
    recordPresentationTelemetry(receipt, resolvedTelemetryContext(options));
    return withLegacyOperationResult(receipt);
  }

  private terminalReceipt<T>(
    name: AnimationSceneName,
    options: PlaySceneOptions<T>,
    outcome: Extract<PresentationOutcome, "interrupted" | "aborted">,
    reason: string,
  ): CompatiblePresentationReceipt<T> {
    const contract = getSceneDefinition(name).contract;
    const at = nowMs();
    const sceneInstanceId = this.createSceneInstanceId(name);
    const host = resolvedHostIdentity(contract, sceneInstanceId, options);
    const receipt: PresentationReceipt<T> = {
      sceneName: name,
      sceneInstanceId,
      hostId: host.hostId,
      hostKind: host.hostKind,
      requestSource: host.requestSource,
      ...(options.eventOrActionId ? { eventOrActionId: options.eventOrActionId } : {}),
      outcome,
      motionPolicy: this.motionPolicy,
      startedAt: at,
      completedAt: at,
      durationMs: 0,
      semanticLabelsReached: [],
      targetReport: emptyTargetReport(name, sceneInstanceId, host.hostId, at),
      interruptionReason: sanitizeReason(reason),
      acknowledgmentAllowed: false,
      cleanup: "completed",
    };
    recordPresentationTelemetry(receipt, resolvedTelemetryContext(options));
    return withLegacyOperationResult(receipt);
  }

  private createSceneInstanceId(name: AnimationSceneName) {
    this.instanceCounter += 1;
    const randomId = globalThis.crypto?.randomUUID?.();
    return randomId ?? `${name}-${Date.now().toString(36)}-${this.instanceCounter.toString(36)}`;
  }

  private stageOutcome<T>(result: StageResult<T>): PresentationOutcome {
    if (result.kind === "completed") return "presented";
    if (result.kind === "failed") return "runtime-failed";
    return result.kind;
  }

  private async awaitStage<T>(
    promise: Promise<T>,
    deadline: number,
    terminalPromise: Promise<ExternalTerminal>,
  ): Promise<StageResult<T>> {
    const remaining = deadline - nowMs();
    if (remaining <= 0) {
      this.stopCurrentTimeline();
      return { kind: "timed-out" };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<StageResult<T>>((resolve) => {
      timer = setTimeout(() => resolve({ kind: "timed-out" }), remaining);
    });
    const settled = promise.then<StageResult<T>, StageResult<T>>(
      (value) => ({ kind: "completed", value }),
      (error: unknown) => ({ kind: "failed", error }),
    );
    const terminal = terminalPromise.then<StageResult<T>>((value) => value);
    const result = await Promise.race([settled, terminal, timeout]);
    if (timer !== undefined) clearTimeout(timer);
    if (result.kind !== "completed" && result.kind !== "failed") this.stopCurrentTimeline();
    return result;
  }

  private async tryFallback<T>(
    sceneName: AnimationSceneName,
    sceneInstanceId: string,
    hostId: string,
    hostKind: string,
    trigger: PresentationFallbackTrigger,
    motionPolicy: ResolvedMotionPolicy,
    contract: SceneTargetContract,
    options: PlaySceneOptions<T>,
    deadline: number,
    terminalPromise: Promise<ExternalTerminal>,
  ) {
    const fallback = contract.playbackPolicy.allowedFallback;
    if (!fallback || !options.presentationFallback) return undefined;
    const context: PresentationFallbackContext = {
      sceneName,
      sceneInstanceId,
      hostId,
      hostKind,
      fallback,
      trigger,
      motionPolicy,
      ...(options.signal ? { signal: options.signal } : {}),
    };
    const attempt = Promise.resolve().then(() => options.presentationFallback!(context));
    return this.awaitStage<PresentationFallbackResult>(attempt, deadline, terminalPromise);
  }

  private runTimeline(timeline: SceneTimeline, phase: DirectorSnapshot["phase"]) {
    return new Promise<void>((resolve, reject) => {
      this.stopCurrentTimeline();
      this.currentTimeline = timeline;
      changeMountedMetric("gsap", 1);
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        changeMountedMetric("gsap", -1);
        this.currentResolve = null;
        if (error === undefined) resolve();
        else reject(error);
      };
      this.currentResolve = () => finish();
      try {
        timeline.eventCallback("onUpdate", () => this.update({ progress: timeline.progress() }));
        timeline.eventCallback("onComplete", () => finish());
        timeline.eventCallback("onReverseComplete", () => finish());
        timeline.timeScale(this.snapshot.speed);
        this.update({ phase, progress: timeline.progress() });
        timeline.play(0);
      } catch (error) {
        finish(error);
      }
    });
  }

  private startIdle(timeline: SceneTimeline) {
    this.stopCurrentTimeline();
    this.currentTimeline = timeline;
    timeline.timeScale(this.snapshot.speed).play(0);
  }

  private stopCurrentTimeline() {
    const timeline = this.currentTimeline;
    const finish = this.currentResolve;
    this.currentTimeline = null;
    this.currentResolve = null;
    let failed = false;
    try {
      timeline?.kill();
    } catch {
      failed = true;
    }
    try {
      finish?.();
    } catch {
      failed = true;
    }
    return failed;
  }

  private releaseHeldContext(root: HTMLElement) {
    const cleanup = this.heldContexts.get(root);
    if (!cleanup) return false;
    this.heldContexts.delete(root);
    try {
      cleanup();
      return false;
    } catch {
      return true;
    }
  }

  private releaseAllHeldContexts() {
    const contexts = [...this.heldContexts.values()];
    this.heldContexts.clear();
    contexts.forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Compatibility holds are best-effort during provider teardown.
      }
    });
  }
}

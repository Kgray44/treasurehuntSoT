import type { JournalPhase, JournalPhaseOutcome, MotionMode } from "../core/animation-types";

export const journalOpeningPhases = [
  "ENTRY_IDLE",
  "ENTRY_ACTIVATED",
  "CLOSED_BOOK_REVEAL",
  "LATCH_RELEASING",
  "COVER_OPENING",
  "SEALED_PAGE_REVEAL",
  "SEAL_BREAKING",
  "BOOK_SETTLING",
  "JOURNAL_READY",
] as const satisfies readonly JournalPhase[];

export type JournalOpeningPhase = JournalPhase;

type JournalPhaseActorContract = {
  actor: string;
  selector: string;
  required: boolean;
  expectsFiniteAnimation: boolean;
  expectedProperties: readonly string[];
  expectedAnimationNames?: readonly string[];
  excludeTargetSelectors?: readonly string[];
};

export type JournalPhaseContract = {
  phase: JournalPhase;
  actors: readonly JournalPhaseActorContract[];
  durationMs: Readonly<Record<MotionMode, number>>;
  timeoutSafetyMarginMs: number;
  reducedFallback: string | null;
  finalSemanticState: JournalPhase;
};

const staticDuration = { full: 0, gentle: 0, reduced: 0 } as const;
const phaseTargetExclusions = [
  ".page-flip-book",
  "[data-animation-owner='st-page-flip']",
  "[data-animation-ambient]",
] as const;

export const journalPhaseContracts = {
  ENTRY_IDLE: {
    phase: "ENTRY_IDLE",
    actors: [],
    durationMs: staticDuration,
    timeoutSafetyMarginMs: 0,
    reducedFallback: null,
    finalSemanticState: "ENTRY_IDLE",
  },
  ENTRY_ACTIVATED: {
    phase: "ENTRY_ACTIVATED",
    actors: [],
    durationMs: staticDuration,
    timeoutSafetyMarginMs: 0,
    reducedFallback: null,
    finalSemanticState: "ENTRY_ACTIVATED",
  },
  CLOSED_BOOK_REVEAL: {
    phase: "CLOSED_BOOK_REVEAL",
    actors: [
      {
        actor: "closed-book",
        selector: "[data-opening-actor='closed-book']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["opacity", "transform", "visibility"],
        excludeTargetSelectors: phaseTargetExclusions,
      },
      {
        actor: "introduction",
        selector: "[data-opening-actor='introduction']",
        required: false,
        expectsFiniteAnimation: false,
        expectedProperties: ["opacity", "background-color", "visibility"],
      },
    ],
    durationMs: { full: 1350, gentle: 1000, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-closed-book",
    finalSemanticState: "CLOSED_BOOK_REVEAL",
  },
  LATCH_RELEASING: {
    phase: "LATCH_RELEASING",
    actors: [
      {
        actor: "latch",
        selector: "[data-opening-actor='latch']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["transform", "opacity"],
      },
    ],
    durationMs: { full: 1050, gentle: 1050, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-latch",
    finalSemanticState: "LATCH_RELEASING",
  },
  COVER_OPENING: {
    phase: "COVER_OPENING",
    actors: [
      {
        actor: "front-cover",
        selector: "[data-opening-actor='front-cover']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["transform"],
      },
    ],
    durationMs: { full: 2100, gentle: 700, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-open-cover",
    finalSemanticState: "COVER_OPENING",
  },
  SEALED_PAGE_REVEAL: {
    phase: "SEALED_PAGE_REVEAL",
    actors: [
      {
        actor: "sealed-page",
        selector: "[data-opening-actor='sealed-page']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["opacity", "transform"],
      },
    ],
    durationMs: { full: 1000, gentle: 700, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-sealed-page",
    finalSemanticState: "SEALED_PAGE_REVEAL",
  },
  SEAL_BREAKING: {
    phase: "SEAL_BREAKING",
    actors: [
      {
        actor: "wax-seal",
        selector: "[data-opening-actor='wax-seal']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["filter", "opacity", "stroke-dashoffset", "transform"],
      },
    ],
    durationMs: { full: 1250, gentle: 1150, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-broken-seal",
    finalSemanticState: "SEAL_BREAKING",
  },
  BOOK_SETTLING: {
    phase: "BOOK_SETTLING",
    actors: [
      {
        actor: "book-camera",
        selector: "[data-opening-actor='book-camera']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["opacity", "transform", "visibility"],
        excludeTargetSelectors: phaseTargetExclusions,
      },
      {
        actor: "persistent-interface",
        selector: "[data-opening-actor='persistent-interface']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["opacity", "transform", "visibility"],
      },
      {
        actor: "objective",
        selector: "[data-opening-actor='objective']",
        required: true,
        expectsFiniteAnimation: true,
        expectedProperties: ["opacity", "transform", "visibility"],
      },
    ],
    durationMs: { full: 1500, gentle: 1300, reduced: 140 },
    timeoutSafetyMarginMs: 400,
    reducedFallback: "reduced-motion-static-ready-journal",
    finalSemanticState: "BOOK_SETTLING",
  },
  JOURNAL_READY: {
    phase: "JOURNAL_READY",
    actors: [],
    durationMs: staticDuration,
    timeoutSafetyMarginMs: 0,
    reducedFallback: null,
    finalSemanticState: "JOURNAL_READY",
  },
} as const satisfies Record<JournalPhase, JournalPhaseContract>;

export function nextJournalOpeningPhase(phase: JournalOpeningPhase): JournalOpeningPhase | null {
  const index = journalOpeningPhases.indexOf(phase);
  return index < journalOpeningPhases.length - 1 ? journalOpeningPhases[index + 1] : null;
}

export function isJournalInteractive(phase: JournalOpeningPhase) {
  return phase === "JOURNAL_READY";
}

export function getJournalPhaseTimeoutMs(phase: JournalPhase, mode: MotionMode, playbackRate = 1) {
  const contract = journalPhaseContracts[phase];
  const safePlaybackRate = Number.isFinite(playbackRate) ? Math.min(2, Math.max(0.25, playbackRate)) : 1;
  return Math.ceil(contract.durationMs[mode] / safePlaybackRate + contract.timeoutSafetyMarginMs);
}

type AnimationClassification =
  | { status: "finite"; animation: Animation }
  | { status: "ignored" }
  | { status: "runtime-failed"; errorCode: string };

type AnimationTracker = {
  promise: Promise<void>;
  cleanup: () => void;
};

class JournalAnimationRuntimeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "JournalAnimationRuntimeError";
  }
}

function clockNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function scheduleFrame(callback: FrameRequestCallback) {
  if (typeof requestAnimationFrame === "function") {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  }
  const timer = setTimeout(() => callback(clockNow()), 16);
  return () => clearTimeout(timer);
}

const paintAcquisitionTimeoutMs = 100;

function nextPaint(signal: AbortSignal) {
  return new Promise<"painted" | "aborted">((resolve) => {
    let settled = false;
    let paintTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelPendingFrame: () => void = () => undefined;
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      if (paintTimeout !== null) clearTimeout(paintTimeout);
      paintTimeout = null;
      cancelPendingFrame();
      cancelPendingFrame = () => undefined;
    };
    const settle = (result: "painted" | "aborted") => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onAbort = () => settle("aborted");
    if (signal.aborted) {
      settle("aborted");
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    paintTimeout = setTimeout(() => settle("painted"), paintAcquisitionTimeoutMs);
    cancelPendingFrame = scheduleFrame(() => {
      if (settled) return;
      cancelPendingFrame = scheduleFrame(() => settle("painted"));
    });
  });
}

function normalizeProperty(property: string) {
  return property.toLowerCase().replaceAll("-", "");
}

function animationTargetIsExcluded(animation: Animation, actor: HTMLElement, contract: JournalPhaseActorContract) {
  const target = animation.effect && "target" in animation.effect ? animation.effect.target : null;
  if (!(target instanceof Element)) return false;
  if (target !== actor && !actor.contains(target)) return true;
  return Boolean(contract.excludeTargetSelectors?.some((selector) => target.closest(selector)));
}

function animationMatchesContract(animation: Animation, contract: JournalPhaseActorContract) {
  const expectedProperties = new Set(contract.expectedProperties.map(normalizeProperty));
  const runtimeAnimation = animation as Animation & { animationName?: string; transitionProperty?: string };
  if (runtimeAnimation.transitionProperty) {
    return expectedProperties.has(normalizeProperty(runtimeAnimation.transitionProperty));
  }
  if (runtimeAnimation.animationName) {
    return Boolean(contract.expectedAnimationNames?.includes(runtimeAnimation.animationName));
  }
  const effect = animation.effect;
  const getKeyframes = (effect as (AnimationEffect & { getKeyframes?: () => Array<Record<string, unknown>> }) | null)
    ?.getKeyframes;
  if (!effect || typeof getKeyframes !== "function") return true;
  try {
    const properties = getKeyframes
      .call(effect)
      .flatMap((keyframe: Record<string, unknown>) => Object.keys(keyframe))
      .filter((property) => !["composite", "computedOffset", "easing", "offset"].includes(property));
    return (
      properties.length === 0 || properties.some((property) => expectedProperties.has(normalizeProperty(property)))
    );
  } catch {
    return true;
  }
}

function classifyAnimation(
  animation: Animation,
  actor: HTMLElement,
  contract: JournalPhaseActorContract,
): AnimationClassification {
  if (animation.playState === "idle" || animationTargetIsExcluded(animation, actor, contract)) {
    return { status: "ignored" };
  }
  if (!animationMatchesContract(animation, contract)) return { status: "ignored" };
  const effect = animation.effect;
  try {
    if (effect && "getComputedTiming" in effect && typeof effect.getComputedTiming === "function") {
      const timing = effect.getComputedTiming();
      if (timing.endTime === Infinity || timing.activeDuration === Infinity) return { status: "ignored" };
    }
    if (effect && "getTiming" in effect && typeof effect.getTiming === "function") {
      const timing = effect.getTiming();
      if (timing.iterations === Infinity || timing.duration === Infinity) return { status: "ignored" };
    }
  } catch {
    return { status: "runtime-failed", errorCode: "animation-timing-failed" };
  }
  return { status: "finite", animation };
}

function trackAnimation(animation: Animation): AnimationTracker {
  if (animation.playState === "finished") return { promise: Promise.resolve(), cleanup: () => undefined };
  if (typeof animation.addEventListener === "function" && typeof animation.removeEventListener === "function") {
    let resolvePromise!: () => void;
    let rejectPromise!: (error: JournalAnimationRuntimeError) => void;
    let settled = false;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const cleanup = () => {
      animation.removeEventListener("finish", onFinish);
      animation.removeEventListener("cancel", onCancel);
    };
    const settle = (result: "finish" | "cancel") => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result === "finish") resolvePromise();
      else rejectPromise(new JournalAnimationRuntimeError("animation-cancelled"));
    };
    const onFinish = () => settle("finish");
    const onCancel = () => settle("cancel");
    animation.addEventListener("finish", onFinish, { once: true });
    animation.addEventListener("cancel", onCancel, { once: true });
    queueMicrotask(() => {
      if (animation.playState === "finished") onFinish();
      else if (animation.playState === "idle") onCancel();
    });
    return { promise, cleanup };
  }
  try {
    return {
      promise: Promise.resolve(animation.finished).then(
        () => undefined,
        () => Promise.reject(new JournalAnimationRuntimeError("animation-finished-rejected")),
      ),
      cleanup: () => undefined,
    };
  } catch {
    return {
      promise: Promise.reject(new JournalAnimationRuntimeError("animation-finished-unavailable")),
      cleanup: () => undefined,
    };
  }
}

function readPlaybackRate(root: HTMLElement) {
  const value = Number(root.dataset.journalSpeed ?? 1);
  return Number.isFinite(value) ? value : 1;
}

/** Observes the CSS work owned by one physical phase and always returns a bounded typed outcome. */
export async function waitForJournalPhase(
  root: HTMLElement,
  phase: JournalOpeningPhase,
  mode: MotionMode,
  signal: AbortSignal,
): Promise<JournalPhaseOutcome> {
  const startedAt = clockNow();
  if ((await nextPaint(signal)) === "aborted") return { status: "aborted", phase };
  if (signal.aborted) return { status: "aborted", phase };
  const contract = journalPhaseContracts[phase];
  if (contract.actors.length === 0) {
    return {
      status: "completed",
      phase,
      finiteAnimationCount: 0,
      durationMs: Math.max(0, Math.round(clockNow() - startedAt)),
    };
  }

  for (const actorContract of contract.actors) {
    const actors = root.querySelectorAll<HTMLElement>(actorContract.selector);
    if (actorContract.required && actors.length === 0) {
      return { status: "missing-actor", phase, actor: actorContract.actor };
    }
  }

  if (mode === "reduced" && contract.reducedFallback) {
    return { status: "completed-fallback", phase, reason: contract.reducedFallback };
  }

  const finiteAnimations = new Set<Animation>();
  for (const actorContract of contract.actors) {
    const actors = Array.from(root.querySelectorAll<HTMLElement>(actorContract.selector));
    const actorFiniteAnimations = new Set<Animation>();
    for (const actor of actors) {
      let animations: Animation[];
      try {
        animations = actor.getAnimations({ subtree: true });
      } catch {
        return { status: "runtime-failed", phase, errorCode: "animation-query-failed" };
      }
      for (const animation of animations) {
        const classification = classifyAnimation(animation, actor, actorContract);
        if (classification.status === "runtime-failed") {
          return { status: "runtime-failed", phase, errorCode: classification.errorCode };
        }
        if (classification.status === "finite") {
          actorFiniteAnimations.add(classification.animation);
          finiteAnimations.add(classification.animation);
        }
      }
    }
    if (actorContract.expectsFiniteAnimation && actorFiniteAnimations.size === 0) {
      return { status: "missing-animation", phase };
    }
  }

  if (finiteAnimations.size === 0) {
    return { status: "missing-animation", phase };
  }

  const trackers = [...finiteAnimations].map(trackAnimation);
  const timeoutMs = getJournalPhaseTimeoutMs(phase, mode, readPlaybackRate(root));
  return new Promise<JournalPhaseOutcome>((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timeout !== null) clearTimeout(timeout);
      timeout = null;
      signal.removeEventListener("abort", onAbort);
      trackers.forEach((tracker) => tracker.cleanup());
    };
    const settle = (outcome: JournalPhaseOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };
    const onAbort = () => settle({ status: "aborted", phase });
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => settle({ status: "timed-out", phase, timeoutMs }), timeoutMs);
    void Promise.all(trackers.map((tracker) => tracker.promise)).then(
      () =>
        settle({
          status: "completed",
          phase,
          finiteAnimationCount: finiteAnimations.size,
          durationMs: Math.max(0, Math.round(clockNow() - startedAt)),
        }),
      (error: unknown) =>
        settle({
          status: "runtime-failed",
          phase,
          errorCode: error instanceof JournalAnimationRuntimeError ? error.code : "animation-runtime-failed",
        }),
    );
    if (signal.aborted) onAbort();
  });
}

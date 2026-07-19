import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getJournalPhaseTimeoutMs,
  isJournalInteractive,
  journalOpeningPhases,
  nextJournalOpeningPhase,
  waitForJournalPhase,
} from "./opening-machine";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function actor(root: HTMLElement, name: string, animations: Animation[] = []) {
  const element = document.createElement("div");
  element.dataset.openingActor = name;
  Object.defineProperty(element, "getAnimations", {
    configurable: true,
    value: vi.fn(() => animations),
  });
  root.append(element);
  return element;
}

function animation(
  target: Element,
  {
    property = "transform",
    finished = Promise.resolve(),
    endTime = 100,
    iterations = 1,
    playState = "running",
    animationName,
  }: {
    property?: string;
    finished?: Promise<void>;
    endTime?: number;
    iterations?: number;
    playState?: AnimationPlayState;
    animationName?: string;
  } = {},
) {
  const effect = {
    target,
    getComputedTiming: () => ({ endTime, activeDuration: endTime }),
    getTiming: () => ({ duration: endTime, iterations }),
    getKeyframes: () => [{ [property]: "initial" }, { [property]: "final" }],
  } as unknown as AnimationEffect;
  return {
    effect,
    finished,
    playState,
    transitionProperty: animationName ? undefined : property,
    animationName,
  } as unknown as Animation;
}

async function passPaintFrames() {
  await vi.advanceTimersByTimeAsync(2);
}

describe("journal opening state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 1),
    );
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
  });

  afterEach(() => {
    expect(vi.getTimerCount()).toBe(0);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("advances through the complete physical sequence in one direction", () => {
    const visited: Array<(typeof journalOpeningPhases)[number]> = [journalOpeningPhases[0]];
    let next = nextJournalOpeningPhase(visited[0]);
    while (next) {
      visited.push(next);
      next = nextJournalOpeningPhase(next);
    }
    expect(visited).toEqual(journalOpeningPhases);
  });

  it("does not enable journal interaction before the book settles", () => {
    expect(journalOpeningPhases.slice(0, -1).every((phase) => !isJournalInteractive(phase))).toBe(true);
    expect(isJournalInteractive("JOURNAL_READY")).toBe(true);
    expect(nextJournalOpeningPhase("JOURNAL_READY")).toBeNull();
  });

  it("reports completion for the expected finite phase animation", async () => {
    const root = document.createElement("div");
    const latch = actor(root, "latch");
    Object.defineProperty(latch, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [animation(latch)]),
    });
    const outcomePromise = waitForJournalPhase(root, "LATCH_RELEASING", "full", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toMatchObject({
      status: "completed",
      phase: "LATCH_RELEASING",
      finiteAnimationCount: 1,
    });
  });

  it("distinguishes a missing required actor", async () => {
    const outcomePromise = waitForJournalPhase(
      document.createElement("div"),
      "COVER_OPENING",
      "full",
      new AbortController().signal,
    );
    await passPaintFrames();
    await expect(outcomePromise).resolves.toEqual({
      status: "missing-actor",
      phase: "COVER_OPENING",
      actor: "front-cover",
    });
  });

  it("distinguishes a required actor with no finite animation", async () => {
    const root = document.createElement("div");
    actor(root, "sealed-page");
    const outcomePromise = waitForJournalPhase(root, "SEALED_PAGE_REVEAL", "full", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toEqual({
      status: "missing-animation",
      phase: "SEALED_PAGE_REVEAL",
    });
  });

  it("ignores an infinite ambient animation instead of waiting forever", async () => {
    const root = document.createElement("div");
    const latch = actor(root, "latch");
    Object.defineProperty(latch, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [
        animation(latch, { endTime: Infinity, iterations: Infinity }),
        animation(latch, { animationName: "ambient-flicker" }),
      ]),
    });
    const outcomePromise = waitForJournalPhase(root, "LATCH_RELEASING", "full", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toEqual({
      status: "missing-animation",
      phase: "LATCH_RELEASING",
    });
  });

  it("waits only for relevant finite work in a mixed animation set", async () => {
    const root = document.createElement("div");
    const cover = actor(root, "front-cover");
    const finite = animation(cover);
    const infinite = animation(cover, { endTime: Infinity, iterations: Infinity });
    const irrelevant = animation(cover, { property: "color" });
    Object.defineProperty(cover, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [finite, infinite, irrelevant]),
    });
    const outcomePromise = waitForJournalPhase(root, "COVER_OPENING", "full", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toMatchObject({
      status: "completed",
      phase: "COVER_OPENING",
      finiteAnimationCount: 1,
    });
  });

  it("reports a rejected animation finished promise as a runtime failure", async () => {
    const root = document.createElement("div");
    const waxSeal = actor(root, "wax-seal");
    const completion = deferred();
    Object.defineProperty(waxSeal, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [animation(waxSeal, { finished: completion.promise })]),
    });
    const outcomePromise = waitForJournalPhase(root, "SEAL_BREAKING", "full", new AbortController().signal);
    await passPaintFrames();
    completion.reject(new Error("renderer failed"));
    await expect(outcomePromise).resolves.toEqual({
      status: "runtime-failed",
      phase: "SEAL_BREAKING",
      errorCode: "animation-finished-rejected",
    });
  });

  it("times out an unresolved finite animation using the phase budget", async () => {
    const root = document.createElement("div");
    const cover = actor(root, "front-cover");
    const completion = deferred();
    Object.defineProperty(cover, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [animation(cover, { finished: completion.promise })]),
    });
    const outcomePromise = waitForJournalPhase(root, "COVER_OPENING", "gentle", new AbortController().signal);
    await passPaintFrames();
    const timeoutMs = getJournalPhaseTimeoutMs("COVER_OPENING", "gentle");
    await vi.advanceTimersByTimeAsync(timeoutMs);
    await expect(outcomePromise).resolves.toEqual({ status: "timed-out", phase: "COVER_OPENING", timeoutMs });
  });

  it("allows the declared gentle book-settling work to finish before its bounded timeout", async () => {
    const root = document.createElement("div");
    const completion = deferred();
    for (const name of ["book-camera", "persistent-interface", "objective"]) {
      const element = actor(root, name);
      Object.defineProperty(element, "getAnimations", {
        configurable: true,
        value: vi.fn(() => [animation(element, { finished: completion.promise, endTime: 1300 })]),
      });
    }
    const outcomePromise = waitForJournalPhase(root, "BOOK_SETTLING", "gentle", new AbortController().signal);
    await passPaintFrames();
    expect(getJournalPhaseTimeoutMs("BOOK_SETTLING", "gentle")).toBe(1700);
    await vi.advanceTimersByTimeAsync(1300);
    completion.resolve();
    await expect(outcomePromise).resolves.toMatchObject({
      status: "completed",
      phase: "BOOK_SETTLING",
      finiteAnimationCount: 3,
    });
  });

  it("settles an active wait as aborted in under 100 ms and clears its timeout", async () => {
    const root = document.createElement("div");
    const latch = actor(root, "latch");
    const completion = deferred();
    Object.defineProperty(latch, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [animation(latch, { finished: completion.promise })]),
    });
    const controller = new AbortController();
    const outcomePromise = waitForJournalPhase(root, "LATCH_RELEASING", "full", controller.signal);
    await passPaintFrames();
    const abortedAt = Date.now();
    controller.abort();
    await expect(outcomePromise).resolves.toEqual({ status: "aborted", phase: "LATCH_RELEASING" });
    expect(Date.now() - abortedAt).toBeLessThan(100);
  });

  it("bounds paint acquisition when requestAnimationFrame is suspended", async () => {
    const cancelFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 41),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const settled = vi.fn();
    const outcomePromise = waitForJournalPhase(
      document.createElement("div"),
      "JOURNAL_READY",
      "full",
      new AbortController().signal,
    );
    void outcomePromise.then(settled);

    await vi.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(outcomePromise).resolves.toMatchObject({ status: "completed", phase: "JOURNAL_READY" });
    expect(cancelFrame).toHaveBeenCalledWith(41);
  });

  it("aborts suspended paint acquisition and clears every pending callback", async () => {
    const cancelFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 42),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const controller = new AbortController();
    const outcomePromise = waitForJournalPhase(
      document.createElement("div"),
      "JOURNAL_READY",
      "full",
      controller.signal,
    );

    expect(vi.getTimerCount()).toBe(1);
    controller.abort();

    await expect(outcomePromise).resolves.toEqual({ status: "aborted", phase: "JOURNAL_READY" });
    expect(cancelFrame).toHaveBeenCalledWith(42);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses the declared static fallback when reduced motion has no finite phase animation", async () => {
    const root = document.createElement("div");
    actor(root, "front-cover");
    const outcomePromise = waitForJournalPhase(root, "COVER_OPENING", "reduced", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toEqual({
      status: "completed-fallback",
      phase: "COVER_OPENING",
      reason: "reduced-motion-static-open-cover",
    });
  });

  it("uses the declared reduced fallback even when a short CSS transition is still observable", async () => {
    const root = document.createElement("div");
    const cover = actor(root, "front-cover");
    Object.defineProperty(cover, "getAnimations", {
      configurable: true,
      value: vi.fn(() => [animation(cover)]),
    });
    const outcomePromise = waitForJournalPhase(root, "COVER_OPENING", "reduced", new AbortController().signal);
    await passPaintFrames();
    await expect(outcomePromise).resolves.toEqual({
      status: "completed-fallback",
      phase: "COVER_OPENING",
      reason: "reduced-motion-static-open-cover",
    });
    expect(cover.getAnimations).not.toHaveBeenCalled();
  });

  it("returns the same deterministic terminal outcome for a phase that declares no animation", async () => {
    const root = document.createElement("div");
    const first = waitForJournalPhase(root, "JOURNAL_READY", "full", new AbortController().signal);
    await passPaintFrames();
    const firstOutcome = await first;
    const second = waitForJournalPhase(root, "JOURNAL_READY", "reduced", new AbortController().signal);
    await passPaintFrames();
    const secondOutcome = await second;
    expect(firstOutcome).toMatchObject({ status: "completed", phase: "JOURNAL_READY", finiteAnimationCount: 0 });
    expect(secondOutcome).toMatchObject({ status: "completed", phase: "JOURNAL_READY", finiteAnimationCount: 0 });
  });
});

import { createElement, StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalPhaseOutcome } from "@/animation/core/animation-types";
import type { JournalOpeningPhase } from "@/animation/journal/opening-machine";
import {
  journalOpeningAllowsPersistence,
  runJournalOpeningPhases,
  TallTaleJournalSession,
} from "./TallTaleJournalSession";

const openingTestDouble = vi.hoisted(() => ({ waitForPhase: vi.fn() }));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({
    mode: "reduced",
    productMode: "reduced",
    systemReduced: true,
    policy: { level: "reduced" },
    setMode: vi.fn(),
    cycle: vi.fn(),
  }),
}));

vi.mock("@/animation/journal/opening-machine", () => ({
  isJournalInteractive: (phase: JournalOpeningPhase) => phase === "JOURNAL_READY",
  waitForJournalPhase: (...args: unknown[]) => openingTestDouble.waitForPhase(...args),
}));

vi.mock("@/components/player/journal/PhysicalJournalBook", async () => {
  const React = await import("react");
  return {
    PhysicalJournalBook: React.forwardRef(function PhysicalJournalBookMock(_props: unknown, ref) {
      React.useImperativeHandle(ref, () => ({
        next: vi.fn(),
        previous: vi.fn(),
        turnTo: vi.fn(),
        flipTo: vi.fn(),
        currentPage: () => 0,
        pageCount: () => 0,
        orientation: () => "portrait" as const,
        boundary: () => null,
      }));
      return React.createElement("section", { "data-testid": "physical-journal-book" });
    }),
  };
});

vi.mock("@/tall-tale/journal-page-model", () => ({
  buildTallTaleJournalPages: () => [],
  pageIndexForJournalBlock: () => 0,
  pageIndexForJournalChapter: () => 0,
  pageIndexForReadingState: () => 0,
}));

function completed(phase: JournalOpeningPhase): JournalPhaseOutcome {
  return { status: "completed", phase, finiteAnimationCount: 1, durationMs: 12 };
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function jsonResponse(body: unknown, jsonPromise?: Promise<unknown>): Response {
  return {
    ok: true,
    json: vi.fn(() => jsonPromise ?? Promise.resolve(body)),
  } as unknown as Response;
}

function sessionState(sessionId: string) {
  return {
    csrfToken: `csrf-${sessionId}`,
    session: {
      id: sessionId,
      status: "ACTIVE",
      previewMode: false,
      versionId: `version-${sessionId}`,
      versionLabel: `Edition ${sessionId}`,
      versionPublishedAt: null,
      versionChecksum: null,
      currentSequence: 1,
      startedAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      completedAt: null,
    },
    tale: {
      title: `Tale ${sessionId}`,
      slug: `tale-${sessionId}`,
      subtitle: null,
      shortDescription: null,
    },
    chapter: null,
    block: null,
    pendingVerification: null,
    assets: [],
    journal: { mode: "active", currentChapterId: null, currentBlockId: null, chapters: [] },
  };
}

function readingState(textScale: number) {
  return {
    pageId: null,
    openDrawer: null,
    hasOpened: false,
    lastEventSequence: 0,
    textScale,
    updatedAt: null,
  };
}

async function flushMicrotasks(rounds = 12) {
  for (let round = 0; round < rounds; round += 1) await Promise.resolve();
}

class ControlledEventSource extends EventTarget {
  static instances: ControlledEventSource[] = [];
  static activeStreams = 0;
  static activeListeners = 0;

  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    ControlledEventSource.instances.push(this);
    ControlledEventSource.activeStreams += 1;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (callback) ControlledEventSource.activeListeners += 1;
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    if (callback) ControlledEventSource.activeListeners -= 1;
    super.removeEventListener(type, callback, options);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    ControlledEventSource.activeStreams -= 1;
  }

  static reset() {
    ControlledEventSource.instances = [];
    ControlledEventSource.activeStreams = 0;
    ControlledEventSource.activeListeners = 0;
  }
}

describe("TallTaleJournalSession opening outcome consumer", () => {
  it("reports a completed opening only after every phase completes in order", async () => {
    const root = document.createElement("main");
    const phases = ["ENTRY_ACTIVATED", "CLOSED_BOOK_REVEAL", "JOURNAL_READY"] as const;
    const visited: JournalOpeningPhase[] = [];
    const waitForPhase = vi.fn(async (_root: HTMLElement, phase: JournalOpeningPhase) => completed(phase));

    const result = await runJournalOpeningPhases({
      root,
      phases,
      mode: "full",
      signal: new AbortController().signal,
      onPhase: (phase) => visited.push(phase),
      waitForPhase,
    });

    expect(result).toEqual({ status: "completed" });
    expect(visited).toEqual(phases);
    expect(waitForPhase).toHaveBeenCalledTimes(phases.length);
  });

  it("preserves an approved reduced-motion fallback as a distinct successful outcome", async () => {
    const root = document.createElement("main");
    const phases = ["CLOSED_BOOK_REVEAL", "JOURNAL_READY"] as const;
    const waitForPhase = vi.fn(async (_root: HTMLElement, phase: JournalOpeningPhase) =>
      phase === "CLOSED_BOOK_REVEAL"
        ? ({ status: "completed-fallback", phase, reason: "reduced-motion-static-closed-book" } as const)
        : completed(phase),
    );

    const result = await runJournalOpeningPhases({
      root,
      phases,
      mode: "reduced",
      signal: new AbortController().signal,
      onPhase: () => undefined,
      waitForPhase,
    });

    expect(result).toEqual({
      status: "completed-fallback",
      reasons: ["reduced-motion-static-closed-book"],
    });
  });

  it.each([
    { status: "missing-actor", phase: "LATCH_RELEASING", actor: "latch" },
    { status: "missing-animation", phase: "COVER_OPENING" },
    { status: "timed-out", phase: "SEAL_BREAKING", timeoutMs: 1650 },
    { status: "runtime-failed", phase: "BOOK_SETTLING", errorCode: "animation-query-failed" },
  ] satisfies JournalPhaseOutcome[])("stops on $status and returns a non-persistable failure", async (phaseOutcome) => {
    const waitForPhase = vi.fn(async () => phaseOutcome);
    const result = await runJournalOpeningPhases({
      root: document.createElement("main"),
      phases: [phaseOutcome.phase, "JOURNAL_READY"],
      mode: "full",
      signal: new AbortController().signal,
      onPhase: () => undefined,
      waitForPhase,
    });

    expect(result).toEqual({ status: "failure", outcome: phaseOutcome });
    expect(waitForPhase).toHaveBeenCalledOnce();
    expect(journalOpeningAllowsPersistence(result.status)).toBe(false);
  });

  it("stops immediately when the phase waiter reports an abort", async () => {
    const waitForPhase = vi.fn(
      async (_root: HTMLElement, phase: JournalOpeningPhase): Promise<JournalPhaseOutcome> => ({
        status: "aborted",
        phase,
      }),
    );
    const result = await runJournalOpeningPhases({
      root: document.createElement("main"),
      phases: ["COVER_OPENING", "JOURNAL_READY"],
      mode: "gentle",
      signal: new AbortController().signal,
      onPhase: () => undefined,
      waitForPhase,
    });

    expect(result).toEqual({ status: "aborted", phase: "COVER_OPENING" });
    expect(waitForPhase).toHaveBeenCalledOnce();
    expect(journalOpeningAllowsPersistence(result.status)).toBe(false);
  });

  it("does not enter a phase when its signal was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const onPhase = vi.fn();
    const waitForPhase = vi.fn(async (_root: HTMLElement, phase: JournalOpeningPhase) => completed(phase));

    const result = await runJournalOpeningPhases({
      root: document.createElement("main"),
      phases: ["ENTRY_ACTIVATED"],
      mode: "full",
      signal: controller.signal,
      onPhase,
      waitForPhase,
    });

    expect(result).toEqual({ status: "aborted", phase: "ENTRY_ACTIVATED" });
    expect(onPhase).not.toHaveBeenCalled();
    expect(waitForPhase).not.toHaveBeenCalled();
  });

  it("converts an unexpected waiter rejection into a safe runtime failure", async () => {
    const result = await runJournalOpeningPhases({
      root: document.createElement("main"),
      phases: ["SEALED_PAGE_REVEAL"],
      mode: "full",
      signal: new AbortController().signal,
      onPhase: () => undefined,
      waitForPhase: async () => Promise.reject(new Error("private runtime detail")),
    });

    expect(result).toEqual({
      status: "failure",
      outcome: {
        status: "runtime-failed",
        phase: "SEALED_PAGE_REVEAL",
        errorCode: "journal-phase-wait-rejected",
      },
    });
  });

  it("allows persistence only for completed, approved fallback, or deliberate skip", () => {
    expect(journalOpeningAllowsPersistence("completed")).toBe(true);
    expect(journalOpeningAllowsPersistence("completed-fallback")).toBe(true);
    expect(journalOpeningAllowsPersistence("skipped")).toBe(true);
    for (const status of ["idle", "running", "aborted", "failure"] as const) {
      expect(journalOpeningAllowsPersistence(status)).toBe(false);
    }
  });
});

describe("TallTaleJournalSession mounted synchronous teardown", () => {
  beforeEach(() => {
    localStorage.clear();
    ControlledEventSource.reset();
    openingTestDouble.waitForPhase.mockReset();
    openingTestDouble.waitForPhase.mockImplementation(async (_root: HTMLElement, phase: JournalOpeningPhase) =>
      completed(phase),
    );
    vi.stubGlobal("EventSource", ControlledEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    ControlledEventSource.reset();
  });

  it("cancels its scheduled initial load when unmounted before the queued microtask", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = render(
      createElement(StrictMode, null, createElement(TallTaleJournalSession, { sessionId: "microtask" })),
    );
    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ControlledEventSource.activeStreams).toBe(0);
    await act(flushMicrotasks);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts an in-flight initial request in the unmount commit", async () => {
    vi.useFakeTimers();
    let activeRequests = 0;
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      activeRequests += 1;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => {
            activeRequests -= 1;
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(createElement(TallTaleJournalSession, { sessionId: "pending-request" }));
    await act(flushMicrotasks);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(activeRequests).toBe(1);
    expect(requestSignal?.aborted).toBe(false);

    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    expect(activeRequests).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await act(flushMicrotasks);
  });

  it("closes streams, aborts opening work, removes journal keys, and clears reconnect timers for 20 Strict Mode cycles", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    let activeRequests = 0;
    let activeOpenings = 0;
    const fulfilledSignals: AbortSignal[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        activeRequests += 1;
        if (init?.signal) fulfilledSignals.push(init.signal);
        const sessionId = String(input).split("/").at(-1) ?? "unknown";
        return Promise.resolve(jsonResponse(sessionState(sessionId))).finally(() => {
          activeRequests -= 1;
        });
      }),
    );
    openingTestDouble.waitForPhase.mockImplementation(
      (_root: HTMLElement, phase: JournalOpeningPhase, _mode: string, signal: AbortSignal) =>
        new Promise<JournalPhaseOutcome>((resolve) => {
          activeOpenings += 1;
          signal.addEventListener(
            "abort",
            () => {
              activeOpenings -= 1;
              resolve({ status: "aborted", phase });
            },
            { once: true },
          );
        }),
    );

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const sessionId = `cycle-${cycle}`;
      const intervalStart = setIntervalSpy.mock.results.length;
      const view = render(createElement(StrictMode, null, createElement(TallTaleJournalSession, { sessionId })));
      await act(flushMicrotasks);

      const journal = view.container.querySelector<HTMLElement>("main[data-journal-phase]");
      expect(journal?.isConnected).toBe(true);
      expect(activeRequests).toBe(0);
      expect(ControlledEventSource.activeStreams).toBe(1);
      expect(ControlledEventSource.activeListeners).toBe(2);

      fireEvent.click(screen.getByRole("button", { name: "chapters" }));
      fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
      await act(flushMicrotasks);
      expect(activeOpenings).toBe(1);
      const journalIntervals = setIntervalSpy.mock.results
        .slice(intervalStart)
        .filter((_result, index) => [500, 5000].includes(Number(setIntervalSpy.mock.calls[intervalStart + index]?.[1])))
        .map((result) => result.value);
      expect(journalIntervals.length).toBeGreaterThanOrEqual(2);
      const fulfilledSignal = fulfilledSignals.at(-1);
      expect(fulfilledSignal?.aborted).toBe(false);
      const storedBeforeUnmount = localStorage.getItem(`tall-tale-journal:${sessionId}`);
      expect(storedBeforeUnmount).toContain('"openDrawer":"chapters"');

      view.unmount();
      expect(journal?.isConnected).toBe(false);
      expect(activeRequests).toBe(0);
      expect(activeOpenings).toBe(0);
      expect(ControlledEventSource.activeStreams).toBe(0);
      expect(ControlledEventSource.activeListeners).toBe(0);
      for (const interval of journalIntervals) expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
      expect(fulfilledSignal?.aborted).toBe(false);

      journal?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(localStorage.getItem(`tall-tale-journal:${sessionId}`)).toBe(storedBeforeUnmount);
      await act(flushMicrotasks);
      localStorage.removeItem(`tall-tale-journal:${sessionId}`);
      vi.clearAllTimers();
    }
  });

  it("cancels reconnect polling after a stream becomes live and does not abort an already fulfilled request", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    let fulfilledSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        fulfilledSignal = init?.signal ?? undefined;
        return Promise.resolve(jsonResponse(sessionState("fulfilled")));
      }),
    );

    const view = render(createElement(TallTaleJournalSession, { sessionId: "fulfilled" }));
    await act(flushMicrotasks);
    expect(fulfilledSignal?.aborted).toBe(false);
    expect(ControlledEventSource.activeStreams).toBe(1);
    const journalIntervals = setIntervalSpy.mock.results
      .filter((_result, index) => [500, 5000].includes(Number(setIntervalSpy.mock.calls[index]?.[1])))
      .map((result) => result.value);
    const reconnectInterval = setIntervalSpy.mock.results.find(
      (_result, index) => Number(setIntervalSpy.mock.calls[index]?.[1]) === 5000,
    )?.value;
    expect(journalIntervals.length).toBeGreaterThanOrEqual(2);
    expect(reconnectInterval).toBeDefined();

    const source = ControlledEventSource.instances.at(-1);
    await act(async () => {
      source?.onopen?.(new Event("open"));
      await flushMicrotasks();
    });
    expect(clearIntervalSpy).toHaveBeenCalledWith(reconnectInterval);

    view.unmount();
    expect(fulfilledSignal?.aborted).toBe(false);
    expect(ControlledEventSource.activeStreams).toBe(0);
    expect(ControlledEventSource.activeListeners).toBe(0);
    for (const interval of journalIntervals) expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a stale identity journal response that %s after a session rerender",
    async (settlement) => {
      const oldJournalBody = deferred<unknown>();
      const identitySignals = new Map<string, AbortSignal>();
      vi.stubGlobal(
        "fetch",
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/journal-state")) {
            const sessionId = url.split("/").at(-2) ?? "unknown";
            if (init?.signal) identitySignals.set(sessionId, init.signal);
            if (sessionId === "old") return Promise.resolve(jsonResponse({}, oldJournalBody.promise));
            return Promise.resolve(jsonResponse({ readingState: readingState(0.95) }));
          }
          const sessionId = url.split("/").at(-1) ?? "unknown";
          return Promise.resolve(jsonResponse(sessionState(sessionId)));
        }),
      );

      const view = render(createElement(TallTaleJournalSession, { sessionId: "old", identitySession: true }));
      await act(flushMicrotasks);
      expect(identitySignals.get("old")?.aborted).toBe(false);

      view.rerender(createElement(TallTaleJournalSession, { sessionId: "new", identitySession: true }));
      await act(flushMicrotasks);
      expect(identitySignals.get("old")?.aborted).toBe(true);
      expect(identitySignals.get("new")?.aborted).toBe(false);
      expect(screen.getByRole("heading", { name: "Tale new" })).toBeTruthy();
      expect((screen.getByLabelText("Journal text size") as HTMLInputElement).value).toBe("0.95");

      await act(async () => {
        if (settlement === "resolve") oldJournalBody.resolve({ readingState: readingState(1.4) });
        else oldJournalBody.reject(new Error("stale old-session body"));
        await flushMicrotasks();
      });

      expect(screen.getByRole("heading", { name: "Tale new" })).toBeTruthy();
      expect((screen.getByLabelText("Journal text size") as HTMLInputElement).value).toBe("0.95");
      expect(ControlledEventSource.activeStreams).toBe(1);

      view.unmount();
      expect(identitySignals.get("new")?.aborted).toBe(false);
      expect(ControlledEventSource.activeStreams).toBe(0);
      expect(ControlledEventSource.activeListeners).toBe(0);
    },
  );
});

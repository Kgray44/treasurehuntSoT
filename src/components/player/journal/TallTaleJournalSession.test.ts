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
const pageFlipTestDouble = vi.hoisted(() => ({
  fallbackVisible: false,
  forceReadableFallback: vi.fn(),
  readiness: vi.fn(),
}));
const journalPageModelTestDouble = vi.hoisted(() => ({
  buildPages: vi.fn(),
  pageForBlock: vi.fn(),
  pageForChapter: vi.fn(),
  pageForReadingState: vi.fn(),
}));

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

vi.mock("@/animation/journal/opening-machine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/animation/journal/opening-machine")>()),
  waitForJournalPhase: (...args: unknown[]) => openingTestDouble.waitForPhase(...args),
}));

vi.mock("@/components/player/journal/PhysicalJournalBook", async () => {
  const React = await import("react");
  return {
    PhysicalJournalBook: React.forwardRef(function PhysicalJournalBookMock(
      props: {
        initialPage?: number;
        onReadinessChange?: (snapshot: ReturnType<typeof pageFlipTestDouble.readiness>) => void;
      },
      ref,
    ) {
      const { onReadinessChange } = props;
      React.useImperativeHandle(ref, () => ({
        next: vi.fn(),
        previous: vi.fn(),
        turnTo: vi.fn(),
        flipTo: vi.fn(),
        currentPage: () => 0,
        pageCount: () => 0,
        orientation: () => "portrait" as const,
        boundary: () => null,
        pageTargets: () => null,
        readiness: () => pageFlipTestDouble.readiness(),
        forceReadableFallback: (reason: string) => pageFlipTestDouble.forceReadableFallback(reason),
      }));
      React.useEffect(() => {
        try {
          onReadinessChange?.(pageFlipTestDouble.readiness());
        } catch {
          // A failed readiness probe is exercised through the public handle.
        }
      }, [onReadinessChange]);
      return React.createElement(
        "section",
        { "data-initial-page": props.initialPage, "data-testid": "physical-journal-book" },
        pageFlipTestDouble.fallbackVisible
          ? React.createElement("article", { "data-testid": "pageflip-static-current-page" }, "Readable current page")
          : null,
      );
    }),
  };
});

vi.mock("@/tall-tale/journal-page-model", () => ({
  buildTallTaleJournalPages: (...args: unknown[]) => journalPageModelTestDouble.buildPages(...args),
  pageIndexForJournalBlock: (...args: unknown[]) => journalPageModelTestDouble.pageForBlock(...args),
  pageIndexForJournalChapter: (...args: unknown[]) => journalPageModelTestDouble.pageForChapter(...args),
  pageIndexForReadingState: (...args: unknown[]) => journalPageModelTestDouble.pageForReadingState(...args),
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
    pageFlipTestDouble.readiness.mockReset();
    pageFlipTestDouble.readiness.mockReturnValue({
      status: "reduced",
      ready: true,
      bookId: "physical-journal",
      mountId: "test-journal",
      mode: "reduced",
      generation: 1,
    });
    pageFlipTestDouble.fallbackVisible = false;
    pageFlipTestDouble.forceReadableFallback.mockReset();
    pageFlipTestDouble.forceReadableFallback.mockImplementation(() => {
      pageFlipTestDouble.fallbackVisible = true;
      pageFlipTestDouble.readiness.mockReturnValue({
        status: "fallback",
        ready: true,
        bookId: "physical-journal",
        mountId: "test-journal",
        mode: "reduced",
        generation: 1,
      });
    });
    journalPageModelTestDouble.buildPages.mockReset();
    journalPageModelTestDouble.buildPages.mockReturnValue([]);
    journalPageModelTestDouble.pageForBlock.mockReset();
    journalPageModelTestDouble.pageForBlock.mockReturnValue(0);
    journalPageModelTestDouble.pageForChapter.mockReset();
    journalPageModelTestDouble.pageForChapter.mockReturnValue(0);
    journalPageModelTestDouble.pageForReadingState.mockReset();
    journalPageModelTestDouble.pageForReadingState.mockReturnValue(0);
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
      localStorage.setItem(
        `tall-tale-journal:${sessionId}`,
        JSON.stringify({ ...readingState(1), openDrawer: "chapters" }),
      );
      const intervalStart = setIntervalSpy.mock.results.length;
      const view = render(createElement(StrictMode, null, createElement(TallTaleJournalSession, { sessionId })));
      await act(flushMicrotasks);

      const journal = view.container.querySelector<HTMLElement>("main[data-journal-phase]");
      expect(journal?.isConnected).toBe(true);
      expect(activeRequests).toBe(0);
      expect(ControlledEventSource.activeStreams).toBe(1);
      expect(ControlledEventSource.activeListeners).toBe(2);

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

  it("treats access revocation as terminal while keeping released pages readable", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(sessionState("revoked"))));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(createElement(TallTaleJournalSession, { sessionId: "revoked" }));
    await act(flushMicrotasks);
    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);

    const source = ControlledEventSource.instances.at(-1)!;
    await act(async () => {
      source.dispatchEvent(new Event("access-revoked"));
      await flushMicrotasks();
    });
    const fetchCountAfterRevocation = fetchMock.mock.calls.length;

    expect(source.closed).toBe(true);
    expect(ControlledEventSource.activeStreams).toBe(0);
    expect(ControlledEventSource.activeListeners).toBe(0);
    expect(screen.getByText("Access revoked")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("will not reconnect");
    expect(screen.queryByRole("button", { name: "Retry now" })).toBeNull();
    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("JOURNAL_READY");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await flushMicrotasks();
    });
    expect(fetchMock).toHaveBeenCalledTimes(fetchCountAfterRevocation);
  });

  it("keeps an offline transport failure recoverable and distinct from revocation", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(sessionState("offline")))),
    );
    render(createElement(TallTaleJournalSession, { sessionId: "offline" }));
    await act(flushMicrotasks);
    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);

    const source = ControlledEventSource.instances.at(-1)!;
    await act(async () => {
      source.onerror?.(new Event("error"));
      await flushMicrotasks();
    });

    expect(source.closed).toBe(false);
    expect(screen.getByText("Offline")).toBeTruthy();
    expect(screen.getByText("You appear to be offline.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry now" })).toBeTruthy();
  });

  it("makes the unopened background inert, transfers focus to the ready journal, and restores drawer focus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const sessionId = String(input).split("/").at(-1) ?? "focus";
        return Promise.resolve(jsonResponse(sessionState(sessionId)));
      }),
    );

    const view = render(createElement(TallTaleJournalSession, { sessionId: "focus" }));
    await act(flushMicrotasks);
    const tools = view.container.querySelector<HTMLElement>(".journal-context-tabs")!;
    const closedDrawer = view.container.querySelector<HTMLElement>(".journal-chapters-drawer")!;
    expect(tools.hasAttribute("inert")).toBe(true);
    expect(closedDrawer.hasAttribute("inert")).toBe(true);
    const libraryExit = screen.getByRole("link", { name: "Return to Chronicle Library" });
    expect(libraryExit.closest('[role="dialog"]')).not.toBeNull();
    expect(libraryExit.closest("[inert]")).toBeNull();

    const open = screen.getByRole("button", { name: /Open the journal/i });
    open.focus();
    fireEvent.click(open);
    await act(flushMicrotasks);

    const heading = screen.getByRole("heading", { name: "Edition focus Voyage Journal" });
    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(view.container.querySelector("main")?.dataset.journalOpeningOutcome).toBe("completed-fallback");
    expect(view.container.querySelector("main")?.dataset.pageFlipReadiness).toBe("reduced");
    expect(document.activeElement).toBe(heading);
    expect(tools.hasAttribute("inert")).toBe(false);
    expect(pageFlipTestDouble.readiness).toHaveBeenCalled();

    const chapters = screen.getByRole("button", { name: "chapters" });
    fireEvent.click(chapters);
    await act(flushMicrotasks);
    const close = screen.getByRole("button", { name: "Close chapter drawer" });
    expect(closedDrawer.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    await act(flushMicrotasks);
    expect(closedDrawer.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(chapters);
  });

  it("offers manual full and abbreviated replay and restores the replay trigger", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(sessionState("replay")))),
    );
    const view = render(createElement(TallTaleJournalSession, { sessionId: "replay" }));
    await act(flushMicrotasks);
    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);

    expect(screen.getByRole("button", { name: "Replay full opening" })).toBeTruthy();
    const replayShort = screen.getByRole("button", { name: "Replay short opening" });
    replayShort.focus();
    fireEvent.click(replayShort);
    await act(flushMicrotasks);

    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(replayShort.isConnected).toBe(true);
    expect(replayShort.closest("[inert]")).toBeNull();
    expect(replayShort.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.activeElement).toBe(replayShort);
  });

  it("opens a completed voyage as a quiet archive without EventSource or reconnect polling", async () => {
    vi.useFakeTimers();
    const archive = sessionState("archive");
    archive.session.status = "COMPLETED";
    archive.journal.mode = "historical";
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(archive))),
    );

    const view = render(createElement(TallTaleJournalSession, { sessionId: "archive" }));
    await act(flushMicrotasks);

    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(view.container.querySelector("main")?.dataset.journalReadyReason).toBe("completed-fallback");
    expect(screen.getByText("Completed archive")).toBeTruthy();
    expect(ControlledEventSource.activeStreams).toBe(0);
    expect(setIntervalSpy.mock.calls.some((call) => Number(call[1]) === 5000)).toBe(false);
  });

  it("converges a phase timeout on readable JOURNAL_READY without persisting an aborted first opening", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(sessionState("timeout")))),
    );
    openingTestDouble.waitForPhase.mockImplementationOnce(
      async (_root: HTMLElement, phase: JournalOpeningPhase): Promise<JournalPhaseOutcome> => ({
        status: "timed-out",
        phase,
        timeoutMs: 250,
      }),
    );
    const view = render(createElement(TallTaleJournalSession, { sessionId: "timeout" }));
    await act(flushMicrotasks);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);

    const journal = view.container.querySelector<HTMLElement>("main")!;
    expect(journal.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(journal.dataset.journalReadyReason).toBe("phase-timeout");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("tall-tale-journal:timeout") ?? "{}").hasOpened).not.toBe(true);
  });

  it("waits at BOOK_SETTLING, then converges a PageFlip readiness timeout without false persistence", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(sessionState("pageflip-timeout")))),
    );
    pageFlipTestDouble.readiness.mockReturnValue({
      status: "initializing",
      ready: false,
      bookId: "physical-journal",
      mountId: "timeout-journal",
      mode: "reduced",
      generation: 1,
    });
    const view = render(createElement(TallTaleJournalSession, { sessionId: "pageflip-timeout" }));
    await act(flushMicrotasks);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);
    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("BOOK_SETTLING");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1510);
      await flushMicrotasks();
    });
    const journal = view.container.querySelector<HTMLElement>("main")!;
    expect(journal.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(journal.dataset.journalReadyReason).toBe("pageflip-readiness-failure");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(pageFlipTestDouble.forceReadableFallback).toHaveBeenCalledWith("PageFlip readiness timed out");
    expect(screen.getByTestId("pageflip-static-current-page")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("tall-tale-journal:pageflip-timeout") ?? "{}").hasOpened).not.toBe(true);
  });

  it("converges a failed PageFlip readiness probe on readable JOURNAL_READY without exposing its error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(sessionState("pageflip-failure")))),
    );
    pageFlipTestDouble.readiness.mockImplementation(() => {
      throw new Error("private readiness failure");
    });
    const view = render(createElement(TallTaleJournalSession, { sessionId: "pageflip-failure" }));
    await act(flushMicrotasks);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/i }));
    await act(flushMicrotasks);

    const journal = view.container.querySelector<HTMLElement>("main")!;
    expect(journal.dataset.journalPhase).toBe("JOURNAL_READY");
    expect(journal.dataset.journalReadyReason).toBe("pageflip-readiness-failure");
    expect(pageFlipTestDouble.forceReadableFallback).toHaveBeenCalledWith("PageFlip readiness probe failed");
    expect(screen.getByTestId("pageflip-static-current-page")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).not.toContain("private readiness failure");
    expect(JSON.parse(localStorage.getItem("tall-tale-journal:pageflip-failure") ?? "{}").hasOpened).not.toBe(true);
  });

  it("recreates session identity before loading the new cursor, opening policy, stream, and page", async () => {
    const oldState = sessionState("old-identity");
    oldState.session.currentSequence = 3;
    const newState = sessionState("new-identity");
    newState.session.currentSequence = 9;
    journalPageModelTestDouble.buildPages.mockReturnValue([
      { id: "page", density: "soft", label: "Current page", blockId: null },
    ]);
    journalPageModelTestDouble.pageForReadingState.mockImplementation((_pages: unknown, pageId: unknown) =>
      pageId === "new-page" ? 4 : 1,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/journal-state")) {
          if (init?.method === "POST") return Promise.resolve(jsonResponse({}));
          const id = url.split("/").at(-2);
          return Promise.resolve(
            jsonResponse({
              readingState: {
                ...readingState(1),
                hasOpened: id === "new-identity",
                pageId: id === "new-identity" ? "new-page" : "old-page",
              },
            }),
          );
        }
        return Promise.resolve(jsonResponse(url.endsWith("/new-identity") ? newState : oldState));
      }),
    );

    const view = render(createElement(TallTaleJournalSession, { sessionId: "old-identity", identitySession: true }));
    await act(flushMicrotasks);
    const oldSource = ControlledEventSource.instances.at(-1)!;
    expect(oldSource.url).toContain("/old-identity/events?after=3");
    expect(screen.getByTestId("physical-journal-book").dataset.initialPage).toBe("1");
    expect(openingTestDouble.waitForPhase).not.toHaveBeenCalled();

    view.rerender(createElement(TallTaleJournalSession, { sessionId: "new-identity", identitySession: true }));
    await act(flushMicrotasks);

    const newSource = ControlledEventSource.instances.at(-1)!;
    expect(oldSource.closed).toBe(true);
    expect(newSource).not.toBe(oldSource);
    expect(newSource.url).toContain("/new-identity/events?after=9");
    expect(ControlledEventSource.activeStreams).toBe(1);
    expect(screen.getByTestId("physical-journal-book").dataset.initialPage).toBe("4");
    expect(openingTestDouble.waitForPhase).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "JOURNAL_READY",
      "reduced",
      expect.any(AbortSignal),
    );
    expect(view.container.querySelector("main")?.dataset.journalPhase).toBe("JOURNAL_READY");
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
      expect(screen.getByRole("heading", { name: "Tale new", hidden: true })).toBeTruthy();
      expect((screen.getByLabelText("Journal text size") as HTMLInputElement).value).toBe("0.95");

      await act(async () => {
        if (settlement === "resolve") oldJournalBody.resolve({ readingState: readingState(1.4) });
        else oldJournalBody.reject(new Error("stale old-session body"));
        await flushMicrotasks();
      });

      expect(screen.getByRole("heading", { name: "Tale new", hidden: true })).toBeTruthy();
      expect((screen.getByLabelText("Journal text size") as HTMLInputElement).value).toBe("0.95");
      expect(ControlledEventSource.activeStreams).toBe(1);

      view.unmount();
      expect(identitySignals.get("new")?.aborted).toBe(false);
      expect(ControlledEventSource.activeStreams).toBe(0);
      expect(ControlledEventSource.activeListeners).toBe(0);
    },
  );
});

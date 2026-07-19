import { describe, expect, it, vi } from "vitest";
import type { JournalPhaseOutcome } from "@/animation/core/animation-types";
import type { JournalOpeningPhase } from "@/animation/journal/opening-machine";
import { journalOpeningAllowsPersistence, runJournalOpeningPhases } from "./TallTaleJournalSession";

function completed(phase: JournalOpeningPhase): JournalPhaseOutcome {
  return { status: "completed", phase, finiteAnimationCount: 1, durationMs: 12 };
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

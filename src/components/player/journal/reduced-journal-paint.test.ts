import { afterEach, expect, it, vi } from "vitest";
import { waitForReducedJournalPaint } from "./reduced-journal-paint";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("settles the static reduced Journal after one rendering opportunity", async () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const settled = vi.fn();
  const outcome = waitForReducedJournalPaint(
    document.createElement("div"),
    "JOURNAL_READY",
    "reduced",
    new AbortController().signal,
  );
  void outcome.then(settled);
  expect(settled).not.toHaveBeenCalled();
  frames.shift()?.(performance.now());
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toHaveBeenCalledOnce();
  await expect(outcome).resolves.toMatchObject({
    status: "completed",
    phase: "JOURNAL_READY",
    finiteAnimationCount: 0,
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels the pending reduced handoff when the opening is aborted", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 42),
  );
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const controller = new AbortController();
  const outcome = waitForReducedJournalPaint(
    document.createElement("div"),
    "JOURNAL_READY",
    "reduced",
    controller.signal,
  );
  controller.abort();
  await expect(outcome).resolves.toEqual({ status: "aborted", phase: "JOURNAL_READY" });
  expect(cancel).toHaveBeenCalledWith(42);
  expect(vi.getTimerCount()).toBe(0);
});

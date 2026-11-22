import type { waitForJournalPhase } from "@/animation/journal/opening-machine";

export const waitForReducedJournalPaint: typeof waitForJournalPhase = (_root, phase, _mode, signal) => {
  if (signal.aborted) return Promise.resolve({ status: "aborted", phase });
  const startedAt = performance.now();

  return new Promise((resolve) => {
    let afterPaint: ReturnType<typeof setTimeout> | undefined;
    function cleanup() {
      signal.removeEventListener("abort", abort);
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      if (afterPaint !== undefined) clearTimeout(afterPaint);
    }
    function abort() {
      cleanup();
      resolve({ status: "aborted", phase });
    }
    function complete() {
      cleanup();
      resolve({
        status: "completed",
        phase,
        finiteAnimationCount: 0,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    }

    // The static handoff can proceed in a task after the first rendering opportunity.
    const frame = requestAnimationFrame(() => {
      afterPaint = setTimeout(complete, 0);
    });
    const deadline = setTimeout(complete, 100);
    signal.addEventListener("abort", abort, { once: true });
  });
};

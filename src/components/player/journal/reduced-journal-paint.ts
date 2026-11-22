import type { waitForJournalPhase } from "@/animation/journal/opening-machine";

export const waitForReducedJournalPaint: typeof waitForJournalPhase = (_root, phase, _mode, signal) => {
  if (signal.aborted) return Promise.resolve({ status: "aborted", phase });
  const startedAt = performance.now();
  const diagnosticWindow = window as Window & {
    __lanternwakeTimingMode?: "timer" | "priority";
    scheduler?: { postTask: (task: () => void, opts: { priority: "user-blocking"; signal: AbortSignal }) => Promise<void> };
  };
  performance.mark("lw-preflight:start");

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
    let settled = false;
    function complete() {
      if (settled) return;
      settled = true;
      performance.mark("lw-preflight:complete");
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
      performance.mark("lw-preflight:frame");
      if (diagnosticWindow.__lanternwakeTimingMode === "priority" && diagnosticWindow.scheduler) {
        void diagnosticWindow.scheduler.postTask(() => {
          performance.mark("lw-preflight:priority-task");
          complete();
        }, { priority: "user-blocking", signal }).catch(() => undefined);
        return;
      }
      afterPaint = setTimeout(() => {
        performance.mark("lw-preflight:timer-task");
        complete();
      }, 0);
    });
    const deadline = setTimeout(() => {
      performance.mark("lw-preflight:deadline");
      complete();
    }, 100);
    signal.addEventListener("abort", abort, { once: true });
  });
};

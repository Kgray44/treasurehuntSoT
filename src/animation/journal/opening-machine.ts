import type { MotionMode } from "../core/animation-types";

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
] as const;

export type JournalOpeningPhase = (typeof journalOpeningPhases)[number];

const phaseTargets: Partial<Record<JournalOpeningPhase, string[]>> = {
  CLOSED_BOOK_REVEAL: ["[data-opening-actor='closed-book']", "[data-opening-actor='introduction']"],
  LATCH_RELEASING: ["[data-opening-actor='latch']"],
  COVER_OPENING: ["[data-opening-actor='front-cover']"],
  SEALED_PAGE_REVEAL: ["[data-opening-actor='sealed-page']"],
  SEAL_BREAKING: ["[data-opening-actor='wax-seal']"],
  BOOK_SETTLING: [
    "[data-opening-actor='book-camera']",
    "[data-opening-actor='persistent-interface']",
    "[data-opening-actor='objective']",
  ],
};

export function nextJournalOpeningPhase(phase: JournalOpeningPhase): JournalOpeningPhase | null {
  const index = journalOpeningPhases.indexOf(phase);
  return index < journalOpeningPhases.length - 1 ? journalOpeningPhases[index + 1] : null;
}

export function isJournalInteractive(phase: JournalOpeningPhase) {
  return phase === "JOURNAL_READY";
}

function abortError() {
  return new DOMException("The journal opening was interrupted.", "AbortError");
}

function nextPaint(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      });
    });
    const onAbort = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Waits for the CSS work owned by one physical phase instead of chaining timing guesses. */
export async function waitForJournalPhase(
  root: HTMLElement,
  phase: JournalOpeningPhase,
  mode: MotionMode,
  signal: AbortSignal,
) {
  await nextPaint(signal);
  if (signal.aborted) throw abortError();
  const selectors = phaseTargets[phase] ?? [];
  const animations = selectors.flatMap((selector) => {
    const actor = root.querySelector<HTMLElement>(selector);
    return actor?.getAnimations({ subtree: true }) ?? [];
  });
  const uniqueAnimations = [...new Set(animations)];
  if (!uniqueAnimations.length) {
    if (mode === "reduced") await nextPaint(signal);
    return;
  }
  await Promise.allSettled(uniqueAnimations.map((animation) => animation.finished));
  if (signal.aborted) throw abortError();
}

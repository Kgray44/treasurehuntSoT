import type { TransitionPlan } from "./useCinematicTransition";

const s = (name: string, duration: number, gentle = 320, reduced = 90) => ({ name, duration, gentle, reduced });

export const cinematicSequences = {
  firstArrival: {
    opening: [
      s("dark-sea", 1600),
      s("tide-arrives", 1700),
      s("title-written", 1650),
      s("voyage-materializes", 2100),
      s("content-arrival", 900),
    ],
  },
  reentry: { opening: [s("fog-reentry", 650), s("content-arrival", 900)] },
  signIn: {
    opening: [s("latch-turning", 520)],
    success: [s("seal-released", 950), s("lantern-sweep", 1050), s("ledger-opening", 1250), s("command-arrival", 950)],
    failure: [s("lock-rejected", 700, 280, 120)],
  },
  prepare: {
    opening: [s("ink-gathering", 650)],
    success: [s("page-aligning", 1000), s("ready-stamp", 850)],
    failure: [s("ink-receding", 600)],
  },
  release: {
    opening: [s("tide-gathering", 900)],
    success: [s("seal-breaking", 1250), s("hidden-ink", 1400), s("objective-arrival", 850)],
    failure: [s("seal-reforming", 750)],
  },
  solved: {
    opening: [s("stamp-rising", 600)],
    success: [s("captain-stamp", 1150), s("page-settling", 800)],
    failure: [s("stamp-withdrawn", 550)],
  },
  artifact: {
    opening: [s("velvet-darkening", 750)],
    success: [s("relic-emerging", 1600), s("relic-settling", 1250)],
    failure: [s("curtain-closing", 650)],
  },
  map: {
    opening: [s("fog-gathering", 700)],
    success: [s("fog-parting", 1300), s("route-drawing", 1350), s("bearing-settling", 800)],
    failure: [s("fog-returning", 650)],
  },
  pause: {
    opening: [s("wind-falling", 650)],
    success: [s("lantern-dimming", 1100), s("pause-stamp", 800)],
    failure: [s("wind-returning", 500)],
  },
  resume: {
    opening: [s("pause-lifting", 650)],
    success: [s("lantern-kindling", 950), s("tide-returning", 950)],
    failure: [s("pause-restoring", 500)],
  },
  undo: {
    opening: [s("reversal-gathering", 650)],
    success: [s("ink-absorbing", 1100), s("route-retracting", 950)],
    failure: [s("mark-restoring", 550)],
  },
} satisfies Record<string, TransitionPlan>;

export type CinematicSequenceName = keyof typeof cinematicSequences;

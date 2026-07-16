import { describe, expect, it } from "vitest";
import { cinematicSequences } from "./sequences";
import type { TransitionPlan } from "./useCinematicTransition";

describe("cinematic sequence plans", () => {
  it("keeps the full first arrival active and staged", () => {
    expect(cinematicSequences.firstArrival.opening.map((stage) => stage.name)).toEqual([
      "dark-sea",
      "tide-arrives",
      "title-written",
      "voyage-materializes",
      "content-arrival",
    ]);
    expect(
      cinematicSequences.firstArrival.opening.reduce((total, stage) => total + stage.duration, 0),
    ).toBeGreaterThanOrEqual(6000);
  });

  it("gives every server-backed order a coherent failure reversal", () => {
    for (const name of [
      "signIn",
      "prepare",
      "release",
      "solved",
      "artifact",
      "map",
      "pause",
      "resume",
      "undo",
    ] as const) {
      expect(cinematicSequences[name].failure?.length).toBeGreaterThan(0);
      expect(cinematicSequences[name].success?.length).toBeGreaterThan(0);
    }
  });

  it("provides gentle and reduced durations for every stage", () => {
    for (const plan of Object.values(cinematicSequences) as TransitionPlan[]) {
      for (const stage of [...plan.opening, ...(plan.success ?? []), ...(plan.failure ?? [])]) {
        expect(stage.gentle).toBeLessThanOrEqual(stage.duration);
        expect(stage.reduced).toBeLessThanOrEqual(120);
      }
    }
  });
});

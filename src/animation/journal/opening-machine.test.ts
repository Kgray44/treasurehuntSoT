import { describe, expect, it } from "vitest";
import { isJournalInteractive, journalOpeningPhases, nextJournalOpeningPhase } from "./opening-machine";

describe("journal opening state machine", () => {
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
});

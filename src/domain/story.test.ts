import { describe, expect, it } from "vitest";
import { canTransition, mergeEvents } from "./story";

describe("chapter state machine", () => {
  it("allows the complete first-release path", () => {
    expect(canTransition("LOCKED", "READY")).toBe(true);
    expect(canTransition("READY", "REVEALING")).toBe(true);
    expect(canTransition("REVEALING", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "SOLVED")).toBe(true);
  });
  it("rejects unsafe skips", () => {
    expect(canTransition("LOCKED", "ACTIVE")).toBe(false);
    expect(canTransition("READY", "SOLVED")).toBe(false);
    expect(canTransition("COMPLETE", "ACTIVE")).toBe(false);
  });
});

describe("event reconciliation", () => {
  it("deduplicates by event id and sorts by sequence", () => {
    const result = mergeEvents(
      [{ id: "a", sequence: 2 }],
      [
        { id: "b", sequence: 1 },
        { id: "a", sequence: 2 },
      ],
    );
    expect(result).toEqual([
      { id: "b", sequence: 1 },
      { id: "a", sequence: 2 },
    ]);
  });
  it("accepts close events without losing order", () => {
    expect(
      mergeEvents(
        [],
        [
          { id: "second", sequence: 9 },
          { id: "first", sequence: 8 },
        ],
      ).map((event) => event.id),
    ).toEqual(["first", "second"]);
  });
});

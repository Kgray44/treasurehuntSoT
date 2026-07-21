import { describe, expect, it } from "vitest";
import { conditionPasses, mutateVariables, normalized } from "@/chronicle/progression";
import type { PublishedBlock } from "@/chronicle/types";

const block = (configuration: PublishedBlock["configuration"], blockType = "condition") =>
  ({ blockType, configuration }) as PublishedBlock;

describe("authoritative Chronicle progression rules", () => {
  it("normalizes text answers deterministically", () => {
    expect(normalized("  Moon   LANTERN  ", {})).toBe("moon lantern");
    expect(normalized("  Moon   LANTERN  ", { caseSensitive: true, normalizeWhitespace: false })).toBe(
      "  Moon   LANTERN  ",
    );
  });

  it("resolves scalar, collection, and artifact conditions", () => {
    expect(conditionPasses(block({ variable: "score", operator: "greaterThan", value: 2 }), { score: 3 }, [])).toBe(
      true,
    );
    expect(
      conditionPasses(block({ variable: "clues", operator: "contains", value: "moon" }), { clues: ["moon"] }, []),
    ).toBe(true);
    expect(
      conditionPasses(block({ variable: "artifact:compass", operator: "equals", value: true }), {}, ["compass"]),
    ).toBe(true);
  });

  it("applies variable operations without mutating the prior state", () => {
    const state = { score: 4, gateOpen: false };
    expect(
      mutateVariables(block({ variable: "score", operation: "increment", value: 2 }, "setVariable"), state),
    ).toEqual({
      score: 6,
      gateOpen: false,
    });
    expect(state).toEqual({ score: 4, gateOpen: false });
    expect(mutateVariables(block({ variable: "gateOpen", operation: "toggle" }, "setVariable"), state).gateOpen).toBe(
      true,
    );
  });
});

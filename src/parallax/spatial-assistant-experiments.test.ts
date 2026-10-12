// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assistantExperiments, experimentScene } from "../../tests/parallax/spatial-assistant-experiments";
import { evaluateAssistantCase } from "../../tests/parallax/evaluate-assistant-case";

describe("public synthetic natural-language and adaptive evaluation expectations", () => {
  it("uses distinct test identities and synthetic private data", () => {
    expect(assistantExperiments).toHaveLength(18);
    expect(new Set(assistantExperiments.map((item) => item.id)).size).toBe(18);
  });
  it.each(assistantExperiments)("$id validates its expected materialized outcome", (item) => {
    expect(evaluateAssistantCase(item, experimentScene(item), item.deterministicFixture)).toEqual({
      passed: true,
      findings: [],
    });
  });
});

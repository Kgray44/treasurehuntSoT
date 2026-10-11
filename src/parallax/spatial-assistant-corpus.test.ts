// @vitest-environment node
import { describe, expect, it } from "vitest";
import { materializeAssistantInterpretation, prepareAssistantContext } from "./spatial-assistant";
import { assistantEvaluationCorpus, evaluationScene } from "../../tests/parallax/spatial-assistant-corpus-v1";
export function valueAt(input: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current === null || current === undefined ? undefined : (current as Record<string, unknown>)[key],
      input,
    );
}
describe("Versioned deterministic semantic contract corpus (no live-model evidence)", () => {
  it("contains sixty distinct instructions across all fifteen required categories", () => {
    expect(assistantEvaluationCorpus).toHaveLength(60);
    expect(new Set(assistantEvaluationCorpus.map((item) => item.category)).size).toBe(15);
    expect(new Set(assistantEvaluationCorpus.map((item) => item.request)).size).toBe(60);
    expect(new Set(assistantEvaluationCorpus.map((item) => item.id)).size).toBe(60);
  });
  it.each(assistantEvaluationCorpus)("$id — $category", (item) => {
    const draft = evaluationScene(item),
      before = structuredClone(draft),
      fixture = item.deterministicFixture;
    expect(fixture.intentType).toBe(item.expected.intentType);
    for (const required of item.expected.requiredOperations)
      expect(fixture.operations).toEqual(expect.arrayContaining([expect.objectContaining(required)]));
    for (const operation of fixture.operations) expect(item.expected.forbiddenOperations).not.toContain(operation.type);
    if (item.expected.uncertainty === "ASK") expect(fixture.clarification?.length).toBeGreaterThan(8);
    if (item.expected.uncertainty === "EXPLAIN_LIMITATION")
      expect(fixture.creatorExplanation.length).toBeGreaterThan(8);
    const next = materializeAssistantInterpretation(draft, fixture);
    expect(draft).toEqual(before);
    if (item.expected.unchanged) expect(next).toEqual(before);
    for (const assertion of item.expected.scene) expect(valueAt(next, assertion.path)).toEqual(assertion.value);
    if (item.expected.fallback === "PRESERVE_GUIDED") expect(next.content.fallback).toEqual(before.content.fallback);
    else expect(next.content.fallback.narrative.trim().length).toBeGreaterThan(0);
    const context = JSON.stringify(prepareAssistantContext(draft, item.selectedEntityId));
    expect(context).not.toContain("SYNTHETIC_PRIVATE_ANSWER_947");
    expect(context).not.toContain("SYNTHETIC_PRIVATE_GUIDED_947");
  });
});

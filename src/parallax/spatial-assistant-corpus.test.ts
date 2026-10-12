// @vitest-environment node
import { describe, expect, it } from "vitest";
import { materializeAssistantInterpretation, prepareAssistantContext } from "./spatial-assistant";
import { assistantEvaluationCorpus, evaluationScene } from "../../tests/parallax/spatial-assistant-corpus-v1";
import { evaluateAssistantCase } from "../../tests/parallax/evaluate-assistant-case";
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
  it("rejects a new fixed desk note covering existing content after dependent transforms", () => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === "create-note")!;
    const interpretation = structuredClone(item.deterministicFixture);
    const created = interpretation.operations[0];
    if (created.type !== "CREATE") throw new Error("Expected creation fixture.");
    expect(evaluateAssistantCase(item, evaluationScene(item), interpretation).passed).toBe(true);
    interpretation.operations.push({
      id: "overlap",
      type: "TRANSFORM",
      entityId: created.entityId,
      dependsOn: [created.id],
      explanation: "Move the note to the occupied desk origin.",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
    });
    expect(evaluateAssistantCase(item, evaluationScene(item), interpretation).findings).toContain(
      "EXISTING_READABLE_OBJECT_OVERLAP",
    );
  });
  it("rejects coincident signs even when both requested texts exist", () => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === "multi-signs")!;
    const interpretation = structuredClone(item.deterministicFixture);
    for (const operation of interpretation.operations)
      if (operation.type === "CREATE") operation.position = { x: 0, y: 0, z: 0 };
    expect(evaluateAssistantCase(item, evaluationScene(item), interpretation).findings).toContain(
      "CREATED_OBJECTS_OVERLAP",
    );
  });
  it("evaluates anchor placement by object identity, independent of operation ordering", () => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === "multi-existing")!;
    const interpretation = structuredClone(item.deterministicFixture);
    interpretation.operations.reverse();
    expect(evaluateAssistantCase(item, evaluationScene(item), interpretation)).toEqual({ passed: true, findings: [] });
  });
  it("accepts a valid newly chosen identity while requiring creation content and placement", () => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === "create-note")!;
    const proposal = structuredClone(item.deterministicFixture);
    const operation = proposal.operations[0];
    if (operation.type !== "CREATE") throw new Error("Expected creation fixture.");
    operation.entityId = "model-chosen-note";
    expect(evaluateAssistantCase(item, evaluationScene(item), proposal)).toEqual({ passed: true, findings: [] });
    operation.placement = "WALL";
    expect(evaluateAssistantCase(item, evaluationScene(item), proposal).findings).toContain("REQUIRED_CREATE_MISSING");
    operation.placement = "DESK";
    operation.content = "Different note";
    expect(evaluateAssistantCase(item, evaluationScene(item), proposal).findings).toContain("REQUIRED_CREATE_MISSING");
  });
  it("still rejects a different existing edit target", () => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === "relative-left")!;
    const proposal = structuredClone(item.deterministicFixture);
    const operation = proposal.operations[0];
    if (operation.type !== "TRANSFORM") throw new Error("Expected transform fixture.");
    operation.entityId = "different-existing-map";
    expect(evaluateAssistantCase(item, evaluationScene(item), proposal).findings).toContain(
      "REQUIRED_TRANSFORM_MISSING",
    );
  });
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

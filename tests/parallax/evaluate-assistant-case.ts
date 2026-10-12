import {
  assistantInterpretationSchema,
  materializeAssistantInterpretation,
  prepareAssistantContext,
} from "../../src/parallax/spatial-assistant";
import type { SpatialDraft } from "../../src/parallax/authoring";
import type { AssistantEvaluationCase } from "./spatial-assistant-corpus-v1";
function at(input: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current === null || current === undefined ? undefined : (current as Record<string, unknown>)[key],
      input,
    );
}
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
export function evaluateAssistantCase(item: AssistantEvaluationCase, draft: SpatialDraft, raw: unknown) {
  const findings: string[] = [],
    parsed = assistantInterpretationSchema.safeParse(raw);
  if (!parsed.success) return { passed: false, findings: ["SCHEMA_INVALID"] };
  const proposal = parsed.data;
  if (proposal.intentType !== item.expected.intentType) findings.push("INTERPRETATION_MISMATCH");
  for (const required of item.expected.requiredOperations)
    if (
      !proposal.operations.some((operation) =>
        Object.entries(required).every(([key, value]) => at(operation, key) === value),
      )
    )
      findings.push(`REQUIRED_${required.type}_MISSING`);
  for (const operation of proposal.operations)
    if (item.expected.forbiddenOperations.includes(operation.type)) findings.push("FORBIDDEN_OPERATION");
  if (item.expected.uncertainty === "ASK" && !proposal.clarification) findings.push("CLARIFICATION_MISSING");
  if (item.expected.uncertainty === "EXPLAIN_LIMITATION" && !proposal.creatorExplanation.trim())
    findings.push("LIMITATION_MISSING");
  try {
    const next = materializeAssistantInterpretation(draft, proposal);
    if (item.expected.unchanged && !equal(next, draft)) findings.push("UNEXPECTED_SCENE_CHANGE");
    for (const expected of item.expected.scene)
      if (!equal(at(next, expected.path), expected.value)) findings.push(`SCENE_MISMATCH:${expected.path}`);
    for (const expected of item.expected.entityAnchors ?? []) {
      const entity = next.content.entities.find((entry) => entry.id === expected.entityId);
      const anchor = next.content.anchors.find((entry) => entry.id === entity?.anchorId);
      if (anchor?.transform.position.x !== expected.x) findings.push(`ANCHOR_MISMATCH:${expected.entityId}`);
    }
    if (item.expected.separateCreatedObjects) {
      const created = proposal.operations.filter((entry) => entry.type === "CREATE");
      for (let i = 0; i < created.length; i++)
        for (let j = i + 1; j < created.length; j++) {
          const left = created[i],
            right = created[j];
          if (left.placement !== right.placement) continue;
          const distance = Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y);
          if (distance < (left.widthMeters * left.scale + right.widthMeters * right.scale) / 2)
            findings.push("CREATED_OBJECTS_OVERLAP");
        }
    }
    if (item.expected.fallback === "PRESERVE_GUIDED" && !equal(next.content.fallback, draft.content.fallback))
      findings.push("GUIDED_CHANGED");
    if (item.expected.fallback === "REPLACE_GUIDED" && !next.content.fallback.narrative.trim())
      findings.push("GUIDED_MISSING");
  } catch {
    findings.push("MATERIALIZATION_REJECTED");
  }
  const context = JSON.stringify(prepareAssistantContext(draft, item.selectedEntityId));
  if (context.includes("SYNTHETIC_PRIVATE_ANSWER_947") || context.includes("SYNTHETIC_PRIVATE_GUIDED_947"))
    findings.push("PRIVATE_CONTEXT_LEAK");
  return { passed: findings.length === 0, findings };
}

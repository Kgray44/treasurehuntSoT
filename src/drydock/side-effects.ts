import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import type { DrydockGraphAnalysis } from "@/drydock/graph";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";

type SideEffectKind = "ARTIFACT_GRANT" | "COMPLETION" | "PROVIDER_REQUEST";

type SideEffect = { kind: SideEffectKind; block: CanonicalDrydockBlock; identity?: string };

function effectsForBlock(block: CanonicalDrydockBlock): readonly SideEffect[] {
  const effects: SideEffect[] = [];
  if (block.blockType === "artifactReveal" && block.configuration.addToCollection === true && typeof block.configuration.artifactId === "string")
    effects.push({ kind: "ARTIFACT_GRANT", block, identity: block.configuration.artifactId });
  if (block.blockType === "collectionUpdate" && typeof block.configuration.artifactId === "string")
    effects.push({ kind: "ARTIFACT_GRANT", block, identity: block.configuration.artifactId });
  if (["chapterComplete", "taleComplete"].includes(block.blockType))
    effects.push({ kind: "COMPLETION", block, identity: typeof block.configuration.outcomeId === "string" ? block.configuration.outcomeId : undefined });
  if (typeof block.completion.mode === "string" && block.completion.mode !== "automatic")
    effects.push({ kind: "PROVIDER_REQUEST", block, identity: block.completion.mode });
  return effects;
}

/**
 * Static authored-risk analysis only. It identifies paths that can repeat side effects;
 * One Voyage remains the runtime authority for idempotency and event execution.
 */
export function analyzeDrydockSideEffects(input: {
  blocks: readonly CanonicalDrydockBlock[];
  graphAnalysis: DrydockGraphAnalysis;
}): readonly DrydockIssue[] {
  const effects = input.blocks.flatMap(effectsForBlock);
  const issues: DrydockIssue[] = [];
  const cyclicComponents = input.graphAnalysis.stronglyConnectedComponents.filter((component) =>
    component.length > 1 || (input.graphAnalysis.graph.outgoing.get(component[0]) ?? []).some((edge) => edge.targetBlockId === component[0]),
  );
  for (const component of cyclicComponents) {
    const members = new Set(component);
    for (const effect of effects.filter((candidate) => members.has(candidate.block.id))) {
      if (effect.kind === "ARTIFACT_GRANT" || effect.kind === "COMPLETION")
        issues.push(createDrydockIssue({
          code: "DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP",
          category: "CONTENT",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: effect.block.id, blockType: effect.block.blockType },
          message: "A nonrepeatable authored effect occurs inside a repeatable graph cycle.",
          remediation: "Move the effect outside the cycle or add a governed runtime idempotency design before publishing.",
          metadata: { effectKind: effect.kind, componentSize: component.length },
        }));
      if (effect.kind === "PROVIDER_REQUEST")
        issues.push(createDrydockIssue({
          code: "DRYDOCK_PROVIDER_REQUEST_REPEATS_IN_LOOP",
          category: "PROVIDER",
          severity: "WARNING",
          ruleVersion: 1,
          location: { blockId: effect.block.id, blockType: effect.block.blockType, fieldPath: "completion.mode" },
          message: "A provider request occurs inside a repeatable graph cycle.",
          remediation: "Declare a governed retry/exit policy or move the request outside the repeatable cycle.",
          metadata: { providerMode: effect.identity ?? "unknown", componentSize: component.length },
        }));
    }
  }
  const grants = new Map<string, SideEffect[]>();
  for (const effect of effects)
    if (effect.kind === "ARTIFACT_GRANT" && effect.identity)
      grants.set(effect.identity, [...(grants.get(effect.identity) ?? []), effect]);
  for (const [artifactId, duplicates] of grants)
    if (duplicates.length > 1)
      for (const duplicate of duplicates)
        issues.push(createDrydockIssue({
          code: "DRYDOCK_ARTIFACT_GRANT_DUPLICATE_RISK",
          category: "CONTENT",
          severity: "WARNING",
          ruleVersion: 1,
          location: { blockId: duplicate.block.id, blockType: duplicate.block.blockType, fieldPath: "configuration.artifactId" },
          message: "This Chronicle contains multiple authored grant effects for the same artifact.",
          remediation: "Review recipient and repeatability intent; consolidate or add a governed idempotency design where necessary.",
          metadata: { affectedBlockCount: duplicates.length },
        }));
  const outcomes = new Map<string, SideEffect[]>();
  for (const effect of effects)
    if (effect.kind === "COMPLETION" && effect.identity)
      outcomes.set(effect.identity, [...(outcomes.get(effect.identity) ?? []), effect]);
  for (const [outcomeId, duplicates] of outcomes)
    if (duplicates.length > 1)
      for (const duplicate of duplicates)
        issues.push(createDrydockIssue({
          code: "DRYDOCK_COMPLETION_OUTCOME_DUPLICATE_RISK",
          category: "CONTENT",
          severity: "WARNING",
          ruleVersion: 1,
          location: { blockId: duplicate.block.id, blockType: duplicate.block.blockType, fieldPath: "configuration.outcomeId" },
          message: "This Chronicle maps more than one completion effect to the same outcome ID.",
          remediation: "Confirm the shared outcome is intentionally idempotent or use distinct governed outcomes.",
          metadata: { affectedBlockCount: duplicates.length },
        }));
  return issues;
}

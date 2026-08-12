import type { JsonObject, PublishedBlock, PublishedTaleSnapshot } from "@/chronicle/types";

/**
 * Decision-only Chronicle semantics shared by One Voyage progression and
 * Drydock. This module must remain free of persistence, clock, network, and
 * ambient-random dependencies so a simulator cannot acquire alternate rules.
 */
export function conditionPasses(block: PublishedBlock, variables: JsonObject, inventory: string[]) {
  const config = block.configuration;
  const key = String(config.variable ?? "");
  const actual = key.startsWith("artifact:") ? inventory.includes(key.slice(9)) : variables[key];
  const expected = config.value;
  if (config.operator === "notEquals") return actual !== expected;
  if (config.operator === "greaterThan") return Number(actual) > Number(expected);
  if (config.operator === "lessThan") return Number(actual) < Number(expected);
  if (config.operator === "contains")
    return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
  return actual === expected;
}

export function mutateVariables(block: PublishedBlock, variables: JsonObject) {
  if (block.blockType !== "setVariable") return variables;
  const next = { ...variables };
  const key = String(block.configuration.variable ?? "");
  const operation = String(block.configuration.operation ?? "set");
  if (!key) return next;
  if (operation === "increment") next[key] = Number(next[key] ?? 0) + Number(block.configuration.value ?? 1);
  else if (operation === "decrement") next[key] = Number(next[key] ?? 0) - Number(block.configuration.value ?? 1);
  else if (operation === "toggle") next[key] = !Boolean(next[key]);
  else next[key] = block.configuration.value;
  return next;
}

export function enabledSnapshotBlocks(snapshot: PublishedTaleSnapshot) {
  return snapshot.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.isEnabled));
}

export function chooseCanonicalNext(
  snapshot: PublishedTaleSnapshot,
  block: PublishedBlock,
  variables: JsonObject,
  inventory: string[],
  selected?: string,
) {
  const blocks = enabledSnapshotBlocks(snapshot);
  if (selected) return blocks.find((candidate) => candidate.id === selected) ?? null;
  if (block.blockType === "condition") {
    const target = String(
      block.configuration[
        conditionPasses(block, variables, inventory) ? "successTargetBlockId" : "failureTargetBlockId"
      ] ?? "",
    );
    return blocks.find((candidate) => candidate.id === target) ?? null;
  }
  const target =
    block.connections.find((connection) => connection.connectionType === "DEFAULT")?.targetBlockId ?? block.nextBlockId;
  return blocks.find((candidate) => candidate.id === target) ?? null;
}

export type CanonicalRuntimeState = Readonly<{
  currentBlockId: string | null;
  variables: JsonObject;
  inventory: readonly string[];
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
}>;

export type CanonicalTransitionIntent = Readonly<{
  eventType:
    | "artifactGranted"
    | "blockCompleted"
    | "blockEntered"
    | "chapterCompleted"
    | "progressionStopped"
    | "sessionCompleted";
  blockId: string | null;
}>;

export type CanonicalCompletionPlan = Readonly<{
  state: CanonicalRuntimeState;
  addedArtifactId: string | null;
  automaticBlockIds: readonly string[];
  nextBlockId: string | null;
  intents: readonly CanonicalTransitionIntent[];
}>;

/**
 * Plans a successfully authorized block completion. Authorization, persistence,
 * real event delivery, and real provider evidence remain One Voyage concerns.
 */
export function planCanonicalCompletion(
  snapshot: PublishedTaleSnapshot,
  prior: CanonicalRuntimeState,
  input: Readonly<{ selectedTargetId?: string }>,
): CanonicalCompletionPlan {
  if (prior.status !== "ACTIVE") throw new Error(`This session is ${prior.status.toLowerCase()}.`);
  const block = prior.currentBlockId
    ? enabledSnapshotBlocks(snapshot).find((candidate) => candidate.id === prior.currentBlockId)
    : null;
  if (!block) throw new Error("The current Passage is unavailable.");

  let variables: JsonObject = { ...prior.variables };
  let inventory = [...prior.inventory];
  const intents: CanonicalTransitionIntent[] = [];
  const addedArtifactId = ["artifactReveal", "collectionUpdate"].includes(block.blockType)
    ? String(block.configuration.artifactId ?? "") || null
    : null;
  if (addedArtifactId && !inventory.includes(addedArtifactId)) {
    inventory = [...inventory, addedArtifactId];
    intents.push({ eventType: "artifactGranted", blockId: block.id });
  }
  variables = mutateVariables(block, variables);
  if (block.blockType === "choice" && input.selectedTargetId)
    variables = { ...variables, [`choice:${block.id}`]: input.selectedTargetId };
  intents.push({ eventType: "blockCompleted", blockId: block.id });

  if (block.blockType === "chapterComplete") intents.push({ eventType: "chapterCompleted", blockId: block.id });
  if (block.blockType === "taleComplete") {
    intents.push({ eventType: "sessionCompleted", blockId: block.id });
    return {
      state: { currentBlockId: block.id, variables, inventory, status: "COMPLETED" },
      addedArtifactId,
      automaticBlockIds: [],
      nextBlockId: null,
      intents,
    };
  }

  let next = chooseCanonicalNext(snapshot, block, variables, inventory, input.selectedTargetId);
  const automaticBlockIds: string[] = [];
  const seen = new Set<string>();
  while (next && ["condition", "setVariable"].includes(next.blockType) && !seen.has(next.id)) {
    seen.add(next.id);
    automaticBlockIds.push(next.id);
    intents.push({ eventType: "blockEntered", blockId: next.id });
    variables = mutateVariables(next, variables);
    intents.push({ eventType: "blockCompleted", blockId: next.id });
    next = chooseCanonicalNext(snapshot, next, variables, inventory);
  }
  if (!next) {
    intents.push({ eventType: "progressionStopped", blockId: block.id });
    return {
      state: { currentBlockId: block.id, variables, inventory, status: "PAUSED" },
      addedArtifactId,
      automaticBlockIds,
      nextBlockId: null,
      intents,
    };
  }
  intents.push({ eventType: "blockEntered", blockId: next.id });
  return {
    state: {
      currentBlockId: next.id,
      variables,
      inventory,
      status: "ACTIVE",
    },
    addedArtifactId,
    automaticBlockIds,
    nextBlockId: next.id,
    intents,
  };
}

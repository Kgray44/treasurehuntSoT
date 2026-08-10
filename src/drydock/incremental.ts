import type { JsonObject } from "@/chronicle/types";
import type { CanonicalDrydockBlock, DrydockAuthoredBlockInput } from "@/drydock/contracts/model";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { collectExpressionVariableReferences, typeCheckExpression } from "@/drydock/expressions";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";
import { analyzeDrydockGraph } from "@/drydock/graph";
import { analyzeDrydockConditionFeasibility, analyzeDrydockDefiniteInitialization } from "@/drydock/state";
import { analyzeDrydockStaticRules, type DrydockAssetSnapshot } from "@/drydock/static-rules";
import { analyzeDrydockSideEffects } from "@/drydock/side-effects";
import { analyzeDrydockPerformance } from "@/drydock/performance";
import {
  createVariableRegistry,
  createVariableUsageIndex,
  isVariableValueCompatible,
  permittedOperations,
  type DrydockVariableDeclaration,
  type DrydockVariablePrivacyClass,
  type DrydockVariableType,
  type DrydockVariableUsage,
} from "@/drydock/variables";

export type DrydockDraftContractInput = {
  schemaVersion: 1;
  analysisMode?: "CONTRACT" | "FULL";
  assets?: readonly DrydockAssetSnapshot[];
  variables?: readonly unknown[];
  chapters: ReadonlyArray<{
    id: string;
    blocks: readonly DrydockAuthoredBlockInput[];
  }>;
};

export type DrydockDependencyKind =
  | "BLOCK"
  | "FIELD"
  | "VARIABLE"
  | "EXPRESSION"
  | "ASSET"
  | "PROVIDER"
  | "PRESENTATION"
  | "EDGE"
  | "MIGRATION";

export type DrydockDependencyRecord = {
  kind: DrydockDependencyKind;
  key: string;
  blockId: string;
  fieldPath?: string;
};

export type DrydockDependencyIndex = {
  schemaVersion: 1;
  records: readonly DrydockDependencyRecord[];
  byKey: ReadonlyMap<string, readonly DrydockDependencyRecord[]>;
};

export type DrydockIncrementalChange = {
  blockIds?: readonly string[];
  variableIds?: readonly string[];
  assetIds?: readonly string[];
  providerIds?: readonly string[];
};

const legacyType = (value: unknown): DrydockVariableType => {
  if (value === "boolean") return { kind: "BOOLEAN" };
  if (value === "integer") return { kind: "INTEGER" };
  if (value === "number") return { kind: "NUMBER" };
  if (value === "enum") return { kind: "ENUM", domainId: "legacy", members: [] };
  if (value === "stringSet") return { kind: "STRING_SET" };
  if (value === "identifierReference") return { kind: "IDENTIFIER_REFERENCE", entityType: "legacy" };
  return { kind: "STRING" };
};

function inferDeclarations(blocks: readonly CanonicalDrydockBlock[]): DrydockVariableDeclaration[] {
  const declarations = new Map<string, DrydockVariableDeclaration>();
  for (const block of blocks) {
    if (block.blockType !== "setVariable") continue;
    const id = String(block.configuration.variableId ?? "");
    if (!id || declarations.has(id)) continue;
    const type = legacyType(block.configuration.valueType);
    declarations.set(id, {
      schemaVersion: 1,
      id,
      name: String(block.configuration.variableName ?? block.configuration.variable ?? id),
      type,
      scope: block.configuration.scope === "CHRONICLE_DEFINITION" ? "CHRONICLE_DEFINITION" : "SESSION",
      ...(block.configuration.operation === "set" ? { defaultValue: block.configuration.value as never } : {}),
      description: "Compatibility declaration inferred from a current Set Variable Passage.",
      allowedOperations: permittedOperations(type),
      privacy: (["PLAYER_SAFE", "CAPTAIN_PRIVATE", "CREATOR_PRIVATE", "SYSTEM_PRIVATE"].includes(
        String(block.configuration.privacy),
      )
        ? block.configuration.privacy
        : "PLAYER_SAFE") as DrydockVariablePrivacyClass,
    });
  }
  return [...declarations.values()];
}

function createDependencyIndex(
  blocks: readonly CanonicalDrydockBlock[],
  usages: readonly DrydockVariableUsage[],
): DrydockDependencyIndex {
  const records: DrydockDependencyRecord[] = [];
  for (const block of blocks) {
    records.push({ kind: "BLOCK", key: `block:${block.id}`, blockId: block.id });
    records.push({ kind: "MIGRATION", key: `migration:${block.blockType}:${block.schemaVersion}`, blockId: block.id });
    for (const fieldPath of Object.keys(block.configuration))
      records.push({
        kind: "FIELD",
        key: `field:${block.id}:configuration.${fieldPath}`,
        blockId: block.id,
        fieldPath: `configuration.${fieldPath}`,
      });
    for (const fieldPath of Object.keys(block.presentation))
      records.push({
        kind: "PRESENTATION",
        key: `presentation:${block.id}:${fieldPath}`,
        blockId: block.id,
        fieldPath: `presentation.${fieldPath}`,
      });
    for (const connection of block.connections)
      records.push({
        kind: "EDGE",
        key: `edge:${connection.targetBlockId}`,
        blockId: block.id,
        fieldPath: "connections",
      });
    for (const [fieldPath, value] of Object.entries(block.configuration)) {
      if (fieldPath.toLowerCase().endsWith("assetid") && typeof value === "string")
        records.push({
          kind: "ASSET",
          key: `asset:${value}`,
          blockId: block.id,
          fieldPath: `configuration.${fieldPath}`,
        });
    }
    if (typeof block.completion.mode === "string")
      records.push({
        kind: "PROVIDER",
        key: `provider:${block.completion.mode}`,
        blockId: block.id,
        fieldPath: "completion.mode",
      });
    if (block.expression)
      records.push({
        kind: "EXPRESSION",
        key: `expression:${block.id}`,
        blockId: block.id,
        fieldPath: "configuration.expression",
      });
  }
  for (const usage of usages)
    if (usage.blockId)
      records.push({
        kind: "VARIABLE",
        key: `variable:${usage.variableId}`,
        blockId: usage.blockId,
        fieldPath: usage.fieldPath,
      });
  records.sort((left, right) =>
    `${left.key}:${left.blockId}:${left.fieldPath ?? ""}`.localeCompare(
      `${right.key}:${right.blockId}:${right.fieldPath ?? ""}`,
      "en",
    ),
  );
  const byKey = new Map<string, DrydockDependencyRecord[]>();
  for (const record of records) byKey.set(record.key, [...(byKey.get(record.key) ?? []), record]);
  return { schemaVersion: 1, records, byKey };
}

function affectedBlocks(index: DrydockDependencyIndex, change?: DrydockIncrementalChange): Set<string> | null {
  if (!change) return null;
  const keys = [
    ...(change.blockIds ?? []).map((id) => `block:${id}`),
    ...(change.variableIds ?? []).map((id) => `variable:${id}`),
    ...(change.assetIds ?? []).map((id) => `asset:${id}`),
    ...(change.providerIds ?? []).map((id) => `provider:${id}`),
  ];
  return new Set(keys.flatMap((key) => (index.byKey.get(key) ?? []).map((record) => record.blockId)));
}

export function validateDrydockDraftContracts(draft: DrydockDraftContractInput, change?: DrydockIncrementalChange) {
  const parseIssues: DrydockIssue[] = [];
  const parsedBlocks: CanonicalDrydockBlock[] = [];
  const migrationByBlock = new Map<string, readonly string[]>();
  for (const chapter of draft.chapters)
    for (const block of chapter.blocks) {
      const parsed = parseDrydockBlock(block);
      migrationByBlock.set(block.id, parsed.migrationsApplied);
      parseIssues.push(
        ...parsed.issues.map((issue) => ({ ...issue, location: { chapterId: chapter.id, ...issue.location } })),
      );
      if (parsed.success) parsedBlocks.push(parsed.block);
    }
  const blockIds = new Set<string>();
  for (const block of parsedBlocks) {
    if (blockIds.has(block.id))
      parseIssues.push(
        createDrydockIssue({
          code: "DRYDOCK_BLOCK_ID_DUPLICATE",
          category: "REFERENCE",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: block.id, blockType: block.blockType },
          message: "This Chronicle reuses a stable Passage ID.",
          remediation: "Assign a unique stable Passage ID within the Chronicle.",
        }),
      );
    blockIds.add(block.id);
  }
  for (const block of parsedBlocks)
    for (const connection of block.connections)
      if (!blockIds.has(connection.targetBlockId))
        parseIssues.push(
          createDrydockIssue({
            code: "DRYDOCK_REFERENCE_TARGET_MISSING",
            category: "REFERENCE",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: "connections" },
            message: "A canonical Passage edge targets an ID outside this Chronicle draft.",
            remediation: "Select a target Passage that belongs to this Chronicle draft.",
          }),
        );
  const declarations = draft.variables?.length ? draft.variables : inferDeclarations(parsedBlocks);
  const variables = createVariableRegistry(declarations);
  const usages: DrydockVariableUsage[] = variables.declarations.map((declaration) => ({
    variableId: declaration.id,
    legacyName: declaration.name,
    kind: "DECLARATION",
    fieldPath: `variables.${declaration.id}`,
    privacy: declaration.privacy,
  }));
  const semanticIssues: DrydockIssue[] = [...variables.issues];
  for (const block of parsedBlocks) {
    if (block.expression) {
      const checked = typeCheckExpression(block.expression, variables);
      semanticIssues.push(
        ...checked.issues.map((issue) => ({
          ...issue,
          location: { ...issue.location, blockId: block.id, blockType: block.blockType },
        })),
      );
      for (const variableId of collectExpressionVariableReferences(block.expression)) {
        const declaration = variables.byId.get(variableId);
        usages.push({
          variableId,
          legacyName: declaration?.name,
          kind: "EXPRESSION",
          blockId: block.id,
          fieldPath: "configuration.expression",
          privacy: declaration?.privacy ?? "SYSTEM_PRIVATE",
        });
      }
    }
    if (block.blockType === "setVariable") {
      const variableId = String(block.configuration.variableId ?? "");
      const declaration = variables.byId.get(variableId);
      const operation = String(block.configuration.operation ?? "set");
      usages.push({
        variableId,
        legacyName: String(block.configuration.variableName ?? block.configuration.variable ?? ""),
        kind: "WRITE",
        blockId: block.id,
        fieldPath: "configuration.variableId",
        operation:
          operation === "increment" || operation === "decrement" || operation === "toggle" ? operation : "assign",
        privacy: declaration?.privacy ?? "SYSTEM_PRIVATE",
      });
      if (!declaration)
        semanticIssues.push(
          createDrydockIssue({
            code: "DRYDOCK_VARIABLE_WRITE_UNDECLARED",
            category: "VARIABLE_DECLARATION",
            severity: "ERROR",
            ruleVersion: 1,
            location: {
              blockId: block.id,
              blockType: block.blockType,
              variableId,
              fieldPath: "configuration.variableId",
            },
            message: "Set Variable references an undeclared stable variable ID.",
            remediation: "Declare the variable before writing it.",
          }),
        );
      else if (!isVariableValueCompatible(declaration.type, block.configuration.value as never))
        semanticIssues.push(
          createDrydockIssue({
            code: "DRYDOCK_VARIABLE_WRITE_TYPE",
            category: "VARIABLE_TYPE",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, variableId, fieldPath: "configuration.value" },
            message: "Assigned value is incompatible with the declared variable type.",
            remediation: "Use a typed value and operation supported by the declaration.",
          }),
        );
    }
  }
  const usageIndex = createVariableUsageIndex(usages);
  const dependencyIndex = createDependencyIndex(parsedBlocks, usageIndex.usages);
  const graphAnalysis = analyzeDrydockGraph(parsedBlocks);
  const stateAnalysis = analyzeDrydockDefiniteInitialization({
    graph: graphAnalysis.graph,
    declarations: variables.declarations,
    usages: usageIndex.usages,
  });
  const conditionIssues = analyzeDrydockConditionFeasibility({
    blocks: parsedBlocks,
    declarations: variables.declarations,
    usages: usageIndex.usages,
  });
  const sideEffectIssues = analyzeDrydockSideEffects({ blocks: parsedBlocks, graphAnalysis });
  const performanceIssues = analyzeDrydockPerformance({
    blocks: parsedBlocks,
    graphAnalysis,
    declarations: variables.declarations,
  });
  const staticIssues = analyzeDrydockStaticRules({ blocks: parsedBlocks, assets: draft.assets });
  const wholeChronicleIssues =
    draft.analysisMode === "FULL"
      ? [
          ...graphAnalysis.issues,
          ...stateAnalysis.issues,
          ...conditionIssues,
          ...sideEffectIssues,
          ...performanceIssues,
          ...staticIssues,
        ]
      : [];
  const affected = affectedBlocks(dependencyIndex, change);
  const issues = [...parseIssues, ...semanticIssues, ...wholeChronicleIssues].filter(
    (issue) => !affected || !issue.location.blockId || affected.has(issue.location.blockId),
  );
  return {
    schemaVersion: 1 as const,
    valid: !issues.some((issue) => issue.severity === "ERROR"),
    issues,
    blocks: parsedBlocks.filter((block) => !affected || affected.has(block.id)),
    variableRegistry: variables,
    variableUsageIndex: usageIndex,
    dependencyIndex,
    graphAnalysis,
    stateAnalysis,
    conditionIssues,
    sideEffectIssues,
    performanceIssues,
    staticIssues,
    migrationsApplied: Object.fromEntries(migrationByBlock),
    checkedBlockCount: affected
      ? affected.size
      : draft.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0),
  };
}

export function drydockDraftInputFromStudio(
  input: {
    chapters: Array<{
      id: string;
      blocks: Array<{
        id: string;
        blockType: string;
        schemaVersion?: number;
        configuration: JsonObject;
        presentation?: JsonObject;
        completion?: JsonObject;
        connections?: Array<{
          targetBlockId: string;
          connectionType: string;
          label?: string | null;
          conditionExpression?: string | null;
        }>;
        nextBlockId?: string | null;
      }>;
    }>;
    assets?: readonly DrydockAssetSnapshot[];
  },
  options?: { analysisMode?: "CONTRACT" | "FULL" },
): DrydockDraftContractInput {
  return {
    schemaVersion: 1,
    ...(options?.analysisMode ? { analysisMode: options.analysisMode } : {}),
    ...(input.assets ? { assets: input.assets } : {}),
    chapters: input.chapters.map((chapter) => ({
      id: chapter.id,
      blocks: chapter.blocks.map((block) => ({
        ...block,
        schemaVersion: block.schemaVersion ?? 1,
        presentation: block.presentation ?? {},
        completion: block.completion ?? {},
        connections: block.connections ?? [],
      })),
    })),
  };
}

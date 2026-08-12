import type { DrydockGraphAnalysis } from "@/drydock/graph";
import type { DrydockIssue } from "@/drydock/issues";
import type { DrydockStateAnalysis } from "@/drydock/state";
import type { DrydockVariableDeclaration, DrydockVariableUsage, DrydockVariableUsageIndex } from "@/drydock/variables";

export type DrydockVariableExplorer = {
  schemaVersion: 1;
  variables: readonly {
    id: string;
    name: string;
    description?: string;
    type: DrydockVariableDeclaration["type"];
    scope: DrydockVariableDeclaration["scope"];
    defaultValue?: DrydockVariableDeclaration["defaultValue"];
    privacy: DrydockVariableDeclaration["privacy"];
    allowedOperations: readonly string[];
    readers: readonly { blockId?: string; fieldPath: string; kind: string; reachable: boolean | null }[];
    writers: readonly { blockId?: string; fieldPath: string; operation?: string; reachable: boolean | null }[];
    unreachableReferences: readonly { blockId: string; fieldPath: string }[];
    initialization: {
      hasDefault: boolean;
      proofStatus: DrydockStateAnalysis["status"];
      potentiallyUninitializedReferences: readonly { blockId: string; fieldPath: string }[];
    };
    unusedState: "USED" | "UNUSED" | "WRITE_NEVER_READ";
    renameState: "AVAILABLE_WITH_CURRENT_STUDIO_DRAFT_GUARD";
    relatedIssueCodes: readonly string[];
  }[];
};

const readable = (usage: DrydockVariableUsage) => ["READ", "EXPRESSION", "OPERATION"].includes(usage.kind);
const writable = (usage: DrydockVariableUsage) => usage.kind === "WRITE";

/**
 * Owner-only static survey. It preserves authored defaults for the Creator but
 * is deliberately no-store at the route boundary and never suitable for telemetry.
 */
export function createDrydockVariableExplorer(input: {
  declarations: readonly DrydockVariableDeclaration[];
  usageIndex: DrydockVariableUsageIndex;
  graphAnalysis: DrydockGraphAnalysis;
  stateAnalysis: DrydockStateAnalysis;
  issues: readonly DrydockIssue[];
}): DrydockVariableExplorer {
  return {
    schemaVersion: 1,
    variables: input.declarations
      .map((declaration) => {
        const usages = input.usageIndex.byVariableId.get(declaration.id) ?? [];
        const reachability = (usage: DrydockVariableUsage) =>
          usage.blockId ? input.graphAnalysis.reachableBlockIds.has(usage.blockId) : null;
        const relatedIssues = input.issues.filter((issue) => issue.location.variableId === declaration.id);
        const potentiallyUninitializedReferences = relatedIssues
          .filter(
            (issue) =>
              issue.code === "DRYDOCK_VARIABLE_NOT_DEFINITELY_INITIALIZED" &&
              issue.location.blockId &&
              issue.location.fieldPath,
          )
          .map((issue) => ({ blockId: issue.location.blockId!, fieldPath: issue.location.fieldPath! }));
        const unusedState: "USED" | "UNUSED" | "WRITE_NEVER_READ" = relatedIssues.some(
          (issue) => issue.code === "DRYDOCK_VARIABLE_UNUSED",
        )
          ? "UNUSED"
          : relatedIssues.some((issue) => issue.code === "DRYDOCK_VARIABLE_WRITE_NEVER_READ")
            ? "WRITE_NEVER_READ"
            : "USED";
        return {
          id: declaration.id,
          name: declaration.name,
          ...(declaration.description ? { description: declaration.description } : {}),
          type: declaration.type,
          scope: declaration.scope,
          ...(declaration.defaultValue !== undefined ? { defaultValue: declaration.defaultValue } : {}),
          privacy: declaration.privacy,
          allowedOperations: declaration.allowedOperations,
          readers: usages.filter(readable).map((usage) => ({
            blockId: usage.blockId,
            fieldPath: usage.fieldPath,
            kind: usage.kind,
            reachable: reachability(usage),
          })),
          writers: usages.filter(writable).map((usage) => ({
            blockId: usage.blockId,
            fieldPath: usage.fieldPath,
            operation: usage.operation,
            reachable: reachability(usage),
          })),
          unreachableReferences: usages
            .filter((usage) => usage.blockId && !input.graphAnalysis.reachableBlockIds.has(usage.blockId))
            .map((usage) => ({ blockId: usage.blockId!, fieldPath: usage.fieldPath })),
          initialization: {
            hasDefault: declaration.defaultValue !== undefined,
            proofStatus: input.stateAnalysis.status,
            potentiallyUninitializedReferences,
          },
          unusedState,
          renameState: "AVAILABLE_WITH_CURRENT_STUDIO_DRAFT_GUARD" as const,
          relatedIssueCodes: [...new Set(relatedIssues.map((issue) => issue.code))].sort((a, b) =>
            a.localeCompare(b, "en"),
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en")),
  };
}

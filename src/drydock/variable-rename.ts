import { z } from "zod";

type RenameBlock = {
  id: string;
  blockType: string;
  configuration: Record<string, unknown>;
};

/** Browser-safe canonical propagation for Creator-confirmed variable renames. */
export type RenameVariableDraft = {
  variables: Array<{ id: string; name: string }>;
  chapters: Array<{ blocks: RenameBlock[] }>;
};

export function renameVariableInDraft<T extends RenameVariableDraft>(
  draft: T,
  variableId: string,
  nextName: string,
): T {
  const parsedName = z.string().min(1).max(120).parse(nextName);
  const clone = structuredClone(draft);
  const declaration = clone.variables.find((candidate) => candidate.id === variableId);
  if (!declaration) throw new Error("DRYDOCK_VARIABLE_NOT_DECLARED");
  if (clone.variables.some((candidate) => candidate.id !== variableId && candidate.name === parsedName))
    throw new Error("DRYDOCK_VARIABLE_NAME_DUPLICATE");
  const previousName = declaration.name;
  declaration.name = parsedName;
  for (const chapter of clone.chapters)
    for (const block of chapter.blocks) {
      if (["condition", "setVariable"].includes(block.blockType) && block.configuration.variable === previousName)
        block.configuration.variable = parsedName;
      if (block.configuration.variableId === variableId) block.configuration.variableName = parsedName;
    }
  return clone;
}

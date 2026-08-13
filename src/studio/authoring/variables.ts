import type { Chapter } from "@/components/studio/studio-types";
import type { JsonObject } from "@/chronicle/types";
import { renameVariableInDraft } from "@/drydock/variable-rename";
import type { DrydockVariableDeclaration } from "@/drydock/variables";

/**
 * A Studio draft stores current variable declarations on Set Variable Passages.
 * Drydock remains responsible for the actual governed reference propagation;
 * this adapter only preserves the rest of Studio's block shape around it.
 */
export function renameStudioDraftVariable(input: {
  chapters: Chapter[];
  declarations: readonly Omit<DrydockVariableDeclaration, "schemaVersion">[];
  variableId: string;
  nextName: string;
}): Chapter[] {
  const renamed = renameVariableInDraft(
    {
      variables: input.declarations.map((declaration) => ({ schemaVersion: 1, ...declaration })),
      chapters: input.chapters.map((chapter) => ({
        blocks: chapter.blocks.map((block) => ({
          id: block.id,
          blockType: block.blockType,
          configuration: block.configuration,
        })),
      })),
    },
    input.variableId,
    input.nextName,
  );

  return input.chapters.map((chapter, chapterIndex) => ({
    ...chapter,
    blocks: chapter.blocks.map((block, blockIndex) => ({
      ...block,
      configuration: renamed.chapters[chapterIndex]?.blocks[blockIndex]?.configuration as JsonObject,
    })),
  }));
}

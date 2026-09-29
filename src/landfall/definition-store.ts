import { db } from "@/lib/db";
import { DraftConflictError } from "@/chronicle/studio-service";
import { parseStoredLandfallDefinition, validateLandfallDefinition } from "@/landfall/definition";

export async function getDraftLandfallDefinition(taleId: string) {
  const draft = await db.taleDraft.findFirst({
    where: { taleId },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, autosaveVersion: true, landfallDefinition: true },
  });
  if (!draft) throw new Error("LANDFALL_DRAFT_UNAVAILABLE");
  return {
    draftId: draft.id,
    autosaveVersion: draft.autosaveVersion,
    definition: parseStoredLandfallDefinition(draft.landfallDefinition),
  };
}

/** Draft-only save. The published snapshot and active sessions never read this mutable row. */
export async function saveDraftLandfallDefinition(
  taleId: string,
  input: unknown | null,
  expectedAutosaveVersion: number,
) {
  if (input !== null && Buffer.byteLength(JSON.stringify(input), "utf8") > 1024 * 1024)
    throw new Error("LANDFALL_DEFINITION_TOO_LARGE");
  const definition = input === null ? null : validateLandfallDefinition(input);
  if (definition && definition.taleId !== taleId) throw new Error("LANDFALL_TALE_MISMATCH");
  const serialized = definition ? JSON.stringify(definition) : null;
  if (serialized && Buffer.byteLength(serialized, "utf8") > 1024 * 1024)
    throw new Error("LANDFALL_DEFINITION_TOO_LARGE");
  const draft = await db.taleDraft.findFirst({
    where: { taleId },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, autosaveVersion: true },
  });
  if (!draft) throw new Error("LANDFALL_DRAFT_UNAVAILABLE");
  const saved = await db.taleDraft.updateMany({
    where: { id: draft.id, autosaveVersion: expectedAutosaveVersion },
    data: {
      landfallDefinition: serialized,
      autosaveVersion: { increment: 1 },
      validationState: "NOT_VALIDATED",
      validationSummary: "{}",
      lastValidatedAt: null,
    },
  });
  if (saved.count !== 1) throw new DraftConflictError(draft.autosaveVersion);
  return { draftId: draft.id, autosaveVersion: expectedAutosaveVersion + 1, definition };
}

import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { getDrydockBlockContract } from "@/drydock/contracts/registry";
import type { JsonObject } from "@/chronicle/types";

type SnapshotConnection = {
  targetBlockId: string;
  connectionType: string;
  label?: string | null;
  conditionExpression?: string | null;
  orderIndex?: number;
};

export type TideglassDrydockBlockInput = {
  id: string;
  blockType: string;
  schemaVersion: number;
  configuration: unknown;
  presentation: unknown;
  completion: unknown;
  connections: readonly SnapshotConnection[];
  nextBlockId?: string | null;
};

export type TideglassDrydockBlock = {
  schemaVersion: number;
  configuration: JsonObject;
  presentation: JsonObject;
  completion: JsonObject;
  connections: SnapshotConnection[];
  nextBlockId: string | null;
  adapter: string;
  partial: boolean;
};

export type TideglassDrydockBlockFailure = {
  code: "SCHEMA_UNSUPPORTED" | "INVALID_SECTION" | "COMPARISON_SECTION_UNAVAILABLE";
  adapter: string;
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

/**
 * Tideglass deliberately consumes Drydock's parser rather than keeping an
 * independent historical Story Block registry or upcaster.  It never writes
 * the returned canonical block back to a published edition.
 */
export function normalizeDrydockBlockForTideglass(
  input: TideglassDrydockBlockInput,
): { ok: true; value: TideglassDrydockBlock } | { ok: false; failure: TideglassDrydockBlockFailure } {
  const configuration = object(input.configuration);
  const presentation = object(input.presentation);
  const completion = object(input.completion);
  if (!configuration || !presentation || !completion)
    return { ok: false, failure: { code: "INVALID_SECTION", adapter: "drydock-historical-reader" } };

  const result = parseDrydockBlock({
    id: input.id,
    blockType: input.blockType,
    schemaVersion: input.schemaVersion,
    configuration,
    presentation,
    completion,
    connections: input.connections,
    nextBlockId: input.nextBlockId,
  });
  if (!result.success)
    return {
      ok: false,
      failure: {
        code:
          result.compatibilityStatus === "UNSUPPORTED"
            ? "SCHEMA_UNSUPPORTED"
            : result.compatibilityStatus === "INVALID"
              ? "INVALID_SECTION"
              : "COMPARISON_SECTION_UNAVAILABLE",
        adapter: "drydock-historical-reader",
      },
    };

  const contract = getDrydockBlockContract(input.blockType);
  const applied = new Set(result.migrationsApplied);
  const partial = Boolean(
    contract?.migrations.some((migration) => applied.has(migration.id) && migration.dataLoss === "POSSIBLE"),
  );
  return {
    ok: true,
    value: {
      schemaVersion: result.block.schemaVersion,
      configuration: result.block.configuration,
      presentation: result.block.presentation,
      completion: result.block.completion,
      connections: result.block.connections,
      nextBlockId: result.block.nextBlockId,
      adapter: `drydock:${input.blockType}:${input.schemaVersion}->${result.block.schemaVersion}`,
      partial,
    },
  };
}

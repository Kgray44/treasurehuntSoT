import type { DrydockAuthoredBlockInput } from "@/drydock/contracts/model";
import { getDrydockBlockContract } from "@/drydock/contracts/registry";
import { parseDrydockBlock } from "@/drydock/contracts/parser";

type StructuralValue = Record<string, unknown> | readonly unknown[] | unknown;

function changedPaths(before: StructuralValue, after: StructuralValue, prefix = ""): string[] {
  if (Object.is(before, after)) return [];
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  )
    return [prefix || "block"];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) =>
    changedPaths(
      (before as Record<string, unknown>)[key],
      (after as Record<string, unknown>)[key],
      prefix ? `${prefix}.${key}` : key,
    ),
  );
}

/**
 * A Creator-scoped structural preview over Drydock's parser. It deliberately
 * carries paths and contract metadata, not authored values or an alternate
 * migration implementation.
 */
export function previewDrydockMigration(input: DrydockAuthoredBlockInput) {
  const parsed = parseDrydockBlock(input);
  if (!parsed.success || !parsed.migrationsApplied.length) return null;
  const contract = getDrydockBlockContract(input.blockType);
  if (!contract) return null;
  const applied = contract.migrations.filter((migration) => parsed.migrationsApplied.includes(migration.id));
  return {
    sourceVersion: input.schemaVersion,
    targetVersion: parsed.block.schemaVersion,
    migrationIds: parsed.migrationsApplied,
    warnings: parsed.issues
      .filter((issue) => issue.compatibilityStatus === "MIGRATION_REQUIRED")
      .map((issue) => issue.message),
    affectedFields: [
      ...new Set([
        ...changedPaths(input.configuration, parsed.block.configuration, "configuration"),
        ...changedPaths(input.presentation ?? {}, parsed.block.presentation, "presentation"),
        ...changedPaths(input.completion ?? {}, parsed.block.completion, "completion"),
        ...(input.schemaVersion === parsed.block.schemaVersion ? [] : ["schemaVersion"]),
      ]),
    ].sort(),
    dataLoss: applied.map((migration) => migration.dataLoss),
    canonicalOutputChanges: applied.map((migration) => migration.checksumBehavior),
    after: {
      schemaVersion: parsed.block.schemaVersion,
      configuration: parsed.block.configuration,
      presentation: parsed.block.presentation,
      completion: parsed.block.completion,
    },
  };
}

import { createHash } from "node:crypto";
import type { JsonObject } from "@/chronicle/types";
import type { DrydockBlockMigration, DrydockMigrationInput, DrydockMigrationOutput } from "@/drydock/contracts/model";

const completionDefaults: Record<string, string> = {
  riddle: "textAnswer",
  textAnswer: "textAnswer",
  captainApproval: "captainManual",
  arrivalCheck: "captainManual",
  wait: "timer",
  condition: "automatic",
  setVariable: "automatic",
};

const valueTypeForLiteral = (value: unknown) => {
  if (typeof value === "boolean") return "BOOLEAN" as const;
  if (typeof value === "number" && Number.isSafeInteger(value)) return "INTEGER" as const;
  if (typeof value === "number") return "NUMBER" as const;
  if (Array.isArray(value)) return "STRING_SET" as const;
  return "STRING" as const;
};

const stableVariableId = (_blockId: string, legacyName: string) =>
  `var-${createHash("sha256")
    .update(`legacy-variable:${legacyName.normalize("NFKC")}`)
    .digest("hex")
    .slice(0, 20)}`;

function migrateLegacyConfiguration(input: DrydockMigrationInput): DrydockMigrationOutput {
  const configuration = structuredClone(input.configuration);
  const presentation = structuredClone(input.presentation);
  const completion = structuredClone(input.completion);
  const warnings: string[] = [];
  const legacyCompletion = configuration.completionMode;
  if (typeof legacyCompletion === "string") {
    if (completion.mode === undefined) completion.mode = legacyCompletion;
    delete configuration.completionMode;
  }
  if (typeof completion.completionMode === "string") {
    if (completion.mode === undefined) completion.mode = completion.completionMode;
    delete completion.completionMode;
  }
  if (typeof configuration.verificationProvider === "string") {
    if (completion.mode === undefined) completion.mode = configuration.verificationProvider;
    delete configuration.verificationProvider;
  }
  if (completion.mode === undefined) completion.mode = completionDefaults[input.blockType] ?? "playerConfirmation";
  if (input.blockType === "riddle" && configuration.hints === undefined) configuration.hints = [];
  if (input.blockType === "chapterComplete") {
    if (configuration.nextChapterBehavior === undefined) configuration.nextChapterBehavior = "continue";
    if (configuration.returnToMap === undefined) configuration.returnToMap = false;
  }
  if (input.blockType === "travelDirection" && configuration.destinationVisibility === undefined)
    configuration.destinationVisibility = "named";
  for (const field of ["futureVision", "futureProviderOptions"] as const) {
    const value = configuration[field];
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
      delete configuration[field];
    else if (value !== undefined)
      warnings.push(`${field} requires a registered extension migration before the block can become current.`);
  }
  if (input.blockType === "condition" && configuration.expression === undefined) {
    const variableName = String(configuration.variable ?? "");
    const variableId = stableVariableId(input.id, variableName);
    const value = configuration.value as boolean | number | string | string[] | null;
    const literal = { kind: "literal" as const, valueType: valueTypeForLiteral(value), value };
    const variable = { kind: "variable" as const, variableId };
    const operator = String(configuration.operator ?? "equals");
    configuration.expression = {
      schemaVersion: 1,
      root:
        operator === "contains"
          ? { kind: "contains", source: variable, value: literal }
          : {
              kind: "compare",
              operator:
                operator === "notEquals" || operator === "greaterThan" || operator === "lessThan" ? operator : "equals",
              left: variable,
              right: literal,
            },
    };
  }
  if (input.blockType === "setVariable") {
    const legacyName = String(configuration.variable ?? "variable");
    if (configuration.variableId === undefined) configuration.variableId = stableVariableId(input.id, legacyName);
    if (configuration.variableName === undefined) configuration.variableName = legacyName;
    if (configuration.scope === undefined) configuration.scope = "SESSION";
    if (configuration.privacy === undefined) configuration.privacy = "PLAYER_SAFE";
    if (
      configuration.valueType === "number" &&
      typeof configuration.value === "number" &&
      Number.isSafeInteger(configuration.value)
    )
      configuration.valueType = "integer";
  }
  return {
    ...input,
    schemaVersion: 2,
    configuration: configuration as JsonObject,
    presentation: presentation as JsonObject,
    completion: completion as JsonObject,
    warnings,
  };
}

export function createV1ToV2BlockMigration(blockType: string): DrydockBlockMigration {
  return {
    id: `drydock.${blockType}.v1-to-v2`,
    blockType,
    fromVersion: 1,
    toVersion: 2,
    precondition: (input) => input.blockType === blockType && input.schemaVersion === 1,
    migrate: migrateLegacyConfiguration,
    warnings: [],
    dataLoss: "NONE",
    checksumBehavior: "CANONICAL_OUTPUT_CHANGES",
    fixtureIds: [`drydock-fixture-${blockType}-v1`],
    idempotent: true,
  };
}

export function applyBlockMigrations(
  input: DrydockMigrationInput,
  migrations: readonly DrydockBlockMigration[],
  destinationVersion: number,
): { output?: DrydockMigrationOutput; applied: string[]; missingFromVersion?: number } {
  let current: DrydockMigrationOutput = { ...input, warnings: [] };
  const applied: string[] = [];
  const seen = new Set<number>();
  while (current.schemaVersion < destinationVersion) {
    if (seen.has(current.schemaVersion)) return { applied, missingFromVersion: current.schemaVersion };
    seen.add(current.schemaVersion);
    const migration = migrations.find(
      (candidate) =>
        candidate.fromVersion === current.schemaVersion &&
        candidate.toVersion > candidate.fromVersion &&
        candidate.precondition(current),
    );
    if (!migration) return { applied, missingFromVersion: current.schemaVersion };
    const migrated = migration.migrate(current);
    current = { ...migrated, warnings: [...current.warnings, ...migration.warnings, ...migrated.warnings] };
    applied.push(migration.id);
  }
  return { output: current, applied };
}

export function migrationCatalogRecord(migration: DrydockBlockMigration) {
  return {
    id: migration.id,
    blockType: migration.blockType,
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    warnings: migration.warnings,
    dataLoss: migration.dataLoss,
    checksumBehavior: migration.checksumBehavior,
    fixtureIds: migration.fixtureIds,
    idempotent: migration.idempotent,
  };
}

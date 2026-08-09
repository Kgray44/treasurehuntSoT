import type { z } from "zod";
import type { JsonObject } from "@/chronicle/types";
import { canonicalJson, canonicalizeValue } from "@/drydock/canonical";
import type {
  CanonicalDrydockBlock,
  DrydockAuthoredBlockInput,
  DrydockAuthoredConnection,
  DrydockBlockParseResult,
} from "@/drydock/contracts/model";
import { getDrydockBlockContract } from "@/drydock/contracts/registry";
import { validateDrydockExtensions } from "@/drydock/extensions";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";
import { applyBlockMigrations } from "@/drydock/migrations";
import { drydockProviderRegistry, type DrydockProviderId } from "@/drydock/providers";

const issueFromZod = (
  block: DrydockAuthoredBlockInput,
  area: "configuration" | "presentation" | "completion",
  issue: z.core.$ZodIssue,
) =>
  createDrydockIssue({
    code: `DRYDOCK_${area.toUpperCase()}_SCHEMA_INVALID`,
    category: "SCHEMA",
    severity: "ERROR",
    ruleVersion: 1,
    location: {
      blockId: block.id,
      blockType: block.blockType,
      fieldPath: [area, ...issue.path].join("."),
    },
    message: issue.message,
    remediation: `Correct the ${area} field to match the versioned ${block.blockType} contract.`,
    compatibilityStatus: "CURRENT",
  });

function connectionIssues(block: CanonicalDrydockBlock): DrydockIssue[] {
  const contract = getDrydockBlockContract(block.blockType)!;
  const issues: DrydockIssue[] = [];
  const recognized = block.connections.filter((connection) =>
    contract.connectionPolicy.allowedTypes.includes(connection.connectionType as never),
  );
  if (
    recognized.length < contract.connectionPolicy.minimum ||
    recognized.length > contract.connectionPolicy.maximum ||
    block.connections.some(
      (connection) => !contract.connectionPolicy.allowedTypes.includes(connection.connectionType as never),
    )
  )
    issues.push(
      createDrydockIssue({
        code: "DRYDOCK_CONNECTION_POLICY_INVALID",
        category: "REFERENCE",
        severity: "ERROR",
        ruleVersion: 1,
        location: { blockId: block.id, blockType: block.blockType, fieldPath: "connections" },
        message: "Passage connections do not match the versioned connection policy.",
        remediation: "Use only the allowed canonical BlockConnection types and count.",
      }),
    );
  const first = block.connections[0]?.targetBlockId ?? null;
  if (block.nextBlockId && first && block.nextBlockId !== first)
    issues.push(
      createDrydockIssue({
        code: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT",
        category: "COMPATIBILITY",
        severity: "ERROR",
        ruleVersion: 1,
        location: { blockId: block.id, blockType: block.blockType, fieldPath: "nextBlockId" },
        message: "Legacy next Passage and canonical first edge disagree.",
        remediation: "Preview and apply the target-field compatibility migration.",
        compatibilityStatus: "MIGRATION_REQUIRED",
      }),
    );
  if (block.blockType === "choice") {
    const configured = Array.isArray(block.configuration.choices)
      ? block.configuration.choices.map((choice) =>
          choice && typeof choice === "object" ? String((choice as Record<string, unknown>).targetBlockId ?? "") : "",
        )
      : [];
    const canonical = block.connections
      .filter((connection) => connection.connectionType === "CHOICE")
      .map((connection) => connection.targetBlockId);
    if (configured.length !== canonical.length || configured.some((target, index) => target !== canonical[index]))
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_CHOICE_TARGET_AUTHORITY_CONFLICT",
          category: "COMPATIBILITY",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: block.id, blockType: block.blockType, fieldPath: "configuration.choices" },
          message: "Choice target mirrors disagree with canonical BlockConnection order.",
          remediation: "Use canonical CHOICE edges and regenerate configuration mirrors deterministically.",
          compatibilityStatus: "MIGRATION_REQUIRED",
        }),
      );
  }
  if (block.blockType === "condition") {
    for (const [connectionType, fieldPath] of [
      ["SUCCESS", "successTargetBlockId"],
      ["FAILURE", "failureTargetBlockId"],
    ] as const) {
      const configured = String(block.configuration[fieldPath] ?? "");
      const canonical = block.connections.find(
        (connection) => connection.connectionType === connectionType,
      )?.targetBlockId;
      if (!canonical || configured !== canonical)
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_CONDITION_TARGET_AUTHORITY_CONFLICT",
            category: "COMPATIBILITY",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: `configuration.${fieldPath}` },
            message: "Condition target mirror disagrees with its canonical BlockConnection.",
            remediation: "Use canonical SUCCESS and FAILURE edges and regenerate target mirrors.",
            compatibilityStatus: "MIGRATION_REQUIRED",
          }),
        );
    }
  }
  return issues;
}

function providerIssues(block: CanonicalDrydockBlock): DrydockIssue[] {
  const mode = String(block.completion.mode ?? "automatic");
  if (mode === "automatic") return [];
  const provider = drydockProviderRegistry[mode as DrydockProviderId];
  if (!provider)
    return [
      createDrydockIssue({
        code: "DRYDOCK_PROVIDER_UNREGISTERED",
        category: "PROVIDER_CONTRACT",
        severity: "ERROR",
        ruleVersion: 1,
        location: { blockId: block.id, blockType: block.blockType, fieldPath: "completion.mode" },
        message: "Completion references an unregistered provider contract.",
        remediation: "Select a registered completion provider.",
      }),
    ];
  if (provider.state === "NOT_CONFIGURED")
    return [
      createDrydockIssue({
        code: "DRYDOCK_PROVIDER_NOT_CONFIGURED",
        category: "PROVIDER_CONTRACT",
        severity: "ERROR",
        ruleVersion: 1,
        location: { blockId: block.id, blockType: block.blockType, fieldPath: "completion.mode" },
        message: "The selected provider has no current configured Drydock adapter.",
        remediation: "Use an available provider or configure the canonical owner adapter and fallback.",
      }),
    ];
  return [];
}

export function parseDrydockBlock(input: DrydockAuthoredBlockInput): DrydockBlockParseResult {
  const contract = getDrydockBlockContract(input.blockType);
  if (!contract)
    return {
      success: false,
      migrationsApplied: [],
      compatibilityStatus: "UNSUPPORTED",
      issues: [
        createDrydockIssue({
          code: "DRYDOCK_BLOCK_TYPE_UNSUPPORTED",
          category: "COMPATIBILITY",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: input.id, blockType: input.blockType },
          message: "This Passage type is not supported by the current Drydock contract registry.",
          remediation: "Install its governed adapter or open the content with a compatible reader.",
          compatibilityStatus: "UNSUPPORTED",
        }),
      ],
    };
  if (input.schemaVersion > contract.currentVersion || input.schemaVersion < contract.minimumReaderVersion)
    return {
      success: false,
      migrationsApplied: [],
      compatibilityStatus: "UNSUPPORTED",
      issues: [
        createDrydockIssue({
          code: "DRYDOCK_BLOCK_VERSION_UNSUPPORTED",
          category: "COMPATIBILITY",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: input.id, blockType: input.blockType },
          message: `Passage schema version ${input.schemaVersion} is outside supported reader range ${contract.minimumReaderVersion}-${contract.currentVersion}.`,
          remediation: "Use a compatible reader or add an explicit governed migration path.",
          compatibilityStatus: "UNSUPPORTED",
          metadata: { observedVersion: input.schemaVersion, currentVersion: contract.currentVersion },
        }),
      ],
    };
  const migration = applyBlockMigrations(
    {
      id: input.id,
      blockType: input.blockType,
      schemaVersion: input.schemaVersion,
      configuration: input.configuration,
      presentation: input.presentation ?? {},
      completion: input.completion ?? {},
    },
    contract.migrations,
    contract.currentVersion,
  );
  if (!migration.output)
    return {
      success: false,
      migrationsApplied: migration.applied,
      compatibilityStatus: "MIGRATION_REQUIRED",
      issues: [
        createDrydockIssue({
          code: "DRYDOCK_MIGRATION_PATH_MISSING",
          category: "MIGRATION",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: input.id, blockType: input.blockType },
          message: `No deterministic migration path starts at schema version ${migration.missingFromVersion}.`,
          remediation: "Register and test the missing migration before editing or publishing this Passage.",
          compatibilityStatus: "MIGRATION_REQUIRED",
        }),
      ],
    };
  let candidate = migration.output;
  const migrationsApplied = [...migration.applied];
  if (input.schemaVersion === contract.currentVersion) {
    const configuration = structuredClone(candidate.configuration);
    const completion = structuredClone(candidate.completion);
    let normalized = false;
    for (const field of ["completionMode", "verificationProvider"] as const) {
      if (typeof configuration[field] === "string") {
        if (completion.mode === undefined) completion.mode = configuration[field];
        delete configuration[field];
        normalized = true;
      }
    }
    for (const field of ["futureVision", "futureProviderOptions"] as const) {
      const value = configuration[field];
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
        delete configuration[field];
        normalized = true;
      }
    }
    if (normalized) {
      candidate = { ...candidate, configuration, completion };
      migrationsApplied.push(`drydock.${input.blockType}.v2-known-compatibility-normalization`);
    }
  }
  const configuration = contract.configurationSchema.safeParse(candidate.configuration);
  const presentation = contract.presentationSchema.safeParse(candidate.presentation);
  const completion = contract.completionSchema.safeParse(candidate.completion);
  const issues: DrydockIssue[] = [
    ...(configuration.success
      ? []
      : configuration.error.issues.map((issue) => issueFromZod(input, "configuration", issue))),
    ...(presentation.success
      ? []
      : presentation.error.issues.map((issue) => issueFromZod(input, "presentation", issue))),
    ...(completion.success ? [] : completion.error.issues.map((issue) => issueFromZod(input, "completion", issue))),
  ];
  for (const warning of candidate.warnings)
    issues.push(
      createDrydockIssue({
        code: "DRYDOCK_MIGRATION_WARNING",
        category: "MIGRATION",
        severity: "WARNING",
        ruleVersion: 1,
        location: { blockId: input.id, blockType: input.blockType },
        message: warning,
        remediation: "Review the migration preview before editing or publishing.",
        compatibilityStatus: "MIGRATION_REQUIRED",
      }),
    );
  if (!configuration.success || !presentation.success || !completion.success)
    return {
      success: false,
      issues,
      migrationsApplied,
      compatibilityStatus: migrationsApplied.length ? "MIGRATION_REQUIRED" : "INVALID",
      ...(migrationsApplied.length ? { migrationPreview: candidate } : {}),
    };
  const extensionResult = validateDrydockExtensions(configuration.data.extensions, {
    blockId: input.id,
    blockType: input.blockType,
    fieldPath: "configuration.extensions",
  });
  issues.push(...extensionResult.issues);
  const connections = [...(input.connections ?? [])]
    .map((connection, index) => ({ ...connection, orderIndex: connection.orderIndex ?? index }))
    .sort(
      (left, right) =>
        (left.orderIndex ?? 0) - (right.orderIndex ?? 0) ||
        left.connectionType.localeCompare(right.connectionType, "en") ||
        left.targetBlockId.localeCompare(right.targetBlockId, "en"),
    );
  const block: CanonicalDrydockBlock = {
    id: input.id,
    blockType: input.blockType,
    schemaVersion: contract.currentVersion,
    configuration: canonicalizeValue(configuration.data) as JsonObject,
    presentation: canonicalizeValue(presentation.data) as JsonObject,
    completion: canonicalizeValue(completion.data) as JsonObject,
    connections,
    nextBlockId: input.nextBlockId ?? connections[0]?.targetBlockId ?? null,
    ...(input.blockType === "condition" && configuration.data.expression
      ? { expression: configuration.data.expression as CanonicalDrydockBlock["expression"] }
      : {}),
  };
  issues.push(...connectionIssues(block), ...providerIssues(block));
  if (issues.some((issue) => issue.severity === "ERROR"))
    return {
      success: false,
      issues,
      migrationsApplied,
      compatibilityStatus: migrationsApplied.length ? "MIGRATION_REQUIRED" : "INVALID",
    };
  return { success: true, block, issues, migrationsApplied };
}

export function serializeCanonicalDrydockBlock(block: CanonicalDrydockBlock): string {
  return canonicalJson(
    {
      id: block.id,
      blockType: block.blockType,
      schemaVersion: block.schemaVersion,
      configuration: block.configuration,
      presentation: block.presentation,
      completion: block.completion,
      connections: block.connections,
      nextBlockId: block.nextBlockId,
    },
    Number.MAX_SAFE_INTEGER,
  );
}

/** Maintains the accepted One Voyage transport until its owner adopts separated completion fields. */
export function runtimeCompatibilityProjection(block: CanonicalDrydockBlock): CanonicalDrydockBlock {
  const configuration = { ...block.configuration };
  if (typeof block.completion.mode === "string") configuration.completionMode = block.completion.mode;
  return { ...block, configuration };
}

export function canonicalTargetMigrationPreview(block: CanonicalDrydockBlock): {
  configuration: JsonObject;
  nextBlockId: string | null;
} {
  const configuration = structuredClone(block.configuration);
  if (block.blockType === "choice" && Array.isArray(configuration.choices)) {
    const edges = block.connections.filter((connection) => connection.connectionType === "CHOICE");
    configuration.choices = configuration.choices.map((choice, index) =>
      choice && typeof choice === "object"
        ? { ...(choice as Record<string, unknown>), targetBlockId: edges[index]?.targetBlockId ?? "" }
        : choice,
    );
  }
  if (block.blockType === "condition") {
    configuration.successTargetBlockId =
      block.connections.find((connection) => connection.connectionType === "SUCCESS")?.targetBlockId ?? "";
    configuration.failureTargetBlockId =
      block.connections.find((connection) => connection.connectionType === "FAILURE")?.targetBlockId ?? "";
  }
  return { configuration, nextBlockId: block.connections[0]?.targetBlockId ?? null };
}

export type { DrydockAuthoredConnection };

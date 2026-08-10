import type { z } from "zod";
import type { JsonObject } from "@/chronicle/types";
import type { DrydockExpression } from "@/drydock/expressions";
import type { DrydockIssue } from "@/drydock/issues";
import type { DrydockProviderId } from "@/drydock/providers";
import type { DrydockVariableOperation } from "@/drydock/variables";

export type DrydockConnectionPolicy = {
  canonicalAuthority: "BLOCK_CONNECTION";
  allowedTypes: readonly ("DEFAULT" | "CHOICE" | "SUCCESS" | "FAILURE")[];
  minimum: number;
  maximum: number;
  terminal: boolean;
  legacyMirrors: readonly string[];
};

export type DrydockAssetRequirement = {
  fieldPath: string;
  required: boolean;
  mediaTypes: readonly ("IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "MODEL_3D")[];
  playerSafe: boolean;
  accessibilityFallback?: string;
};

export type DrydockVariableReferenceContract = {
  fieldPath: string;
  identityFieldPath?: string;
  access: "READ" | "WRITE";
  operations?: readonly DrydockVariableOperation[];
};

export type DrydockAccessibilityRule = {
  code: string;
  fieldPath?: string;
  obligation: string;
  required: boolean;
};

export type DrydockMigrationInput = {
  id: string;
  blockType: string;
  schemaVersion: number;
  configuration: JsonObject;
  presentation: JsonObject;
  completion: JsonObject;
};

export type DrydockMigrationOutput = DrydockMigrationInput & {
  warnings: readonly string[];
};

export type DrydockBlockMigration = {
  id: string;
  blockType: string;
  fromVersion: number;
  toVersion: number;
  precondition: (input: DrydockMigrationInput) => boolean;
  migrate: (input: DrydockMigrationInput) => DrydockMigrationOutput;
  warnings: readonly string[];
  dataLoss: "NONE" | "POSSIBLE";
  checksumBehavior: "CANONICAL_OUTPUT_CHANGES" | "CANONICAL_OUTPUT_PRESERVED";
  fixtureIds: readonly string[];
  idempotent: boolean;
};

export type DrydockBlockContract = {
  type: string;
  currentVersion: number;
  minimumReaderVersion: number;
  configurationSchema: z.ZodType<JsonObject>;
  presentationSchema: z.ZodType<JsonObject>;
  completionSchema: z.ZodType<JsonObject>;
  defaultConfiguration: JsonObject;
  defaultPresentation: JsonObject;
  defaultCompletion: JsonObject;
  connectionPolicy: DrydockConnectionPolicy;
  assetRequirements: readonly DrydockAssetRequirement[];
  variableReads: readonly DrydockVariableReferenceContract[];
  variableWrites: readonly DrydockVariableReferenceContract[];
  providerContract: DrydockProviderId | "CONFIGURED_COMPLETION" | null;
  accessibilityRules: readonly DrydockAccessibilityRule[];
  migrations: readonly DrydockBlockMigration[];
  canonicalization: {
    objectKeys: "LEXICOGRAPHIC";
    arrayOrder: "PRESERVE";
    prose: "PRESERVE_EXACTLY";
    finiteNumbersOnly: true;
  };
  compatibility: {
    legacyConfigurationVersion: number;
    legacyCompletionField?: string;
    duplicatedTargetFields: readonly string[];
  };
};

export type DrydockAuthoredConnection = {
  targetBlockId: string;
  connectionType: "DEFAULT" | "CHOICE" | "SUCCESS" | "FAILURE" | string;
  label?: string | null;
  conditionExpression?: string | null;
  orderIndex?: number;
};

export type DrydockAuthoredBlockInput = {
  id: string;
  blockType: string;
  schemaVersion: number;
  configuration: JsonObject;
  presentation?: JsonObject;
  completion?: JsonObject;
  connections?: readonly DrydockAuthoredConnection[];
  nextBlockId?: string | null;
};

export type CanonicalDrydockBlock = {
  id: string;
  blockType: string;
  schemaVersion: number;
  configuration: JsonObject;
  presentation: JsonObject;
  completion: JsonObject;
  connections: DrydockAuthoredConnection[];
  nextBlockId: string | null;
  expression?: DrydockExpression;
};

export type DrydockBlockParseResult =
  | {
      success: true;
      block: CanonicalDrydockBlock;
      issues: readonly DrydockIssue[];
      migrationsApplied: readonly string[];
    }
  | {
      success: false;
      issues: readonly DrydockIssue[];
      migrationsApplied: readonly string[];
      compatibilityStatus: "UNSUPPORTED" | "MIGRATION_REQUIRED" | "INVALID";
      /** Available only when a compatibility error has an unambiguous safe repair. */
      repairCandidate?: CanonicalDrydockBlock;
      /** Creator-authorized use only; never include authored values in broad diagnostics or CI logs. */
      migrationPreview?: DrydockMigrationOutput;
    };

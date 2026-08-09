import { createHash } from "node:crypto";

export const drydockIssueCategories = [
  "SCHEMA",
  "REFERENCE",
  "VARIABLE_DECLARATION",
  "VARIABLE_TYPE",
  "EXPRESSION",
  "MIGRATION",
  "COMPATIBILITY",
  "EXTENSION",
  "ACCESSIBILITY_CONTRACT",
  "PROVIDER_CONTRACT",
] as const;

export type DrydockIssueCategory = (typeof drydockIssueCategories)[number];
export type DrydockIssueSeverity = "ERROR" | "WARNING" | "INFO";

export type DrydockSemanticLocation = {
  chronicleId?: string;
  chapterId?: string;
  blockId?: string;
  blockType?: string;
  fieldPath?: string;
  variableId?: string;
  expressionPath?: string;
};

export type DrydockIssue = {
  id: string;
  code: string;
  category: DrydockIssueCategory;
  severity: DrydockIssueSeverity;
  ruleVersion: number;
  location: DrydockSemanticLocation;
  message: string;
  technicalDetail?: string;
  remediation?: string;
  sourceWatermark?: string;
  compatibilityStatus?: "CURRENT" | "MIGRATION_REQUIRED" | "UNSUPPORTED";
  metadata?: Record<string, string | number | boolean | null>;
};

export type CreateDrydockIssueInput = Omit<DrydockIssue, "id">;

const identity = (input: CreateDrydockIssueInput) =>
  JSON.stringify({
    code: input.code,
    category: input.category,
    ruleVersion: input.ruleVersion,
    location: {
      chronicleId: input.location.chronicleId ?? null,
      chapterId: input.location.chapterId ?? null,
      blockId: input.location.blockId ?? null,
      blockType: input.location.blockType ?? null,
      fieldPath: input.location.fieldPath ?? null,
      variableId: input.location.variableId ?? null,
      expressionPath: input.location.expressionPath ?? null,
    },
    compatibilityStatus: input.compatibilityStatus ?? null,
  });

export function createDrydockIssue(input: CreateDrydockIssueInput): DrydockIssue {
  const digest = createHash("sha256").update(identity(input)).digest("hex").slice(0, 24);
  return {
    ...input,
    ...(input.metadata ? { metadata: privacySafeMetadata(input.metadata) } : {}),
    id: `drydock-${digest}`,
  };
}

const privateFieldPattern =
  /acceptedanswer|answerkey|solution|captainnotes?|captaininstruction|creatornotes?|secret|token|credential|storagekey|private(location|evidence|prose)?/iu;

export function privacySafeMetadata(input: Record<string, unknown>): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (privateFieldPattern.test(key)) return [];
      if (value === null || ["string", "number", "boolean"].includes(typeof value))
        return [[key, value as string | number | boolean | null]];
      return [];
    }),
  );
}

export function sanitizedIssueProjection(issue: DrydockIssue) {
  return {
    id: issue.id,
    code: issue.code,
    category: issue.category,
    severity: issue.severity,
    ruleVersion: issue.ruleVersion,
    location: issue.location,
    message: issue.message,
    remediation: issue.remediation,
    sourceWatermark: issue.sourceWatermark,
    compatibilityStatus: issue.compatibilityStatus,
    metadata: issue.metadata ? privacySafeMetadata(issue.metadata) : undefined,
  };
}

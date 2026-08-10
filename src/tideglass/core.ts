import { createHash } from "node:crypto";
import { z } from "zod";

export const TIDEGLASS_SEMANTIC_SCHEMA_VERSION = "tideglass.semantic.v1" as const;
export const TIDEGLASS_COMPARISON_POLICY_VERSION = "tideglass.policy.v1" as const;

export const TIDEGLASS_LIMITS = {
  snapshotBytes: 8 * 1024 * 1024,
  chapters: 500,
  blocks: 10_000,
  edges: 40_000,
  artifacts: 5_000,
  locations: 5_000,
  media: 10_000,
} as const;

export const changeCategories = [
  "STORY_CONTENT",
  "STRUCTURE",
  "BRANCHING_AND_CHOICES",
  "ENDING",
  "COMPLETION",
  "SIDE_QUEST",
  "ARTIFACT",
  "LOCATION_AND_MAP",
  "MEDIA",
  "ACCESSIBILITY",
  "SETUP_REQUIREMENTS",
  "COMPATIBILITY",
  "SAFETY_AND_WARNINGS",
  "PRESENTATION_METADATA",
] as const;
export type ChronicleChangeCategory = (typeof changeCategories)[number];

export const changeKinds = ["ADDED", "REMOVED", "MODIFIED", "MOVED", "REWIRED", "REPLACED"] as const;
export type ChronicleChangeKind = (typeof changeKinds)[number];

export const significanceLevels = ["PRESENTATION_ONLY", "MINOR", "MEANINGFUL", "MAJOR", "TRANSFORMATIVE"] as const;
export type ChangeSignificance = (typeof significanceLevels)[number];

export const spoilerLevels = [
  "PREVIEW_SAFE",
  "STORY_SPOILER",
  "ENDING_SPOILER",
  "CREATOR_ONLY",
  "CAPTAIN_ONLY",
  "PRIVATE_OR_REDACTED",
] as const;
export type ComparisonSpoilerLevel = (typeof spoilerLevels)[number];

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type RetainedEditionState = "PLAYABLE" | "HISTORICAL_ONLY" | "DEPRECATED" | "REDACTED";

export type ResolvedEditionAnchor = {
  chronicleId: string;
  editionId: string;
  editionChecksum: string;
  publishedAt?: string;
  sourceSchemaVersion: number | string;
  retainedState?: RetainedEditionState;
};

export type EditionPair = {
  chronicleId: string;
  source: ResolvedEditionAnchor;
  target: ResolvedEditionAnchor;
};

export type SemanticUnsupportedSection = {
  section: string;
  code: "SCHEMA_UNSUPPORTED" | "UNKNOWN_SEMANTICS" | "AMBIGUOUS_IDENTITY" | "INVALID_SECTION";
  sourceSchemaVersion?: number | string;
  detail: string;
};

export type SemanticFact = {
  path: string;
  value: JsonValue;
  category: ChronicleChangeCategory;
  significance: ChangeSignificance;
  spoilerLevel: ComparisonSpoilerLevel;
  tags: string[];
};

export type SemanticEntity = {
  id: string;
  entityType: "CHAPTER" | "BLOCK" | "ARTIFACT" | "LOCATION" | "MEDIA";
  parentId?: string;
  order?: number;
  semanticType?: string;
  facts: SemanticFact[];
};

export type SemanticGraphEdge = {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  connectionType: string;
  label: string | null;
  condition: string | null;
  order: number;
};

export type ChronicleSemanticSnapshot = {
  semanticSchemaVersion: typeof TIDEGLASS_SEMANTIC_SCHEMA_VERSION;
  edition: ResolvedEditionAnchor;
  metadata: SemanticFact[];
  structure: {
    chapters: SemanticEntity[];
    blocks: SemanticEntity[];
    graph: { edges: SemanticGraphEdge[] };
  };
  progression: SemanticFact[];
  artifacts: SemanticEntity[];
  world: { locations: SemanticEntity[] };
  media: SemanticEntity[];
  accessibility: SemanticFact[];
  requirements: SemanticFact[];
  unsupportedSections: SemanticUnsupportedSection[];
  normalizationAdapters: string[];
};

export type MatchOutcome =
  | { kind: "EXACT_STABLE_ID"; source: SemanticEntity; target: SemanticEntity }
  | { kind: "EXPLICIT_REPLACEMENT"; source: SemanticEntity; target: SemanticEntity }
  | { kind: "UNMATCHED_SOURCE"; source: SemanticEntity }
  | { kind: "UNMATCHED_TARGET"; target: SemanticEntity }
  | { kind: "AMBIGUOUS"; identity: string };

export type ChangeEvidence = {
  sourceEditionId: string;
  sourceEditionChecksum: string;
  targetEditionId: string;
  targetEditionChecksum: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  semanticPath: string;
  sourceSemanticDigest?: string;
  targetSemanticDigest?: string;
  comparator: string;
  semanticSchemaVersion: typeof TIDEGLASS_SEMANTIC_SCHEMA_VERSION;
  comparisonPolicyVersion: typeof TIDEGLASS_COMPARISON_POLICY_VERSION;
};

export type ChronicleChangeRecord = {
  id: string;
  category: ChronicleChangeCategory;
  kind: ChronicleChangeKind;
  entityType: string;
  entityId?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  significance: ChangeSignificance;
  spoilerLevel: ComparisonSpoilerLevel;
  compatibilityImpact?: "NONE" | "POTENTIAL" | "BREAKING" | "UNKNOWN";
  tags: string[];
  evidence: ChangeEvidence;
};

export type TideglassComparisonStatus = "COMPLETE" | "PARTIAL" | "NO_MEANINGFUL_CHANGE";

export type TideglassChangeSet = {
  comparisonId: string;
  pair: EditionPair;
  semanticSchemaVersion: typeof TIDEGLASS_SEMANTIC_SCHEMA_VERSION;
  comparisonPolicyVersion: typeof TIDEGLASS_COMPARISON_POLICY_VERSION;
  status: TideglassComparisonStatus;
  changes: ChronicleChangeRecord[];
  unsupportedSections: SemanticUnsupportedSection[];
  categoryCounts: Record<ChronicleChangeCategory, number>;
  deterministicDigest: string;
};

export type TideglassComparisonReceipt = {
  comparisonId: string;
  chronicleId: string;
  sourceEditionId: string;
  sourceChecksum: string;
  targetEditionId: string;
  targetChecksum: string;
  sourceSchemaVersion: number | string;
  targetSchemaVersion: number | string;
  semanticSchemaVersion: typeof TIDEGLASS_SEMANTIC_SCHEMA_VERSION;
  comparisonPolicyVersion: typeof TIDEGLASS_COMPARISON_POLICY_VERSION;
  normalizationAdapters: string[];
  status: TideglassComparisonStatus;
  changeCount: number;
  categoryCounts: Record<ChronicleChangeCategory, number>;
  unsupportedSections: SemanticUnsupportedSection[];
  deterministicChangeSetDigest: string;
};

export type TideglassOperationalEnvelope = {
  correlationId: string;
  cacheStatus: "HIT" | "MISS" | "BYPASS";
  normalizationDurationMs: number;
  comparisonDurationMs: number;
  totalDurationMs: number;
};

export type TideglassComparisonResult = {
  changeSet: TideglassChangeSet;
  receipt: TideglassComparisonReceipt;
  operation: TideglassOperationalEnvelope;
};

export const tideglassFailureCodes = [
  "EDITION_NOT_FOUND",
  "EDITION_NOT_AUTHORIZED",
  "CROSS_CHRONICLE_COMPARISON",
  "CHECKSUM_MISMATCH",
  "PUBLISHED_SNAPSHOT_INVALID",
  "SEMANTIC_SCHEMA_UNSUPPORTED",
  "SEMANTIC_SECTION_UNAVAILABLE",
  "ENTITY_IDENTITY_AMBIGUOUS",
  "NORMALIZATION_FAILED",
  "COMPARISON_FAILED",
  "COMPARISON_CANCELLED",
  "COMPARISON_LIMIT_EXCEEDED",
] as const;
export type TideglassFailureCode = (typeof tideglassFailureCodes)[number];

export type TideglassFailure = {
  ok: false;
  code: TideglassFailureCode;
  message: string;
  correlationId?: string;
};

export type TideglassSuccess<T> = { ok: true; value: T };
export type TideglassResult<T> = TideglassSuccess<T> | TideglassFailure;

export const exactIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/u);
export const compareRequestSchema = z
  .object({
    chronicleId: exactIdSchema,
    sourceEditionId: exactIdSchema,
    targetEditionId: exactIdSchema,
  })
  .strict();
export type TideglassCompareRequest = z.infer<typeof compareRequestSchema>;

function toCanonical(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON does not support non-finite numbers.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(toCanonical);
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) output[key] = toCanonical(item);
    }
    return output;
  }
  throw new Error("Value cannot be represented as canonical JSON.");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonical(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function semanticDigest(value: unknown): string {
  return sha256(canonicalJson(value));
}

/**
 * Canonical string ordering must not depend on the host locale or ICU build.
 * JavaScript relational comparison is defined over UTF-16 code units and is
 * therefore byte-stable for the same input strings on every supported host.
 */
export function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function comparisonIdentity(pair: EditionPair): string {
  return semanticDigest({
    chronicleId: pair.chronicleId,
    sourceEditionId: pair.source.editionId,
    sourceEditionChecksum: pair.source.editionChecksum,
    sourceSchemaVersion: pair.source.sourceSchemaVersion,
    targetEditionId: pair.target.editionId,
    targetEditionChecksum: pair.target.editionChecksum,
    targetSchemaVersion: pair.target.sourceSchemaVersion,
    semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
  });
}

export function emptyCategoryCounts(): Record<ChronicleChangeCategory, number> {
  return Object.fromEntries(changeCategories.map((category) => [category, 0])) as Record<
    ChronicleChangeCategory,
    number
  >;
}

export function failure(code: TideglassFailureCode, correlationId?: string): TideglassFailure {
  const messages: Record<TideglassFailureCode, string> = {
    EDITION_NOT_FOUND: "One or more requested Chronicle editions are unavailable.",
    EDITION_NOT_AUTHORIZED: "The requested Chronicle editions are unavailable to this account.",
    CROSS_CHRONICLE_COMPARISON: "Tideglass Phase 1 compares editions from the same Chronicle only.",
    CHECKSUM_MISMATCH: "A published Chronicle edition failed its integrity check.",
    PUBLISHED_SNAPSHOT_INVALID: "A published Chronicle edition has an invalid snapshot.",
    SEMANTIC_SCHEMA_UNSUPPORTED: "A published Chronicle edition uses an unsupported semantic schema.",
    SEMANTIC_SECTION_UNAVAILABLE: "A Chronicle semantic section is unavailable for comparison.",
    ENTITY_IDENTITY_AMBIGUOUS: "A Chronicle semantic section contains ambiguous stable identities.",
    NORMALIZATION_FAILED: "The Chronicle editions could not be normalized safely.",
    COMPARISON_FAILED: "The Chronicle editions could not be compared safely.",
    COMPARISON_CANCELLED: "The Chronicle edition comparison was cancelled.",
    COMPARISON_LIMIT_EXCEEDED: "The Chronicle edition comparison exceeds Phase 1 safety limits.",
  };
  return { ok: false, code, message: messages[code], ...(correlationId ? { correlationId } : {}) };
}

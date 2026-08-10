import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
  TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
  assessTideglassSignificance,
  classifyTideglassChangeSet,
  isTideglassAccessibilityRegression,
  type TideglassSummaryAnnotation,
} from "./intelligence";
import {
  TIDEGLASS_COMPARISON_POLICY_VERSION,
  canonicalJson,
  changeCategories,
  compareCanonicalStrings,
  exactIdSchema,
  semanticDigest,
  spoilerLevels,
  type ChronicleChangeCategory,
  type TideglassChangeSet,
} from "./core";

export const tideglassAnnotationScopes = ["PAIR", "CATEGORY", "CHANGE"] as const;
export const tideglassAnnotationKinds = [
  "HEADLINE",
  "DETAIL",
  "COMPATIBILITY",
  "LIMITATION",
  "REPLAY_GUIDANCE",
] as const;
export const tideglassReplayGuidance = [
  "NO_RECOMMENDATION",
  "MINOR_UPDATE",
  "WORTH_REVISITING",
  "SUBSTANTIAL_NEW_CONTENT",
] as const;
export const tideglassAnnotationStates = ["ACTIVE", "WITHDRAWN"] as const;

export type TideglassCreatorAnnotation = TideglassSummaryAnnotation & {
  chronicleId: string;
  sourceEditionId: string;
  sourceEditionChecksum: string;
  targetEditionId: string;
  targetEditionChecksum: string;
  comparisonPolicyVersion: string;
  createdByAccountId: string;
  createdAt: Date | string;
  supersedesAnnotationId: string | null;
  idempotencyKey: string | null;
};

export function tideglassCreatorAnnotationDto(annotation: TideglassCreatorAnnotation) {
  return {
    id: annotation.id,
    annotationKey: annotation.annotationKey,
    revision: annotation.revision,
    sourceEditionId: annotation.sourceEditionId,
    targetEditionId: annotation.targetEditionId,
    comparisonPolicyVersion: annotation.comparisonPolicyVersion,
    scopeType: annotation.scopeType,
    category: annotation.category,
    changeRecordId: annotation.changeRecordId,
    annotationKind: annotation.annotationKind,
    headline: annotation.headline,
    body: annotation.body,
    spoilerLevel: annotation.spoilerLevel,
    highlighted: annotation.highlighted,
    replayGuidance: annotation.replayGuidance,
    createdAt: annotation.createdAt instanceof Date ? annotation.createdAt.toISOString() : annotation.createdAt,
    supersedesAnnotationId: annotation.supersedesAnnotationId,
    state: annotation.state,
  };
}

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const safeHeadlineSchema = z.string().trim().min(1).max(160).nullable().optional();
const safeBodySchema = z.string().trim().min(1).max(4_000).nullable().optional();

export const annotationMutationSchema = z
  .object({
    operation: z.enum(["CREATE", "REVISE", "WITHDRAW"]),
    sourceEditionId: exactIdSchema,
    sourceEditionChecksum: checksumSchema,
    targetEditionId: exactIdSchema,
    targetEditionChecksum: checksumSchema,
    annotationKey: exactIdSchema.optional(),
    supersedesAnnotationId: exactIdSchema.optional(),
    scopeType: z.enum(tideglassAnnotationScopes).optional(),
    category: z.enum(changeCategories).nullable().optional(),
    changeRecordId: exactIdSchema.nullable().optional(),
    annotationKind: z.enum(tideglassAnnotationKinds).optional(),
    headline: safeHeadlineSchema,
    body: safeBodySchema,
    spoilerLevel: z.enum(spoilerLevels).optional(),
    highlighted: z.boolean().optional(),
    replayGuidance: z.enum(tideglassReplayGuidance).optional(),
    idempotencyKey: exactIdSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.operation === "CREATE" && value.supersedesAnnotationId)
      context.addIssue({ code: "custom", message: "A new annotation cannot supersede a prior revision." });
    if (value.operation !== "CREATE" && (!value.annotationKey || !value.supersedesAnnotationId))
      context.addIssue({ code: "custom", message: "Revision identity is required." });
    if (value.operation !== "WITHDRAW" && (!value.scopeType || !value.annotationKind || !value.spoilerLevel))
      context.addIssue({ code: "custom", message: "Annotation classification is required." });
    if (value.operation !== "WITHDRAW" && !value.headline && !value.body)
      context.addIssue({ code: "custom", message: "An annotation needs a headline or body." });
    if (value.scopeType === "PAIR" && (value.category || value.changeRecordId))
      context.addIssue({ code: "custom", message: "Pair annotations cannot bind a category or Change ID." });
    if (value.scopeType === "CATEGORY" && (!value.category || value.changeRecordId))
      context.addIssue({ code: "custom", message: "Category annotations require only a category." });
    if (value.scopeType === "CHANGE" && (!value.changeRecordId || value.category))
      context.addIssue({ code: "custom", message: "Change annotations require only an exact Change ID." });
  });
export type TideglassAnnotationMutation = z.infer<typeof annotationMutationSchema>;

export type TideglassAnnotationFailureCode =
  | "ANNOTATION_INVALID"
  | "ANNOTATION_PAIR_MISMATCH"
  | "ANNOTATION_CHANGE_UNAVAILABLE"
  | "ANNOTATION_REVISION_CONFLICT"
  | "ANNOTATION_UNSAFE_TEXT"
  | "ANNOTATION_FAILED";

export type TideglassAnnotationResult =
  | { ok: true; value: TideglassCreatorAnnotation; idempotent: boolean; correlationId: string }
  | { ok: false; code: TideglassAnnotationFailureCode; message: string; correlationId: string };

export type TideglassAnnotationAppend = Omit<TideglassCreatorAnnotation, "id" | "revision" | "createdAt"> & {
  correlationId: string;
};

export interface TideglassAnnotationRepository {
  listPair(input: {
    chronicleId: string;
    sourceEditionId: string;
    sourceEditionChecksum: string;
    targetEditionId: string;
    targetEditionChecksum: string;
    comparisonPolicyVersion: string;
  }): Promise<TideglassCreatorAnnotation[]>;
  findIdempotent(accountId: string, idempotencyKey: string): Promise<TideglassCreatorAnnotation | null>;
  appendRevision(input: TideglassAnnotationAppend): Promise<TideglassCreatorAnnotation>;
}

function failure(code: TideglassAnnotationFailureCode, correlationId: string): TideglassAnnotationResult {
  const messages: Record<TideglassAnnotationFailureCode, string> = {
    ANNOTATION_INVALID: "The Tideglass annotation request is invalid.",
    ANNOTATION_PAIR_MISMATCH: "The requested Chronicle edition pair is unavailable.",
    ANNOTATION_CHANGE_UNAVAILABLE: "The requested Change Record is unavailable for this comparison.",
    ANNOTATION_REVISION_CONFLICT: "The annotation has a newer revision. Refresh and try again.",
    ANNOTATION_UNSAFE_TEXT: "The annotation contains content that cannot be stored safely.",
    ANNOTATION_FAILED: "The Tideglass annotation could not be stored.",
  };
  return { ok: false, code, message: messages[code], correlationId };
}

const unsafeAnnotationText =
  /<[^>]*>|javascript\s*:|\bon\w+\s*=|(?:s3|gs|file):\/\/|storage[_-]?key|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY|\u0000/iu;

export function isSafeAnnotationText(value: string | null | undefined) {
  return (
    !value || (!unsafeAnnotationText.test(value) && !/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value))
  );
}

function exactPairMatches(changeSet: TideglassChangeSet, input: TideglassAnnotationMutation, chronicleId: string) {
  return (
    changeSet.pair.chronicleId === chronicleId &&
    changeSet.pair.source.editionId === input.sourceEditionId &&
    changeSet.pair.source.editionChecksum === input.sourceEditionChecksum &&
    changeSet.pair.target.editionId === input.targetEditionId &&
    changeSet.pair.target.editionChecksum === input.targetEditionChecksum &&
    changeSet.comparisonPolicyVersion === TIDEGLASS_COMPARISON_POLICY_VERSION
  );
}

function idempotentMutationMatches(
  annotation: TideglassCreatorAnnotation,
  input: TideglassAnnotationMutation,
  chronicleId: string,
) {
  const expectedState = input.operation === "WITHDRAW" ? "WITHDRAWN" : "ACTIVE";
  return (
    annotation.chronicleId === chronicleId &&
    annotation.sourceEditionId === input.sourceEditionId &&
    annotation.sourceEditionChecksum === input.sourceEditionChecksum &&
    annotation.targetEditionId === input.targetEditionId &&
    annotation.targetEditionChecksum === input.targetEditionChecksum &&
    annotation.comparisonPolicyVersion === TIDEGLASS_COMPARISON_POLICY_VERSION &&
    annotation.state === expectedState &&
    annotation.supersedesAnnotationId === (input.supersedesAnnotationId ?? null) &&
    (!input.annotationKey || annotation.annotationKey === input.annotationKey) &&
    (!input.scopeType || annotation.scopeType === input.scopeType) &&
    (input.category === undefined || annotation.category === input.category) &&
    (input.changeRecordId === undefined || annotation.changeRecordId === input.changeRecordId) &&
    (!input.annotationKind || annotation.annotationKind === input.annotationKind) &&
    (input.headline === undefined || annotation.headline === input.headline) &&
    (input.body === undefined || annotation.body === input.body) &&
    (!input.spoilerLevel || annotation.spoilerLevel === input.spoilerLevel) &&
    (input.highlighted === undefined || annotation.highlighted === input.highlighted) &&
    (!input.replayGuidance || annotation.replayGuidance === input.replayGuidance)
  );
}

export async function appendTideglassAnnotation(
  repository: TideglassAnnotationRepository,
  accountId: string,
  chronicleId: string,
  changeSet: TideglassChangeSet,
  uncheckedInput: unknown,
  correlationId = randomUUID(),
): Promise<TideglassAnnotationResult> {
  const parsed = annotationMutationSchema.safeParse(uncheckedInput);
  if (!parsed.success) return failure("ANNOTATION_INVALID", correlationId);
  const input = parsed.data;
  if (!exactPairMatches(changeSet, input, chronicleId)) return failure("ANNOTATION_PAIR_MISMATCH", correlationId);
  if (!isSafeAnnotationText(input.headline) || !isSafeAnnotationText(input.body))
    return failure("ANNOTATION_UNSAFE_TEXT", correlationId);
  if (input.scopeType === "CHANGE" && !changeSet.changes.some((change) => change.id === input.changeRecordId))
    return failure("ANNOTATION_CHANGE_UNAVAILABLE", correlationId);

  const priorIdempotent = await repository.findIdempotent(accountId, input.idempotencyKey);
  if (priorIdempotent)
    return idempotentMutationMatches(priorIdempotent, input, chronicleId)
      ? { ok: true, value: priorIdempotent, idempotent: true, correlationId }
      : failure("ANNOTATION_REVISION_CONFLICT", correlationId);
  const history = await repository.listPair({
    chronicleId,
    sourceEditionId: input.sourceEditionId,
    sourceEditionChecksum: input.sourceEditionChecksum,
    targetEditionId: input.targetEditionId,
    targetEditionChecksum: input.targetEditionChecksum,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
  });
  const prior = input.annotationKey
    ? history
        .filter((annotation) => annotation.annotationKey === input.annotationKey)
        .sort((left, right) => right.revision - left.revision)[0]
    : undefined;
  if (input.operation === "CREATE" ? prior : !prior || prior.id !== input.supersedesAnnotationId)
    return failure("ANNOTATION_REVISION_CONFLICT", correlationId);
  if (prior && prior.createdByAccountId !== accountId) return failure("ANNOTATION_REVISION_CONFLICT", correlationId);
  if (
    prior &&
    input.operation === "REVISE" &&
    (prior.scopeType !== input.scopeType ||
      prior.category !== (input.category ?? null) ||
      prior.changeRecordId !== (input.changeRecordId ?? null))
  )
    return failure("ANNOTATION_REVISION_CONFLICT", correlationId);
  if (prior && input.spoilerLevel) {
    const previousRank = spoilerLevels.indexOf(prior.spoilerLevel);
    const requestedRank = spoilerLevels.indexOf(input.spoilerLevel);
    if (requestedRank < previousRank) return failure("ANNOTATION_INVALID", correlationId);
  }
  if (input.operation !== "WITHDRAW" && input.scopeType !== "PAIR") {
    const related = changeSet.changes.filter((change) =>
      input.scopeType === "CHANGE" ? change.id === input.changeRecordId : change.category === input.category,
    );
    const requiredRank = Math.max(...related.map((change) => spoilerLevels.indexOf(change.spoilerLevel)));
    if (spoilerLevels.indexOf(input.spoilerLevel!) < requiredRank) return failure("ANNOTATION_INVALID", correlationId);
  }

  const inherited = prior;
  const annotationKey = input.annotationKey ?? randomUUID();
  const scopeType = input.operation === "WITHDRAW" ? inherited!.scopeType : input.scopeType!;
  const category = input.operation === "WITHDRAW" ? inherited!.category : (input.category ?? null);
  const changeRecordId = input.operation === "WITHDRAW" ? inherited!.changeRecordId : (input.changeRecordId ?? null);
  const annotationKind = input.operation === "WITHDRAW" ? inherited!.annotationKind : input.annotationKind!;
  const headline = input.operation === "WITHDRAW" ? inherited!.headline : (input.headline ?? null);
  const body = input.operation === "WITHDRAW" ? inherited!.body : (input.body ?? null);
  const spoilerLevel = input.operation === "WITHDRAW" ? inherited!.spoilerLevel : input.spoilerLevel!;
  const highlighted = input.operation === "WITHDRAW" ? inherited!.highlighted : (input.highlighted ?? false);
  const replayGuidance =
    input.operation === "WITHDRAW" ? inherited!.replayGuidance : (input.replayGuidance ?? "NO_RECOMMENDATION");
  try {
    const value = await repository.appendRevision({
      annotationKey,
      chronicleId,
      sourceEditionId: input.sourceEditionId,
      sourceEditionChecksum: input.sourceEditionChecksum,
      targetEditionId: input.targetEditionId,
      targetEditionChecksum: input.targetEditionChecksum,
      comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
      scopeType,
      category,
      changeRecordId,
      annotationKind,
      headline,
      body,
      spoilerLevel,
      highlighted,
      replayGuidance,
      createdByAccountId: accountId,
      supersedesAnnotationId: prior?.id ?? null,
      state: input.operation === "WITHDRAW" ? "WITHDRAWN" : "ACTIVE",
      idempotencyKey: input.idempotencyKey,
      correlationId,
    });
    return { ok: true, value, idempotent: false, correlationId };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return failure(
      /REVISION_CONFLICT|Unique constraint|unique constraint/iu.test(message)
        ? "ANNOTATION_REVISION_CONFLICT"
        : "ANNOTATION_FAILED",
      correlationId,
    );
  }
}

export function currentTideglassAnnotations(history: readonly TideglassCreatorAnnotation[]) {
  const latest = new Map<string, TideglassCreatorAnnotation>();
  for (const annotation of history) {
    const current = latest.get(annotation.annotationKey);
    if (!current || annotation.revision > current.revision) latest.set(annotation.annotationKey, annotation);
  }
  return [...latest.values()]
    .filter((annotation) => annotation.state === "ACTIVE")
    .sort((left, right) =>
      left.createdAt.toString() === right.createdAt.toString()
        ? compareCanonicalStrings(left.id, right.id)
        : compareCanonicalStrings(left.createdAt.toString(), right.createdAt.toString()),
    );
}

export type TideglassAnnotationWarning = {
  code:
    | "TG-ANNOTATION-SIGNIFICANCE-CONTRADICTION"
    | "TG-ANNOTATION-GAMEPLAY-CONTRADICTION"
    | "TG-ANNOTATION-ACCESSIBILITY-CONTRADICTION"
    | "TG-ANNOTATION-MAJOR-OMISSION";
  annotationId: string;
  changeIds: string[];
  category?: ChronicleChangeCategory;
};

export function tideglassAnnotationWarnings(
  changeSet: TideglassChangeSet,
  annotations: readonly TideglassCreatorAnnotation[],
): TideglassAnnotationWarning[] {
  const changes = classifyTideglassChangeSet(changeSet);
  const significance = assessTideglassSignificance(changes, changeSet.status === "PARTIAL");
  const active = currentTideglassAnnotations(annotations);
  const warnings: TideglassAnnotationWarning[] = [];
  for (const annotation of active) {
    const text = `${annotation.headline ?? ""} ${annotation.body ?? ""}`.toLowerCase();
    if (/minor (?:wording|update|change)/u.test(text) && ["MAJOR", "TRANSFORMATIVE"].includes(significance.level))
      warnings.push({
        code: "TG-ANNOTATION-SIGNIFICANCE-CONTRADICTION",
        annotationId: annotation.id,
        changeIds: changes
          .filter((change) => ["MAJOR", "TRANSFORMATIVE"].includes(change.governedSignificance))
          .map((change) => change.id),
      });
    if (/no (?:gameplay|play) changes?/u.test(text)) {
      const gameplay = changes.filter((change) =>
        ["STRUCTURE", "BRANCHING_AND_CHOICES", "ENDING", "COMPLETION", "SETUP_REQUIREMENTS"].includes(change.category),
      );
      if (gameplay.length)
        warnings.push({
          code: "TG-ANNOTATION-GAMEPLAY-CONTRADICTION",
          annotationId: annotation.id,
          changeIds: gameplay.map((change) => change.id),
        });
    }
    if (/accessibility (?:improved|improvement)/u.test(text)) {
      const regressions = changes.filter(isTideglassAccessibilityRegression);
      if (regressions.length)
        warnings.push({
          code: "TG-ANNOTATION-ACCESSIBILITY-CONTRADICTION",
          annotationId: annotation.id,
          changeIds: regressions.map((change) => change.id),
        });
    }
    if (annotation.annotationKind === "HEADLINE") {
      for (const contribution of significance.categoryContributions.filter((item) =>
        ["MAJOR", "TRANSFORMATIVE"].includes(item.level),
      )) {
        const terms = contribution.category.toLowerCase().split("_");
        if (!terms.some((term) => term.length > 3 && text.includes(term)))
          warnings.push({
            code: "TG-ANNOTATION-MAJOR-OMISSION",
            annotationId: annotation.id,
            changeIds: contribution.changeIds,
            category: contribution.category,
          });
      }
    }
  }
  return warnings.sort((left, right) =>
    compareCanonicalStrings(
      `${left.annotationId}:${left.code}:${left.category ?? ""}`,
      `${right.annotationId}:${right.code}:${right.category ?? ""}`,
    ),
  );
}

function row(value: Record<string, unknown>): TideglassCreatorAnnotation {
  return value as TideglassCreatorAnnotation;
}

export const prismaTideglassAnnotationRepository: TideglassAnnotationRepository = {
  async listPair(input) {
    const values = await db.tideglassCreatorAnnotation.findMany({
      where: input,
      orderBy: [{ annotationKey: "asc" }, { revision: "asc" }],
    });
    return values.map((value) => row(value));
  },
  async findIdempotent(accountId, idempotencyKey) {
    const value = await db.tideglassCreatorAnnotation.findFirst({
      where: { createdByAccountId: accountId, idempotencyKey },
    });
    return value ? row(value) : null;
  },
  async appendRevision(input) {
    return db.$transaction(async (transaction) => {
      const prior = input.supersedesAnnotationId
        ? await transaction.tideglassCreatorAnnotation.findUnique({ where: { id: input.supersedesAnnotationId } })
        : null;
      const latest = await transaction.tideglassCreatorAnnotation.findFirst({
        where: { annotationKey: input.annotationKey },
        orderBy: { revision: "desc" },
      });
      if (
        (prior && latest?.id !== prior.id) ||
        (!prior && latest) ||
        (prior &&
          (prior.annotationKey !== input.annotationKey ||
            prior.createdByAccountId !== input.createdByAccountId ||
            prior.chronicleId !== input.chronicleId ||
            prior.sourceEditionId !== input.sourceEditionId ||
            prior.sourceEditionChecksum !== input.sourceEditionChecksum ||
            prior.targetEditionId !== input.targetEditionId ||
            prior.targetEditionChecksum !== input.targetEditionChecksum ||
            prior.comparisonPolicyVersion !== input.comparisonPolicyVersion))
      )
        throw new Error("ANNOTATION_REVISION_CONFLICT");
      const { correlationId, ...data } = input;
      const created = await transaction.tideglassCreatorAnnotation.create({
        data: { ...data, id: randomUUID(), revision: (prior?.revision ?? 0) + 1 },
      });
      await transaction.platformAuditEvent.create({
        data: {
          actorType: "CREATOR",
          actorId: input.createdByAccountId,
          actorAccountId: input.createdByAccountId,
          action:
            input.state === "WITHDRAWN"
              ? "TIDEGLASS_ANNOTATION_WITHDRAWN"
              : prior
                ? "TIDEGLASS_ANNOTATION_SUPERSEDED"
                : "TIDEGLASS_ANNOTATION_CREATED",
          resourceType: "TideglassCreatorAnnotation",
          resourceId: created.id,
          outcome: "SUCCEEDED",
          correlationId,
          metadata: canonicalJson({
            annotationSchemaVersion: TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
            changeCodeRegistryVersion: TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
            annotationKey: input.annotationKey,
            revision: created.revision,
            chronicleId: input.chronicleId,
            sourceEditionId: input.sourceEditionId,
            targetEditionId: input.targetEditionId,
            scopeType: input.scopeType,
            annotationKind: input.annotationKind,
            spoilerLevel: input.spoilerLevel,
            state: input.state,
            contentDigest: semanticDigest({ headline: input.headline, body: input.body }),
          }),
        },
      });
      return row(created);
    });
  },
};

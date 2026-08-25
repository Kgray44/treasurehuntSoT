import projectionPolicy from "../../Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Projection_Policy.json";
import {
  currentTideglassAnnotations,
  tideglassAnnotationWarnings,
  type TideglassCreatorAnnotation,
} from "./annotations";
import {
  TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
  TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
  TIDEGLASS_PROJECTION_POLICY_VERSION,
  TIDEGLASS_SUMMARY_POLICY_VERSION,
  assessTideglassSignificance,
  buildTideglassSummary,
  classifyTideglassChangeSet,
  type TideglassClassifiedChange,
} from "./intelligence";
import {
  emptyCategoryCounts,
  semanticDigest,
  type ChronicleChangeCategory,
  type ComparisonSpoilerLevel,
  type TideglassChangeSet,
  type TideglassComparisonResult,
} from "./core";

export const tideglassAudiences = ["PUBLIC_PREVIEW", "PLAYER_SAFE", "CAPTAIN_SAFE", "CREATOR_FULL"] as const;
export type TideglassAudience = (typeof tideglassAudiences)[number];
export const tideglassSummaryModes = ["CONCISE", "DETAILED"] as const;
export type TideglassSummaryMode = (typeof tideglassSummaryModes)[number];
export type TideglassDisclosureState = "VISIBLE" | "DISCLOSABLE" | "WITHHELD";

function disclosureFor(audience: TideglassAudience, spoiler: ComparisonSpoilerLevel): TideglassDisclosureState {
  return projectionPolicy.audiences[audience][spoiler] as TideglassDisclosureState;
}

function safeUnavailableSection(section: TideglassChangeSet["unsupportedSections"][number]) {
  return {
    section: section.section.split(":")[0],
    code: section.code,
    ...(section.sourceSchemaVersion !== undefined ? { sourceSchemaVersion: section.sourceSchemaVersion } : {}),
  };
}

function safeChange(change: TideglassClassifiedChange, audience: TideglassAudience) {
  const disclosureState = disclosureFor(audience, change.governedSpoilerLevel);
  const base = {
    changeCode: change.changeCode,
    category: change.category,
    kind: change.kind,
    kindLabelKey: `tideglass.change-kind.${change.kind.toLowerCase()}`,
    significance: change.governedSignificance,
    spoilerLevel: change.governedSpoilerLevel,
    disclosureState,
    compatibilityRelevant: change.compatibilityRelevant,
  };
  if (audience !== "CREATOR_FULL") return base;
  return {
    ...base,
    id: change.id,
    entityType: change.entityType,
    entityId: change.entityId,
    sourceEntityId: change.sourceEntityId,
    targetEntityId: change.targetEntityId,
    tags: change.tags,
    evidence: change.evidence,
  };
}

function projectedAnnotation(annotation: TideglassCreatorAnnotation, audience: TideglassAudience) {
  const disclosureState = disclosureFor(audience, annotation.spoilerLevel);
  const base = {
    annotationKind: annotation.annotationKind,
    headline: annotation.headline,
    body: annotation.body,
    spoilerLevel: annotation.spoilerLevel,
    disclosureState,
    highlighted: annotation.highlighted,
    replayGuidance: annotation.replayGuidance,
    scopeType: annotation.scopeType,
    ...(annotation.scopeType === "CATEGORY" ? { category: annotation.category } : {}),
  };
  return audience === "CREATOR_FULL"
    ? {
        ...base,
        id: annotation.id,
        annotationKey: annotation.annotationKey,
        revision: annotation.revision,
        changeRecordId: annotation.changeRecordId,
        state: annotation.state,
      }
    : base;
}

function annotationEligible(
  annotation: TideglassCreatorAnnotation,
  audience: TideglassAudience,
  visibleChangeIds: ReadonlySet<string>,
  visibleCategories: ReadonlySet<ChronicleChangeCategory>,
) {
  if (disclosureFor(audience, annotation.spoilerLevel) === "WITHHELD") return false;
  if (annotation.scopeType === "CHANGE")
    return Boolean(annotation.changeRecordId && visibleChangeIds.has(annotation.changeRecordId));
  if (annotation.scopeType === "CATEGORY")
    return Boolean(annotation.category && visibleCategories.has(annotation.category));
  return true;
}

function projectedChangeSet(source: TideglassChangeSet, changes: TideglassClassifiedChange[]): TideglassChangeSet {
  const categoryCounts = emptyCategoryCounts();
  for (const change of changes) categoryCounts[change.category] += 1;
  return { ...source, changes, categoryCounts };
}

export function projectTideglassComparison(
  result: TideglassComparisonResult,
  audience: TideglassAudience,
  mode: TideglassSummaryMode = "CONCISE",
  history: readonly TideglassCreatorAnnotation[] = [],
) {
  const classified = classifyTideglassChangeSet(result.changeSet);
  const eligible = classified.filter((change) => disclosureFor(audience, change.governedSpoilerLevel) !== "WITHHELD");
  const visibleChangeIds = new Set(eligible.map((change) => change.id));
  const visibleCategories = new Set(eligible.map((change) => change.category));
  const activeAnnotations = currentTideglassAnnotations(history);
  const eligibleAnnotations = activeAnnotations.filter((annotation) =>
    annotationEligible(annotation, audience, visibleChangeIds, visibleCategories),
  );
  const annotations = eligibleAnnotations
    .map((annotation) => projectedAnnotation(annotation, audience))
    .filter((annotation): annotation is NonNullable<typeof annotation> => Boolean(annotation));
  const summary = buildTideglassSummary(projectedChangeSet(result.changeSet, eligible), eligibleAnnotations);
  const hasCanonicalChanges = result.changeSet.changes.length > 0;
  const hasProjectedChanges = eligible.length > 0;
  const headline = !hasProjectedChanges && hasCanonicalChanges ? null : summary.headline;
  const overallSignificance =
    !hasProjectedChanges && hasCanonicalChanges
      ? null
      : assessTideglassSignificance(eligible, result.changeSet.status === "PARTIAL");
  const categoryGroups = summary.categoryGroups.map((group) => {
    const disclosureState = disclosureFor(audience, group.lines[0]?.spoilerLevel ?? "PREVIEW_SAFE");
    return {
      ...group,
      labelKey: `tideglass.category.${group.category.toLowerCase().replaceAll("_", "-")}`,
      disclosureState,
      accessibleDescriptionKey: `tideglass.disclosure.${disclosureState.toLowerCase()}`,
    };
  });
  const projectedCompatibility = summary.compatibility.filter((delta) =>
    delta.sourceChangeIds.every((id) => visibleChangeIds.has(id)),
  );
  const visibleCategoryCounts = emptyCategoryCounts();
  for (const change of eligible) visibleCategoryCounts[change.category] += 1;
  const body = {
    comparisonId: result.changeSet.comparisonId,
    pair: {
      sourceEditionId: result.changeSet.pair.source.editionId,
      targetEditionId: result.changeSet.pair.target.editionId,
    },
    audience,
    mode,
    projectionStatus:
      result.changeSet.status === "NO_MEANINGFUL_CHANGE"
        ? ("NO_MEANINGFUL_CHANGE" as const)
        : result.changeSet.status === "PARTIAL"
          ? ("PARTIAL" as const)
          : hasProjectedChanges
            ? result.changeSet.status
            : ("AVAILABLE" as const),
    policy: {
      semanticSchemaVersion: result.changeSet.semanticSchemaVersion,
      comparisonPolicyVersion: result.changeSet.comparisonPolicyVersion,
      changeCodeRegistryVersion: TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
      projectionPolicyVersion: TIDEGLASS_PROJECTION_POLICY_VERSION,
      summaryPolicyVersion: TIDEGLASS_SUMMARY_POLICY_VERSION,
      annotationSchemaVersion: TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
    },
    visibleChangeCount: eligible.length,
    visibleCategoryCounts,
    changes: mode === "DETAILED" ? eligible.map((change) => safeChange(change, audience)) : [],
    summary: {
      digest: summary.digest,
      headline,
      overallSignificance,
      keyChanges: summary.keyChanges,
      categoryGroups: mode === "DETAILED" ? categoryGroups : [],
      compatibility: projectedCompatibility,
      partial: result.changeSet.status === "PARTIAL",
      unavailableSections:
        audience === "CREATOR_FULL"
          ? result.changeSet.unsupportedSections
          : result.changeSet.unsupportedSections.map(safeUnavailableSection),
    },
    annotations,
    ...(audience === "CREATOR_FULL"
      ? { annotationWarnings: tideglassAnnotationWarnings(result.changeSet, history), receipt: result.receipt }
      : {}),
  };
  return { ...body, projectionDigest: semanticDigest(body) };
}

export function selectTideglassAudience(
  serverMaximum: TideglassAudience,
  requested: TideglassAudience | undefined,
): TideglassAudience {
  const rank = new Map<TideglassAudience, number>([
    ["PUBLIC_PREVIEW", 0],
    ["CAPTAIN_SAFE", 0],
    ["PLAYER_SAFE", 1],
    ["CREATOR_FULL", 2],
  ]);
  if (!requested) return serverMaximum;
  return (rank.get(requested) ?? 0) <= (rank.get(serverMaximum) ?? 0) ? requested : serverMaximum;
}

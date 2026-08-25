import changeCodeRegistry from "../../Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Change_Code_Registry.json";
import projectionPolicy from "../../Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Projection_Policy.json";
import {
  canonicalJson,
  changeCategories,
  compareCanonicalStrings,
  semanticDigest,
  significanceLevels,
  spoilerLevels,
  type ChangeSignificance,
  type ChronicleChangeCategory,
  type ChronicleChangeRecord,
  type ComparisonSpoilerLevel,
  type JsonValue,
  type TideglassChangeSet,
} from "./core";

export const TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION = changeCodeRegistry.registryVersion;
export const TIDEGLASS_PROJECTION_POLICY_VERSION = projectionPolicy.projectionPolicyVersion;
export const TIDEGLASS_SUMMARY_POLICY_VERSION = projectionPolicy.summaryPolicyVersion;
export const TIDEGLASS_ANNOTATION_SCHEMA_VERSION = projectionPolicy.annotationSchemaVersion;

export type TideglassClassifiedChange = ChronicleChangeRecord & {
  changeCode: string;
  governedSignificance: ChangeSignificance;
  governedSpoilerLevel: ComparisonSpoilerLevel;
  compatibilityRelevant: boolean;
  summaryTemplateFamily: string;
};

export type TideglassSignificanceReason = {
  code: string;
  level: ChangeSignificance;
  changeIds: string[];
  changeCodes: string[];
  explanationKey: string;
};

export type TideglassSignificanceAssessment = {
  level: ChangeSignificance;
  reasons: TideglassSignificanceReason[];
  categoryContributions: Array<{
    category: ChronicleChangeCategory;
    level: ChangeSignificance;
    changeIds: string[];
  }>;
  compatibilityCritical: boolean;
  caveats: string[];
};

export const compatibilityDimensions = [
  "PLATFORM",
  "PROVIDER",
  "DEVICE",
  "CAPTAIN",
  "CREW",
  "ACCESSIBILITY",
  "CONTENT_SCHEMA",
  "ASSET_FORMAT",
  "PHYSICAL_REQUIREMENT",
] as const;
export type TideglassCompatibilityDimension = (typeof compatibilityDimensions)[number];

export type TideglassCompatibilityDelta = {
  id: string;
  dimension: TideglassCompatibilityDimension;
  impact:
    | "NONE"
    | "ADDED_REQUIREMENT"
    | "REMOVED_REQUIREMENT"
    | "CHANGED_REQUIREMENT"
    | "POTENTIALLY_BREAKING"
    | "INCOMPATIBLE"
    | "UNKNOWN";
  sourceChangeIds: string[];
  before?: JsonValue;
  after?: JsonValue;
  certainty: "EXACT" | "DECLARED" | "UNKNOWN";
};

export type TideglassSummaryLine = {
  id: string;
  templateKey: string;
  category: ChronicleChangeCategory;
  significance: ChangeSignificance;
  spoilerLevel: ComparisonSpoilerLevel;
  changeIds: string[];
  changeCodes: string[];
  audienceEligibility: Array<"PUBLIC_PREVIEW" | "PLAYER_SAFE" | "CAPTAIN_SAFE" | "CREATOR_FULL">;
  parameters: Record<string, JsonValue>;
};

export type TideglassSummaryGroup = {
  id: string;
  category: ChronicleChangeCategory;
  lines: TideglassSummaryLine[];
};

export type TideglassSummaryAnnotation = {
  id: string;
  annotationKey: string;
  revision: number;
  scopeType: "PAIR" | "CATEGORY" | "CHANGE";
  category: ChronicleChangeCategory | null;
  changeRecordId: string | null;
  annotationKind: "HEADLINE" | "DETAIL" | "COMPATIBILITY" | "LIMITATION" | "REPLAY_GUIDANCE";
  headline: string | null;
  body: string | null;
  spoilerLevel: ComparisonSpoilerLevel;
  highlighted: boolean;
  replayGuidance: "NO_RECOMMENDATION" | "MINOR_UPDATE" | "WORTH_REVISITING" | "SUBSTANTIAL_NEW_CONTENT";
  state: "ACTIVE" | "WITHDRAWN";
};

export type TideglassComparisonSummary = {
  comparisonId: string;
  changeSetDigest: string;
  changeCodeRegistryVersion: string;
  summaryPolicyVersion: string;
  projectionPolicyVersion: string;
  annotationSchemaVersion: string;
  annotationDigest: string;
  overallSignificance: TideglassSignificanceAssessment;
  headline: TideglassSummaryLine;
  keyChanges: TideglassSummaryLine[];
  categoryGroups: TideglassSummaryGroup[];
  compatibility: TideglassCompatibilityDelta[];
  partial: boolean;
  unavailableSections: TideglassChangeSet["unsupportedSections"];
  digest: string;
};

const significanceRank = new Map(significanceLevels.map((level, index) => [level, index]));
const spoilerRank = new Map(spoilerLevels.map((level, index) => [level, index]));
const categoryOrder = new Map(changeCategories.map((category, index) => [category, index]));

function maximumSignificance(values: readonly ChangeSignificance[]): ChangeSignificance {
  return values.reduce(
    (current, candidate) =>
      (significanceRank.get(candidate) ?? 0) > (significanceRank.get(current) ?? 0) ? candidate : current,
    "PRESENTATION_ONLY",
  );
}

function maximumSpoiler(values: readonly ComparisonSpoilerLevel[]): ComparisonSpoilerLevel {
  return values.reduce(
    (current, candidate) => ((spoilerRank.get(candidate) ?? 0) > (spoilerRank.get(current) ?? 0) ? candidate : current),
    "PREVIEW_SAFE",
  );
}

function categoryRule(category: ChronicleChangeCategory) {
  const rule = changeCodeRegistry.categories.find((candidate) => candidate.category === category);
  if (!rule) throw new Error(`UNREGISTERED_TIDEGLASS_CATEGORY:${category}`);
  return rule;
}

function specialization(change: ChronicleChangeRecord) {
  return changeCodeRegistry.specializations.find((candidate) => change.evidence.semanticPath.includes(candidate.match));
}

const emptyAccessibilityDigests = new Set([
  semanticDigest(""),
  semanticDigest(null),
  semanticDigest(false),
  semanticDigest([]),
]);

export function isTideglassAccessibilityRegression(change: ChronicleChangeRecord) {
  return (
    change.category === "ACCESSIBILITY" &&
    (change.kind === "REMOVED" ||
      (change.kind === "MODIFIED" &&
        Boolean(change.evidence.targetSemanticDigest) &&
        emptyAccessibilityDigests.has(change.evidence.targetSemanticDigest!) &&
        !emptyAccessibilityDigests.has(change.evidence.sourceSemanticDigest ?? "")))
  );
}

export function classifyTideglassChange(change: ChronicleChangeRecord): TideglassClassifiedChange {
  const rule = categoryRule(change.category);
  const specialized = specialization(change);
  const suffix = changeCodeRegistry.kindSuffixes[change.kind];
  if (!suffix) throw new Error(`UNREGISTERED_TIDEGLASS_KIND:${change.kind}`);
  const accessibilityRegressionFloor = isTideglassAccessibilityRegression(change) ? "MAJOR" : "PRESENTATION_ONLY";
  return {
    ...change,
    changeCode: specialized?.code ?? `${rule.prefix}-${suffix}`,
    governedSignificance: maximumSignificance([
      change.significance,
      rule.defaultSignificance as ChangeSignificance,
      accessibilityRegressionFloor,
    ]),
    governedSpoilerLevel: maximumSpoiler([change.spoilerLevel, rule.defaultSpoiler as ComparisonSpoilerLevel]),
    compatibilityRelevant: rule.compatibilityRelevant || Boolean(specialized?.compatibilityDimension),
    summaryTemplateFamily: rule.summaryTemplateFamily,
  };
}

export function classifyTideglassChangeSet(changeSet: TideglassChangeSet) {
  return changeSet.changes.map(classifyTideglassChange);
}

function compatibilityDimension(change: TideglassClassifiedChange): TideglassCompatibilityDimension | null {
  const specialized = specialization(change);
  if (specialized?.compatibilityDimension) return specialized.compatibilityDimension as TideglassCompatibilityDimension;
  if (change.category === "ACCESSIBILITY") return "ACCESSIBILITY";
  if (change.category === "MEDIA") return "ASSET_FORMAT";
  if (change.category === "LOCATION_AND_MAP") return "PROVIDER";
  if (change.category === "COMPLETION") return "CAPTAIN";
  if (change.category === "COMPATIBILITY") return "CONTENT_SCHEMA";
  if (change.category === "SETUP_REQUIREMENTS") return "DEVICE";
  if (change.category === "SAFETY_AND_WARNINGS") return "ACCESSIBILITY";
  return null;
}

function compatibilityImpact(change: TideglassClassifiedChange): TideglassCompatibilityDelta["impact"] {
  if ((change.category === "ACCESSIBILITY" || change.category === "SAFETY_AND_WARNINGS") && change.kind === "REMOVED")
    return "POTENTIALLY_BREAKING";
  if (change.kind === "ADDED") return "ADDED_REQUIREMENT";
  if (change.kind === "REMOVED") return "REMOVED_REQUIREMENT";
  if (["MODIFIED", "MOVED", "REWIRED", "REPLACED"].includes(change.kind)) return "CHANGED_REQUIREMENT";
  return "UNKNOWN";
}

export function compatibilityDeltas(changes: readonly TideglassClassifiedChange[]): TideglassCompatibilityDelta[] {
  return changes.flatMap((change) => {
    if (!change.compatibilityRelevant) return [];
    const dimension = compatibilityDimension(change);
    if (!dimension) return [];
    const body = {
      dimension,
      impact: compatibilityImpact(change),
      sourceChangeIds: [change.id],
      ...(change.evidence.sourceSemanticDigest
        ? { before: { semanticDigest: change.evidence.sourceSemanticDigest } as JsonValue }
        : {}),
      ...(change.evidence.targetSemanticDigest
        ? { after: { semanticDigest: change.evidence.targetSemanticDigest } as JsonValue }
        : {}),
      certainty: "EXACT" as const,
    };
    return [{ id: semanticDigest({ policy: TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION, ...body }), ...body }];
  });
}

export function assessTideglassSignificance(
  changes: readonly TideglassClassifiedChange[],
  partial = false,
): TideglassSignificanceAssessment {
  const byCategory = new Map<ChronicleChangeCategory, TideglassClassifiedChange[]>();
  for (const change of changes) byCategory.set(change.category, [...(byCategory.get(change.category) ?? []), change]);
  const categoryContributions = [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      level: maximumSignificance(items.map((item) => item.governedSignificance)),
      changeIds: items.map((item) => item.id),
    }))
    .sort((left, right) => (categoryOrder.get(left.category) ?? 999) - (categoryOrder.get(right.category) ?? 999));
  let level = maximumSignificance(changes.map((change) => change.governedSignificance));
  const majorCategories = categoryContributions.filter(
    (item) => (significanceRank.get(item.level) ?? 0) >= (significanceRank.get("MAJOR") ?? 3),
  );
  const transformative =
    majorCategories.length >= 3 &&
    majorCategories.some((item) => ["STRUCTURE", "BRANCHING_AND_CHOICES", "ENDING"].includes(item.category));
  if (transformative) level = "TRANSFORMATIVE";
  const reasons = categoryContributions.map((contribution) => {
    const items = byCategory.get(contribution.category) ?? [];
    return {
      code: `TG-SIGNIFICANCE-${contribution.category}`,
      level: contribution.level,
      changeIds: items.map((item) => item.id),
      changeCodes: [...new Set(items.map((item) => item.changeCode))].sort(compareCanonicalStrings),
      explanationKey: `tideglass.significance.${contribution.category.toLowerCase()}`,
    };
  });
  if (transformative)
    reasons.unshift({
      code: "TG-SIGNIFICANCE-TRANSFORMATIVE-CROSS-SYSTEM",
      level: "TRANSFORMATIVE",
      changeIds: majorCategories.flatMap((item) => item.changeIds),
      changeCodes: [...new Set(changes.map((item) => item.changeCode))].sort(compareCanonicalStrings),
      explanationKey: "tideglass.significance.transformative-cross-system",
    });
  const deltas = compatibilityDeltas(changes);
  return {
    level,
    reasons,
    categoryContributions,
    compatibilityCritical: deltas.some(
      (delta) =>
        ["ADDED_REQUIREMENT", "POTENTIALLY_BREAKING", "INCOMPATIBLE", "UNKNOWN"].includes(delta.impact) ||
        ["PLATFORM", "PROVIDER", "DEVICE", "ACCESSIBILITY", "PHYSICAL_REQUIREMENT"].includes(delta.dimension),
    ),
    caveats: partial ? ["TG-CAVEAT-PARTIAL-SEMANTICS"] : [],
  };
}

function eligibility(spoilerLevel: ComparisonSpoilerLevel): TideglassSummaryLine["audienceEligibility"] {
  const audiences = ["PUBLIC_PREVIEW", "PLAYER_SAFE", "CAPTAIN_SAFE", "CREATOR_FULL"] as const;
  return audiences.filter((audience) => projectionPolicy.audiences[audience][spoilerLevel] !== "WITHHELD");
}

function summaryLine(
  templateKey: string,
  category: ChronicleChangeCategory,
  changes: readonly TideglassClassifiedChange[],
  parameters: Record<string, JsonValue>,
): TideglassSummaryLine {
  const changeIds = changes.map((change) => change.id);
  const changeCodes = [...new Set(changes.map((change) => change.changeCode))].sort(compareCanonicalStrings);
  const significance = maximumSignificance(changes.map((change) => change.governedSignificance));
  const spoilerLevel = maximumSpoiler(changes.map((change) => change.governedSpoilerLevel));
  return {
    id: semanticDigest({
      summaryPolicyVersion: TIDEGLASS_SUMMARY_POLICY_VERSION,
      templateKey,
      category,
      changeIds,
      changeCodes,
      parameters,
    }),
    templateKey,
    category,
    significance,
    spoilerLevel,
    changeIds,
    changeCodes,
    audienceEligibility: eligibility(spoilerLevel),
    parameters,
  };
}

export function annotationDigest(annotations: readonly TideglassSummaryAnnotation[]) {
  const latest = new Map<string, TideglassSummaryAnnotation>();
  for (const annotation of annotations) {
    const current = latest.get(annotation.annotationKey);
    if (!current || annotation.revision > current.revision) latest.set(annotation.annotationKey, annotation);
  }
  return semanticDigest(
    [...latest.values()]
      .filter((annotation) => annotation.state === "ACTIVE")
      .sort((left, right) =>
        compareCanonicalStrings(`${left.annotationKey}:${left.revision}`, `${right.annotationKey}:${right.revision}`),
      )
      .map((annotation) => ({
        id: annotation.id,
        annotationKey: annotation.annotationKey,
        revision: annotation.revision,
        scopeType: annotation.scopeType,
        category: annotation.category,
        changeRecordId: annotation.changeRecordId,
        annotationKind: annotation.annotationKind,
        headline: annotation.headline,
        body: annotation.body,
        spoilerLevel: annotation.spoilerLevel,
        highlighted: annotation.highlighted,
        replayGuidance: annotation.replayGuidance,
      })),
  );
}

export function buildTideglassSummary(
  changeSet: TideglassChangeSet,
  annotations: readonly TideglassSummaryAnnotation[] = [],
): TideglassComparisonSummary {
  const classified = classifyTideglassChangeSet(changeSet);
  const assessment = assessTideglassSignificance(classified, changeSet.status === "PARTIAL");
  const groups = changeCategories.flatMap((category) => {
    const items = classified.filter((change) => change.category === category);
    if (!items.length) return [];
    const family = items[0].summaryTemplateFamily;
    const line = summaryLine(`tideglass.summary.category.${family}`, category, items, {
      count: items.length,
      kinds: [...new Set(items.map((item) => item.kind))].sort(compareCanonicalStrings),
    });
    return [{ id: semanticDigest({ category, lineId: line.id }), category, lines: [line] }];
  });
  const allChanges = classified;
  const headline =
    changeSet.status === "NO_MEANINGFUL_CHANGE"
      ? summaryLine("tideglass.summary.no-meaningful-change", "PRESENTATION_METADATA", [], { status: changeSet.status })
      : summaryLine(
          changeSet.status === "PARTIAL" ? "tideglass.summary.partial" : "tideglass.summary.overall",
          groups[0]?.category ?? "PRESENTATION_METADATA",
          allChanges,
          { status: changeSet.status, visibleChangeCount: allChanges.length },
        );
  const activeAnnotationDigest = annotationDigest(annotations);
  const body = {
    comparisonId: changeSet.comparisonId,
    changeSetDigest: changeSet.deterministicDigest,
    changeCodeRegistryVersion: TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
    summaryPolicyVersion: TIDEGLASS_SUMMARY_POLICY_VERSION,
    projectionPolicyVersion: TIDEGLASS_PROJECTION_POLICY_VERSION,
    annotationSchemaVersion: TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
    annotationDigest: activeAnnotationDigest,
    overallSignificance: assessment,
    headline,
    keyChanges: groups.slice(0, 5).flatMap((group) => group.lines),
    categoryGroups: groups,
    compatibility: compatibilityDeltas(classified),
    partial: changeSet.status === "PARTIAL",
    unavailableSections: changeSet.unsupportedSections,
  };
  return { ...body, digest: semanticDigest(body) };
}

export function canonicalSummaryJson(summary: TideglassComparisonSummary) {
  return canonicalJson(summary);
}

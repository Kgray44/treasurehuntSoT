import type { DrydockIssueCategory, DrydockIssueSeverity } from "@/drydock/issues";

export type DrydockRuleDefinition = {
  code: string;
  version: 1;
  category: DrydockIssueCategory;
  defaultSeverity: DrydockIssueSeverity;
  waiverPolicy: "NEVER" | "REVIEW_REQUIRED";
  title: string;
  summary: string;
  technicalExplanation: string;
  affectedSchemaRange: { minimum: 1; maximum: 2 };
  affectedBlockFamilies: readonly string[];
  applicability: "INCREMENTAL" | "FULL" | "BOTH";
  semanticLocationType: "CHRONICLE" | "BLOCK" | "VARIABLE" | "FIELD";
  repairClassification:
    | "SAFE_AUTOMATIC"
    | "REVIEW_REQUIRED"
    | "MANUAL"
    | "ARCHITECTURAL"
    | "NOT_REPAIRABLE_AUTOMATICALLY";
  compatibilityPolicy: "CURRENT_SCHEMA_ONLY" | "MIGRATION_REQUIRED" | "UNSUPPORTED";
  documentationReference: string;
  testIds: readonly string[];
};

const neverWaivableCategories: readonly DrydockIssueCategory[] = [
  "SCHEMA",
  "REFERENCE",
  "MIGRATION",
  "COMPATIBILITY",
  "EXTENSION",
  "PRIVACY",
  "PROVIDER",
  "PROVIDER_CONTRACT",
];

type RuleInput = Pick<DrydockRuleDefinition, "code" | "category" | "defaultSeverity" | "summary"> &
  Partial<
    Omit<DrydockRuleDefinition, "code" | "version" | "waiverPolicy" | "category" | "defaultSeverity" | "summary">
  >;

/** The catalog is executable authority: all report issues use its code/version/policy contract. */
export function ruleDefinition(input: RuleInput): DrydockRuleDefinition {
  const scope =
    input.category === "GRAPH" ||
    input.category === "STATE" ||
    input.category === "ASSET" ||
    input.category === "ACCESSIBILITY" ||
    input.category === "PRIVACY"
      ? "FULL"
      : "BOTH";
  return {
    ...input,
    version: 1,
    waiverPolicy:
      input.defaultSeverity === "ERROR" || neverWaivableCategories.includes(input.category)
        ? "NEVER"
        : "REVIEW_REQUIRED",
    title:
      input.title ??
      input.code
        .replace(/^DRYDOCK_/, "")
        .split("_")
        .map((word) => `${word.slice(0, 1)}${word.slice(1).toLowerCase()}`)
        .join(" "),
    technicalExplanation:
      input.technicalExplanation ??
      `Static Drydock rule ${input.code} evaluated against the canonical Chronicle snapshot.`,
    affectedSchemaRange: input.affectedSchemaRange ?? { minimum: 1, maximum: 2 },
    affectedBlockFamilies: input.affectedBlockFamilies ?? ["CANONICAL_CHRONICLE"],
    applicability: input.applicability ?? scope,
    semanticLocationType:
      input.semanticLocationType ??
      (input.category === "STATE" ? "VARIABLE" : input.category === "GRAPH" ? "BLOCK" : "FIELD"),
    repairClassification:
      input.repairClassification ?? (input.defaultSeverity === "WARNING" ? "REVIEW_REQUIRED" : "MANUAL"),
    compatibilityPolicy: input.compatibilityPolicy ?? "CURRENT_SCHEMA_ONLY",
    documentationReference: input.documentationReference ?? "Development_Docs/Projects/Project Drydock/README.md",
    testIds: input.testIds ?? [`phase2:${input.code.toLowerCase()}`],
  };
}

export const drydockRuleCatalog = [
  ruleDefinition({
    code: "DRYDOCK_BLOCK_ID_DUPLICATE",
    category: "REFERENCE",
    defaultSeverity: "ERROR",
    summary: "A Chronicle contains the same stable Passage ID more than once.",
    semanticLocationType: "BLOCK",
  }),
  ruleDefinition({
    code: "DRYDOCK_BLOCK_TYPE_UNSUPPORTED",
    category: "COMPATIBILITY",
    defaultSeverity: "ERROR",
    summary: "A Passage type has no current canonical Drydock contract.",
    compatibilityPolicy: "UNSUPPORTED",
  }),
  ruleDefinition({
    code: "DRYDOCK_BLOCK_VERSION_UNSUPPORTED",
    category: "COMPATIBILITY",
    defaultSeverity: "ERROR",
    summary: "A Passage schema version is outside the supported reader range.",
    compatibilityPolicy: "UNSUPPORTED",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONNECTION_POLICY_INVALID",
    category: "REFERENCE",
    defaultSeverity: "ERROR",
    summary: "A Passage connection set violates its canonical connection policy.",
  }),
  ruleDefinition({
    code: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT",
    category: "COMPATIBILITY",
    defaultSeverity: "ERROR",
    summary: "A legacy next-target mirror disagrees with canonical BlockConnection authority.",
    compatibilityPolicy: "MIGRATION_REQUIRED",
    repairClassification: "SAFE_AUTOMATIC",
  }),
  ruleDefinition({
    code: "DRYDOCK_CHOICE_TARGET_AUTHORITY_CONFLICT",
    category: "COMPATIBILITY",
    defaultSeverity: "ERROR",
    summary: "Choice target compatibility fields disagree with canonical BlockConnection authority.",
    compatibilityPolicy: "MIGRATION_REQUIRED",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONDITION_TARGET_AUTHORITY_CONFLICT",
    category: "COMPATIBILITY",
    defaultSeverity: "ERROR",
    summary: "Condition target compatibility fields disagree with canonical BlockConnection authority.",
    compatibilityPolicy: "MIGRATION_REQUIRED",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_PROVIDER_UNREGISTERED",
    category: "PROVIDER_CONTRACT",
    defaultSeverity: "ERROR",
    summary: "A completion provider has no registered contract.",
    compatibilityPolicy: "UNSUPPORTED",
  }),
  ruleDefinition({
    code: "DRYDOCK_PROVIDER_NOT_CONFIGURED",
    category: "PROVIDER_CONTRACT",
    defaultSeverity: "ERROR",
    summary: "A selected provider has no configured static-validation adapter.",
    compatibilityPolicy: "UNSUPPORTED",
  }),
  ruleDefinition({
    code: "DRYDOCK_MIGRATION_PATH_MISSING",
    category: "MIGRATION",
    defaultSeverity: "ERROR",
    summary: "No governed migration path reaches the current block contract.",
    compatibilityPolicy: "MIGRATION_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_MIGRATION_WARNING",
    category: "MIGRATION",
    defaultSeverity: "WARNING",
    summary: "A governed migration completed with a compatibility warning.",
    compatibilityPolicy: "MIGRATION_REQUIRED",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXTENSION_ENVELOPE_INVALID",
    category: "EXTENSION",
    defaultSeverity: "ERROR",
    summary: "An extension envelope does not satisfy the registered typed shape.",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXTENSION_NAMESPACE_UNREGISTERED",
    category: "EXTENSION",
    defaultSeverity: "ERROR",
    summary: "An extension namespace is not registered for this Chronicle contract.",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXTENSION_PAYLOAD_INVALID",
    category: "EXTENSION",
    defaultSeverity: "ERROR",
    summary: "An extension payload does not satisfy its registered contract.",
  }),
  ruleDefinition({
    code: "DRYDOCK_REFERENCE_TARGET_MISSING",
    category: "REFERENCE",
    defaultSeverity: "ERROR",
    summary: "A canonical connection references a missing Passage.",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_DECLARATION_INVALID",
    category: "VARIABLE_DECLARATION",
    defaultSeverity: "ERROR",
    summary: "A variable declaration does not satisfy the typed variable contract.",
    semanticLocationType: "VARIABLE",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_DUPLICATE",
    category: "VARIABLE_DECLARATION",
    defaultSeverity: "ERROR",
    summary: "Variable IDs or Creator-readable names are duplicated.",
    semanticLocationType: "VARIABLE",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_WRITE_UNDECLARED",
    category: "VARIABLE_DECLARATION",
    defaultSeverity: "ERROR",
    summary: "A Set Variable Passage references no declared stable variable.",
    semanticLocationType: "VARIABLE",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_WRITE_TYPE",
    category: "VARIABLE_TYPE",
    defaultSeverity: "ERROR",
    summary: "A variable write value is incompatible with its declared type.",
    semanticLocationType: "VARIABLE",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_SCHEMA_INVALID",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "A typed expression does not satisfy the versioned canonical expression schema.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_DEPTH_LIMIT",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An expression exceeds the governed nesting-depth limit.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_NODE_LIMIT",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An expression exceeds the governed node-count limit.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_SIZE_LIMIT",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An expression exceeds the governed serialized-size limit.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_LITERAL_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An expression literal does not match its declared typed value.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_VARIABLE_UNKNOWN",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An expression references a variable that is not declared by the Chronicle.",
    semanticLocationType: "VARIABLE",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_COMPARE_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "Expression comparison operands have incompatible types.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_ORDER_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "An ordered expression comparison does not use numeric operands.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_LOGICAL_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "A logical expression operand is not Boolean.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_NOT_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "A NOT expression operand is not Boolean.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_CONTAINS_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "A contains expression does not use a string-set source and string value.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_EXPRESSION_COUNT_TYPE",
    category: "EXPRESSION",
    defaultSeverity: "ERROR",
    summary: "A count expression source is not a string set.",
    semanticLocationType: "FIELD",
  }),
  ruleDefinition({
    code: "DRYDOCK_GRAPH_ENTRY_MISSING",
    category: "GRAPH",
    defaultSeverity: "ERROR",
    summary: "A Chronicle requires an entry Passage.",
  }),
  ruleDefinition({
    code: "DRYDOCK_GRAPH_TERMINAL_MISSING",
    category: "GRAPH",
    defaultSeverity: "ERROR",
    summary: "A Chronicle requires a Voyage Complete terminal.",
  }),
  ruleDefinition({
    code: "DRYDOCK_GRAPH_UNREACHABLE",
    category: "GRAPH",
    defaultSeverity: "ERROR",
    summary: "A Passage has no syntactic entry path.",
  }),
  ruleDefinition({
    code: "DRYDOCK_GRAPH_NO_TERMINAL_PATH",
    category: "GRAPH",
    defaultSeverity: "ERROR",
    summary: "A reachable Passage cannot statically reach a terminal.",
  }),
  ruleDefinition({
    code: "DRYDOCK_GRAPH_AUTOMATIC_LOOP",
    category: "GRAPH",
    defaultSeverity: "ERROR",
    summary: "A cycle has no static exit.",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN",
    category: "CONTROL_FLOW",
    defaultSeverity: "WARNING",
    summary: "A legacy edge condition cannot be statically proven by the governed typed-expression adapter.",
    applicability: "FULL",
    semanticLocationType: "FIELD",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_STATE_PROOF_INCOMPLETE",
    category: "STATE",
    defaultSeverity: "WARNING",
    summary: "The explicit state-proof bound was reached.",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_NOT_DEFINITELY_INITIALIZED",
    category: "STATE",
    defaultSeverity: "ERROR",
    summary: "A variable lacks initialization on every path.",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_UNUSED",
    category: "STATE",
    defaultSeverity: "WARNING",
    summary: "A declared variable has no static Chronicle consumer or writer.",
  }),
  ruleDefinition({
    code: "DRYDOCK_VARIABLE_WRITE_NEVER_READ",
    category: "STATE",
    defaultSeverity: "WARNING",
    summary: "A variable write has no static Chronicle consumer.",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONDITION_EXPRESSION_NOT_BOOLEAN",
    category: "STATE",
    defaultSeverity: "ERROR",
    summary: "A Condition Passage expression does not resolve to Boolean.",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONDITION_ALWAYS_TRUE",
    category: "STATE",
    defaultSeverity: "WARNING",
    summary: "A condition is provably always true from immutable default state.",
  }),
  ruleDefinition({
    code: "DRYDOCK_CONDITION_ALWAYS_FALSE",
    category: "STATE",
    defaultSeverity: "WARNING",
    summary: "A condition is provably always false from immutable default state.",
  }),
  ruleDefinition({
    code: "DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP",
    category: "CONTENT",
    defaultSeverity: "ERROR",
    summary: "A nonrepeatable authored effect occurs inside a repeatable graph cycle.",
    applicability: "FULL",
    repairClassification: "ARCHITECTURAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_PROVIDER_REQUEST_REPEATS_IN_LOOP",
    category: "PROVIDER",
    defaultSeverity: "WARNING",
    summary: "A provider request occurs inside a repeatable graph cycle.",
    applicability: "FULL",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_ARTIFACT_GRANT_DUPLICATE_RISK",
    category: "CONTENT",
    defaultSeverity: "WARNING",
    summary: "Multiple authored effects can grant the same artifact.",
    applicability: "FULL",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_COMPLETION_OUTCOME_DUPLICATE_RISK",
    category: "CONTENT",
    defaultSeverity: "WARNING",
    summary: "Multiple completion effects map to one outcome ID.",
    applicability: "FULL",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_BLOCK_COUNT_HIGH",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "The Chronicle approaches the static block-count review threshold.",
    applicability: "FULL",
    repairClassification: "ARCHITECTURAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_EDGE_COUNT_HIGH",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "The Chronicle approaches the static edge-count review threshold.",
    applicability: "FULL",
    repairClassification: "ARCHITECTURAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_VARIABLE_COUNT_HIGH",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "The Chronicle approaches the static variable-count review threshold.",
    applicability: "FULL",
    repairClassification: "ARCHITECTURAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_STATE_COMPLEXITY_HIGH",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "The graph and variable catalog have high bounded-analysis complexity.",
    applicability: "FULL",
    repairClassification: "ARCHITECTURAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_FAN_OUT_HIGH",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "A Passage has high authored branching fan-out.",
    applicability: "FULL",
    repairClassification: "REVIEW_REQUIRED",
  }),
  ruleDefinition({
    code: "DRYDOCK_PERFORMANCE_EXPRESSION_NEAR_LIMIT",
    category: "PERFORMANCE",
    defaultSeverity: "WARNING",
    summary: "A typed expression approaches its hard complexity limit.",
    applicability: "FULL",
    repairClassification: "MANUAL",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_PROOF_INCOMPLETE",
    category: "ASSET",
    defaultSeverity: "WARNING",
    summary: "The full asset snapshot was unavailable.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_REQUIRED_MISSING",
    category: "ASSET",
    defaultSeverity: "ERROR",
    summary: "A required asset reference is missing.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_REFERENCE_MISSING",
    category: "ASSET",
    defaultSeverity: "ERROR",
    summary: "An asset reference is absent from the snapshot.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_MEDIA_TYPE",
    category: "ASSET",
    defaultSeverity: "ERROR",
    summary: "An asset media type is incompatible.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_PRIVACY",
    category: "PRIVACY",
    defaultSeverity: "ERROR",
    summary: "A private asset enters a player-safe surface.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ASSET_NOT_READY",
    category: "ASSET",
    defaultSeverity: "ERROR",
    summary: "An asset has no ready delivery variant.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_IMAGE_TEXT_ALTERNATIVE",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "An image lacks its required text alternative.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_VIDEO_CAPTIONS",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "A cinematic lacks required captions.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_MOTION_MEANING",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "A visual transformation lacks a non-motion equivalent.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_VIDEO_NON_MOTION_MEANING",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "A cinematic lacks a non-motion meaning equivalent.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_AUDIO_TRANSCRIPT",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "Audio lacks its required transcript.",
  }),
  ruleDefinition({
    code: "DRYDOCK_ACCESS_PROVIDER_FALLBACK",
    category: "ACCESSIBILITY",
    defaultSeverity: "ERROR",
    summary: "A provider lacks an accessible fallback.",
  }),
] as const;

export function getDrydockRuleDefinition(code: string) {
  return drydockRuleCatalog.find((rule) => rule.code === code);
}

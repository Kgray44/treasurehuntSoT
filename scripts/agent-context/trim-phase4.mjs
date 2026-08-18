import { createHash } from "node:crypto";

export const PHASE4_SCHEMA_VERSION = "1.0";
export const ESTIMATOR_VERSION = "project-trim-usage-estimator-1.0";
export const ACCOUNTING_HIERARCHY = ["EXACT", "RECONSTRUCTED", "CALIBRATED_ESTIMATE", "COARSE_ESTIMATE", "UNAVAILABLE"];

const utf8Bytes = (value) => Buffer.byteLength(String(value ?? ""), "utf8");
const words = (value) =>
  String(value ?? "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
const rounded = (value) => Math.round(value / 100) * 100;
const forbiddenTelemetryKeys =
  /(?:secret|password|credential|cookie|authorization|private.?key|raw.?prompt|transcript)/iu;
const duplicationMarkers = [
  "context expansion is not scope expansion",
  "sounding line remains release authority",
  "generic git/worktree hygiene",
  "generic test workflow",
  "generic privacy rules",
];

export const CALIBRATION_CORPUS_V1 = Object.freeze([
  { id: "E1", taskClass: "DENSE_CONTINUATION", exactTokens: 81156, durationMinutes: 4 + 2 / 60 },
  { id: "E2", taskClass: "DENSE_CONTINUATION", exactTokens: 187806, durationMinutes: 8 + 13 / 60 },
  { id: "E3", taskClass: "WAIT_MONITOR_HEAVY", exactTokens: 136326, durationMinutes: 25 + 34 / 60 },
  { id: "E4", taskClass: "MIXED_ENGINEERING", exactTokens: 619819, durationMinutes: 57 + 56 / 60 },
  { id: "E5", taskClass: "MIXED_ENGINEERING", exactTokens: 1050704, durationMinutes: 119 },
  { id: "E6", taskClass: "MIXED_ENGINEERING", exactTokens: 1957467, durationMinutes: 218 },
  { id: "E7", taskClass: "MIXED_ENGINEERING", exactTokens: 5850280, durationMinutes: 550 },
]);

export const BUDGET_BANDS = Object.freeze({
  NARROW: { target: 200000, warning: 300000, review: 450000 },
  ORDINARY: { target: 450000, warning: 700000, review: 1000000 },
  HIGH_RISK: { target: 750000, warning: 1100000, review: 1600000 },
  LARGE_CLOSURE: { comparableBaselineRequired: true, warningMultiplier: 1, reviewMultiplier: 1.25 },
});

const taskBand = (taskClass) => {
  if (["bug-repair", "documentation-only", "record-only", "tight-continuation"].includes(taskClass)) return "NARROW";
  if (["integration", "security-sensitive", "high-risk"].includes(taskClass)) return "HIGH_RISK";
  if (["release-closure", "large-closure"].includes(taskClass)) return "LARGE_CLOSURE";
  return "ORDINARY";
};
const rateFor = (activityRegime) =>
  ({
    DENSE_CONTINUATION: { rate: 21500, low: 0.65, high: 1.4, confidence: "MEDIUM" },
    MIXED_ENGINEERING: { rate: 9000, low: 0.55, high: 1.55, confidence: "MEDIUM" },
    WAIT_MONITOR_HEAVY: { rate: 6000, low: 0.4, high: 1.8, confidence: "LOW" },
  })[activityRegime] ?? { rate: 9000, low: 0.55, high: 1.55, confidence: "MEDIUM" };

function ensureNoPrivateTelemetry(value, key = "") {
  if (forbiddenTelemetryKeys.test(key)) throw new Error(`TELEMETRY_PRIVATE_FIELD_REJECTED:${key}`);
  if (Array.isArray(value)) return value.forEach((entry) => ensureNoPrivateTelemetry(entry));
  if (value && typeof value === "object")
    Object.entries(value).forEach(([childKey, childValue]) => ensureNoPrivateTelemetry(childValue, childKey));
}

export function createTaskContract(input = {}) {
  if (!input.project || !input.increment || !input.title) throw new Error("TASK_CONTRACT_IDENTITY_REQUIRED");
  if (!["STANDARD_AUTONOMOUS", "UNATTENDED_CONTINUATION"].includes(input.executionProfile))
    throw new Error("TASK_CONTRACT_EXECUTION_PROFILE_INVALID");
  if (!Array.isArray(input.uniqueScope) || !input.uniqueScope.length)
    throw new Error("TASK_CONTRACT_UNIQUE_SCOPE_REQUIRED");
  if (!Array.isArray(input.deliverables) || !input.deliverables.length)
    throw new Error("TASK_CONTRACT_DELIVERABLES_REQUIRED");
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    kind: "PROJECT_TRIM_SHORT_TASK_CONTRACT",
    project: input.project,
    increment: input.increment,
    title: input.title,
    executionProfile: input.executionProfile,
    packetRequired: true,
    uniqueScope: [...input.uniqueScope],
    uniqueNonGoals: [...(input.uniqueNonGoals ?? [])],
    specialAuthorization: input.specialAuthorization ?? null,
    deliverables: [...input.deliverables],
    completionAuthority: "CURRENT_REPOSITORY_GUIDANCE_PROJECT_TRIM_AND_SOUNDING_LINE",
  };
}

export function inspectTaskContract(contract) {
  const material = [
    ...(contract.uniqueScope ?? []),
    ...(contract.uniqueNonGoals ?? []),
    ...(contract.deliverables ?? []),
  ].join("\n");
  const duplicatedPermanentContent = duplicationMarkers.filter((marker) => material.toLowerCase().includes(marker));
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    promptBytes: utf8Bytes(material),
    words: words(material),
    estimatedTokens: Math.ceil(utf8Bytes(material) / 4),
    duplicatedPermanentContent,
    uniqueRequirementsRetained: Array.isArray(contract.uniqueScope) && contract.uniqueScope.length > 0,
    authorityRequirementsRetained:
      contract.completionAuthority === "CURRENT_REPOSITORY_GUIDANCE_PROJECT_TRIM_AND_SOUNDING_LINE",
    nonGoalsRetained: Array.isArray(contract.uniqueNonGoals),
    completionRequirementsRetained: Array.isArray(contract.deliverables) && contract.deliverables.length > 0,
    bloatWarning: utf8Bytes(material) > 8000 && !contract.detailedPromptJustified,
    hardCharacterLimit: null,
  };
}

export function comparePromptContracts({ legacy, compact }) {
  const compactInspection = inspectTaskContract(compact);
  const legacyBytes = utf8Bytes(legacy);
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    legacy: { promptBytes: legacyBytes, words: words(legacy), estimatedTokens: Math.ceil(legacyBytes / 4) },
    compact: compactInspection,
    promptByteReductionPercent: legacyBytes
      ? Math.round(((legacyBytes - compactInspection.promptBytes) / legacyBytes) * 1000) / 10
      : null,
    equivalence: {
      uniqueRequirementsRetained: compactInspection.uniqueRequirementsRetained,
      authorityRequirementsRetained: compactInspection.authorityRequirementsRetained,
      nonGoalsRetained: compactInspection.nonGoalsRetained,
      completionRequirementsRetained: compactInspection.completionRequirementsRetained,
      result:
        compactInspection.uniqueRequirementsRetained &&
        compactInspection.authorityRequirementsRetained &&
        compactInspection.nonGoalsRetained &&
        compactInspection.completionRequirementsRetained
          ? "PASS"
          : "FAIL",
    },
  };
}

export function estimateUsage(input = {}) {
  if (Number.isFinite(input.exactTokens) && input.exactTokens >= 0)
    return {
      accountingMethod: "EXACT",
      exactTokens: input.exactTokens,
      pointEstimate: null,
      lowEstimate: null,
      highEstimate: null,
      confidence: "EXACT",
      estimatorVersion: null,
      provenance: input.provenance ?? "Official/platform-exposed aggregate goal total",
      evidenceInputs: input.evidenceInputs ?? [],
      modifiers: input.modifiers ?? [],
      caveats: ["Exact aggregate is not component-level attribution."],
    };
  if (input.accountingMethod === "RECONSTRUCTED" && Number.isFinite(input.pointEstimate) && input.pointEstimate > 0)
    return {
      accountingMethod: "RECONSTRUCTED",
      exactTokens: null,
      pointEstimate: input.pointEstimate,
      lowEstimate: input.lowEstimate ?? Math.floor(input.pointEstimate * 0.7),
      highEstimate: input.highEstimate ?? Math.ceil(input.pointEstimate * 1.3),
      confidence: input.confidence ?? "LOW",
      estimatorVersion: null,
      provenance: input.provenance ?? "Reconstructed retained transcript/tool/context coverage; not official billing.",
      evidenceInputs: input.evidenceInputs ?? [],
      includedSurfaces: input.includedSurfaces ?? [],
      missingSurfaces: input.missingSurfaces ?? [],
      modifiers: input.modifiers ?? [],
      caveats: ["Reconstruction is not official billing."],
    };
  if (Number.isFinite(input.durationMinutes) && input.durationMinutes > 0) {
    const band = rateFor(input.activityRegime);
    const calibratedRate =
      Number.isFinite(input.rateOverride) && input.rateOverride > 0 ? input.rateOverride : band.rate;
    const modifier = Number.isFinite(input.modifier) && input.modifier > 0 ? input.modifier : 1;
    const point = rounded(calibratedRate * input.durationMinutes * modifier);
    if (input.accountingMethod === "COARSE_ESTIMATE")
      return {
        accountingMethod: "COARSE_ESTIMATE",
        exactTokens: null,
        pointEstimate: point,
        lowEstimate: Math.max(1, rounded(point * 0.35)),
        highEstimate: rounded(point * 2),
        confidence: "LOW",
        estimatorVersion: ESTIMATOR_VERSION,
        provenance: "Limited metadata coarse estimate; not official billing.",
        evidenceInputs: input.evidenceInputs ?? [],
        modifiers: input.modifiers ?? [],
        caveats: ["Deliberately wide range because activity classification is weak."],
      };
    return {
      accountingMethod: "CALIBRATED_ESTIMATE",
      exactTokens: null,
      pointEstimate: point,
      lowEstimate: Math.max(1, rounded(point * band.low)),
      highEstimate: rounded(point * band.high),
      confidence: band.confidence,
      estimatorVersion: ESTIMATOR_VERSION,
      activityRegime: input.activityRegime ?? "MIXED_ENGINEERING",
      provenance: "Versioned activity-band estimate; not official billing.",
      evidenceInputs: input.evidenceInputs ?? [],
      modifiers: input.modifiers ?? [],
      comparableTaskClass: input.comparableTaskClass ?? null,
      caveats: ["Activity bands are an interpretable calibration, not a universal duration multiplier."],
    };
  }
  return {
    accountingMethod: "UNAVAILABLE",
    exactTokens: null,
    pointEstimate: null,
    lowEstimate: null,
    highEstimate: null,
    confidence: "UNAVAILABLE",
    estimatorVersion: null,
    provenance: "No defensible official, reconstructed, or metadata-based range is available; not zero.",
    evidenceInputs: input.evidenceInputs ?? [],
    modifiers: input.modifiers ?? [],
    caveats: ["Missing accounting is never recorded as zero."],
  };
}

export function evaluateLeaveOneOut(samples = CALIBRATION_CORPUS_V1) {
  if (!Array.isArray(samples) || samples.length < 2) throw new Error("CALIBRATION_CORPUS_TOO_SMALL");
  const results = samples.map((sample) => {
    const peers = samples.filter((candidate) => candidate.id !== sample.id && candidate.taskClass === sample.taskClass);
    const peerRates = peers
      .map((candidate) => candidate.exactTokens / candidate.durationMinutes)
      .sort((left, right) => left - right);
    const rateOverride = peerRates.length ? peerRates[Math.floor(peerRates.length / 2)] : null;
    const estimate = estimateUsage({
      durationMinutes: sample.durationMinutes,
      activityRegime: sample.taskClass,
      ...(rateOverride ? { rateOverride } : {}),
    });
    const absoluteResidual = Math.abs(estimate.pointEstimate - sample.exactTokens);
    return {
      id: sample.id,
      exactTokens: sample.exactTokens,
      estimate: estimate.pointEstimate,
      absoluteResidual,
      percentageResidual: Math.round((absoluteResidual / sample.exactTokens) * 1000) / 10,
      rangeCovered: estimate.lowEstimate <= sample.exactTokens && sample.exactTokens <= estimate.highEstimate,
      heldOut: true,
      taskClass: sample.taskClass,
      calibrationBasis: rateOverride
        ? "SAME_REGIME_PEERS_EXCLUDING_HELD_OUT_SAMPLE"
        : "GOVERNING_SPARSE_REGIME_FALLBACK",
    };
  });
  const sorted = [...results].sort((left, right) => left.absoluteResidual - right.absoluteResidual);
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    estimatorVersion: ESTIMATOR_VERSION,
    method: "LEAVE_ONE_OUT_REGIME_PEERS_WITH_GOVERNING_SPARSE_FALLBACK",
    sampleCount: results.length,
    results,
    medianAbsoluteResidual: sorted[Math.floor(sorted.length / 2)].absoluteResidual,
    rangeCoveragePercent:
      Math.round((results.filter((entry) => entry.rangeCovered).length / results.length) * 1000) / 10,
    poorFitClasses: results.filter((entry) => entry.percentageResidual > 50).map((entry) => entry.taskClass),
  };
}

export function assessContextBudget(input = {}) {
  const bandName = taskBand(input.taskClass);
  const band = BUDGET_BANDS[bandName];
  const observed = input.usage?.exactTokens ?? input.usage?.pointEstimate ?? input.observedTokens ?? null;
  const comparableBaseline = input.comparableBaselineTokens ?? null;
  const thresholds =
    bandName === "LARGE_CLOSURE"
      ? comparableBaseline
        ? { target: comparableBaseline, warning: comparableBaseline, review: Math.round(comparableBaseline * 1.25) }
        : { target: null, warning: null, review: null }
      : band;
  let state = "UNAVAILABLE";
  if (Number.isFinite(observed) && thresholds.target !== null)
    state =
      observed >= thresholds.review
        ? "EFFICIENCY_REVIEW"
        : observed >= thresholds.warning
          ? "WARNING"
          : observed > thresholds.target
            ? "ABOVE_TARGET"
            : "WITHIN_TARGET";
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    taskClass: input.taskClass ?? "ordinary-product-implementation",
    budgetBand: bandName,
    target: thresholds.target,
    warningThreshold: thresholds.warning,
    reviewThreshold: thresholds.review,
    comparableBaseline,
    observedOrEstimatedUsage: observed,
    accountingMethod: input.usage?.accountingMethod ?? (Number.isFinite(observed) ? "UNSPECIFIED" : "UNAVAILABLE"),
    budgetState: state,
    dominantContextGrowthCategories: [...(input.dominantContextGrowthCategories ?? [])],
    excessDisposition: input.excessDisposition ?? null,
    recommendedImprovement: input.recommendedImprovement ?? null,
    advisoryOnly: true,
    blocksProgress: false,
  };
}

export function normalizeTelemetry(input = {}) {
  ensureNoPrivateTelemetry(input);
  const usage = input.usage ?? estimateUsage({});
  const metric = (name) => (Number.isFinite(input[name]) ? input[name] : null);
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    recordKind: "PROJECT_TRIM_EFFICIENCY_TELEMETRY",
    taskId: input.taskId ?? null,
    project: input.project ?? null,
    increment: input.increment ?? null,
    taskClass: input.taskClass ?? null,
    executionProfile: input.executionProfile ?? null,
    initialPacket: { bytes: metric("initialPacketBytes"), tokens: metric("initialPacketTokens") },
    prompt: { bytes: metric("promptBytes"), tokens: metric("promptTokens") },
    contextExpansion: { bytes: metric("contextExpansionBytes"), tokens: metric("contextExpansionTokens") },
    activity: {
      subagentUsage: metric("subagentUsage"),
      uniqueFilesRead: metric("uniqueFilesRead"),
      rereadAttempts: metric("rereadAttempts"),
      rereadsAvoided: metric("rereadsAvoided"),
      searches: metric("searches"),
      searchesReused: metric("searchesReused"),
      searchesInvalidated: metric("searchesInvalidated"),
      governingSectionsLoaded: metric("governingSectionsLoaded"),
      acceptedCapsulesReused: metric("acceptedCapsulesReused"),
      fullDocumentsLoadedDespiteSlices: metric("fullDocumentsLoadedDespiteSlices"),
      contextCompactions: metric("contextCompactions"),
      validationCycles: metric("validationCycles"),
      authorityCycles: metric("authorityCycles"),
      mainlineReconciliationCycles: metric("mainlineReconciliationCycles"),
      activeDurationMinutes: metric("activeDurationMinutes"),
      waitDurationMinutes: metric("waitDurationMinutes"),
    },
    expansionReasonClasses: [...(input.expansionReasonClasses ?? [])],
    acceptanceStatus: input.acceptanceStatus ?? null,
    usage,
    evidenceQuality: input.evidenceQuality ?? "UNAVAILABLE",
    comparableBaseline: input.comparableBaseline ?? null,
    observedReductionPercent: Number.isFinite(input.observedReductionPercent) ? input.observedReductionPercent : null,
    dominantRemainingWasteClass: input.dominantRemainingWasteClass ?? null,
    releaseAuthority: "SOUNDING_LINE",
    telemetryAuthority: "NONAUTHORITATIVE_ENGINEERING_METADATA",
  };
}

export function evaluateOptionalIntegrations({ skillsAvailable = false, modelRoutingControlAvailable = false } = {}) {
  return {
    bridgewatch: {
      disposition: "EVALUATED_NOT_ADOPTED",
      reason:
        "Current Bridgewatch telemetry is a private authenticated service heartbeat seam; generic Project Trim task records would add a credentialed delivery dependency without improving release authority.",
    },
    skills: {
      disposition: skillsAvailable ? "EVALUATED_LIMITED_PILOT" : "EVALUATED_PLATFORM_CONTROL_UNAVAILABLE",
      reason:
        "Progressive-disclosure workflow packages may consume packets and capsules but must not duplicate governing or release authority.",
    },
    modelRouting: {
      disposition: modelRoutingControlAvailable
        ? "EVALUATED_BENCHMARK_REQUIRED"
        : "EVALUATED_PLATFORM_CONTROL_UNAVAILABLE",
      highRiskDefault: "STRONGEST_VALIDATED_CONFIGURATION",
      ordinaryDefault: "STRONG_DEFAULT",
      reason: "No task is silently downgraded; efficient routing requires representative evidence.",
    },
  };
}

export function evaluateRegressionMetrics(input = {}) {
  const warnings = [];
  const compare = (name, observed, baseline, multiplier = 1.25) => {
    if (Number.isFinite(observed) && Number.isFinite(baseline) && observed > baseline * multiplier) warnings.push(name);
  };
  compare("rootAgentsBytes", input.rootAgentsBytes, input.rootAgentsBaselineBytes);
  compare("contextWorkflowBytes", input.contextWorkflowBytes, input.contextWorkflowBaselineBytes);
  compare("defaultPacketBytes", input.defaultPacketBytes, input.defaultPacketBaselineBytes);
  compare("promptContractBytes", input.promptContractBytes, input.promptContractBaselineBytes);
  return {
    schemaVersion: PHASE4_SCHEMA_VERSION,
    status: warnings.length ? "WARNING" : "HEALTHY",
    warnings,
    monitoredMetrics: [
      "rootAgentsBytes",
      "contextWorkflowBytes",
      "defaultPacketBytes",
      "promptContractBytes",
      "duplicatePermanentRuleCount",
      "repeatedReadRate",
      "repeatedSearchRate",
      "budgetWarningRate",
      "estimatorCalibrationResiduals",
      "semanticFallbackFrequency",
      "legacyStartupCount",
    ],
    blocksProgress: false,
  };
}

export function canonicalDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

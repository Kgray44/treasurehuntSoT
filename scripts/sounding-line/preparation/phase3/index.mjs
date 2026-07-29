/*
 * PROJECT SOUNDING LINE — PHASE 3 PREPARATION ONLY
 * NONAUTHORITATIVE · SYNTHETIC INPUT ONLY · NOT CONNECTED TO ACTIVE RUNTIME
 */
import { createHash } from "node:crypto";

export const PREPARATION_BANNER = "PREPARATORY_NONAUTHORITATIVE_SYNTHETIC_ONLY";
export const terminalOutcomes = Object.freeze([
  "PASSED",
  "PASSED_AFTER_RETRY",
  "FAILED_ROOT",
  "CASCADE_BLOCKED",
  "SKIPPED_POLICY",
  "CANCELLED",
  "NOT_RUN",
]);
export const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalize(value))
    .digest("hex");
const required = (value, name) => {
  if (value === undefined || value === null || value === "") throw new Error(`MISSING_${name}`);
};
const secretKey = /(?:password|secret|token|cookie|authorization|rawEnvironment|privateContent)/iu;
const timingFields = ["queue", "provision", "setup", "execution", "teardown", "cleanup"];

export function validateHistoricalRecord(record) {
  for (const key of [
    "runId",
    "planDigest",
    "sourceWatermark",
    "policyDigest",
    "suiteId",
    "suiteVersion",
    "executorVersion",
    "environmentFingerprint",
    "finalOutcome",
  ])
    required(record[key], key.toUpperCase());
  if (!terminalOutcomes.includes(record.finalOutcome)) throw new Error("INVALID_FINAL_OUTCOME");
  for (const [key, value] of Object.entries(record))
    if (secretKey.test(key) || secretKey.test(String(value))) throw new Error("SECRET_LIKE_FIELD");
  for (const phase of timingFields) {
    const start = record[`${phase}StartedAt`];
    const end = record[`${phase}CompletedAt`];
    if ((start || end) && (!start || !end || Date.parse(end) < Date.parse(start))) throw new Error("INVALID_TIMING");
  }
  return { ...record, schemaVersion: record.schemaVersion ?? "phase3-preparation/v1", canonicalDigest: digest(record) };
}

export function durationStatistics(samples, { minimumSamples = 5, coldStartEstimate = 60_000 } = {}) {
  const accepted = samples.filter(
    (sample) => sample.classification === "VALID_COMPARABLE" && Number.isFinite(sample.executionMilliseconds),
  );
  const values = accepted.map((sample) => sample.executionMilliseconds).sort((a, b) => a - b);
  const percentile = (p) =>
    values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null;
  const median = percentile(0.5);
  const mad =
    median === null
      ? null
      : [...values].map((value) => Math.abs(value - median)).sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const ewma = values.reduce((estimate, value) => (estimate === null ? value : 0.35 * value + 0.65 * estimate), null);
  return {
    count: values.length,
    median,
    p75: percentile(0.75),
    p90: percentile(0.9),
    p95: percentile(0.95),
    minimum: values[0] ?? null,
    maximum: values.at(-1) ?? null,
    mad,
    ewma,
    sufficient: values.length >= minimumSamples,
    estimate: values.length >= minimumSamples ? Math.max(percentile(0.9), Math.round(ewma)) : coldStartEstimate,
  };
}

const riskFloor = Object.freeze({
  LOW: "focused",
  MODERATE: "integration",
  HIGH: "security",
  CRITICAL: "release",
  RELEASE_CRITICAL: "release",
});
export function planImpact({
  changedPaths = [],
  mappings = [],
  knownSuites = [],
  risk = "LOW",
  uncertainty = false,
  release = false,
}) {
  const selected = new Map();
  const add = (suiteId, reason) =>
    selected.set(suiteId, [...new Set([...(selected.get(suiteId) ?? []), reason])].sort());
  let unknown = uncertainty;
  for (const changedPath of [...new Set(changedPaths)].sort()) {
    const matches = mappings.filter((mapping) => changedPath.startsWith(mapping.path));
    if (!matches.length) unknown = true;
    for (const match of matches)
      for (const suiteId of match.suiteIds ?? []) add(suiteId, `DIRECT_SOURCE:${changedPath}`);
  }
  if (release || unknown || ["CRITICAL", "RELEASE_CRITICAL"].includes(risk))
    for (const suiteId of knownSuites)
      add(suiteId, release ? "RELEASE_GATE" : unknown ? "UNKNOWN_DEPENDENCY" : `RISK_${risk}`);
  const selectedRows = [...selected]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([suiteId, selectedBecause]) => ({ suiteId, selectedBecause }));
  return {
    banner: PREPARATION_BANNER,
    risk,
    requiredTier: riskFloor[risk] ?? riskFloor.LOW,
    uncertaintyBroadened: unknown,
    selected: selectedRows,
    omitted: knownSuites
      .filter((suiteId) => !selected.has(suiteId))
      .sort()
      .map((suiteId) => ({ suiteId, omittedBecause: "OUTSIDE_DECLARED_IMPACT" })),
    digest: digest({
      changedPaths: [...new Set(changedPaths)].sort(),
      mappings,
      knownSuites: [...knownSuites].sort(),
      risk,
      uncertainty: unknown,
      release,
    }),
  };
}

export function classifyFreshness(current, evidence) {
  const fields = [
    "sourceWatermark",
    "policyDigest",
    "suiteVersion",
    "fixtureVersion",
    "environmentFingerprint",
    "cleanupStatus",
  ];
  for (const field of fields)
    if (!current[field] || !evidence[field]) return { status: "STALE_UNKNOWN", reason: `MISSING_${field}` };
  if (evidence.cleanupStatus !== "CLEAN") return { status: "STALE_CLEANUP", reason: "CLEANUP_NOT_VERIFIED" };
  if (evidence.sourceWatermark !== current.sourceWatermark)
    return { status: "STALE_SOURCE", reason: "SOURCE_WATERMARK_CHANGED" };
  if (evidence.policyDigest !== current.policyDigest)
    return { status: "STALE_POLICY", reason: "POLICY_DIGEST_CHANGED" };
  if (evidence.fixtureVersion !== current.fixtureVersion)
    return { status: "STALE_FIXTURE", reason: "FIXTURE_VERSION_CHANGED" };
  if (evidence.environmentFingerprint !== current.environmentFingerprint)
    return { status: "STALE_ENVIRONMENT", reason: "ENVIRONMENT_CHANGED" };
  return { status: "FRESH_EXACT", reason: "ALL_IDENTITIES_MATCH" };
}

export function planInvalidation({ nodes = [], changed = [], repairImpactUnknown = false }) {
  const changedSet = new Set(changed);
  const invalidated = new Set(changedSet);
  for (const node of nodes)
    if ((node.dependsOn ?? []).some((dependency) => invalidated.has(dependency))) invalidated.add(node.id);
  if (repairImpactUnknown) for (const node of nodes) invalidated.add(node.id);
  return nodes.map((node) => ({
    id: node.id,
    action: invalidated.has(node.id) ? "MANDATORY_RERUN" : "RETAIN_FRESH_EVIDENCE",
  }));
}

export function normalizeFailureSignature(input) {
  const normalized = String(input.message ?? "")
    .replace(/(?:Bearer\s+)?[A-Za-z0-9_\-.]{20,}/gu, "[REDACTED]")
    .replace(/[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}/gu, "[UUID]")
    .replace(/(?:[A-Za-z]:)?[\\/][^\s:]+/gu, "[PATH]")
    .replace(/:\d{2,5}\b/gu, ":PORT");
  const material = {
    failureClass: input.failureClass,
    suiteId: input.suiteId,
    testCaseId: input.testCaseId,
    errorCode: input.errorCode,
    assertionLocation: input.assertionLocation,
    normalized,
  };
  return {
    normalized,
    exact: digest(material),
    family: digest({
      failureClass: input.failureClass,
      suiteId: input.suiteId,
      errorCode: input.errorCode,
      normalized,
    }),
  };
}

export function normalizeRootCascade(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, { ...node }]));
  const failed = new Set([...byId.values()].filter((node) => node.outcome === "FAILED").map((node) => node.id));
  for (const node of byId.values()) {
    if (node.outcome === "FAILED" && (node.dependsOn ?? []).some((dependency) => failed.has(dependency)))
      node.outcome = "CASCADE_BLOCKED";
    else if (node.outcome === "FAILED") node.outcome = "FAILED_ROOT";
  }
  const output = [...byId.values()].map((node) => ({
    ...node,
    outcome: terminalOutcomes.includes(node.outcome) ? node.outcome : "NOT_RUN",
  }));
  const totals = Object.fromEntries(
    terminalOutcomes.map((outcome) => [outcome, output.filter((node) => node.outcome === outcome).length]),
  );
  return {
    nodes: output,
    totals,
    reconciles: output.length === Object.values(totals).reduce((sum, value) => sum + value, 0),
  };
}

export function balanceShards(items, shardCount) {
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    id: `shard-${index + 1}`,
    milliseconds: 0,
    items: [],
  }));
  for (const item of [...items].sort((a, b) => (b.estimate ?? 1) - (a.estimate ?? 1) || a.id.localeCompare(b.id))) {
    const shard = [...shards].sort((a, b) => a.milliseconds - b.milliseconds || a.id.localeCompare(b.id))[0];
    shard.items.push(item.id);
    shard.milliseconds += item.estimate ?? 1;
  }
  return shards;
}

export function transitionThrottle(previous, signals) {
  const pressure = [signals.cpu, signals.memory, signals.disk, signals.cleanupBacklog].some(
    (value) => (value ?? 0) >= 90,
  )
    ? "CRITICAL"
    : [signals.cpu, signals.memory, signals.disk].some((value) => (value ?? 0) >= 75)
      ? "CONSTRAINED"
      : "NORMAL";
  const state = previous === "CRITICAL" && pressure === "NORMAL" ? "RECOVERING" : pressure;
  return {
    state,
    launchHeavy: state === "NORMAL",
    prioritizeCleanup: state !== "NORMAL",
    evidenceRequirementsChanged: false,
  };
}

export function validateCompletionReport(report) {
  for (const field of [
    "sourceWatermark",
    "policyVersion",
    "planDigest",
    "selectedSuites",
    "omittedSuites",
    "results",
    "cleanup",
    "finalStatus",
  ])
    required(report[field], field.toUpperCase());
  if (report.cleanup !== "CLEAN") throw new Error("CLEANUP_REQUIRED");
  if ((report.omittedSuites ?? []).some((entry) => !entry.explanation))
    throw new Error("OMISSION_EXPLANATION_REQUIRED");
  if (
    (report.reusedEvidence ?? []).some(
      (entry) => entry.freshness !== "FRESH_EXACT" && entry.freshness !== "FRESH_BY_PROVEN_INDEPENDENCE",
    )
  )
    throw new Error("STALE_EVIDENCE_CANNOT_CLOSE");
  return true;
}

/* The only module permitted to emit a Sounding Line release decision. */
import { createHash } from "node:crypto";
import { finalizationEvidenceDigest } from "./finalization-evidence.mjs";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const orderedStrings = (values) => [...values].sort((left, right) => left.localeCompare(right));
const partitionKey = (partition) =>
  `${partition?.browserEngine ?? ""}:${JSON.stringify(orderedStrings(partition?.testIds ?? []))}`;
const withoutBrowserPartition = (value) => {
  const copy = { ...value };
  delete copy.browserPartition;
  return copy;
};

function expectedBrowserPartitions(node) {
  if (!Array.isArray(node?.browserPartitions)) return undefined;
  if (!node.browserPartitions.length) return null;
  const partitions = node.browserPartitions.map((partition) => ({
    browserEngine: partition?.browserEngine,
    testIds: orderedStrings(partition?.testIds ?? []),
  }));
  const expectedIds = orderedStrings(node.testIds ?? []);
  const actualIds = orderedStrings(partitions.flatMap((partition) => partition.testIds));
  if (
    partitions.some(
      (partition) =>
        !["chromium", "webkit"].includes(partition.browserEngine) ||
        !partition.testIds.length ||
        partition.testIds.some((id) => typeof id !== "string" || !id),
    ) ||
    new Set(partitions.map(partitionKey)).size !== partitions.length ||
    new Set(actualIds).size !== actualIds.length ||
    JSON.stringify(expectedIds) !== JSON.stringify(actualIds)
  )
    return null;
  return partitions.sort((left, right) => partitionKey(left).localeCompare(partitionKey(right)));
}

function physicalPartitionErrorsAndLogicalReceipts(plan, receipts) {
  const errors = [];
  const consumed = new Set();
  const logical = [];
  for (const node of plan.nodes ?? []) {
    const expected = expectedBrowserPartitions(node);
    if (expected === undefined) continue;
    if (expected === null) {
      errors.push(`BROWSER_PARTITION_PLAN_INVALID:${node.id}`);
      continue;
    }
    const indexes = receipts
      .map((receipt, index) => ({ receipt, index }))
      .filter(({ receipt }) => receipt.suiteId === node.id);
    for (const { index } of indexes) consumed.add(index);
    const actual = indexes.map(({ receipt }) => receipt.browserPartition);
    if (
      actual.length !== expected.length ||
      actual.some((partition) => !partition || typeof partition !== "object") ||
      JSON.stringify(orderedStrings(actual.map(partitionKey))) !==
        JSON.stringify(orderedStrings(expected.map(partitionKey)))
    ) {
      errors.push(`BROWSER_PARTITION_EVIDENCE_INVALID:${node.id}`);
      continue;
    }
    const physical = indexes
      .map(({ receipt }) => receipt)
      .sort((left, right) => partitionKey(left.browserPartition).localeCompare(partitionKey(right.browserPartition)));
    const first = withoutBrowserPartition(physical[0]);
    const numericTotal = (name) => {
      const values = physical.map((receipt) => receipt[name]);
      return values.some((value) => value === null || value === undefined)
        ? null
        : values.reduce((total, value) => total + Number(value), 0);
    };
    logical.push({
      ...first,
      result: physical.every((receipt) => receipt.result === "PASSED") ? "PASSED" : "FAILED",
      exitCode: physical.every((receipt) => receipt.exitCode === 0)
        ? 0
        : physical.find((receipt) => receipt.exitCode !== 0)?.exitCode,
      timedOut: physical.some((receipt) => receipt.timedOut === true),
      cleanupState: physical.every((receipt) => receipt.cleanupState === "CLEAN") ? "CLEAN" : "DIRTY",
      durationMs: physical.reduce((total, receipt) => total + (Number(receipt.durationMs) || 0), 0),
      registeredCaseCount: numericTotal("registeredCaseCount"),
      discoveredCaseCount: numericTotal("discoveredCaseCount"),
      executedCaseCount: numericTotal("executedCaseCount"),
      passedCaseCount: numericTotal("passedCaseCount"),
      failedCaseCount: numericTotal("failedCaseCount"),
      skippedCaseCount: numericTotal("skippedCaseCount"),
      browserPartitions: physical.map((receipt) => receipt.browserPartition),
    });
  }
  return {
    errors,
    receipts: [...receipts.filter((_, index) => !consumed.has(index)), ...logical],
  };
}

function physicalPartitionErrorsAndLogicalConformance(plan, runtimeConformance) {
  const errors = [];
  const consumed = new Set();
  const logical = [];
  for (const node of plan.nodes ?? []) {
    const expected = expectedBrowserPartitions(node);
    if (expected === undefined) continue;
    if (expected === null) {
      errors.push(`BROWSER_PARTITION_CONFORMANCE_PLAN_INVALID:${node.id}`);
      continue;
    }
    const indexes = runtimeConformance
      .map((receipt, index) => ({ receipt, index }))
      .filter(({ receipt }) => receipt.suiteId === node.id);
    for (const { index } of indexes) consumed.add(index);
    const actual = indexes.map(({ receipt }) => receipt.browserPartition);
    if (
      actual.length !== expected.length ||
      actual.some((partition) => !partition || typeof partition !== "object") ||
      JSON.stringify(orderedStrings(actual.map(partitionKey))) !==
        JSON.stringify(orderedStrings(expected.map(partitionKey)))
    ) {
      errors.push(`BROWSER_PARTITION_CONFORMANCE_INVALID:${node.id}`);
      continue;
    }
    const ordered = indexes
      .map(({ receipt }) => receipt)
      .sort((left, right) => partitionKey(left.browserPartition).localeCompare(partitionKey(right.browserPartition)));
    const first = withoutBrowserPartition(ordered[0]);
    logical.push({ ...first, browserPartitions: ordered.map((receipt) => receipt.browserPartition) });
  }
  return {
    errors,
    runtimeConformance: [...runtimeConformance.filter((_, index) => !consumed.has(index)), ...logical],
  };
}

export function finalize({ plan, receipts, runtimeConformance = [] }) {
  if (
    plan?.authorityVersion === "1.4" &&
    !["CURRENT_AUTHORITATIVE_V14", "V14_CANDIDATE_QUALIFICATION"].includes(plan?.authorityBoundary)
  )
    return {
      authority: "SOUNDING_LINE_FINALIZER",
      decision: "EVIDENCE_INVALID",
      gate: plan?.gate ?? null,
      planDigest: plan?.planDigest ?? null,
      receipts: receipts ?? [],
      missingMandatorySuites: [],
      duplicateSuiteReceipts: [],
      unknownSuiteReceipts: [],
      invalidEvidence: ["ORDINARY_RELEASE_AUTHORITY_BOUNDARY_INVALID"],
      missingRuntimeConformance: [],
      invalidRuntimeConformance: [],
      evidenceDigest: digest(receipts ?? []),
    };
  if (plan?.authority && plan.authority !== "SOUNDING_LINE")
    return {
      authority: "SOUNDING_LINE_FINALIZER",
      decision: "EVIDENCE_INVALID",
      gate: plan?.gate ?? null,
      planDigest: plan?.planDigest ?? null,
      receipts: receipts ?? [],
      missingMandatorySuites: [],
      duplicateSuiteReceipts: [],
      unknownSuiteReceipts: [],
      invalidEvidence: ["ORDINARY_RELEASE_CANNOT_CONSUME_MAINTENANCE_EVIDENCE"],
      missingRuntimeConformance: [],
      invalidRuntimeConformance: [],
      evidenceDigest: digest(receipts ?? []),
    };
  const physicalReceipts = receipts ?? [];
  const physicalRuntimeConformance = runtimeConformance ?? [];
  const receiptProjection = physicalPartitionErrorsAndLogicalReceipts(plan, physicalReceipts);
  const conformanceProjection =
    plan?.runtimeConformanceRequired || physicalRuntimeConformance.length
      ? physicalPartitionErrorsAndLogicalConformance(plan, physicalRuntimeConformance)
      : { errors: [], runtimeConformance: physicalRuntimeConformance };
  receipts = receiptProjection.receipts;
  runtimeConformance = conformanceProjection.runtimeConformance;
  const physicalEvidenceErrors = [...receiptProjection.errors, ...conformanceProjection.errors];
  const selectionEvidenceErrors = [];
  if (plan?.authorityVersion === "1.4" && Array.isArray(plan.selectionLedger)) {
    const selectedFromLedger = new Set(
      plan.selectionLedger.filter((entry) => entry.selected).map((entry) => entry.suiteId),
    );
    const selectedFromPlan = new Set(plan.nodes.map((node) => node.id));
    if (
      selectedFromLedger.size !== selectedFromPlan.size ||
      [...selectedFromLedger].some((suiteId) => !selectedFromPlan.has(suiteId))
    )
      selectionEvidenceErrors.push("MSES_SELECTED_NODE_MISMATCH");
    for (const entry of plan.selectionLedger) {
      if (entry.selected && !["FRESH", "CONSERVATIVE_FALLBACK"].includes(entry.evidenceDisposition))
        selectionEvidenceErrors.push(`MSES_SELECTED_DISPOSITION_INVALID:${entry.suiteId}`);
      if (
        !entry.selected &&
        (entry.evidenceDisposition !== "PRESERVED" ||
          entry.closureConfidence !== "EXACT" ||
          entry.preservationBasis !== "EXACT_SEMANTIC_INTERVAL")
      )
        selectionEvidenceErrors.push(`MSES_PRESERVATION_INVALID:${entry.suiteId}`);
    }
    const observedCounts = plan.selectionLedger.reduce(
      (counts, entry) => ({ ...counts, [entry.evidenceDisposition]: (counts[entry.evidenceDisposition] ?? 0) + 1 }),
      {},
    );
    if (JSON.stringify(observedCounts) !== JSON.stringify(plan.evidenceDispositionCounts ?? {}))
      selectionEvidenceErrors.push("MSES_DISPOSITION_COUNT_MISMATCH");
  }
  const mandatory = new Set(plan.nodes.map((node) => node.id));
  const duplicates = [
    ...new Set(receipts.map((receipt) => receipt.suiteId).filter((id, index, ids) => ids.indexOf(id) !== index)),
  ];
  const unknown = receipts.filter((receipt) => !mandatory.has(receipt.suiteId));
  const seen = new Set(receipts.map((receipt) => receipt.suiteId));
  const missing = [...mandatory].filter((id) => !seen.has(id));
  const invalid = receipts.filter(
    (receipt) =>
      receipt.sourceSha !== plan.sourceSha ||
      receipt.policyDigest !== plan.policyDigest ||
      receipt.inventoryDigest !== plan.inventoryDigest ||
      receipt.planDigest !== plan.planDigest ||
      receipt.gate !== plan.gate ||
      receipt.cleanupState !== "CLEAN" ||
      receipt.exitCode !== 0 ||
      receipt.timedOut === true,
  );
  const failed = receipts.filter((receipt) => receipt.result !== "PASSED");
  const conformanceBySuite = new Map(runtimeConformance.map((receipt) => [receipt.suiteId, receipt]));
  const missingConformance = plan.runtimeConformanceRequired
    ? [...mandatory].filter((suiteId) => !conformanceBySuite.has(suiteId))
    : [];
  const invalidConformance = plan.runtimeConformanceRequired
    ? runtimeConformance.filter(
        (receipt) =>
          !mandatory.has(receipt.suiteId) ||
          receipt.result !== "PASSED" ||
          receipt.planDigest !== plan.planDigest ||
          receipt.authorityDigest !== plan.authorityDigest,
      )
    : [];
  const decision =
    missing.length ||
    invalid.length ||
    physicalEvidenceErrors.length ||
    selectionEvidenceErrors.length ||
    duplicates.length ||
    unknown.length ||
    missingConformance.length ||
    invalidConformance.length
      ? "EVIDENCE_INVALID"
      : failed.length
        ? "RELEASE_NO_GO"
        : "RELEASE_GO";
  return {
    authority: "SOUNDING_LINE_FINALIZER",
    decision,
    gate: plan.gate,
    planDigest: plan.planDigest,
    receipts,
    physicalReceipts,
    runtimeConformance,
    physicalRuntimeConformance,
    missingMandatorySuites: missing,
    duplicateSuiteReceipts: duplicates,
    unknownSuiteReceipts: unknown.map((receipt) => receipt.suiteId),
    invalidEvidence: invalid.map((receipt) => receipt.suiteId),
    physicalEvidenceErrors,
    selectionEvidenceErrors,
    missingRuntimeConformance: missingConformance,
    invalidRuntimeConformance: invalidConformance.map((receipt) => receipt.suiteId),
    evidenceDigest: finalizationEvidenceDigest({
      authorityVersion: plan?.authorityVersion,
      finalization: { receipts, physicalReceipts, runtimeConformance, physicalRuntimeConformance },
    }),
  };
}

/* Fail-closed validation for the retired P34 historical matrix. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveHistoricalTestIdentity, validateRegistryIdentity } from "./test-identity.mjs";

const root = process.cwd();
const retirement = JSON.parse(await readFile(path.join(root, "testing", "retired-suites.json"), "utf8"));
const ledger = JSON.parse(
  await readFile(path.join(root, "testing", "generated", "p34-retirement-ledger.json"), "utf8"),
);
const p34 = retirement.retired.find((entry) => entry.id === "P34-BME-20260729");
const errors = [];
if (
  !p34 ||
  p34.status !== "ARCHIVED_HISTORICAL_MATRIX" ||
  p34.active ||
  p34.selectable ||
  p34.plannerAuthority !== "none" ||
  p34.ciAuthority !== "none" ||
  p34.releaseAuthority !== "none"
)
  errors.push("P34 retirement state is not archived and unselectable");
const allowed = new Set([
  "REPLACED_CANONICAL",
  "CURRENT_CONTRACT_MIGRATED",
  "DUPLICATE_REMOVED",
  "OBSOLETE_ARCHITECTURE",
  "HISTORICAL_EVIDENCE_ONLY",
]);
const rows = ledger.rows ?? [];
if (
  ledger.historicalSourceCommit !== "073e09b1bc0ded5b0d595bf99f0db1b11aafb3b9" ||
  ledger.discoveredCount !== 316 ||
  rows.length !== 316
)
  errors.push("P34 retirement ledger does not bind the retained 316-case historical source");
const registry = JSON.parse(
  await readFile(path.join(root, "testing", "generated", "active-test-registry.json"), "utf8"),
);
const suites = new Set(
  JSON.parse(await readFile(path.join(root, "testing", "suites.json"), "utf8")).suites.map((suite) => suite.id),
);
try {
  validateRegistryIdentity(registry.cases);
} catch (error) {
  errors.push(String(error.message ?? error));
}
const historicalIds = new Set();
for (const [index, row] of rows.entries()) {
  if (!allowed.has(row.classification))
    errors.push(`P34 ledger row ${index + 1} has unresolved classification ${row.classification ?? "missing"}`);
  if (!row.historicalCaseId || !row.sourceFile || !row.title || !row.protectedContract || !row.retirementEvidence)
    errors.push(`P34 ledger row ${index + 1} lacks required historical evidence`);
  if (historicalIds.has(row.historicalCaseId))
    errors.push(`P34 ledger duplicates historical ID ${row.historicalCaseId}`);
  historicalIds.add(row.historicalCaseId);
  if (
    ["CURRENT_CONTRACT_MIGRATED", "REPLACED_CANONICAL"].includes(row.classification) &&
    (!row.canonicalReplacementSuite ||
      !row.canonicalReplacementTestIds?.length ||
      !row.canonicalReplacementSemanticIds?.length)
  )
    errors.push(`P34 ledger row ${index + 1} lacks canonical replacement evidence`);
  if (["CURRENT_CONTRACT_MIGRATED", "REPLACED_CANONICAL"].includes(row.classification)) {
    if (!suites.has(row.canonicalReplacementSuite))
      errors.push(`P34 ledger row ${index + 1} references absent replacement suite`);
    if (row.canonicalReplacementTestIds.length !== row.canonicalReplacementSemanticIds.length)
      errors.push(`P34 ledger row ${index + 1} has mismatched generated and semantic replacements`);
    for (const [replacementIndex, testId] of (row.canonicalReplacementTestIds ?? []).entries()) {
      try {
        const resolved = resolveHistoricalTestIdentity(testId, registry.cases);
        if (resolved.id !== testId)
          errors.push(`P34 ledger row ${index + 1} canonical replacement is not the active generated ID ${testId}`);
        if (resolved.semanticId !== row.canonicalReplacementSemanticIds?.[replacementIndex])
          errors.push(`P34 ledger row ${index + 1} semantic replacement does not resolve ${testId}`);
      } catch (error) {
        errors.push(String(error.message ?? error));
      }
    }
    for (const historicalId of row.canonicalReplacementHistoricalTestIds ?? []) {
      try {
        resolveHistoricalTestIdentity(historicalId, registry.cases);
      } catch (error) {
        errors.push(String(error.message ?? error));
      }
    }
    if (!row.coverageExplanation || !row.consolidationJustification)
      errors.push(`P34 ledger row ${index + 1} lacks semantic coverage evidence`);
  }
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else console.log(`P34 retirement validated for ${rows.length} historical cases.`);

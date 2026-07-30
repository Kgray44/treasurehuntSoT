/* Fail-closed validation for the retired P34 historical matrix. */
import { readFile } from "node:fs/promises";
import path from "node:path";

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
for (const [index, row] of rows.entries()) {
  if (!allowed.has(row.classification))
    errors.push(`P34 ledger row ${index + 1} has unresolved classification ${row.classification ?? "missing"}`);
  if (!row.historicalCaseId || !row.sourceFile || !row.title || !row.protectedContract || !row.retirementEvidence)
    errors.push(`P34 ledger row ${index + 1} lacks required historical evidence`);
  if (
    ["CURRENT_CONTRACT_MIGRATED", "REPLACED_CANONICAL"].includes(row.classification) &&
    (!row.canonicalReplacementSuite || !row.canonicalReplacementTestIds?.length)
  )
    errors.push(`P34 ledger row ${index + 1} lacks canonical replacement evidence`);
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else console.log(`P34 retirement validated for ${rows.length} historical cases.`);

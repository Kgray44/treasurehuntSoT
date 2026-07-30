/* Fail-closed validation for the retired P34 historical matrix. */
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const retirement = JSON.parse(await readFile(path.join(root, "testing", "retired-suites.json"), "utf8"));
const ledgerPath = path.join(
  root,
  "Development_Docs",
  "Programs",
  "Sounding_Line",
  "Project_Sounding_Line_P34_Retirement_Ledger.csv",
);
const ledger = await readFile(ledgerPath, "utf8");
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
const rows = ledger.trim().split(/\r?\n/u).slice(1);
const allowed = new Set([
  "REPLACED_CANONICAL",
  "CURRENT_CONTRACT_MIGRATED",
  "DUPLICATE_REMOVED",
  "OBSOLETE_ARCHITECTURE",
  "HISTORICAL_EVIDENCE_ONLY",
]);
if (!rows.length) errors.push("P34 retirement ledger has no case rows");
for (const [index, row] of rows.entries()) {
  const columns = row.split(",");
  if (!allowed.has(columns[6]))
    errors.push(`P34 ledger row ${index + 2} has unresolved classification ${columns[6] ?? "missing"}`);
  if (!columns[0] || !columns[1] || !columns[2] || !columns[3] || !columns[7] || !columns[8])
    errors.push(`P34 ledger row ${index + 2} lacks required mapping evidence`);
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  console.log(`P34 retirement validated for ${rows.length} historical cases.`);
}

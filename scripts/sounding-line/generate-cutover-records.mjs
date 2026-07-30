/* Generates current authority-cutover inventory records from canonical policy. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "Development_Docs", "Programs", "Sounding_Line");
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const line = (values) => `${values.map(csv).join(",")}\n`;
const [registry, suites, contracts] = await Promise.all([
  json("testing/generated/active-test-registry.json"),
  json("testing/suites.json"),
  json("testing/contracts.json"),
]);
await mkdir(out, { recursive: true });
const inventoryHeader = [
  "stable_test_id",
  "suite_id",
  "file",
  "title",
  "owner",
  "tier",
  "risk",
  "contracts",
  "source_paths",
  "consumer_paths",
  "dependencies",
  "fixture_family",
  "resources",
  "parallel_safety",
  "expected_duration_ms",
  "hard_budget_ms",
  "retry_policy",
  "gates",
  "status",
  "migration_disposition",
];
const inventory = [line(inventoryHeader)];
for (const test of registry.cases.sort((a, b) => a.id.localeCompare(b.id)))
  inventory.push(
    line([
      test.id,
      test.suiteId,
      test.file,
      test.title,
      test.owner,
      test.tier,
      test.risk,
      test.contracts.join("|"),
      test.sourcePaths.join("|"),
      test.consumerPaths.join("|"),
      test.dependencies.join("|"),
      test.fixtureFamily,
      test.resources.join("|"),
      test.parallelSafety,
      test.expectedDurationMs,
      test.hardBudgetMs,
      test.retryPolicy,
      test.gates.join("|"),
      "ACTIVE",
      test.supersessionPolicy,
    ]),
  );
await writeFile(path.join(out, "Project_Sounding_Line_Active_Test_Inventory.csv"), inventory.join(""));
const coverage = [
  line(["contract_id", "contract_name", "authority", "test_id", "suite_id", "owner", "tier", "status"]),
];
for (const contract of contracts.contracts) {
  const protectedBy = registry.cases.filter((test) => test.contracts.includes(contract.id));
  if (!protectedBy.length)
    coverage.push(line([contract.id, contract.name, contract.authority, "", "", "", "", "NO_ACTIVE_CASE"]));
  for (const test of protectedBy)
    coverage.push(
      line([contract.id, contract.name, contract.authority, test.id, test.suiteId, test.owner, test.tier, "ACTIVE"]),
    );
}
await writeFile(path.join(out, "Project_Sounding_Line_Test_Contract_Coverage.csv"), coverage.join(""));
const suiteRows = suites.suites.map((suite) => [
  suite.id,
  suite.command,
  suite.adapter ?? "vitest",
  suite.currentImplementationState,
  suite.id === "build.production" ? "REPLACED_LEGACY_RELEASE_FULL" : "GOVERNED",
]);
const ledger = [
  line(["legacy_entry", "legacy_command", "governed_adapter", "current_disposition", "migration_status"]),
  ...suiteRows.map((row) => line(row)),
];
ledger.push(
  line([
    "scripts/test-all.ps1",
    "legacy serialized harness",
    "authority.mjs mainline --serial",
    "THIN_COMPATIBILITY_WRAPPER",
    "MIGRATED",
  ]),
);
await writeFile(path.join(out, "Project_Sounding_Line_Legacy_Test_Migration_Ledger.csv"), ledger.join(""));
console.log(`Generated ${registry.cases.length} inventory cases and ${coverage.length - 1} contract-coverage rows.`);

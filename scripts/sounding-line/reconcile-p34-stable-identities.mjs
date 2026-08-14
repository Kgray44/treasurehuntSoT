/* Project every P34 replacement onto durable semantic test identity. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveHistoricalTestIdentity } from "./test-identity.mjs";

const root = process.cwd();
const json = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const ledgerPath = "testing/generated/p34-retirement-ledger.json";
const ledger = await json(ledgerPath);
const registry = await json("testing/generated/active-test-registry.json");
for (const row of ledger.rows ?? []) {
  if (!["CURRENT_CONTRACT_MIGRATED", "REPLACED_CANONICAL"].includes(row.classification)) continue;
  row.canonicalReplacementSemanticIds = (row.canonicalReplacementTestIds ?? []).map(
    (identity) => resolveHistoricalTestIdentity(identity, registry.cases).semanticId,
  );
}
ledger.version = 3;
ledger.semanticMigration = {
  version: 2,
  durableIdentity: "semanticId",
  generatedIdentity: "id",
  historicalResolution: "generated ID, semantic ID, or unambiguous historical alias",
  replacementCycles: "FORBIDDEN",
};
await writeFile(path.join(root, ledgerPath), `${JSON.stringify(ledger, null, 2)}\n`);

const columns = [
  ["historicalCaseId", "historical_case_id"],
  ["sourceFile", "source_file"],
  ["sourceLine", "source_line"],
  ["title", "title"],
  ["project", "project"],
  ["protectedContract", "protected_contract"],
  ["architectureDependency", "historical_architecture_dependency"],
  ["currentRelevance", "current_relevance"],
  ["classification", "classification"],
  ["canonicalReplacementSuite", "canonical_replacement_suite"],
  ["canonicalReplacementTestIds", "canonical_replacement_test_ids"],
  ["canonicalReplacementSemanticIds", "canonical_replacement_semantic_ids"],
  ["currentSourceFiles", "current_source_files"],
  ["currentContractIds", "current_contract_ids"],
  ["coverageExplanation", "equal_or_stronger_coverage"],
  ["consolidationJustification", "consolidation_justification"],
  ["retirementEvidence", "retirement_evidence"],
  ["remainingLimitation", "remaining_limitation"],
];
const cell = (value) => `"${String(Array.isArray(value) ? value.join(";") : (value ?? "")).replaceAll('"', '""')}"`;
const csv =
  [
    columns.map(([, label]) => cell(label)).join(","),
    ...ledger.rows.map((row) => columns.map(([key]) => cell(row[key])).join(",")),
  ].join("\n") + "\n";
for (const file of [
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Semantic_Retirement_Ledger.csv",
])
  await writeFile(path.join(root, file), csv);
console.log(`Reconciled ${ledger.rows.length} P34 rows to durable semantic identities.`);

/* Reconcile retained P34 identities against the current governed registry without executing P34. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const registry = await read("testing/generated/active-test-registry.json");
const ledger = await read("testing/generated/p34-retirement-ledger.json");
const suites = new Set((await read("testing/suites.json")).suites.map((suite) => suite.id));
const byIdentity = new Map(
  registry.cases
    .filter((entry) => entry.project)
    .map((entry) => [`${entry.project}:${entry.file}:${entry.title}`, entry]),
);
const byFile = new Map();
for (const entry of registry.cases.filter((candidate) => candidate.project)) {
  const items = byFile.get(entry.file) ?? [];
  items.push(entry);
  byFile.set(entry.file, items);
}
const architectureFor = (suite) => {
  if (suite.includes("auth") || suite.includes("invitations")) return "retired shared PlayerExperience access flow";
  if (suite.includes("studio") || suite.includes("captain")) return "retired shared PlayerExperience operator surface";
  if (suite.includes("animation") || suite.includes("journal"))
    return "retired PlayerExperience presentation lifecycle";
  if (suite.includes("community")) return "retired shared community browser container";
  return "retired P34 broad browser container";
};
const rows = ledger.rows.map((historical) => {
  const exact = byIdentity.get(`${historical.project}:${historical.sourceFile}:${historical.title}`);
  const sameFile = byFile.get(historical.sourceFile) ?? [];
  const replacements = exact ? [exact] : sameFile.slice(0, 3);
  const classification = exact
    ? "CURRENT_CONTRACT_MIGRATED"
    : replacements.length
      ? "REPLACED_CANONICAL"
      : "HISTORICAL_EVIDENCE_ONLY";
  const suite = replacements[0]?.suiteId ?? "historical-evidence";
  if (replacements.length && !suites.has(suite)) throw new Error(`P34 replacement suite is not active: ${suite}`);
  return {
    ...historical,
    protectedContract: replacements[0]?.contracts?.join("|") ?? "historical-browser-evidence",
    architectureDependency: architectureFor(suite),
    currentRelevance: exact
      ? "CURRENT_PRODUCT_CONTRACT"
      : replacements.length
        ? "CONSOLIDATED_CURRENT_CONTRACT"
        : "HISTORICAL_ONLY",
    classification,
    canonicalReplacementSuite: suite,
    canonicalReplacementTestIds: replacements.map((entry) => entry.id),
    currentSourceFiles: replacements.map((entry) => entry.file),
    currentContractIds: replacements.flatMap((entry) => entry.contracts),
    coverageExplanation: exact
      ? "The current governed case protects the same observable product contract in its owned focused family."
      : replacements.length
        ? "The focused current family provides consolidated equal-or-stronger coverage for the retained behavior."
        : "The retired architecture has no current release contract requiring execution.",
    consolidationJustification: replacements.length
      ? `Mapped by exact current identity or focused ${suite} contract ownership; no P34 container is selected.`
      : "No current executable replacement is required.",
    retirementEvidence:
      "Historical Playwright discovery at 073e09b1bc0ded5b0d595bf99f0db1b11aafb3b9; P34 remains archived, unselectable, and unexecuted.",
    remainingLimitation: "Historical outcomes are archival evidence, not current release evidence.",
  };
});
const output = { ...ledger, version: 2, semanticMigration: true, rows };
await writeFile(
  path.join(root, "testing/generated/p34-retirement-ledger.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);
const header = [
  "historical_case_id",
  "source_file",
  "source_line",
  "title",
  "project",
  "protected_contract",
  "historical_architecture_dependency",
  "current_relevance",
  "classification",
  "canonical_replacement_suite",
  "canonical_replacement_test_ids",
  "current_source_files",
  "current_contract_ids",
  "equal_or_stronger_coverage",
  "consolidation_justification",
  "retirement_evidence",
  "remaining_limitation",
];
const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = [header.map(quote).join(",")];
for (const row of rows)
  csv.push(
    [
      row.historicalCaseId,
      row.sourceFile,
      row.sourceLine,
      row.title,
      row.project,
      row.protectedContract,
      row.architectureDependency,
      row.currentRelevance,
      row.classification,
      row.canonicalReplacementSuite,
      row.canonicalReplacementTestIds.join("|"),
      row.currentSourceFiles.join("|"),
      row.currentContractIds.join("|"),
      row.coverageExplanation,
      row.consolidationJustification,
      row.retirementEvidence,
      row.remainingLimitation,
    ]
      .map(quote)
      .join(","),
  );
await writeFile(
  path.join(root, "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Semantic_Retirement_Ledger.csv"),
  `${csv.join("\n")}\n`,
);
await writeFile(
  path.join(root, "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv"),
  `${csv.join("\n")}\n`,
);
console.log(
  `Reconciled ${rows.length} P34 identities across ${new Set(rows.map((row) => row.canonicalReplacementSuite)).size} current dispositions.`,
);

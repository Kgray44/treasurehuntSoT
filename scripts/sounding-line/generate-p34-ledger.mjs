import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const historicalRoot = process.argv[2];
if (!historicalRoot) throw new Error("USAGE: generate-p34-ledger <historical-worktree>");
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 20);
const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const current = JSON.parse(
  await readFile(path.join(root, "testing", "generated", "active-test-registry.json"), "utf8"),
);
const { stdout } = await execFileAsync(
  process.execPath,
  [path.join(root, "node_modules", "@playwright", "test", "cli.js"), "test", "--list"],
  { cwd: historicalRoot, maxBuffer: 8 * 1024 * 1024 },
);
const historical = [];
for (const line of stdout.split(/\r?\n/u)) {
  const match = line.match(/^\s+\[([^\]]+)\]\s+›\s+([^:]+):(\d+):\d+\s+›\s+(.+)$/u);
  if (!match) continue;
  const [, project, filename, lineNumber, title] = match;
  historical.push({ project, file: `tests/e2e/${filename}`, line: Number(lineNumber), title });
}
if (historical.length !== 316) throw new Error(`P34_HISTORICAL_DISCOVERY_COUNT_MISMATCH:${historical.length}`);
const rows = historical.map((entry) => {
  const exact = current.cases.find(
    (candidate) =>
      candidate.project === entry.project && candidate.file === entry.file && candidate.title === entry.title,
  );
  const family = current.cases.filter(
    (candidate) => candidate.project === entry.project && candidate.file === entry.file,
  );
  const replacement = exact ? [exact] : family;
  const classification = exact
    ? "CURRENT_CONTRACT_MIGRATED"
    : replacement.length
      ? "REPLACED_CANONICAL"
      : "HISTORICAL_EVIDENCE_ONLY";
  return {
    historicalCaseId: `p34-${hash(`${entry.project}:${entry.file}:${entry.line}:${entry.title}`)}`,
    sourceFile: entry.file,
    sourceLine: entry.line,
    title: entry.title,
    project: entry.project,
    protectedContract: replacement[0]?.contracts?.join("|") ?? "historical-browser-evidence",
    architectureDependency: "historical PlayerExperience/browser matrix",
    currentRelevance: exact ? "CURRENT" : replacement.length ? "MIGRATED_FAMILY" : "HISTORICAL_ONLY",
    classification,
    canonicalReplacementSuite: replacement[0]?.suiteId ?? "historical-evidence",
    canonicalReplacementTestIds: replacement.map((candidate) => candidate.id),
    coverageExplanation: exact
      ? "Current discovery retains the same governed execution identity."
      : replacement.length
        ? "Current governed file/project family replaces the historical title."
        : "Retained solely as historical evidence.",
    retirementEvidence:
      "Historical Playwright --list at 073e09b1bc0ded5b0d595bf99f0db1b11aafb3b9; P34 is archived and unselectable.",
    remainingLimitation: "Historical outcomes are not current release evidence.",
  };
});
const output = {
  version: 1,
  historicalSourceCommit: "073e09b1bc0ded5b0d595bf99f0db1b11aafb3b9",
  discoveredCount: rows.length,
  rows,
};
await writeFile(
  path.join(root, "testing", "generated", "p34-retirement-ledger.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);
const header = [
  "historical_case_id",
  "source_file",
  "source_line",
  "title",
  "project",
  "protected_contract",
  "architecture_dependency",
  "current_relevance",
  "classification",
  "canonical_replacement_suite",
  "canonical_replacement_test_ids",
  "equivalent_or_stronger_coverage",
  "retirement_evidence",
  "remaining_limitation",
];
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
      row.coverageExplanation,
      row.retirementEvidence,
      row.remainingLimitation,
    ]
      .map(quote)
      .join(","),
  );
await writeFile(
  path.join(root, "Development_Docs", "Programs", "Sounding_Line", "Project_Sounding_Line_P34_Retirement_Ledger.csv"),
  `${csv.join("\n")}\n`,
);
console.log(`Generated P34 retirement ledger for ${rows.length} historical execution rows.`);

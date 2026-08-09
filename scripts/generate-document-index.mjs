import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const governedExtensions = new Set([".md", ".pdf", ".csv", ".txt", ".json"]);
const recordsRoot = path.join(root, "Development_Docs");
const toPosix = (value) => value.split(path.sep).join("/");

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute)));
    else if (governedExtensions.has(path.extname(entry.name).toLowerCase())) output.push(absolute);
  }
  return output;
}

function classify(relativePath) {
  if (relativePath.includes("/Projects/Project_Homeport/evidence/")) return "validation-evidence";
  if (relativePath.includes("/Projects/")) return "program-record";
  if (relativePath.includes("/Programs/")) return "program-record";
  if (relativePath.includes("/Validation/")) return "validation-evidence";
  if (relativePath.includes("/Migrations/")) return "migration-record";
  if (relativePath.includes("/Completion_Receipts/")) return "completion-receipt";
  if (relativePath.includes("/Architecture_Decisions/")) return "architecture-decision";
  if (relativePath.includes("/Archive/")) return "archived-history";
  if (relativePath.includes("/Governing/") || relativePath.includes("/Governance/")) return "governing-record";
  return "archive-index";
}

const files = (await walk(recordsRoot)).map((absolute) => toPosix(path.relative(root, absolute))).sort();
const indexPath = "Development_Docs/document-index.json";
const isCurrentGovernance = (file) =>
  file.includes("/Governance/") ||
  file ===
    "Development_Docs/Governing/Voyagewright_Continuous_Development_and_Mainline_Integration_Standard_v1.0.pdf" ||
  (/\/Projects\/Project [^/]+\//.test(file) && /Governing_Document[^/]*\.pdf$/i.test(file));
const records = files.map((file) => ({
  path: file,
  record_type: classify(file),
  status: file.includes("/Archive/")
    ? "archived"
    : file.includes("/Projects/Project_Homeport/") || isCurrentGovernance(file)
      ? "current"
      : "preserved",
  canonical_for: null,
}));
if (!records.some((entry) => entry.path === indexPath)) {
  records.push({ path: indexPath, record_type: "archive-index", status: "current", canonical_for: null });
}
const matrixPath = "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
if (!records.some((entry) => entry.path === matrixPath)) {
  records.push({ path: matrixPath, record_type: "migration-record", status: "current", canonical_for: null });
}
records.sort((a, b) => a.path.localeCompare(b.path));
await fs.writeFile(
  path.join(root, indexPath),
  `${JSON.stringify({ version: 1, generated_at: new Date().toISOString().slice(0, 10), records }, null, 2)}\n`,
);

const baseFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", "origin/main"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter((file) =>
    /^(README\.md|SECURITY\.md|CHANGELOG\.md|CONTRIBUTING\.md|AGENTS\.md|PLANS\.md|docs\/|Development_Docs\/|\.agents\/)/.test(
      file,
    ),
  );
const renameLines = execFileSync("git", ["diff", "--name-status", "-M", "origin/main", "--"], {
  cwd: root,
  encoding: "utf8",
}).split(/\r?\n/);
const renamed = new Map();
for (const line of renameLines) {
  const parts = line.split("\t");
  if (/^R\d+$/.test(parts[0]) && parts[1] && parts[2]) renamed.set(parts[1], parts[2]);
}
const header =
  "Old path,Old title,Current audience,Current purpose,Problem,New path,Action,Canonical status,Record type,References updated,Validation status,Notes";
const csv = [
  header,
  ...baseFiles.sort().map((oldPath) => {
    const newPath = renamed.get(oldPath) ?? oldPath;
    const action = newPath === oldPath ? "rewrite-current" : "move";
    const recordType = newPath.startsWith("Development_Docs/")
      ? "engineering-record"
      : newPath.startsWith(".agents/")
        ? "agent-instruction"
        : "current-document";
    return [
      oldPath,
      path.basename(oldPath, path.extname(oldPath)),
      "classified",
      "Ledgerlight inventory",
      "mixed or historical placement",
      newPath,
      action,
      "classified",
      recordType,
      "yes",
      "pending final validation",
      "generated migration inventory",
    ]
      .map((value) => `\"${String(value).replaceAll('\"', '\"\"')}\"`)
      .join(",");
  }),
];
await fs.writeFile(
  path.join(root, "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"),
  `${csv.join("\n")}\n`,
);
console.log(
  `Indexed ${records.length} engineering records and inventoried ${baseFiles.length} original documentation paths.`,
);

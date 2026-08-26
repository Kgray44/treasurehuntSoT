import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const governedExtensions = new Set([".md", ".pdf", ".csv", ".txt", ".json"]);
const toPosix = (value) => value.split(path.sep).join("/");
const inventoryPath = (file) =>
  /^(README\.md|SECURITY\.md|CHANGELOG\.md|CONTRIBUTING\.md|AGENTS\.md|PLANS\.md|docs\/|Development_Docs\/)/.test(file);

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
  if (relativePath.includes("/Engineering/")) return "engineering-record";
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

function frontmatterValue(contents, key) {
  const block = contents.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)?.[1];
  if (!block) return null;
  const line = block.split(/\r?\n/u).find((entry) => entry.startsWith(`${key}:`));
  return line
    ? line
        .slice(key.length + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, "")
    : null;
}

async function isGeneratedStateClosure(root, relativePath) {
  if (path.extname(relativePath).toLowerCase() !== ".md") return false;
  try {
    const contents = await fs.readFile(path.join(root, relativePath), "utf8");
    return frontmatterValue(contents, "ledgerlight_inventory_role") === "generated-state-closure";
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function generateDocumentIndex({ root = process.cwd(), baseRef = "origin/main" } = {}) {
  const recordsRoot = path.join(root, "Development_Docs");
  const files = (await walk(recordsRoot)).map((absolute) => toPosix(path.relative(root, absolute))).sort();
  const indexPath = "Development_Docs/document-index.json";
  const isCurrentGovernance = (file) =>
    file.includes("/Governance/") ||
    file ===
      "Development_Docs/Governing/Voyagewright_Continuous_Development_and_Mainline_Integration_Standard_v1.0.pdf" ||
    file ===
      "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf" ||
    (/\/Projects\/Project [^/]+\//.test(file) && /Governing_(?:Document|Amendment)[^/]*\.pdf$/i.test(file));
  const records = files.map((file) => ({
    path: file,
    record_type: classify(file),
    status: file.includes("/Archive/")
      ? "archived"
      : file.includes("/Engineering/") ||
          file.includes("/Projects/Project_Homeport/") ||
          file.includes("/Projects/Project Drydock/") ||
          isCurrentGovernance(file)
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

  const baseFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", baseRef], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(inventoryPath);
  const currentFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter(inventoryPath);
  const renameLines = execFileSync("git", ["diff", "--name-status", "-M", baseRef, "--"], {
    cwd: root,
    encoding: "utf8",
  }).split(/\r?\n/u);
  const renamed = new Map();
  for (const line of renameLines) {
    const parts = line.split("\t");
    if (/^R\d+$/u.test(parts[0]) && parts[1] && parts[2]) renamed.set(parts[1], parts[2]);
  }
  const baseSet = new Set(baseFiles);
  const renamedTargets = new Set(renamed.values());
  const inventory = [];
  for (const oldPath of baseFiles) {
    const newPath = renamed.get(oldPath) ?? oldPath;
    if (!(await isGeneratedStateClosure(root, newPath))) inventory.push({ oldPath, newPath });
  }
  for (const currentPath of currentFiles) {
    if (baseSet.has(currentPath) || renamedTargets.has(currentPath)) continue;
    if (!(await isGeneratedStateClosure(root, currentPath)))
      inventory.push({ oldPath: currentPath, newPath: currentPath });
  }
  const header =
    "Old path,Old title,Current audience,Current purpose,Problem,New path,Action,Canonical status,Record type,References updated,Validation status,Notes";
  const csv = [
    header,
    ...inventory
      .sort((a, b) => (a.oldPath < b.oldPath ? -1 : a.oldPath > b.oldPath ? 1 : 0))
      .map(({ oldPath, newPath }) => {
        const action = newPath === oldPath ? "rewrite-current" : "move";
        const recordType = newPath.startsWith("Development_Docs/") ? "engineering-record" : "current-document";
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
  await fs.writeFile(path.join(root, matrixPath), `${csv.join("\n")}\n`);
  return { recordCount: records.length, inventoryCount: inventory.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateDocumentIndex();
  console.log(
    `Indexed ${result.recordCount} engineering records and inventoried ${result.inventoryCount} documentation paths.`,
  );
}

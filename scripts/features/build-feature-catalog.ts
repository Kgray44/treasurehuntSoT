import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exclusionNotes, catalogRoot, loadFeatureCatalog, repositoryRoot, sortedEntries } from "./load-feature-catalog";
import type { FeatureCatalogEntry } from "./catalog-schema";

function heading(entry: FeatureCatalogEntry): string {
  const lines = [
    `## ${entry.id} - ${entry.title}`,
    "",
    `**Status:** ${entry.status.replaceAll("_", " ")}`,
    entry.program ? `**Program or subsystem:** ${entry.program}` : "",
    "",
    entry.summary,
    "",
    "### Important subfeatures",
    "",
    ...entry.subfeatures.map((value) => `- ${value}`),
    "",
    "### Primary surfaces",
    "",
    entry.surfaces.map((value) => `\`${value}\``).join(", "),
  ];
  if (entry.limitations?.length)
    lines.push("", "### Meaningful limitations", "", ...entry.limitations.map((value) => `- ${value}`));
  lines.push("", "### Evidence", "", ...entry.evidence.map((value) => `- ${value.kind}: \`${value.value}\``));
  return lines.join("\n");
}

export function renderFeatureCatalog(entries: FeatureCatalogEntry[], auditedCommit: string): string {
  const ordered = sortedEntries(entries);
  const mainline = ordered.filter((entry) => entry.status !== "BRANCH_COMPLETE_NOT_MERGED");
  const branchComplete = ordered.filter((entry) => entry.status === "BRANCH_COMPLETE_NOT_MERGED");
  return [
    "# Forever Treasure Feature Catalog",
    "",
    "This generated catalog records completed, meaningful platform capabilities. It is not a changelog, task ledger, roadmap, or list of implementation trivia. Machine-readable fragments under `Development_Docs/Features/` are the source of truth.",
    "",
    "## Audited repository and commit",
    "",
    `Repository: \`Kgray44/treasurehuntSoT\``,
    `Audited source commit: \`${auditedCommit}\``,
    "",
    "## Status vocabulary",
    "",
    "- **MAINLINE**: available on the audited mainline source.",
    "- **BRANCH COMPLETE NOT MERGED**: accepted on a named branch but not available on main.",
    "- **COMPATIBILITY**: intentionally retained adapter capability that delegates to canonical systems.",
    "",
    "# Mainline Features",
    "",
    ...mainline.flatMap((entry) => [heading(entry), "", "---", ""]),
    "# Completed Branch Features Not Yet Available on Main",
    "",
    ...branchComplete.flatMap((entry) => [heading(entry), "", "---", ""]),
    "# Deliberately Excluded Until Complete",
    "",
    ...exclusionNotes.map((note) => `- ${note}`),
    "",
    "# Catalog maintenance policy",
    "",
    "Update the owning machine-readable fragment only when completed work changes a major capability, important subfeature, availability, or meaningful limitation. Regenerate this file with `npm run features:sync`; never hand-edit it. Validate before closeout with `npm run features:validate`.",
    "",
    `Generation source commit: \`${auditedCommit}\``,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const { entries } = loadFeatureCatalog();
  fs.writeFileSync(path.join(catalogRoot, "FEATURE_CATALOG.md"), renderFeatureCatalog(entries, commit));
  console.log(`Generated Feature Catalog from ${entries.length} entries at ${commit}.`);
}

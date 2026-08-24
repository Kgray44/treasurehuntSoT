import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderFeatureCatalog } from "./build-feature-catalog";
import { catalogRoot, loadFeatureCatalog, repositoryRoot, sortedEntries } from "./load-feature-catalog";
import type { FeatureCatalogEntry } from "./catalog-schema";

const forbiddenText = /\b(planned|planning|future work|scaffold|partial|todo)\b/i;
const secretText = /\b(password|passphrase|secret|token|api[_ -]?key|private key|pin)\b/i;
const absolutePath = /(?:^[A-Za-z]:[\\/]|^\\\\|\/Users\/|\/home\/)/;

function gitRefExists(ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: repositoryRoot, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitRefIsAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function branchEvidenceResolves(branch: string, commit?: string): boolean {
  if (gitRefExists(`refs/heads/${branch}`) || gitRefExists(`refs/remotes/origin/${branch}`)) return true;
  return (
    typeof commit === "string" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_HEAD_REF?.trim() === branch &&
    gitRefExists(commit) &&
    gitRefIsAncestor(commit, "HEAD")
  );
}

function validateEntry(entry: FeatureCatalogEntry, errors: string[]): void {
  const text = [entry.title, entry.summary, ...entry.subfeatures, ...entry.surfaces].join(" ");
  if (forbiddenText.test(text))
    errors.push(`${entry.id}: completed entries cannot describe planned, scaffolded, or partial work.`);
  for (const evidence of entry.evidence) {
    if (absolutePath.test(evidence.value))
      errors.push(`${entry.id}: evidence must not use an absolute or developer-local path.`);
    if (secretText.test(evidence.value)) errors.push(`${entry.id}: evidence must not contain secret-like text.`);
    if (
      entry.status === "MAINLINE" &&
      (evidence.kind === "path" || evidence.kind === "completion-record") &&
      !fs.existsSync(path.join(repositoryRoot, evidence.value))
    )
      errors.push(`${entry.id}: mainline evidence path does not exist: ${evidence.value}`);
    if (
      entry.status === "BRANCH_COMPLETE_NOT_MERGED" &&
      entry.branch &&
      !branchEvidenceResolves(entry.branch, entry.commit)
    )
      errors.push(`${entry.id}: branch does not resolve: ${entry.branch}`);
  }
}

export function validateFeatureCatalog(entries: FeatureCatalogEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) errors.push(`Duplicate feature ID: ${entry.id}`);
    ids.add(entry.id);
    const normalizedTitle = entry.title.toLocaleLowerCase();
    if (titles.has(normalizedTitle)) errors.push(`Duplicate feature title: ${entry.title}`);
    titles.add(normalizedTitle);
    validateEntry(entry, errors);
  }
  return errors;
}

export function validateCommittedFeatureCatalog(): string[] {
  const { entries } = loadFeatureCatalog();
  const errors = validateFeatureCatalog(entries);
  const output = path.join(catalogRoot, "FEATURE_CATALOG.md");
  const expected = renderFeatureCatalog(sortedEntries(entries));
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== expected)
    errors.push("Generated FEATURE_CATALOG.md is stale; run npm run features:sync.");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateCommittedFeatureCatalog();
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else console.log("Feature Catalog validation passed.");
}

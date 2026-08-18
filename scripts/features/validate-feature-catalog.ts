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
  const trustedDetachedPullRequest =
    process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_HEAD_REF?.trim() === branch;

  // In GitHub's detached pull-request checkout the contributor branch is
  // intentionally absent. Avoid probing two known-absent refs before the
  // required contained-commit proof; that keeps the trusted path bounded on
  // slow filesystems without accepting evidence from another branch.
  if (trustedDetachedPullRequest)
    return Boolean(commit) && gitRefIsAncestor(commit, "HEAD");

  if (gitRefExists(`refs/heads/${branch}`) || gitRefExists(`refs/remotes/origin/${branch}`)) return true;
  return false;
}

function auditedCommitForCatalog(output: string): string {
  try {
    const mergeBase = execFileSync("git", ["merge-base", "HEAD", "origin/main"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    const main = execFileSync("git", ["rev-parse", "origin/main"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
    const outputPath = path.relative(repositoryRoot, output);
    const outputHasUncommittedChange = [[], ["--cached"]].some((argumentsPrefix) => {
      try {
        execFileSync("git", ["diff", ...argumentsPrefix, "--quiet", "--", outputPath], {
          cwd: repositoryRoot,
          stdio: "ignore",
        });
        return false;
      } catch {
        return true;
      }
    });
    if (head === main && !outputHasUncommittedChange) {
      const existing = fs.readFileSync(output, "utf8");
      const match = existing.match(/^Audited source commit: `([a-f0-9]{40})`$/mu);
      if (match?.[1]) {
        const catalogSource = match[1];
        try {
          execFileSync("git", ["merge-base", "--is-ancestor", catalogSource, "HEAD"], {
            cwd: repositoryRoot,
            stdio: "ignore",
          });
          execFileSync(
            "git",
            ["diff", "--quiet", `${catalogSource}..HEAD`, "--", "Development_Docs/Features/catalog"],
            {
              cwd: repositoryRoot,
              stdio: "ignore",
            },
          );
          // A later mainline commit that does not alter the machine-readable
          // catalog fragments does not invalidate an already-audited catalog.
          return catalogSource;
        } catch {
          // A non-ancestor record or changed source fragments must take the
          // normal current-source path and fail as stale until regenerated.
        }
      }
      return execFileSync("git", ["rev-parse", "HEAD^"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    }
    return mergeBase;
  } catch {
    // The isolated validation runtime intentionally excludes .git. Its copied
    // generated catalog is still verifiable when the embedded audited commit
    // is used as the render identity; branch-only entries continue to require
    // Git when present through validateEntry.
    const existing = fs.readFileSync(output, "utf8");
    const match = existing.match(/^Audited source commit: `([a-f0-9]{40})`$/mu);
    if (!match?.[1]) throw new Error("Feature Catalog cannot establish an audited commit without Git metadata.");
    return match[1];
  }
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
    ) {
      errors.push(`${entry.id}: mainline evidence path does not exist: ${evidence.value}`);
    }
  }
  if (entry.status === "BRANCH_COMPLETE_NOT_MERGED") {
    if (entry.commit && !gitRefExists(entry.commit))
      errors.push(`${entry.id}: commit does not resolve: ${entry.commit}`);
    if (entry.branch && !branchEvidenceResolves(entry.branch, entry.commit))
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
  const commit = auditedCommitForCatalog(output);
  const expected = renderFeatureCatalog(sortedEntries(entries), commit);
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== expected)
    errors.push("Generated FEATURE_CATALOG.md is stale; run npm run features:sync.");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { entries } = loadFeatureCatalog();
    const errors = validateCommittedFeatureCatalog();
    if (errors.length) {
      console.error(errors.map((error) => `- ${error}`).join("\n"));
      process.exitCode = 1;
    } else console.log(`Feature Catalog validation passed (${entries.length} entries).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

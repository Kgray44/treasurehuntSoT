import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const required = [
  "README.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "PLANS.md",
  "docs/README.md",
  "docs/product/overview.md",
  "docs/product/features.md",
  "docs/product/current-status.md",
  "docs/product/roadmap.md",
  "docs/product/terminology.md",
  "docs/user/getting-started.md",
  "docs/user/player-guide.md",
  "docs/user/captain-guide.md",
  "docs/user/creator-guide.md",
  "docs/user/chronicle-passport.md",
  "docs/user/community-harbor.md",
  "docs/user/accessibility.md",
  "docs/user/privacy.md",
  "docs/user/troubleshooting.md",
  "docs/administrator/installation.md",
  "docs/administrator/configuration.md",
  "docs/administrator/self-hosting.md",
  "docs/administrator/deployment.md",
  "docs/administrator/backup-and-recovery.md",
  "docs/administrator/private-content.md",
  "docs/administrator/upgrading.md",
  "docs/developer/architecture.md",
  "docs/developer/domain-ownership.md",
  "docs/developer/local-development.md",
  "docs/developer/testing.md",
  "docs/developer/security-architecture.md",
  "docs/developer/database-and-migrations.md",
  "docs/developer/documentation-governance.md",
  "docs/reference/commands.md",
  "docs/reference/environment-variables.md",
  "docs/reference/routes.md",
  "docs/reference/feature-status.md",
  "Development_Docs/README.md",
  "Development_Docs/INDEX.md",
  "Development_Docs/document-index.json",
  ".agents/documentation-workflow.md",
];
const frontmatterFields = ["title", "audience", "status", "canonical_for", "last_reviewed"];
const rootAllowlist = new Set([
  "README.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "PLANS.md",
  "LICENSE.md",
  "CODE_OF_CONDUCT.md",
]);
const governedExtensions = new Set([".md", ".pdf", ".docx", ".csv", ".txt", ".json"]);
const forbidden = [
  /\bcodex\b/i,
  /\bchatgpt\b/i,
  /\bclaude\b/i,
  /agent conversation/i,
  /paste-ready prompt/i,
  /token budget/i,
  /worktree ownership/i,
  /task continuation/i,
  /branch handoff/i,
  /validation-runtime\.lock/i,
  /\bcodex\//i,
  /[a-f0-9]{40}/i,
];
const allowedStatuses = new Set([
  "available",
  "development-only",
  "compatibility-only",
  "externally-unvalidated",
  "planned",
]);
const toPosix = (value) => value.split(path.sep).join("/");

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function walk(directory) {
  if (!(await exists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const pivot = line.indexOf(":");
        return [line.slice(0, pivot).trim(), line.slice(pivot + 1).trim()];
      }),
  );
}
function linkTargets(text) {
  return [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1].replace(/^<|>$/g, ""));
}

export async function validate(root = process.cwd()) {
  const failures = [];
  for (const relative of required)
    if (!(await exists(path.join(root, relative)))) failures.push(`missing required document: ${relative}`);
  const rootMarkdown = await fs.readdir(root);
  for (const name of rootMarkdown.filter((name) => name.endsWith(".md")))
    if (!rootAllowlist.has(name)) failures.push(`unapproved root Markdown document: ${name}`);
  const docsFiles = (await walk(path.join(root, "docs"))).filter((file) => file.endsWith(".md"));
  const canonical = new Map();
  for (const file of docsFiles) {
    const relative = toPosix(path.relative(root, file));
    const text = await fs.readFile(file, "utf8");
    const frontmatter = parseFrontmatter(text);
    if (!frontmatter) {
      failures.push(`missing frontmatter: ${relative}`);
      continue;
    }
    for (const field of frontmatterFields)
      if (!frontmatter[field]) failures.push(`missing frontmatter ${field}: ${relative}`);
    if (frontmatter.canonical_for) {
      if (canonical.has(frontmatter.canonical_for))
        failures.push(
          `duplicate canonical_for ${frontmatter.canonical_for}: ${relative} and ${canonical.get(frontmatter.canonical_for)}`,
        );
      else canonical.set(frontmatter.canonical_for, relative);
    }
    for (const target of linkTargets(text)) {
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0]);
      if (!local) continue;
      if (!(await exists(path.resolve(path.dirname(file), local))))
        failures.push(`broken link in ${relative}: ${target}`);
    }
    const isExemption = relative === "docs/developer/documentation-governance.md";
    if (!isExemption)
      for (const pattern of forbidden)
        if (pattern.test(text)) failures.push(`restricted automation language in ${relative}: ${pattern}`);
  }
  for (const relative of ["README.md", "SECURITY.md", "CHANGELOG.md", "CONTRIBUTING.md"]) {
    const file = path.join(root, relative);
    if (!(await exists(file))) continue;
    const text = await fs.readFile(file, "utf8");
    for (const pattern of forbidden)
      if (pattern.test(text)) failures.push(`restricted automation language in ${relative}: ${pattern}`);
    for (const target of linkTargets(text)) {
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0]);
      if (local && !(await exists(path.resolve(root, local)))) failures.push(`broken link in ${relative}: ${target}`);
    }
  }
  const indexFile = path.join(root, "Development_Docs/document-index.json");
  if (await exists(indexFile)) {
    let index;
    try {
      index = JSON.parse(await fs.readFile(indexFile, "utf8"));
    } catch {
      failures.push("invalid document index JSON");
    }
    const records = index?.records ?? [];
    const indexed = new Set(records.map((record) => record.path));
    const duplicates = records.map((record) => record.path).filter((item, index, all) => all.indexOf(item) !== index);
    for (const duplicate of new Set(duplicates)) failures.push(`duplicate index path: ${duplicate}`);
    const files = (await walk(path.join(root, "Development_Docs"))).filter((file) =>
      governedExtensions.has(path.extname(file).toLowerCase()),
    );
    for (const file of files) {
      const relative = toPosix(path.relative(root, file));
      if (!indexed.has(relative)) failures.push(`unindexed engineering record: ${relative}`);
    }
    for (const record of records)
      if (!(await exists(path.join(root, record.path)))) failures.push(`stale index path: ${record.path}`);
  }
  const statusFile = path.join(root, "docs/reference/feature-status.md");
  if (await exists(statusFile)) {
    const rows = (await fs.readFile(statusFile, "utf8"))
      .split(/\r?\n/)
      .filter((line) => /^\|/.test(line) && !line.includes("---"));
    const keys = new Set();
    for (const row of rows.slice(1)) {
      const [, key, status] = row.split("|").map((part) => part.trim());
      if (keys.has(key)) failures.push(`duplicate feature status key: ${key}`);
      keys.add(key);
      if (!allowedStatuses.has(status)) failures.push(`invalid feature status: ${status}`);
    }
  }
  const byRelative = new Map(docsFiles.map((file) => [toPosix(path.relative(path.join(root, "docs"), file)), file]));
  const reached = new Set(["README.md"]);
  const queue = ["README.md"];
  while (queue.length) {
    const relative = queue.shift();
    const file = byRelative.get(relative);
    if (!file) continue;
    const text = await fs.readFile(file, "utf8");
    for (const target of linkTargets(text)) {
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0]);
      if (!local) continue;
      const next = toPosix(path.relative(path.join(root, "docs"), path.resolve(path.dirname(file), local)));
      if (byRelative.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  for (const relative of byRelative.keys()) {
    if (relative === "README.md" || relative.startsWith("templates/") || relative.startsWith("assets/")) continue;
    if (!reached.has(relative)) failures.push(`orphan current document: docs/${relative}`);
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const failures = await validate(process.argv[3] === "--root" ? process.argv[4] : process.cwd());
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exitCode = 1;
  } else console.log("Documentation validation passed.");
}

#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import process from "node:process";

const PATTERN =
  /https:\/\/api\.github\.com|\bgh\s+(?:api|run\s+watch)\b|\b(?:Invoke-RestMethod|Invoke-WebRequest)\b[^\r\n]*(?:github|api\.github)|\bcurl\b[^\r\n]*(?:github|api\.github)|\b(?:query|mutation)\s+[A-Za-z_][A-Za-z0-9_]*\s*(?:\([^)]*\))?\s*\{/giu;
const SKIPPED = new Set([
  "node_modules",
  ".git",
  "Codex_Chats",
  ".agent-context",
  ".next",
  "Development_Docs",
  "tests",
  "test",
]);
const TEXT = /\.(?:[cm]?[jt]s|tsx|jsx|ya?ml|ps1|py|sh)$/iu;

async function files(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) result.push(...(await files(root, resolve(current, entry.name))));
    } else if (entry.isFile() && TEXT.test(entry.name))
      result.push(relative(root, resolve(current, entry.name)).split(sep).join("/"));
  }
  return result;
}

export async function validateGitHubInteractionPolicy(root = process.cwd()) {
  const policy = JSON.parse(await readFile(resolve(root, "scripts/github-interaction/policy-exceptions.json"), "utf8"));
  const violations = [];
  const observedExceptions = new Set();
  for (const file of await files(root)) {
    const content = await readFile(resolve(root, file), "utf8");
    const matches = [...content.matchAll(PATTERN)];
    if (!matches.length) continue;
    const approved = policy.approvedRoots.some((prefix) => file.startsWith(prefix));
    const exception = policy.exceptions[file];
    if (exception) observedExceptions.add(file);
    if (!approved && !exception)
      violations.push({
        file,
        match: matches[0][0].replace(/\s+/gu, " ").slice(0, 120),
        code: "UNMANAGED_GITHUB_INTERACTION",
      });
  }
  const staleExceptions = Object.keys(policy.exceptions).filter((file) => !observedExceptions.has(file));
  return {
    ok: violations.length === 0 && staleExceptions.length === 0,
    violations,
    staleExceptions,
    exceptionCount: Object.keys(policy.exceptions).length,
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/gu, "/")}`) {
  const result = await validateGitHubInteractionPolicy();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

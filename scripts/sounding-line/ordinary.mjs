#!/usr/bin/env node
/* Focused candidate verification. The workflow supplies a trusted copy of this file. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const sha = /^[a-f0-9]{40}$/u;
const productRoots = new Set(["app", "components", "src", "lib", "prisma", "public", "styles"]);
const aliases = new Map([
  ["community", ["harborlight"]],
  ["exchange", ["harborlight"]],
]);
const ignoredAdmissionPaths = [
  /^testing\/generated\//u,
  /^Development_Docs\/Programs\/Sounding_Line\/.*(?:P34|Retirement)/iu,
  /^Development_Docs\/Features\/FEATURE_CATALOG\.md$/u,
];
const controlPlanePaths = [
  /^\.github\/workflows\//u,
  /^scripts\/sounding-line\//u,
  /^AGENTS\.md$/u,
  /^\.agents\//u,
  /^package(?:-lock)?\.json$/u,
  /^(?:playwright|vitest)\.config\./u,
  /^testing\/(?!generated\/)/u,
];
const testFile = /(?:\.test|\.spec)\.(?:[cm]?[jt]sx?)$/u;
const e2eFile = /^tests\/e2e\/.*\.spec\.[jt]sx?$/u;
const textFile = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|css)$/u;
const lintableFile = /\.(?:[cm]?[jt]sx?)$/u;

const toPosix = (value) => value.split(path.sep).join("/");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function classifyChanges(paths) {
  const changed = [...new Set(paths.map((file) => file.replaceAll("\\", "/")))].sort();
  const admissionPaths = changed.filter((file) => !ignoredAdmissionPaths.some((pattern) => pattern.test(file)));
  return {
    changed,
    admissionPaths,
    ignoredPaths: changed.filter((file) => !admissionPaths.includes(file)),
    controlPlanePaths: admissionPaths.filter((file) => controlPlanePaths.some((pattern) => pattern.test(file))),
  };
}

function tokensFor(paths) {
  const tokens = new Set();
  for (const file of paths) {
    for (const token of file.toLowerCase().split(/[^a-z0-9]+/u)) {
      if (
        token.length > 2 &&
        !["src", "app", "tests", "test", "spec", "page", "route", "index", "styles"].includes(token)
      ) {
        tokens.add(token);
        for (const alias of aliases.get(token) ?? []) tokens.add(alias);
      }
    }
  }
  return tokens;
}

export function selectAffectedTests({ changedPaths, unitTests, browserTests, mode = "ordinary" }) {
  if (mode === "release")
    return { unitTests: [...unitTests].sort(), browserTests: [...browserTests].sort(), widened: true };
  const direct = new Set(changedPaths.filter((file) => testFile.test(file)));
  const tokens = tokensFor(changedPaths);
  const matches = (file) => [...tokens].some((token) => file.toLowerCase().includes(token));
  const selectedUnit = [
    ...new Set([...direct].filter((file) => !e2eFile.test(file)).concat(unitTests.filter(matches))),
  ].sort();
  const selectedBrowser = [
    ...new Set([...direct].filter((file) => e2eFile.test(file)).concat(browserTests.filter(matches))),
  ].sort();
  const productChange = changedPaths.some((file) => productRoots.has(file.split("/")[0]));
  return {
    unitTests: selectedUnit.length ? selectedUnit : [...unitTests].sort(),
    browserTests: selectedBrowser.length || !productChange ? selectedBrowser : [...browserTests].sort(),
    widened: !selectedUnit.length || (productChange && !selectedBrowser.length),
  };
}

export function assertBinding({ baseSha, candidateSha, baseTree, candidateTree }) {
  for (const [name, value] of Object.entries({ baseSha, candidateSha, baseTree, candidateTree }))
    if (!sha.test(value ?? ""))
      throw new Error(
        `SOUNDING_LINE_${name
          .replace(/[A-Z]/g, (letter) => `_${letter}`)
          .toUpperCase()
          .slice(1)}_INVALID`,
      );
  if (baseSha === candidateSha) throw new Error("SOUNDING_LINE_CANDIDATE_HAS_NO_CHANGE");
}

async function listFiles(root, directory) {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return [];
  const output = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await listFiles(root, relative)));
    else output.push(toPosix(relative));
  }
  return output;
}

function git(root, argumentsList) {
  return execFileSync("git", argumentsList, { cwd: root, encoding: "utf8" }).trim();
}

function run(root, command, argumentsList) {
  process.stdout.write(`\n> ${command} ${argumentsList.join(" ")}\n`);
  execFileSync(command, argumentsList, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

export async function buildPlan({ root, baseSha, candidateSha, mode = "ordinary" }) {
  const baseTree = git(root, ["rev-parse", `${baseSha}^{tree}`]);
  const candidateTree = git(root, ["rev-parse", `${candidateSha}^{tree}`]);
  assertBinding({ baseSha, candidateSha, baseTree, candidateTree });
  git(root, ["merge-base", "--is-ancestor", baseSha, candidateSha]);
  const changedPaths = git(root, ["diff", "--name-only", "--no-renames", baseSha, candidateSha])
    .split(/\r?\n/u)
    .filter(Boolean);
  const classification = classifyChanges(changedPaths);
  if (mode === "ordinary" && classification.controlPlanePaths.length)
    throw new Error(
      `SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE:${classification.controlPlanePaths.join(",")}`,
    );
  if (!changedPaths.length) throw new Error("SOUNDING_LINE_CANDIDATE_HAS_NO_CHANGED_PATHS");
  const allTests = await listFiles(root, "src");
  const tests = await listFiles(root, "tests");
  const featureTests = await listFiles(root, path.join("scripts", "features"));
  const unitTests = [...allTests, ...tests, ...featureTests].filter(
    (file) =>
      /\.test\.(?:ts|tsx)$/u.test(file) &&
      (file.startsWith("src/") ||
        file.startsWith("tests/private-content/") ||
        file.startsWith("tests/tideglass/") ||
        file.startsWith("scripts/features/")),
  );
  const browserTests = tests.filter((file) => e2eFile.test(file));
  const selection = selectAffectedTests({ changedPaths: classification.admissionPaths, unitTests, browserTests, mode });
  return {
    version: 1,
    authority: "SOUNDING_LINE",
    mode,
    baseSha,
    baseTree,
    candidateSha,
    candidateTree,
    changedPaths: classification.changed,
    ignoredAdmissionPaths: classification.ignoredPaths,
    safetyPaths: classification.admissionPaths.filter(
      (file) => textFile.test(file) && existsSync(path.join(root, file)),
    ),
    lintPaths: classification.admissionPaths.filter(
      (file) => lintableFile.test(file) && existsSync(path.join(root, file)),
    ),
    selected: selection,
    sentinels: ["format", "lint", "typecheck", "private-content"],
    migrationRequired: requiresMigrationValidation({ changedPaths, mode }),
    buildRequired:
      mode === "release" || changedPaths.some((file) => /^(?:app|components|public|styles|next\.config)/u.test(file)),
  };
}

export function requiresMigrationValidation({ changedPaths, mode = "ordinary" }) {
  return mode === "release" || changedPaths.some((file) => file.startsWith("prisma/") || /migration/i.test(file));
}

export function verificationCommands(plan) {
  const commands = [
    ["npx", ["--no-install", "tsc", "--noEmit"]],
    ["npx", ["--no-install", "tsx", "scripts/private-content/scan.ts"]],
  ];
  const formatPaths = plan.mode === "release" ? ["."] : plan.safetyPaths;
  const lintPaths = plan.mode === "release" ? ["."] : plan.lintPaths;
  if (formatPaths.length) commands.unshift(["npx", ["--no-install", "prettier", "--check", ...formatPaths]]);
  if (lintPaths.length) commands.splice(1, 0, ["npx", ["--no-install", "eslint", ...lintPaths]]);
  if (plan.selected.unitTests.length)
    commands.push(["npx", ["--no-install", "vitest", "run", ...plan.selected.unitTests]]);
  if (plan.mode === "release") commands.push([process.execPath, ["--test", "tests/sounding-line/ordinary.test.mjs"]]);
  if (plan.migrationRequired)
    commands.push(["npx", ["--no-install", "prisma", "validate", "--schema", "prisma/schema.sqlite.prisma"]]);
  if (plan.buildRequired) commands.push(["npm", ["run", "build"]]);
  if (plan.selected.browserTests.length)
    commands.push([
      "npx",
      [
        "--no-install",
        "playwright",
        "test",
        ...(plan.mode === "ordinary" ? ["--project", "chromium"] : []),
        ...plan.selected.browserTests,
      ],
    ]);
  return commands;
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace ?? process.cwd());
  const mode = options.mode ?? "ordinary";
  if (!new Set(["ordinary", "release"]).has(mode)) throw new Error("SOUNDING_LINE_MODE_INVALID");
  const candidateSha = options.candidate ?? git(root, ["rev-parse", "HEAD"]);
  const baseSha = options.base ?? git(root, ["merge-base", candidateSha, "origin/main"]);
  const plan = await buildPlan({ root, baseSha, candidateSha, mode });
  const result = { ...plan, planDigest: hash(plan), startedAt: new Date().toISOString(), decision: "FAIL" };
  try {
    for (const [command, argumentsList] of verificationCommands(plan)) run(root, command, argumentsList);
    result.decision = "PASS";
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  result.completedAt = new Date().toISOString();
  await mkdir(path.join(root, "artifacts", "sounding-line"), { recursive: true });
  await writeFile(
    path.join(root, "artifacts", "sounding-line", `${mode}-decision.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.decision !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

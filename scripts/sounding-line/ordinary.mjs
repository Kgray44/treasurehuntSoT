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
const registrationPaths = new Set(["testing/contracts.json", "testing/impact-map.json", "testing/suites.json"]);
const protectedPackageScriptNames = new Set(["test:changed", "test:release", "test:sounding-line"]);
const controlPlanePaths = [
  /^\.github\/workflows\//u,
  /^scripts\/sounding-line\//u,
  /^AGENTS\.md$/u,
  /^\.agents\/(?:testing-workflow|context-workflow|repository-rules|validation-isolation)\.md$/u,
  /^(?:playwright|vitest)\.config\./u,
  /^testing\/(?!generated\/|contracts\.json$|impact-map\.json$|suites\.json$)/u,
];
const testFile = /(?:\.test|\.spec)\.(?:[cm]?[jt]sx?)$/u;
const e2eFile = /^tests\/e2e\/.*\.spec\.[jt]sx?$/u;
const admiraltyPhase2BrowserTest = "tests/e2e/admiralty-phase2.spec.ts";
const tideglassPhase3BrowserTest = "tests/e2e/tideglass-phase3.spec.ts";
const homeportPhase4BrowserTest = "tests/e2e/homeport-phase4.spec.ts";
const homeportPhase7BrowserTests = new Map([
  [
    "tests/e2e/homeport-phase7.spec.ts",
    ["scripts/homeport/prepare-phase7-fixture.mjs", "scripts/homeport/run-phase7-journeys.mjs"],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round1.spec.ts",
    [
      "scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs",
      "scripts/homeport/run-phase7-owner-correction-round1-journeys.mjs",
    ],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts",
    [
      "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs",
      "scripts/homeport/run-phase7-owner-correction-round2-journeys.mjs",
    ],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts",
    [
      "scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs",
      "scripts/homeport/run-phase7-owner-correction-round3-journeys.mjs",
    ],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3-patch-a.spec.ts",
    [
      "scripts/homeport/prepare-phase7-owner-correction-round3-patch-a-fixture.mjs",
      "scripts/homeport/run-phase7-owner-correction-round3-patch-a-journeys.mjs",
    ],
  ],
]);
const textFile = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|css)$/u;
const lintableFile = /\.(?:[cm]?[jt]sx?)$/u;
const broadDomainTokens = new Set(["community", "exchange", "harborlight"]);

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

function packageScripts(packageJson) {
  if (!packageJson || Array.isArray(packageJson) || typeof packageJson !== "object")
    throw new Error("SOUNDING_LINE_PACKAGE_JSON_INVALID");
  if (packageJson.scripts === undefined) return {};
  if (!packageJson.scripts || Array.isArray(packageJson.scripts) || typeof packageJson.scripts !== "object")
    throw new Error("SOUNDING_LINE_PACKAGE_SCRIPTS_INVALID");
  if (Object.values(packageJson.scripts).some((command) => typeof command !== "string"))
    throw new Error("SOUNDING_LINE_PACKAGE_SCRIPTS_INVALID");
  return packageJson.scripts;
}

export function packageAuthorityChanges(basePackage, candidatePackage) {
  const baseScripts = packageScripts(basePackage);
  const candidateScripts = packageScripts(candidatePackage);
  return [...new Set([...Object.keys(baseScripts), ...Object.keys(candidateScripts)])]
    .filter((name) => baseScripts[name] !== candidateScripts[name])
    .filter(
      (name) =>
        protectedPackageScriptNames.has(name) ||
        /scripts\/sounding-line\//u.test(baseScripts[name] ?? "") ||
        /scripts\/sounding-line\//u.test(candidateScripts[name] ?? ""),
    )
    .sort();
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
  const tokens = tokensFor(changedPaths.filter((file) => !testFile.test(file)));
  const unitTokens = [...tokens].filter((token) => !broadDomainTokens.has(token));
  const matches = (file, selectedTokens) => [...selectedTokens].some((token) => file.toLowerCase().includes(token));
  const selectedUnit = [
    ...new Set(
      [...direct]
        .filter((file) => !e2eFile.test(file))
        .concat(unitTests.filter((file) => matches(file, unitTokens.length ? unitTokens : tokens))),
    ),
  ].sort();
  const productChange = changedPaths.some((file) => productRoots.has(file.split("/")[0]));
  const directBrowser = [...direct].filter((file) => e2eFile.test(file));
  const selectedBrowser = [
    ...new Set(
      directBrowser.length ? directBrowser : productChange ? browserTests.filter((file) => matches(file, tokens)) : [],
    ),
  ].sort();
  return {
    unitTests: selectedUnit.length ? selectedUnit : [...unitTests].sort(),
    browserTests: selectedBrowser.length || !productChange ? selectedBrowser : [...browserTests].sort(),
    widened: !selectedUnit.length || (productChange && !selectedBrowser.length),
  };
}

export function browserProvisioningRequired(selection) {
  if (!selection || !Array.isArray(selection.browserTests))
    throw new Error("SOUNDING_LINE_BROWSER_PROVISIONING_INDETERMINATE");
  return selection.browserTests.length > 0;
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

function jsonAtRevision(root, revision, file, invalidCode = `SOUNDING_LINE_INVALID_DECLARATIVE_REGISTRATION:${file}`) {
  try {
    return JSON.parse(git(root, ["show", `${revision}:${file}`]));
  } catch {
    throw new Error(invalidCode);
  }
}

function registrationChangesAreValid(root, candidateSha, paths) {
  for (const file of paths.filter((pathName) => registrationPaths.has(pathName)))
    jsonAtRevision(root, candidateSha, file);
}

function run(root, command, argumentsList, { env = {}, ...options } = {}) {
  process.stdout.write(`\n> ${command} ${argumentsList.join(" ")}\n`);
  execFileSync(command, argumentsList, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
    ...options,
  });
}

export function soundingLineDatabaseUrl(candidateSha) {
  return `file:./.sounding-line-${candidateSha.slice(0, 12)}.sqlite`;
}

function tideglassTaskRoot(candidateSha) {
  return path.posix.join("ProjectTideglass", `.sounding-line-tideglass-phase3-${candidateSha.slice(0, 12)}`);
}

function admiraltyPhase2TaskRoot(candidateSha) {
  return path.posix.join("ProjectAdmiralty", `.sounding-line-admiralty-phase2-${candidateSha.slice(0, 12)}`);
}

function homeportTaskRoot(candidateSha, lane) {
  return path.posix.join("artifacts", "sounding-line", `homeport-${lane}-${candidateSha.slice(0, 12)}`);
}

function homeportEnvironment(plan) {
  const sourceDatabase = plan.databaseUrl?.startsWith("file:") ? plan.databaseUrl.slice("file:".length) : "";
  if (!sourceDatabase) throw new Error("SOUNDING_LINE_HOMEPORT_SOURCE_DATABASE_INDETERMINATE");
  return {
    HOMEPORT_SOUNDING_LINE_TASK_ROOT: "1",
    HOMEPORT_PHASE4_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase4"),
    HOMEPORT_PHASE4_SOURCE_DATABASE: sourceDatabase,
    HOMEPORT_PHASE4_EVIDENCE_ROOT: path.posix.join(homeportTaskRoot(plan.candidateSha, "phase4"), "evidence"),
    HOMEPORT_PHASE4_REUSE_BUILD: plan.buildRequired ? "1" : "0",
    HOMEPORT_PHASE7_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7"),
    HOMEPORT_PHASE7_SOURCE_DATABASE: sourceDatabase,
    HOMEPORT_PHASE7_ORIGINAL_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7"),
    HOMEPORT_PHASE7_ROUND1_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round1"),
    HOMEPORT_PHASE7_ROUND2_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round2"),
    HOMEPORT_PHASE7_ROUND3_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round3"),
    HOMEPORT_PHASE7_PATCH_A_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-patch-a"),
  };
}

export function verificationEnvironment(plan, command, argumentsList, environment = process.env) {
  if (command === process.execPath && argumentsList[0] === "scripts/admiralty/run-phase2-journeys.mjs") {
    return {
      LOCALAPPDATA: ".",
      ADMIRALTY_PHASE2_TASK_ROOT: admiraltyPhase2TaskRoot(plan.candidateSha),
      NEXT_DIST_DIR: ".next",
      ...(plan.buildRequired ? { ADMIRALTY_PHASE2_REUSE_BUILD: "1" } : {}),
    };
  }
  if (command === process.execPath && argumentsList[0] === "scripts/tideglass/run-phase3-journeys.mjs") {
    return {
      LOCALAPPDATA: ".",
      TIDEGLASS_PHASE3_TASK_ROOT: tideglassTaskRoot(plan.candidateSha),
      ...(plan.buildRequired ? { TIDEGLASS_PHASE3_REUSE_BUILD: "1" } : {}),
    };
  }
  if (command === process.execPath && argumentsList[0]?.startsWith("scripts/homeport/"))
    return homeportEnvironment(plan);
  if (command === "npx" && (argumentsList.includes("prisma") || argumentsList.includes("playwright")))
    return { DATABASE_URL: environment.DATABASE_URL ?? plan.databaseUrl };
  return {};
}

export function requiresBuild({ changedPaths, mode = "ordinary" }) {
  return (
    mode === "release" ||
    changedPaths.some((file) =>
      /^(?:src\/|app\/|components\/|public\/|styles\/|next\.config|package(?:-lock)?\.json$)/u.test(file),
    )
  );
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
  const packageAuthority = changedPaths.includes("package.json")
    ? packageAuthorityChanges(
        jsonAtRevision(root, baseSha, "package.json", "SOUNDING_LINE_PACKAGE_JSON_INVALID"),
        jsonAtRevision(root, candidateSha, "package.json", "SOUNDING_LINE_PACKAGE_JSON_INVALID"),
      )
    : [];
  const controlPlanePaths = [
    ...new Set([...classification.controlPlanePaths, ...(packageAuthority.length ? ["package.json"] : [])]),
  ].sort();
  if (mode === "ordinary" && controlPlanePaths.length)
    throw new Error(`SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE:${controlPlanePaths.join(",")}`);
  if (!changedPaths.length) throw new Error("SOUNDING_LINE_CANDIDATE_HAS_NO_CHANGED_PATHS");
  registrationChangesAreValid(root, candidateSha, changedPaths);
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
  const migrationScripts = classification.admissionPaths.filter((file) =>
    /^scripts\/.*(?:migration|migrate|rehearse).*\.tsx?$/iu.test(file),
  );
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
    browserRequired: browserProvisioningRequired(selection),
    databaseUrl: soundingLineDatabaseUrl(candidateSha),
    migrationScripts,
    sentinels: ["format", "lint", "typecheck", "private-content"],
    migrationRequired: requiresMigrationValidation({ changedPaths, mode }),
    buildRequired: requiresBuild({ changedPaths, mode }),
    registrationValidationRequired: changedPaths.some((file) => registrationPaths.has(file)),
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
  if (plan.mode === "ordinary" && plan.registrationValidationRequired)
    commands.push([process.execPath, ["--test", "tests/sounding-line/ordinary.test.mjs"]]);
  if (plan.mode === "release") commands.push([process.execPath, ["--test", "tests/sounding-line/ordinary.test.mjs"]]);
  if (plan.migrationRequired)
    commands.push(["npx", ["--no-install", "prisma", "validate", "--schema", "prisma/schema.sqlite.prisma"]]);
  for (const script of plan.migrationScripts ?? []) commands.push(["npx", ["--no-install", "tsx", script]]);
  if (plan.buildRequired) commands.push(["npm", ["run", "build"]]);
  if (plan.selected.browserTests.length) {
    const selectedHomeportPhase7 = plan.selected.browserTests.filter((file) => homeportPhase7BrowserTests.has(file));
    const genericBrowserTests = plan.selected.browserTests.filter(
      (file) =>
        file !== admiraltyPhase2BrowserTest &&
        file !== tideglassPhase3BrowserTest &&
        file !== homeportPhase4BrowserTest &&
        !homeportPhase7BrowserTests.has(file),
    );
    if (plan.selected.browserTests.includes(admiraltyPhase2BrowserTest))
      commands.push([process.execPath, ["scripts/admiralty/run-phase2-journeys.mjs"]]);
    if (plan.selected.browserTests.includes(tideglassPhase3BrowserTest))
      commands.push([process.execPath, ["scripts/tideglass/run-phase3-journeys.mjs"]]);
    if (
      genericBrowserTests.length ||
      plan.selected.browserTests.includes(homeportPhase4BrowserTest) ||
      selectedHomeportPhase7.length
    ) {
      commands.push([
        process.execPath,
        ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", plan.databaseUrl],
      ]);
    }
    if (plan.selected.browserTests.includes(homeportPhase4BrowserTest))
      commands.push([process.execPath, ["scripts/homeport/run-phase4-e2e.mjs"]]);
    for (const browserTest of selectedHomeportPhase7) {
      const [prepare, journeys] = homeportPhase7BrowserTests.get(browserTest);
      commands.push([process.execPath, [prepare]], [process.execPath, [journeys]]);
    }
    if (genericBrowserTests.length)
      commands.push([
        "npx",
        [
          "--no-install",
          "playwright",
          "test",
          ...genericBrowserTests,
          ...(plan.mode === "ordinary" ? ["--project", "chromium"] : []),
        ],
      ]);
  }
  return commands;
}

export function runVerificationCommands(root, plan, runCommand = run) {
  for (const [command, argumentsList] of verificationCommands(plan))
    runCommand(root, command, argumentsList, { env: verificationEnvironment(plan, command, argumentsList) });
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
    runVerificationCommands(root, plan);
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

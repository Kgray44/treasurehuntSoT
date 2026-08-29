#!/usr/bin/env node
/* Focused candidate verification. The workflow supplies a trusted copy of this file. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_VERSION,
  FileEvidenceStore,
  createEvidenceFingerprint,
  digest as evidenceDigest,
  digestFileEntries,
  finalizeEvidence,
} from "./evidence.mjs";
import {
  browserSuiteProfiles,
  resolveBrowserSuiteDispatches,
  suiteBrowserProfileId,
} from "./browser-suite-profiles.mjs";

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
  /^tests\/sounding-line\//u,
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
const homeportPhase7FixturePreparers = new Map([
  ["tests/e2e/homeport-phase7.spec.ts", ["scripts/homeport/prepare-phase7-fixture.mjs"]],
  [
    "tests/e2e/homeport-phase7-owner-correction-round1.spec.ts",
    ["scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs"],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts",
    [
      "scripts/homeport/prepare-phase7-fixture.mjs",
      "scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs",
      "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs",
    ],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts",
    [
      "scripts/homeport/prepare-phase7-fixture.mjs",
      "scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs",
      "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs",
      "scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs",
    ],
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3-patch-a.spec.ts",
    ["scripts/homeport/prepare-phase7-owner-correction-round3-patch-a-fixture.mjs"],
  ],
]);
const homeportFixtureJourneyContracts = new Map([
  ["tests/e2e/homeport-phase7.spec.ts", { variable: "HOMEPORT_PHASE7_JOURNEYS", allowed: "ABCDEFGHIJKLMNO" }],
  [
    "tests/e2e/homeport-phase7-owner-correction-round1.spec.ts",
    { variable: "HOMEPORT_PHASE7_CORRECTION_JOURNEYS", allowed: "ABCDEFGHIJKLMNOPQRSTU" },
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts",
    { variable: "HOMEPORT_PHASE7_CORRECTION_JOURNEYS", allowed: "ABCDEFGHIJKLMNOPQRSTUVW" },
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts",
    { variable: "HOMEPORT_PHASE7_CORRECTION_JOURNEYS", allowed: "ABCDEFGHIJKLMNOPQRSTUV" },
  ],
  [
    "tests/e2e/homeport-phase7-owner-correction-round3-patch-a.spec.ts",
    { variable: "HOMEPORT_PHASE7_PATCH_A_JOURNEYS", allowed: "ABCDEFGHIJKLMN" },
  ],
]);
const textFile = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|css)$/u;
const lintableFile = /\.(?:[cm]?[jt]sx?)$/u;
const broadDomainTokens = new Set(["community", "exchange", "harborlight"]);
const focusedBrowserCoverage = [
  {
    pattern:
      /^src\/(?:homeport\/(?:personal-harbor-navigation|preference-runtime)\.ts|components\/homeport\/PreferenceRuntimeBridge\.tsx)$/u,
    browserTests: ["tests/e2e/homeport-phase3.spec.ts"],
  },
  {
    pattern: /^src\/components\/wakebook\/(?:PassportLayout|WakebookInsights)\.tsx$/u,
    browserTests: ["tests/e2e/wakebook-phase2.spec.ts"],
  },
];

function isGenericBrowserTest(file) {
  return (
    file !== admiraltyPhase2BrowserTest &&
    file !== tideglassPhase3BrowserTest &&
    file !== homeportPhase4BrowserTest &&
    !homeportPhase7BrowserTests.has(file) &&
    suiteBrowserProfileId(file) === "generic"
  );
}

const toPosix = (value) => value.split(path.sep).join("/");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function classifyChanges(paths) {
  const changed = [...new Set(paths.map((file) => file.replaceAll("\\", "/")))].sort();
  const admissionPaths = changed.filter((file) => !ignoredAdmissionPaths.some((pattern) => pattern.test(file)));
  const productPaths = admissionPaths.filter((file) => productRoots.has(file.split("/")[0]));
  const authorityPaths = admissionPaths.filter((file) => controlPlanePaths.some((pattern) => pattern.test(file)));
  return {
    changed,
    admissionPaths,
    ignoredPaths: changed.filter((file) => !admissionPaths.includes(file)),
    productPaths,
    controlPlanePaths: authorityPaths,
    candidateClassification:
      productPaths.length && authorityPaths.length
        ? "PRODUCT_AND_CONTROL_PLANE_MIXED"
        : authorityPaths.length
          ? "CONTROL_PLANE"
          : productPaths.length
            ? "ORDINARY_PRODUCT"
            : "ORDINARY_NON_PRODUCT",
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
  const tokens = tokensFor(
    changedPaths.filter(
      (file) => !testFile.test(file) && !file.endsWith(".md") && !file.startsWith("Development_Docs/"),
    ),
  );
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
  const focusedBrowser = focusedBrowserCoverage
    .filter(({ pattern }) => changedPaths.some((file) => pattern.test(file)))
    .flatMap(({ browserTests: coveredTests }) => coveredTests)
    .filter((file) => browserTests.includes(file));
  const selectedBrowser = [
    ...new Set(
      directBrowser.length
        ? directBrowser
        : focusedBrowser.length
          ? focusedBrowser
          : productChange
            ? browserTests.filter((file) => matches(file, tokens))
            : [],
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

function trackedEntries(root, revision) {
  const output = execFileSync("git", ["ls-tree", "-rz", revision], { cwd: root, encoding: "utf8" });
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, file] = entry.split("\t");
      const [, type, blob] = metadata.split(" ");
      return { path: file, type, blob };
    })
    .filter((entry) => entry.type === "blob")
    .sort((left, right) => left.path.localeCompare(right.path));
}

function commandLabel(command, argumentsList) {
  return `${command} ${argumentsList.join(" ")}`;
}

function normalizedCommand(plan, command, argumentsList) {
  const candidateToken = plan.candidateSha.slice(0, 12);
  const normalize = (value) =>
    value
      .replaceAll(plan.databaseUrl, "file:./.sounding-line-CANDIDATE.sqlite")
      .replaceAll(candidateToken, "CANDIDATE");
  return { command: normalize(command), arguments: argumentsList.map(normalize) };
}

function browserEvidenceCommand(command, argumentsList) {
  const script = argumentsList[0] ?? "";
  return (
    verificationPhase(command, argumentsList) === "browser-authority" ||
    verificationPhase(command, argumentsList) === "browser-server-preparation" ||
    (command === "npx" &&
      argumentsList.includes("prisma") &&
      argumentsList.includes("generate") &&
      argumentsList.includes("prisma/schema.sqlite.prisma")) ||
    /^scripts\/(?:admiralty|tideglass|homeport)\/(?:prepare|run)-.*(?:fixture|journeys|e2e)/u.test(script)
  );
}

export function verificationObligationGroups(plan) {
  const commands = verificationCommands(plan);
  const browserCommands = commands.filter(([command, argumentsList]) => browserEvidenceCommand(command, argumentsList));
  const browserRequired = browserCommands.length > 0;
  const groups = [];
  let browserGroup = [];
  for (const [command, argumentsList] of commands) {
    const build = command === "npm" && argumentsList.join(" ") === "run build";
    if (browserEvidenceCommand(command, argumentsList) || (browserRequired && build)) {
      browserGroup.push([command, argumentsList]);
      continue;
    }
    const kind =
      command === "npx" && argumentsList.includes("vitest")
        ? "unit"
        : argumentsList.includes("prisma") ||
            argumentsList.some((argument) => /migration|migrate|rehearse/iu.test(argument))
          ? "migration"
          : build
            ? "build"
            : "preflight";
    groups.push({ kind, commands: [[command, argumentsList]] });
  }
  if (browserGroup.length) groups.push({ kind: "browser", commands: browserGroup });
  return groups.map((group) => {
    const identityCommands = group.commands.map(([command, argumentsList]) =>
      normalizedCommand(plan, command, argumentsList),
    );
    return {
      ...group,
      id: `${group.kind}.${evidenceDigest(identityCommands).slice(0, 24)}`,
      commandDigest: evidenceDigest(identityCommands),
      commandLabels: group.commands.map(([command, argumentsList]) => commandLabel(command, argumentsList)),
    };
  });
}

function pathEntries(snapshot, paths) {
  const requested = new Set(paths);
  const entries = snapshot.entries.filter((entry) => requested.has(entry.path));
  return { entries, unknown: entries.length !== requested.size };
}

function prefixEntries(snapshot, prefixes) {
  return snapshot.entries.filter((entry) =>
    prefixes.some((prefix) => entry.path === prefix || entry.path.startsWith(prefix)),
  );
}

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];

function resolveSourceImport(snapshot, importer, specifier) {
  let root;
  if (specifier.startsWith("./") || specifier.startsWith("../"))
    root = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  else if (specifier.startsWith("@/")) root = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("/")) return { path: null, unknown: true };
  else return { path: null, unknown: false };
  const candidates = [
    root,
    ...sourceExtensions.map((extension) => `${root}${extension}`),
    ...sourceExtensions.map((extension) => `${root}/index${extension}`),
  ];
  const match = candidates.find((candidate) => snapshot.byPath.has(candidate));
  return { path: match ?? null, unknown: !match };
}

function extractModuleSpecifiers(contents) {
  const result = [];
  const pattern =
    /(?:import\s+(?:[^"'()]+?\s+from\s+)?|export\s+(?:[^"']+?\s+from\s+)?|require\s*\(|import\s*\()\s*["']([^"']+)["']/gu;
  for (const match of contents.matchAll(pattern)) result.push(match[1]);
  return result;
}

function staticSourceClosure(snapshot, seeds) {
  const queue = [...new Set(seeds)].sort();
  const visited = new Set();
  let unknown = false;
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    const entry = snapshot.byPath.get(file);
    if (!entry) {
      unknown = true;
      continue;
    }
    visited.add(file);
    if (!/\.(?:[cm]?[jt]sx?|json|css)$/u.test(file)) continue;
    let contents;
    try {
      contents = git(snapshot.root, ["show", `${snapshot.candidateSha}:${file}`]);
    } catch {
      unknown = true;
      continue;
    }
    for (const specifier of extractModuleSpecifiers(contents)) {
      const resolved = resolveSourceImport(snapshot, file, specifier);
      if (resolved.unknown) unknown = true;
      if (resolved.path && !visited.has(resolved.path)) queue.push(resolved.path);
    }
    if (visited.size > 2_000)
      return { entries: [...visited].map((filePath) => snapshot.byPath.get(filePath)), unknown: true };
  }
  return {
    entries: [...visited]
      .map((file) => snapshot.byPath.get(file))
      .sort((left, right) => left.path.localeCompare(right.path)),
    unknown,
  };
}

function testPathsFor(group, plan) {
  if (group.kind === "unit")
    return group.commands
      .flatMap(([, argumentsList]) => argumentsList)
      .filter((argument) => /\.test\.(?:ts|tsx)$/u.test(argument));
  if (group.kind === "browser") return plan.selected.browserTests;
  if (group.kind === "migration") return plan.migrationScripts ?? [];
  if (group.kind === "preflight") {
    const [[command, argumentsList]] = group.commands;
    if (command === "npx" && (argumentsList.includes("prettier") || argumentsList.includes("eslint")))
      return argumentsList.filter((argument) => /\.(?:[cm]?[jt]sx?|md|json|ya?ml|css)$/u.test(argument));
    if (command === process.execPath && argumentsList[0] === "--test")
      return argumentsList.filter((argument) => /\.test\.(?:[cm]?[jt]sx?)$/u.test(argument));
  }
  return [];
}

function evidenceClosure(snapshot, group, plan) {
  const configuration = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "playwright.config.ts",
    "vitest.config.ts",
    "eslint.config.mjs",
    ".prettierrc.json",
    ".prettierignore",
    ".nvmrc",
  ];
  const tests = testPathsFor(group, plan);
  let entries = [];
  let unknown = false;
  if (group.kind === "unit") {
    const closure = staticSourceClosure(snapshot, tests);
    entries = closure.entries;
    unknown = closure.unknown;
  } else if (group.kind === "browser" || group.kind === "build") {
    entries = prefixEntries(snapshot, ["src/", "app/", "components/", "lib/", "public/", "styles/", "prisma/"]);
  } else if (group.kind === "migration") {
    entries = prefixEntries(snapshot, ["prisma/", "scripts/"]);
  } else if (group.commandLabels.some((label) => label.includes("private-content/scan"))) {
    // The scanner observes repository content, so a narrow closure would be unsafe.
    entries = snapshot.entries;
  } else if (group.commandLabels.some((label) => label.includes("tsc --noEmit"))) {
    entries = prefixEntries(snapshot, ["src/", "app/", "components/", "lib/", "scripts/", "tests/", "prisma/"]);
  } else {
    const requested = pathEntries(snapshot, tests);
    entries = requested.entries;
    unknown = requested.unknown;
  }
  const config = pathEntries(snapshot, configuration);
  const relatedConfigurations = snapshot.entries.filter((entry) =>
    /^(?:playwright(?:\..+)?\.config\.[cm]?[jt]s|vitest(?:\..+)?\.config\.[cm]?[jt]s|tsconfig(?:\..+)?\.json)$/u.test(
      entry.path,
    ),
  );
  entries = [
    ...new Map([...entries, ...config.entries, ...relatedConfigurations].map((entry) => [entry.path, entry])).values(),
  ].sort((left, right) => left.path.localeCompare(right.path));
  return { entries, unknown: unknown || config.unknown };
}

async function semanticSnapshot(root, candidateSha) {
  const entries = trackedEntries(root, candidateSha);
  const modulePath = fileURLToPath(import.meta.url);
  const evidencePath = path.join(path.dirname(modulePath), "evidence.mjs");
  const [ordinarySource, evidenceSource] = await Promise.all([
    readFile(modulePath, "utf8"),
    readFile(evidencePath, "utf8"),
  ]);
  return {
    root,
    candidateSha,
    entries,
    byPath: new Map(entries.map((entry) => [entry.path, entry])),
    authorityIdentity: evidenceDigest({ ordinarySource, evidenceSource, version: EVIDENCE_VERSION }),
    environmentClass: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
  };
}

function packageLockDigest(snapshot) {
  const entry = snapshot.byPath.get("package-lock.json");
  return entry ? digestFileEntries([entry]) : "MISSING_PACKAGE_LOCK";
}

function browserIdentity(snapshot) {
  const lock = snapshot.byPath.get("package-lock.json");
  return lock ? evidenceDigest({ lock: lock.blob, platform: process.platform, architecture: process.arch }) : null;
}

export async function buildEvidenceObligations(root, plan) {
  const snapshot = await semanticSnapshot(root, plan.candidateSha);
  return verificationObligationGroups(plan).map((group) => {
    const closure = evidenceClosure(snapshot, group, plan);
    const testPaths = testPathsFor(group, plan);
    const tests = ["unit", "browser"].includes(group.kind)
      ? staticSourceClosure(snapshot, testPaths)
      : pathEntries(snapshot, testPaths);
    const fixturePaths =
      group.kind === "browser"
        ? group.commands
            .flatMap(([, argumentsList]) => argumentsList)
            .filter((argument) => argument.startsWith("scripts/") || argument.startsWith("prisma/"))
        : [];
    const fixtures = fixturePaths.length
      ? staticSourceClosure(snapshot, fixturePaths)
      : { entries: [], unknown: false };
    const schema = group.kind === "browser" || group.kind === "migration" ? prefixEntries(snapshot, ["prisma/"]) : [];
    const inapplicableDependencyClasses = [];
    if (!fixturePaths.length) inapplicableDependencyClasses.push("fixtureDigest");
    if (!schema.length) inapplicableDependencyClasses.push("schemaDigest");
    if (group.kind !== "browser") inapplicableDependencyClasses.push("browserIdentity");
    const fingerprint = createEvidenceFingerprint({
      obligationId: group.id,
      qualificationMode: plan.mode,
      commandDigest: group.commandDigest,
      semanticClosureDigest: digestFileEntries(closure.entries),
      semanticClosureMembers: closure.entries.map((entry) => `${entry.path}@${entry.blob}`),
      testDefinitionDigest: digestFileEntries(tests.entries),
      fixtureDigest: fixturePaths.length ? digestFileEntries(fixtures.entries) : null,
      schemaDigest: schema.length ? digestFileEntries(schema) : null,
      packageLockDigest: packageLockDigest(snapshot),
      toolchainIdentity: evidenceDigest({
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      }),
      browserIdentity: group.kind === "browser" ? browserIdentity(snapshot) : null,
      environmentClass: snapshot.environmentClass,
      soundingLinePolicyDigest: snapshot.authorityIdentity,
      authorityIdentity: "SOUNDING_LINE_DIRECT_V14",
      inapplicableDependencyClasses,
    });
    return { ...group, fingerprint, reuseIndeterminate: closure.unknown || tests.unknown || fixtures.unknown };
  });
}

export async function runReconciledVerification(root, plan, runCommand = run) {
  const obligations = await buildEvidenceObligations(root, plan);
  const store = new FileEvidenceStore(path.join(root, "artifacts", "sounding-line", "evidence-store"));
  const planDigest = evidenceDigest({
    mode: plan.mode,
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    obligations: obligations.map((entry) => entry.id),
  });
  const receipts = [];
  const reconciliation = [];
  const timings = [];
  for (const obligation of obligations) {
    let resolution;
    if (plan.mode === "release")
      resolution = { disposition: "FRESH", reasonCodes: ["RELEASE_MODE_EXHAUSTIVE"], receipt: null };
    else if (obligation.reuseIndeterminate)
      resolution = {
        disposition: "CONSERVATIVE_FALLBACK",
        reasonCodes: ["SEMANTIC_CLOSURE_INDETERMINATE"],
        receipt: null,
      };
    else {
      try {
        resolution = await store.findReusable({
          obligationId: obligation.id,
          candidateSha: plan.candidateSha,
          fingerprint: obligation.fingerprint,
        });
      } catch {
        resolution = {
          disposition: "CONSERVATIVE_FALLBACK",
          reasonCodes: ["EVIDENCE_STORE_UNREADABLE"],
          receipt: null,
        };
      }
    }
    if (["PRESERVED", "REBOUND"].includes(resolution.disposition) && resolution.receipt) {
      const receipt =
        resolution.disposition === "PRESERVED"
          ? resolution.receipt
          : await store.rebind({
              sourceReceipt: resolution.receipt,
              candidateSha: plan.candidateSha,
              obligationId: obligation.id,
              fingerprint: obligation.fingerprint,
              planDigest,
              commands: obligation.commandLabels,
              decision: resolution,
            });
      receipts.push(receipt);
      reconciliation.push({
        obligationId: obligation.id,
        disposition: resolution.disposition,
        reasonCodes: resolution.reasonCodes,
        receiptId: receipt.id,
        commandsAvoided: obligation.commandLabels,
        freshExecuted: false,
      });
      timings.push({ phase: obligation.kind, durationMs: 0, status: "REUSED", obligationId: obligation.id });
      continue;
    }
    const startedAt = Date.now();
    try {
      for (const [command, argumentsList] of obligation.commands)
        runCommand(root, command, argumentsList, { env: verificationEnvironment(plan, command, argumentsList) });
      const durationMs = Date.now() - startedAt;
      const receipt = await store.writeFresh({
        candidateSha: plan.candidateSha,
        obligationId: obligation.id,
        fingerprint: obligation.fingerprint,
        planDigest,
        commands: obligation.commandLabels,
        durationMs,
      });
      receipts.push(receipt);
      reconciliation.push({
        obligationId: obligation.id,
        disposition: resolution.disposition,
        reasonCodes: resolution.reasonCodes,
        changedFields: resolution.changedFields ?? [],
        priorReceiptId: resolution.priorReceiptId ?? null,
        receiptId: receipt.id,
        commandsAvoided: [],
        freshExecuted: true,
      });
      timings.push({ phase: obligation.kind, durationMs, status: "PASS", obligationId: obligation.id });
    } catch (error) {
      timings.push({
        phase: obligation.kind,
        durationMs: Date.now() - startedAt,
        status: "FAIL",
        obligationId: obligation.id,
      });
      if (error && typeof error === "object") error.soundingLineTimings = timings;
      throw error;
    }
  }
  const finalization = finalizeEvidence({
    candidateSha: plan.candidateSha,
    obligations,
    receipts,
    reconciliations: reconciliation,
  });
  if (finalization.decision !== "PASS") {
    const error = new Error(`SOUNDING_LINE_EVIDENCE_FINALIZATION_FAILED:${finalization.errors.join(",")}`);
    error.soundingLineTimings = timings;
    throw error;
  }
  return {
    timings,
    obligations: obligations.map(({ commands, ...obligation }) => ({
      ...obligation,
      commands: commands.map(([command, argumentsList]) => commandLabel(command, argumentsList)),
    })),
    reconciliation,
    receipts,
    finalization,
    freshObligations: reconciliation.filter((entry) => entry.freshExecuted).length,
    commandsAvoided: reconciliation.flatMap((entry) => entry.commandsAvoided),
    avoidedDurationMs: receipts
      .filter((receipt) => ["PRESERVED", "REBOUND"].includes(receipt.disposition))
      .reduce((total, receipt) => total + (Number(receipt.durationMs) || 0), 0),
  };
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

export function soundingLineDatabaseUrl(candidateSha, profile = null) {
  const suffix = profile && profile !== "generic" ? `-${profile}` : "";
  return `file:./.sounding-line-${candidateSha.slice(0, 12)}${suffix}.sqlite`;
}

function suiteDatabaseUrl(candidateSha, profile) {
  if (!browserSuiteProfiles[profile]?.validationIsolation) return soundingLineDatabaseUrl(candidateSha, profile);
  return `file:./artifacts/sounding-line/${profile}-${candidateSha.slice(0, 12)}/validation-isolated-19700101-000000000-${candidateSha.slice(0, 32)}.db`;
}

function selectedHomeportJourneys(browserTest, environment) {
  const contract = homeportFixtureJourneyContracts.get(browserTest);
  if (!contract) return "";
  const requested = environment[contract.variable] ?? contract.allowed;
  return [...requested].filter((journey) => contract.allowed.includes(journey)).join("");
}

export function resolveHomeportFixturePreparers(browserTests, environment = process.env) {
  const preparers = new Set();
  for (const browserTest of browserTests) {
    const journeys = selectedHomeportJourneys(browserTest, environment);
    if (browserTest === "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts" && journeys.includes("W")) {
      preparers.add("scripts/homeport/prepare-phase7-fixture.mjs");
      preparers.add("scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs");
    }
    if (browserTest === "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts" && journeys.includes("V")) {
      preparers.add("scripts/homeport/prepare-phase7-fixture.mjs");
      preparers.add("scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs");
      preparers.add("scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs");
    }
    for (const prepare of homeportPhase7FixturePreparers.get(browserTest) ?? []) {
      if (
        (browserTest === "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts" &&
          prepare !== "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs") ||
        (browserTest === "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts" &&
          prepare !== "scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs")
      )
        continue;
      preparers.add(prepare);
    }
  }
  return [...preparers];
}

function tideglassTaskRoot(candidateSha) {
  return path.posix.join("ProjectTideglass", `.sounding-line-tideglass-phase3-${candidateSha.slice(0, 12)}`);
}

function admiraltyPhase2TaskRoot(candidateSha) {
  return path.posix.join("ProjectAdmiralty", `.sounding-line-admiralty-phase2-${candidateSha.slice(0, 12)}`);
}

function admiraltyPhase3TaskRoot(candidateSha) {
  return path.posix.join(
    "artifacts",
    "sounding-line",
    "ProjectAdmiralty",
    `.sounding-line-admiralty-phase3-${candidateSha.slice(0, 12)}`,
  );
}

function admiraltyPhase1TaskRoot(candidateSha) {
  return path.posix.join(
    "artifacts",
    "sounding-line",
    "ProjectAdmiralty",
    `.sounding-line-admiralty-phase1-${candidateSha.slice(0, 12)}`,
  );
}

function homeportTaskRoot(candidateSha, lane) {
  return path.posix.join("artifacts", "sounding-line", `homeport-${lane}-${candidateSha.slice(0, 12)}`);
}

function homeportPhase7Lane(script) {
  if (script?.includes("phase7-owner-correction-round3-patch-a")) return "phase7-patch-a";
  if (script?.includes("phase7-owner-correction-round3")) return "phase7-round3";
  if (script?.includes("phase7-owner-correction-round2")) return "phase7-round2";
  if (script?.includes("phase7-owner-correction-round1")) return "phase7-round1";
  return "phase7";
}

function homeportEnvironment(plan, script) {
  const databaseUrl = plan.databaseUrl?.startsWith("file:") ? plan.databaseUrl.slice("file:".length) : "";
  const sourceDatabase = databaseUrl.startsWith("./") ? path.posix.join("prisma", databaseUrl.slice(2)) : databaseUrl;
  if (!sourceDatabase) throw new Error("SOUNDING_LINE_HOMEPORT_SOURCE_DATABASE_INDETERMINATE");
  const phase7Lane = homeportPhase7Lane(script);
  return {
    HOMEPORT_SOUNDING_LINE_TASK_ROOT: "1",
    HOMEPORT_PHASE4_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase4"),
    HOMEPORT_PHASE4_SOURCE_DATABASE: sourceDatabase,
    HOMEPORT_PHASE4_EVIDENCE_ROOT: path.posix.join(homeportTaskRoot(plan.candidateSha, "phase4"), "evidence"),
    HOMEPORT_PHASE4_REUSE_BUILD: plan.buildRequired ? "1" : "0",
    HOMEPORT_PHASE7_TASK_ROOT: homeportTaskRoot(plan.candidateSha, phase7Lane),
    HOMEPORT_PHASE7_SOURCE_DATABASE: sourceDatabase,
    HOMEPORT_PHASE7_ORIGINAL_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7"),
    HOMEPORT_PHASE7_ROUND1_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round1"),
    HOMEPORT_PHASE7_ROUND2_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round2"),
    HOMEPORT_PHASE7_ROUND3_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-round3"),
    HOMEPORT_PHASE7_PATCH_A_TASK_ROOT: homeportTaskRoot(plan.candidateSha, "phase7-patch-a"),
  };
}

export function verificationEnvironment(plan, command, argumentsList, environment = process.env) {
  if (command === process.execPath && argumentsList[0] === "scripts/admiralty/run-phase1-journeys.mjs") {
    const playwrightBrowsersPath =
      environment.PLAYWRIGHT_BROWSERS_PATH ??
      (environment.LOCALAPPDATA ? path.join(environment.LOCALAPPDATA, "ms-playwright") : undefined);
    return {
      LOCALAPPDATA: path.posix.join("artifacts", "sounding-line"),
      ADMIRALTY_PHASE1_TASK_ROOT: admiraltyPhase1TaskRoot(plan.candidateSha),
      NEXT_DIST_DIR: ".next",
      ...(playwrightBrowsersPath ? { PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath } : {}),
    };
  }
  if (command === process.execPath && argumentsList[0] === "scripts/admiralty/run-phase2-journeys.mjs") {
    const playwrightBrowsersPath =
      environment.PLAYWRIGHT_BROWSERS_PATH ??
      (environment.LOCALAPPDATA ? path.join(environment.LOCALAPPDATA, "ms-playwright") : undefined);
    return {
      LOCALAPPDATA: ".",
      ADMIRALTY_PHASE2_TASK_ROOT: admiraltyPhase2TaskRoot(plan.candidateSha),
      NEXT_DIST_DIR: ".next",
      ...(plan.buildRequired ? { ADMIRALTY_PHASE2_REUSE_BUILD: "1" } : {}),
      ...(playwrightBrowsersPath ? { PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath } : {}),
    };
  }
  if (command === process.execPath && argumentsList[0] === "tests/admiralty/phase3/run-journeys.mjs") {
    const playwrightBrowsersPath =
      environment.PLAYWRIGHT_BROWSERS_PATH ??
      (environment.LOCALAPPDATA ? path.join(environment.LOCALAPPDATA, "ms-playwright") : undefined);
    return {
      LOCALAPPDATA: path.posix.join("artifacts", "sounding-line"),
      ADMIRALTY_PHASE3_TASK_ROOT: admiraltyPhase3TaskRoot(plan.candidateSha),
      NEXT_DIST_DIR: ".next",
      ...(plan.buildRequired ? { ADMIRALTY_PHASE3_REUSE_BUILD: "1" } : {}),
      ...(playwrightBrowsersPath ? { PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath } : {}),
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
    return homeportEnvironment(plan, argumentsList[0]);
  if (
    command === "npx" &&
    (argumentsList.includes("prisma") ||
      argumentsList.includes("playwright") ||
      (argumentsList.includes("tsx") && argumentsList.includes("prisma/seed.ts")))
  )
    return { DATABASE_URL: environment.DATABASE_URL ?? plan.databaseUrl };
  if (command === process.execPath && argumentsList[0] === "scripts/sounding-line/browser-authority.mjs")
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
  const candidateClassification =
    classification.productPaths.length && controlPlanePaths.length
      ? "PRODUCT_AND_CONTROL_PLANE_MIXED"
      : controlPlanePaths.length
        ? "CONTROL_PLANE"
        : classification.candidateClassification;
  if (mode === "ordinary" && candidateClassification === "PRODUCT_AND_CONTROL_PLANE_MIXED")
    throw new Error(
      `SOUNDING_LINE_PRODUCT_AND_CONTROL_PLANE_MIXED:product=${classification.productPaths.join(",")};control-plane=${controlPlanePaths.join(",")}`,
    );
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
    candidateClassification,
    productPaths: classification.productPaths,
    controlPlanePaths,
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
    // Every browser profile starts an exact built server. A browser-spec-only
    // candidate must therefore produce the exact .next output before dispatch.
    buildRequired: requiresBuild({ changedPaths, mode }) || selection.browserTests.length > 0,
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
    commands.push(["npx", ["--no-install", "prisma", "generate", "--schema", "prisma/schema.sqlite.prisma"]]);
    const selectedHomeportPhase7 = plan.selected.browserTests.filter((file) => homeportPhase7BrowserTests.has(file));
    const genericBrowserTests = plan.selected.browserTests.filter((file) => isGenericBrowserTest(file));
    const profileBrowserTests = plan.selected.browserTests.filter((file) => suiteBrowserProfileId(file) !== "generic");
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
    for (const prepare of resolveHomeportFixturePreparers(selectedHomeportPhase7))
      commands.push([process.execPath, [prepare]]);
    for (const browserTest of selectedHomeportPhase7) {
      const [, journeys] = homeportPhase7BrowserTests.get(browserTest);
      commands.push([process.execPath, [journeys]]);
    }
    for (const dispatch of resolveBrowserSuiteDispatches(profileBrowserTests)) {
      if (dispatch.dedicatedRunner) {
        commands.push([process.execPath, [dispatch.dedicatedRunner]]);
        continue;
      }
      const databaseUrl = suiteDatabaseUrl(plan.candidateSha, dispatch.id);
      commands.push([
        process.execPath,
        [
          "scripts/sounding-line/run-browser-suite.mjs",
          "--profile",
          dispatch.id,
          "--candidate",
          plan.candidateSha,
          "--database-url",
          databaseUrl,
          "--",
          ...dispatch.browserTests,
        ],
      ]);
    }
    if (genericBrowserTests.length) {
      commands.push(["npx", ["--no-install", "tsx", "prisma/seed.ts"]]);
      commands.push([
        process.execPath,
        [
          "scripts/sounding-line/browser-authority.mjs",
          "--",
          ...genericBrowserTests,
          ...(plan.mode === "ordinary" ? ["--project", "chromium"] : []),
        ],
      ]);
    }
  }
  return commands;
}

function verificationPhase(command, argumentsList) {
  if (command === "npm" && argumentsList.join(" ") === "run build") return "build";
  if (argumentsList[0] === "scripts/sounding-line/browser-authority.mjs") return "browser-authority";
  if (argumentsList[0] === "scripts/sounding-line/run-browser-suite.mjs") return "suite-fixture-preflight";
  if (argumentsList[0]?.startsWith("scripts/homeport/prepare-phase7")) return "fixture-preflight";
  if (argumentsList[0] === "scripts/sounding-line/sqlite-bootstrap.mjs" || argumentsList.includes("prisma/seed.ts"))
    return "browser-server-preparation";
  return "preflight";
}

export function runVerificationCommands(root, plan, runCommand = run) {
  const timings = [];
  for (const [command, argumentsList] of verificationCommands(plan)) {
    const startedAt = Date.now();
    const phase = verificationPhase(command, argumentsList);
    try {
      runCommand(root, command, argumentsList, { env: verificationEnvironment(plan, command, argumentsList) });
      timings.push({ phase, durationMs: Date.now() - startedAt, status: "PASS" });
    } catch (error) {
      timings.push({ phase, durationMs: Date.now() - startedAt, status: "FAIL" });
      if (error && typeof error === "object") error.soundingLineTimings = timings;
      if (phase === "fixture-preflight")
        throw new Error(`SOUNDING_LINE_HOMEPORT_FIXTURE_PREFLIGHT_FAILED:${argumentsList[0]}`);
      throw error;
    }
  }
  return timings;
}

export function failureCategoryFor(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:")) return "INVALID_SERVER_TOPOLOGY";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:")) return "INFRASTRUCTURE_STARTUP_FAILURE";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:")) return "INFRASTRUCTURE_RUNTIME_FAILURE";
  if (message.startsWith("SOUNDING_LINE_HOMEPORT_FIXTURE_PREFLIGHT_FAILED:")) return "FIXTURE_ORCHESTRATION_FAILURE";
  if (message.startsWith("SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:"))
    return "SUITE_FIXTURE_CONTRACT_UNSATISFIED";
  if (
    message.startsWith("SOUNDING_LINE_PRODUCT_AND_CONTROL_PLANE_MIXED:") ||
    message.startsWith("SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE:")
  )
    return "CANDIDATE_CLASSIFICATION_FAILURE";
  return "PRODUCT_FAILURE";
}

export function sanitizedFailureCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("SOUNDING_LINE_")) return message;
  return "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED";
}

async function readBrowserRuntimeReceipt(root) {
  try {
    return JSON.parse(await readFile(path.join(root, "artifacts", "sounding-line", "browser-runtime.json"), "utf8"));
  } catch {
    return null;
  }
}

async function readBrowserSuiteProfileReceipt(root) {
  try {
    return JSON.parse(
      await readFile(path.join(root, "artifacts", "sounding-line", "browser-suite-profile.json"), "utf8"),
    );
  } catch {
    return null;
  }
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
  const startedAt = new Date().toISOString();
  const preflightStartedAt = Date.now();
  let plan;
  let result;
  try {
    plan = await buildPlan({ root, baseSha, candidateSha, mode });
    result = {
      ...plan,
      planDigest: hash(plan),
      startedAt,
      timing: { classificationPreflightMs: Date.now() - preflightStartedAt, commands: [] },
      failureCategory: null,
      decision: "FAIL",
    };
    const verification = await runReconciledVerification(root, plan);
    result.timing.commands = verification.timings;
    result.evidenceReconciliation = {
      evidenceVersion: EVIDENCE_VERSION,
      obligations: verification.obligations,
      reconciliation: verification.reconciliation,
      finalization: verification.finalization,
      requiredObligations: verification.finalization.requiredObligations,
      freshObligations: verification.freshObligations,
      commandsAvoided: verification.commandsAvoided,
      avoidedDurationMs: verification.avoidedDurationMs,
    };
    result.browserQualification = await readBrowserRuntimeReceipt(root);
    result.browserSuiteProfile = await readBrowserSuiteProfileReceipt(root);
    if (result.browserQualification?.failureCategory)
      result.failureCategory = result.browserQualification.failureCategory;
    if (result.browserSuiteProfile?.failureCategory)
      result.failureCategory = result.browserSuiteProfile.failureCategory;
    result.decision = "PASS";
  } catch (error) {
    result ??= {
      version: 1,
      authority: "SOUNDING_LINE",
      mode,
      baseSha,
      candidateSha,
      startedAt,
      timing: { classificationPreflightMs: Date.now() - preflightStartedAt, commands: [] },
      decision: "FAIL",
    };
    result.error = sanitizedFailureCode(error);
    result.failureCategory = failureCategoryFor(error);
    result.timing.commands = error?.soundingLineTimings ?? result.timing.commands;
    result.browserQualification = await readBrowserRuntimeReceipt(root);
    result.browserSuiteProfile = await readBrowserSuiteProfileReceipt(root);
    if (result.browserQualification?.failureCategory)
      result.failureCategory = result.browserQualification.failureCategory;
    if (result.browserSuiteProfile?.failureCategory)
      result.failureCategory = result.browserSuiteProfile.failureCategory;
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

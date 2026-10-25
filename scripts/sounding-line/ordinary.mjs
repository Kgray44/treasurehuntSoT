#!/usr/bin/env node
/* Focused candidate verification. The workflow supplies a trusted copy of this file. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { builtinModules } from "node:module";
import { validateR8RawOriginals } from "./experience-r8-format.mjs";
import { existsSync, realpathSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_VERSION,
  FileEvidenceStore,
  createEvidenceFingerprint,
  canonicalJson,
  compareEvidenceFingerprints,
  digest as evidenceDigest,
  digestFileEntries,
  finalizeEvidence,
  verifyReceipt,
} from "./evidence.mjs";
import {
  browserSuiteProfiles,
  resolveBrowserSuiteDispatches,
  suiteBrowserProfileId,
} from "./browser-suite-profiles.mjs";
import { planProductExperience, verifyProductExperience } from "./product-experience.mjs";
import { runTrustedExperienceReplay } from "./experience-browser.mjs";
import { verifyTrustedExperienceAttestation } from "./experience-attestation.mjs";
import { revisionJson } from "./product-experience.mjs";
import { assertExceptionExecution, markExceptionTechnicalComplete } from "./experience-exception.mjs";
import { BROWSER_DIAGNOSTIC_CONTEXT, createBrowserDiagnosticSession } from "./browser-diagnostics.mjs";
import { withVerificationStage, verificationFailureObservation } from "./verification-diagnostics.mjs";
import { withSourceDiagnosticCapture } from "./source-diagnostics.mjs";
import { createR14Observation } from "./experience-r14-observability.mjs";
import { createCurrentAdmissionObservation } from "./experience-current-observability.mjs";
import { authenticateCompletedEvidence, authenticatedCompletedReceipt } from "./authenticated-completed-evidence.mjs";

const sha = /^[a-f0-9]{40}$/u;
const protectedBrowserScripts = new Map([
  ["scripts/sounding-line/run-browser-suite.mjs", fileURLToPath(new URL("./run-browser-suite.mjs", import.meta.url))],
  ["scripts/sounding-line/browser-authority.mjs", fileURLToPath(new URL("./browser-authority.mjs", import.meta.url))],
]);
function isProtectedBrowserHost(command, argumentsList) {
  return command === process.execPath && [...protectedBrowserScripts.values()].includes(argumentsList[0]);
}
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
    browserTests: ["tests/e2e/homeport-phase3.spec.ts", "tests/e2e/phase3-replay-resilience.spec.ts"],
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
  return execFileSync("git", argumentsList, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function trackedEntries(root, revision) {
  const output = execFileSync("git", ["ls-tree", "-rz", revision], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
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

// `npx` resolves through cmd.exe on Windows. Keep each command well below its
// 8,191-character command-line ceiling while retaining deterministic Vitest
// selection order. A complete set of chunks remains one unit obligation below.
export const WINDOWS_SAFE_VITEST_COMMAND_LENGTH = 6_000;

export function boundedVitestCommands(unitTests) {
  const prefix = ["--no-install", "vitest", "run"];
  const commands = [];
  let argumentsList = [...prefix];
  for (const testPath of unitTests) {
    const candidate = [...argumentsList, testPath];
    if (
      argumentsList.length > prefix.length &&
      commandLabel("npx", candidate).length > WINDOWS_SAFE_VITEST_COMMAND_LENGTH
    ) {
      commands.push(["npx", argumentsList]);
      argumentsList = [...prefix, testPath];
    } else {
      argumentsList = candidate;
    }
    if (commandLabel("npx", argumentsList).length > WINDOWS_SAFE_VITEST_COMMAND_LENGTH)
      throw new Error(`SOUNDING_LINE_UNIT_TEST_PATH_EXCEEDS_WINDOWS_COMMAND_LIMIT:${testPath}`);
  }
  if (argumentsList.length > prefix.length) commands.push(["npx", argumentsList]);
  return commands;
}

function normalizedCommand(plan, command, argumentsList) {
  const databases = new Map([
    [plan.databaseUrl, "file:./.sounding-line-CANDIDATE.sqlite"],
    ...Object.keys(browserSuiteProfiles).map((profile) => [
      suiteDatabaseUrl(plan.candidateSha, profile),
      `file:./.sounding-line-CANDIDATE-${profile}.sqlite`,
    ]),
  ]);
  const normalize = (value) => {
    if (value === plan.candidateSha) return "CANDIDATE";
    return databases.get(value) ?? value;
  };
  return { command, arguments: argumentsList.map(normalize) };
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

// A legacy preflight group can execute a complete browser suite or dedicated journey.
// Keep its canonical partition/order while binding browser inputs and always
// requiring fresh execution of its setup, production runtime and browser work.
function isWholeBrowserExecution(group) {
  return group.commands.some(
    ([command, argumentsList]) =>
      command === process.execPath &&
      ["scripts/sounding-line/run-browser-suite.mjs", "tests/admiralty/phase3/run-journeys.mjs"].includes(
        argumentsList[0],
      ),
  );
}

function browserFixturePaths(group) {
  return group.commands
    .flatMap(([, argumentsList]) => argumentsList)
    .filter(
      (argument) => argument.startsWith("scripts/") || argument.startsWith("prisma/") || argument.startsWith("tests/"),
    );
}

function isBrowserEvidenceObligation(group) {
  return group.kind === "browser" || isWholeBrowserExecution(group);
}

function requiresCurrentSetupOutput(group) {
  return (
    isWholeBrowserExecution(group) ||
    group.commands.some(
      ([command, argumentsList]) =>
        command === "npm" && ["run db:generate", "run build"].includes(argumentsList.join(" ")),
    )
  );
}

function requiresCurrentPolicyVerification(group) {
  return group.commands.some(
    ([command, argumentsList]) =>
      command === process.execPath &&
      argumentsList[0] === "--test" &&
      argumentsList.includes("tests/sounding-line/ordinary.test.mjs"),
  );
}

export function verificationObligationGroups(plan) {
  const commands = verificationCommands(plan);
  const browserCommands = commands.filter(([command, argumentsList]) => browserEvidenceCommand(command, argumentsList));
  const browserRequired = browserCommands.length > 0;
  const groups = [];
  let browserGroup = [];
  let unitGroup = [];
  for (const [command, argumentsList] of commands) {
    const build = command === "npm" && argumentsList.join(" ") === "run build";
    if (browserEvidenceCommand(command, argumentsList) || (browserRequired && build)) {
      if (unitGroup.length) {
        groups.push({ kind: "unit", commands: unitGroup });
        unitGroup = [];
      }
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
    if (kind === "unit") {
      unitGroup.push([command, argumentsList]);
      continue;
    }
    if (unitGroup.length) {
      groups.push({ kind: "unit", commands: unitGroup });
      unitGroup = [];
    }
    groups.push({ kind, commands: [[command, argumentsList]] });
  }
  if (unitGroup.length) groups.push({ kind: "unit", commands: unitGroup });
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
const builtinSpecifiers = new Set(builtinModules.map((name) => name.replace(/^node:/u, "")));

function resolveSourceImport(snapshot, importer, specifier) {
  const builtin = specifier.replace(/^node:/u, "");
  if (specifier.startsWith("node:") || builtinSpecifiers.has(builtin)) return { path: null, unknown: true };
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
    // Unresolved computed imports/filesystem inputs cannot establish a reusable
    // semantic closure merely because their caller lives under src/.
    if (
      /\b(?:import|require)\s*\((?!\s*(?:"[^"\\\r\n]*"|'[^'\\\r\n]*')\s*\))/u.test(contents) ||
      /\b(?:import|require)\s*\//u.test(contents) ||
      /\b(?:process|globalThis|global|Reflect|eval|Function)\b|\.\s*constructor\b|\[\s*["']constructor["']\s*\]|\brequire\b(?!\s*\()/u.test(
        contents,
      ) ||
      /\bimport\s*\.\s*meta\s*\.\s*env/u.test(contents) ||
      /\b(?:readFile(?:Sync)?|readdir(?:Sync)?|createReadStream)\s*\(/u.test(contents)
    )
      unknown = true;
    for (const match of contents.matchAll(
      /\b(?:readFile(?:Sync)?|readdir(?:Sync)?|createReadStream)\s*\(\s*(["'])([^"']+)\1/gu,
    )) {
      const input = path.posix.normalize(match[2]);
      if (snapshot.byPath.has(input) && !visited.has(input)) queue.push(input);
      // CWD and non-file APIs are not inferred from a string alone. Their
      // literal tracked bytes are included, while reuse remains indeterminate.
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
  if (isBrowserEvidenceObligation(group)) return plan.selected.browserTests;
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
  const browserEvidence = isBrowserEvidenceObligation(group);
  let entries = [];
  let unknown = false;
  if (group.kind === "unit") {
    const closure = staticSourceClosure(snapshot, tests);
    entries = closure.entries;
    unknown = closure.unknown;
  } else if (requiresCurrentSetupOutput(group) && !browserEvidence && group.kind !== "build") {
    const setup = prefixEntries(snapshot, ["prisma/", "scripts/"]);
    const dependencies = staticSourceClosure(
      snapshot,
      setup.map((entry) => entry.path),
    );
    entries = dependencies.entries;
    unknown = dependencies.unknown;
  } else if (browserEvidence || group.kind === "build") {
    // Browser setup and tests can read public models, photographic fixtures and
    // runtime files without importing them. Keep this conservative closure until
    // an independently reviewed narrower dependency proof exists.
    entries = prefixEntries(snapshot, ["src/", "app/", "components/", "lib/", "public/", "styles/", "prisma/"]);
    const runtimeImports = staticSourceClosure(
      snapshot,
      entries.map((entry) => entry.path),
    );
    // Runtime imports can legitimately leave product prefixes, including JSON
    // registries under Development_Docs. Their bytes are product dependencies.
    entries.push(...runtimeImports.entries);
    unknown ||= runtimeImports.unknown;
    if (browserEvidence) {
      entries.push(...prefixEntries(snapshot, ["scripts/", "tests/e2e/", "tests/config/", "testing/"]));
      const runners = staticSourceClosure(snapshot, browserFixturePaths(group));
      entries.push(...runners.entries);
      unknown ||= runners.unknown;
    }
  } else if (group.kind === "migration") {
    const migration = staticSourceClosure(
      snapshot,
      prefixEntries(snapshot, ["prisma/", "scripts/"]).map((entry) => entry.path),
    );
    entries = migration.entries;
    unknown = migration.unknown;
  } else if (group.commandLabels.some((label) => label.includes("private-content/scan"))) {
    // The scanner observes repository content, so a narrow closure would be unsafe.
    entries = snapshot.entries;
  } else if (group.commandLabels.some((label) => label.includes("tsc --noEmit"))) {
    const typecheck = staticSourceClosure(
      snapshot,
      prefixEntries(snapshot, ["src/", "app/", "components/", "lib/", "scripts/", "tests/", "prisma/"]).map(
        (entry) => entry.path,
      ),
    );
    entries = typecheck.entries;
    unknown = typecheck.unknown;
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
  const [
    ordinarySource,
    evidenceSource,
    experienceSource,
    experienceBrowserSource,
    experienceAttestationSource,
    exceptionSource,
    exceptionPolicy,
    r8FormatSource,
    r9Source,
  ] = await Promise.all([
    readFile(modulePath, "utf8"),
    readFile(evidencePath, "utf8"),
    readFile(path.join(path.dirname(modulePath), "product-experience.mjs"), "utf8"),
    readFile(path.join(path.dirname(modulePath), "experience-browser.mjs"), "utf8"),
    readFile(path.join(path.dirname(modulePath), "experience-attestation.mjs"), "utf8"),
    readFile(path.join(path.dirname(modulePath), "experience-exception.mjs"), "utf8"),
    Promise.resolve(revisionJson(root, candidateSha, "testing/product-experience-exceptions.json", true)),
    readFile(path.join(path.dirname(modulePath), "experience-r8-format.mjs"), "utf8"),
    readFile(path.join(path.dirname(modulePath), "experience-r9.mjs"), "utf8"),
  ]);
  return {
    root,
    candidateSha,
    entries,
    byPath: new Map(entries.map((entry) => [entry.path, entry])),
    // Pure unit execution uses the actual verifier/evidence semantic engine.
    // Campaign admission/review/custody is recomputed separately for every plan;
    // unrelated exception-registry rows are not unit execution dependencies.
    unitEvidencePolicyIdentity: evidenceDigest({ ordinarySource, evidenceSource, version: EVIDENCE_VERSION }),
    authorityIdentity: evidenceDigest({
      ordinarySource,
      evidenceSource,
      experienceSource,
      experienceBrowserSource,
      experienceAttestationSource,
      exceptionSource,
      exceptionPolicy,
      r8FormatSource,
      r9Source,
      version: EVIDENCE_VERSION,
    }),
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
    const runtimeSetup = requiresCurrentSetupOutput(group);
    const browserEvidence = isBrowserEvidenceObligation(group);
    const currentPolicy = requiresCurrentPolicyVerification(group);
    const closure = evidenceClosure(snapshot, group, plan);
    const testPaths = testPathsFor(group, plan);
    const tests =
      group.kind === "unit" || browserEvidence
        ? staticSourceClosure(snapshot, testPaths)
        : pathEntries(snapshot, testPaths);
    const fixturePaths = browserEvidence
      ? browserFixturePaths(group)
      : runtimeSetup
        ? prefixEntries(snapshot, ["scripts/"]).map((entry) => entry.path)
        : [];
    const fixtures = fixturePaths.length
      ? staticSourceClosure(snapshot, fixturePaths)
      : { entries: [], unknown: false };
    const schema =
      browserEvidence || group.kind === "migration" || runtimeSetup ? prefixEntries(snapshot, ["prisma/"]) : [];
    const inapplicableDependencyClasses = [];
    if (!fixturePaths.length) inapplicableDependencyClasses.push("fixtureDigest");
    if (!schema.length) inapplicableDependencyClasses.push("schemaDigest");
    if (!browserEvidence) inapplicableDependencyClasses.push("browserIdentity");
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
      browserIdentity: browserEvidence ? browserIdentity(snapshot) : null,
      environmentClass: snapshot.environmentClass,
      soundingLinePolicyDigest:
        group.kind === "unit" ? snapshot.unitEvidencePolicyIdentity : snapshot.authorityIdentity,
      authorityIdentity: "SOUNDING_LINE_DIRECT_V14_BROWSER_CLOSURE_2",
      inapplicableDependencyClasses,
    });
    return {
      ...group,
      fingerprint,
      // The owned browser profile still inherits ambient process environment.
      // Do not claim reusable browser proof until producer/runtime provenance is
      // independently authenticated; complete source closure alone is insufficient.
      reuseIndeterminate:
        closure.unknown || tests.unknown || fixtures.unknown || browserEvidence || runtimeSetup || currentPolicy,
      ...(group.kind === "browser"
        ? { reuseReason: "BROWSER_RUNTIME_PROVENANCE_UNAUTHENTICATED" }
        : runtimeSetup
          ? { reuseReason: "SETUP_OUTPUT_NOT_ATTESTED" }
          : currentPolicy
            ? { reuseReason: "CURRENT_POLICY_VERIFICATION_REQUIRED" }
            : {}),
    };
  });
}

// This memory accepts whole PASS observations from this parent or the opaque
// authenticated protected-producer reader. Restored JSON alone is never proof.
const parentObservedReceipts = new Map();
const parentObservedProvenance = new Map();

function parentConstructedReceipt(payload) {
  const identity = evidenceDigest({
    candidateSha: payload.candidateSha,
    obligationId: payload.obligationId,
    fingerprintDigest: payload.fingerprint.fingerprintDigest,
    disposition: payload.disposition,
    originalReceiptId: payload.originalReceiptId ?? null,
  });
  const unsigned = {
    version: EVIDENCE_VERSION,
    kind: "sounding-line-evidence-receipt",
    immutable: true,
    id: `sl14-${identity.slice(0, 32)}`,
    ...payload,
  };
  return { ...unsigned, receiptDigest: evidenceDigest(unsigned) };
}

function assertExactParentReceipt(receipt, payload) {
  if (canonicalJson(receipt) !== canonicalJson(parentConstructedReceipt(payload)))
    throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_RECEIPT_CHANGED");
}

function rememberObservedReceipt(root, receipt, provenance = null) {
  const key = `${path.resolve(root)}:${receipt.receiptDigest}`;
  parentObservedReceipts.set(key, canonicalJson(receipt));
  if (provenance) parentObservedProvenance.set(key, JSON.parse(canonicalJson(provenance)));
}

function parentObservedResolution(root, obligation, candidateSha) {
  const prefix = `${path.resolve(root)}:`;
  let prior = null;
  for (const [key, encoded] of parentObservedReceipts) {
    if (!key.startsWith(prefix)) continue;
    const receipt = JSON.parse(encoded);
    if (receipt.obligationId !== obligation.id) continue;
    prior = receipt;
    if (reusableReceiptDisposition(root, receipt, obligation.fingerprint)) continue;
    return {
      disposition: receipt.candidateSha === candidateSha ? "PRESERVED" : "REBOUND",
      reasonCodes: ["TRUSTED_PARENT_OBSERVED_SEMANTIC_FINGERPRINT_MATCH"],
      receipt,
    };
  }
  return prior
    ? {
        ...compareEvidenceFingerprints({
          prior: prior.fingerprint,
          current: obligation.fingerprint,
          priorReceiptId: prior.id,
        }),
        receipt: null,
      }
    : null;
}

function reusableReceiptDisposition(root, receipt, fingerprint) {
  if (!verifyReceipt(receipt).valid) return "EVIDENCE_INTEGRITY_FAILURE";
  let actual;
  try {
    actual = createEvidenceFingerprint(receipt.fingerprint);
  } catch {
    return "EVIDENCE_FINGERPRINT_INVALID";
  }
  if (
    canonicalJson(actual) !== canonicalJson(receipt.fingerprint) ||
    compareEvidenceFingerprints({ prior: actual, current: fingerprint }).disposition !== "PRESERVED"
  )
    return "EVIDENCE_FINGERPRINT_INVALID";
  if (parentObservedReceipts.get(`${path.resolve(root)}:${receipt.receiptDigest}`) !== canonicalJson(receipt))
    return "EVIDENCE_PRODUCER_UNAUTHENTICATED";
  return null;
}

export function completedEvidenceDirectory(
  root,
  authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
) {
  const candidate = realpathSync(root);
  const authority = realpathSync(authorityRoot);
  const relative = path.relative(candidate, authority);
  // Same-root local verification stays valid, but cannot label a directory in
  // the candidate as an independent protected-authority export.
  if (!relative.startsWith(`..${path.sep}`) && relative !== "..") return undefined;
  return path.join(authority, "artifacts", "sounding-line", "completed-evidence");
}

export function completedEvidenceEnvironmentClass(plan, environment = process.env) {
  const developmentRole = [environment.SOUNDING_LINE_ROLE, environment.SOUNDING_LINE_EXECUTION_ROLE].includes(
    "DEVELOPMENT_ONLY",
  );
  const diagnosticLease = Object.entries(environment).some(
    ([key, value]) => value && /(?:DIAGNOSTIC|POSTTECHNICAL|HISTORICAL_VALIDATION).*LEASE$/u.test(key),
  );
  return plan.mode === "ordinary" &&
    environment.SOUNDING_LINE_EVIDENCE_PURPOSE === "PROTECTED_FINAL_VERIFICATION" &&
    environment.GITHUB_ACTIONS === "true" &&
    environment.GITHUB_REPOSITORY === "Kgray44/treasurehuntSoT" &&
    environment.GITHUB_JOB === "final-check" &&
    environment.GITHUB_EVENT_NAME === "pull_request_target" &&
    environment.GITHUB_WORKFLOW_REF ===
      "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main" &&
    !developmentRole &&
    !diagnosticLease
    ? "github-actions-nonbrowser-controlled"
    : "UNSUPPORTED";
}

async function completedEvidenceCheckpoint(root, plan, planDigest, directory) {
  if (!directory) return null;
  const target = path.resolve(directory);
  const relative = path.relative(await realpath(root), target);
  if (!relative.startsWith(`..${path.sep}`) && relative !== "..")
    throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_MUST_BE_OUTSIDE_CANDIDATE");
  await mkdir(path.dirname(target), { recursive: true });
  if ((await realpath(path.dirname(target))) !== path.dirname(target))
    throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_PARENT_SYMLINK");
  await mkdir(target, { mode: 0o700 });
  const st = await lstat(target);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_ROOT_INVALID");
  const authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const publicNumber = (value) =>
    /^[1-9][0-9]*$/u.test(value ?? "") && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const producerObservation = {
    authentication: "UNAUTHENTICATED_OBSERVED_METADATA",
    environmentClass: completedEvidenceEnvironmentClass(plan),
    repository: process.env.GITHUB_REPOSITORY ?? null,
    runId: publicNumber(process.env.GITHUB_RUN_ID),
    runAttempt: publicNumber(process.env.GITHUB_RUN_ATTEMPT),
    workflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
    workflowSha: process.env.GITHUB_WORKFLOW_SHA ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
    job: process.env.GITHUB_JOB ?? null,
    authoritySha: git(authorityRoot, ["rev-parse", "HEAD"]),
    authorityModuleSha256: createHash("sha256")
      .update(await readFile(fileURLToPath(import.meta.url)))
      .digest("hex"),
    candidateTree: git(root, ["rev-parse", `${plan.candidateSha}^{tree}`]),
    sourceDigest: plan.productExperience?.sourceDigest ?? null,
  };
  let sequence = 0;
  return async (receipts) => {
    const entries = receipts.map((receipt) => {
      if (parentObservedReceipts.get(`${path.resolve(root)}:${receipt.receiptDigest}`) !== canonicalJson(receipt))
        throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_NOT_PARENT_OBSERVED");
      return JSON.parse(canonicalJson(receipt));
    });
    // Each create-only checkpoint is a completed prefix. A later failure or
    // cancellation does not change it into final qualification or a partial PASS.
    const checkpoint = {
      version: 1,
      kind: "sounding-line-completed-obligation-checkpoint",
      authentication: "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER",
      candidateSha: plan.candidateSha,
      baseSha: plan.baseSha,
      planDigest,
      producerObservation,
      completedWholeObligations: entries.length,
      receipts: entries,
      wholeVerificationPassed: false,
      qualification: false,
    };
    await writeFile(
      path.join(target, `checkpoint-${String(++sequence).padStart(4, "0")}.json`),
      `${canonicalJson(checkpoint)}\n`,
      { flag: "wx", mode: 0o600 },
    );
  };
}

export async function runReconciledVerification(
  root,
  plan,
  runCommand = run,
  { completedEvidenceRoot, authenticatedEvidence } = {},
) {
  if (git(root, ["rev-parse", "HEAD"]) !== plan.candidateSha)
    throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_HEAD_CHANGED");
  git(root, ["diff", "--exit-code", "HEAD", "--"]);
  const obligations = await withVerificationStage("EVIDENCE_FINGERPRINTS", () => buildEvidenceObligations(root, plan), {
    observeFailure: false,
  });
  const store = new FileEvidenceStore(path.join(root, "artifacts", "sounding-line", "evidence-store"));
  const observedRoot = path.join(root, "artifacts", "sounding-line", "parent-observed-evidence");
  await mkdir(observedRoot, { recursive: true });
  // Never overwrite or promote a restored, candidate-writable receipt. Fresh
  // observations use a new ledger; historical/cache bytes remain untouched.
  const observedStore = new FileEvidenceStore(await mkdtemp(path.join(observedRoot, "observation-")));
  const planDigest = evidenceDigest({
    mode: plan.mode,
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    obligations: obligations.map((entry) => entry.id),
  });
  const checkpoint = await completedEvidenceCheckpoint(root, plan, planDigest, completedEvidenceRoot);
  const receipts = [];
  const reconciliation = [];
  const timings = [];
  for (const obligation of obligations) {
    let resolution;
    let producerProvenance = null;
    if (plan.mode === "release")
      resolution = { disposition: "FRESH", reasonCodes: ["RELEASE_MODE_EXHAUSTIVE"], receipt: null };
    else if (obligation.reuseIndeterminate)
      resolution = {
        disposition: "CONSERVATIVE_FALLBACK",
        reasonCodes: [obligation.reuseReason ?? "SEMANTIC_CLOSURE_INDETERMINATE"],
        receipt: null,
      };
    else {
      try {
        const authenticated = authenticatedCompletedReceipt(authenticatedEvidence, {
          root,
          candidateSha: plan.candidateSha,
          obligationId: obligation.id,
          fingerprint: obligation.fingerprint,
        });
        if (authenticated) {
          producerProvenance = authenticatedEvidence.provenance.find(
            (entry) => entry.receiptId === authenticated.id && entry.receiptDigest === authenticated.receiptDigest,
          );
          if (!producerProvenance) throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_PROVENANCE_MISSING");
          rememberObservedReceipt(root, authenticated, producerProvenance);
          resolution = {
            disposition: authenticated.candidateSha === plan.candidateSha ? "PRESERVED" : "REBOUND",
            reasonCodes: ["AUTHENTICATED_PROTECTED_PRODUCER_FINGERPRINT_MATCH"],
            receipt: authenticated,
          };
        } else
          resolution =
            parentObservedResolution(root, obligation, plan.candidateSha) ??
            (await store.findReusable({
              obligationId: obligation.id,
              candidateSha: plan.candidateSha,
              fingerprint: obligation.fingerprint,
            }));
      } catch {
        resolution = {
          disposition: "CONSERVATIVE_FALLBACK",
          reasonCodes: ["EVIDENCE_STORE_UNREADABLE"],
          receipt: null,
        };
      }
    }
    if (["PRESERVED", "REBOUND"].includes(resolution.disposition) && resolution.receipt) {
      producerProvenance ??=
        parentObservedProvenance.get(`${path.resolve(root)}:${resolution.receipt.receiptDigest}`) ?? null;
      const denial = reusableReceiptDisposition(root, resolution.receipt, obligation.fingerprint);
      if (denial) resolution = { disposition: "CONSERVATIVE_FALLBACK", reasonCodes: [denial], receipt: null };
    }
    if (["PRESERVED", "REBOUND"].includes(resolution.disposition) && resolution.receipt) {
      const receipt =
        resolution.disposition === "PRESERVED"
          ? resolution.receipt
          : await observedStore.rebind({
              sourceReceipt: resolution.receipt,
              candidateSha: plan.candidateSha,
              obligationId: obligation.id,
              fingerprint: obligation.fingerprint,
              planDigest,
              commands: obligation.commandLabels,
              decision: resolution,
            });
      if (resolution.disposition === "REBOUND") {
        const source = resolution.receipt;
        const identity = {
          originalReceiptId: source.id,
          priorFingerprintDigest: source.fingerprint.fingerprintDigest,
          currentFingerprintDigest: obligation.fingerprint.fingerprintDigest,
          disposition: resolution.disposition,
        };
        assertExactParentReceipt(receipt, {
          candidateSha: plan.candidateSha,
          obligationId: obligation.id,
          fingerprint: obligation.fingerprint,
          planDigest,
          commands: obligation.commandLabels,
          durationMs: source.durationMs ?? null,
          authorityVersion: EVIDENCE_VERSION,
          producer: "SOUNDING_LINE_DIRECT",
          result: "PASSED",
          disposition: resolution.disposition,
          originalReceiptId: source.id,
          lineage: {
            version: EVIDENCE_VERSION,
            immutable: true,
            ...identity,
            reasonCodes: resolution.reasonCodes,
            lineageDigest: evidenceDigest(identity),
          },
        });
      }
      rememberObservedReceipt(root, receipt, producerProvenance);
      receipts.push(receipt);
      if (checkpoint) await checkpoint(receipts);
      reconciliation.push({
        obligationId: obligation.id,
        disposition: resolution.disposition,
        reasonCodes: resolution.reasonCodes,
        receiptId: receipt.id,
        commandsAvoided: obligation.commandLabels,
        freshExecuted: false,
        ...(producerProvenance ? { producerProvenance: JSON.parse(canonicalJson(producerProvenance)) } : {}),
      });
      timings.push({ phase: obligation.kind, durationMs: 0, status: "REUSED", obligationId: obligation.id });
      continue;
    }
    const startedAt = Date.now();
    try {
      for (const [command, argumentsList] of obligation.commands)
        await runCommand(root, command, argumentsList, { env: verificationEnvironment(plan, command, argumentsList) });
      const durationMs = Date.now() - startedAt;
      if (git(root, ["rev-parse", "HEAD"]) !== plan.candidateSha)
        throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_HEAD_CHANGED");
      git(root, ["diff", "--exit-code", "HEAD", "--"]);
      const receipt = await observedStore.writeFresh({
        candidateSha: plan.candidateSha,
        obligationId: obligation.id,
        fingerprint: obligation.fingerprint,
        planDigest,
        commands: obligation.commandLabels,
        durationMs,
      });
      assertExactParentReceipt(receipt, {
        candidateSha: plan.candidateSha,
        obligationId: obligation.id,
        fingerprint: obligation.fingerprint,
        planDigest,
        commands: obligation.commandLabels,
        durationMs,
        authorityVersion: EVIDENCE_VERSION,
        producer: "SOUNDING_LINE_DIRECT",
        result: "PASSED",
        disposition: "FRESH",
        originalReceiptId: null,
      });
      rememberObservedReceipt(root, receipt);
      receipts.push(receipt);
      if (checkpoint) await checkpoint(receipts);
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

export function run(root, command, argumentsList, { env = {}, ...options } = {}) {
  process.stdout.write(`\n> ${command} ${argumentsList.join(" ")}\n`);
  const candidateEnvironment = { ...process.env, ...env };
  if (!Object.hasOwn(env, BROWSER_DIAGNOSTIC_CONTEXT)) delete candidateEnvironment[BROWSER_DIAGNOSTIC_CONTEXT];
  delete candidateEnvironment.GH_TOKEN;
  delete candidateEnvironment.GITHUB_TOKEN;
  if (!isProtectedBrowserHost(command, argumentsList)) {
    delete candidateEnvironment.GITHUB_OUTPUT;
    delete candidateEnvironment.SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE;
  }
  execFileSync(command, argumentsList, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: candidateEnvironment,
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

export async function buildPlan({
  root,
  baseSha,
  candidateSha,
  mode = "ordinary",
  experienceEvidenceRequired = true,
  prNumber = process.env.SOUNDING_LINE_PR_NUMBER,
}) {
  const baseTree = git(root, ["rev-parse", `${baseSha}^{tree}`]);
  const candidateTree = git(root, ["rev-parse", `${candidateSha}^{tree}`]);
  assertBinding({ baseSha, candidateSha, baseTree, candidateTree });
  git(root, ["merge-base", "--is-ancestor", baseSha, candidateSha]);
  validateR8RawOriginals({ root, baseSha, candidateSha });
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
  const productExperience = await withVerificationStage(
    "EXPERIENCE_PLAN",
    () =>
      planProductExperience({
        root,
        baseSha,
        candidateSha,
        changedPaths: classification.admissionPaths,
        prNumber,
      }),
    { observeFailure: false },
  );
  if (productExperience.applicable) {
    for (const browserTest of productExperience.browserTests)
      if (!browserTests.includes(browserTest))
        throw new Error(`PRODUCT_EXPERIENCE_BROWSER_TEST_MISSING:${browserTest}`);
    selection.browserTests = [...new Set([...selection.browserTests, ...productExperience.browserTests])].sort();
    if (experienceEvidenceRequired) {
      await withVerificationStage(
        "COMMITTED_EVIDENCE",
        () => verifyProductExperience(root, candidateSha, productExperience),
        { observeFailure: false },
      );
      productExperience.trustedAttestation = await withVerificationStage(
        "TRUSTED_ATTESTATION",
        () =>
          verifyTrustedExperienceAttestation({
            root,
            plan: productExperience,
            evidence: revisionJson(root, candidateSha, productExperience.evidencePath),
          }),
        { observeFailure: false },
      );
    }
  }
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
    productExperience,
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
    ["npm", ["run", "db:generate"]],
    ["npx", ["--no-install", "tsc", "--noEmit"]],
    ["npx", ["--no-install", "tsx", "scripts/private-content/scan.ts"]],
  ];
  const formatPaths = plan.mode === "release" ? ["."] : plan.safetyPaths;
  const lintPaths = plan.mode === "release" ? ["."] : plan.lintPaths;
  if (formatPaths.length) commands.unshift(["npx", ["--no-install", "prettier", "--check", ...formatPaths]]);
  if (lintPaths.length) commands.splice(1, 0, ["npx", ["--no-install", "eslint", ...lintPaths]]);
  if (plan.selected.unitTests.length) commands.push(...boundedVitestCommands(plan.selected.unitTests));
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
    if (plan.selected.browserTests.includes(homeportPhase4BrowserTest) || selectedHomeportPhase7.length) {
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
      commands.push([
        process.execPath,
        [
          "scripts/sounding-line/run-browser-suite.mjs",
          "--profile",
          "generic",
          "--candidate",
          plan.candidateSha,
          "--database-url",
          suiteDatabaseUrl(plan.candidateSha, "generic"),
          "--",
          ...genericBrowserTests,
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
  if (message.startsWith("PRODUCT_EXPERIENCE_")) return "PRODUCT_EXPERIENCE_FAILURE";
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

// Fixed tokens only: contract names, integration owners and other suffix details
// are not safe ordinary-decision diagnostics.
const productExperienceFailureCodes = new Set(
  `
  ACCEPTED_REFERENCE_INVALID ACCEPTED_REFERENCE_UNKNOWN ACCESSIBILITY_OR_RESPONSIVE_DEFECT
  ANONYMOUS_ROLE_STATE_MISMATCH APPLICABILITY_INDETERMINATE ARTIFACT_DIGEST_MISMATCH
  ARTIFACT_IDENTITY_INVALID ARTIFACT_NOT_TRACKED_REGULAR_FILE ARTIFACT_ORIGIN_INVALID ARTIFACT_PATH_INVALID
  ATTESTATION_ACCESS_UNAVAILABLE ATTESTATION_ARCHIVE_DIGEST_MISMATCH ATTESTATION_ARCHIVE_INVALID
  ATTESTATION_JSON_INVALID ATTESTATION_MANIFEST_MISSING ATTESTATION_PROVENANCE_INVALID
  ATTESTATION_REPOSITORY_INVALID ATTESTATION_SOURCE_MISMATCH BASELINE_DEBT_NOT_EXEMPT BASELINE_EVIDENCE_INVALID
  BLOCKING_FINDING CANDIDATE_BASELINE_DEBT_FORBIDDEN CONTINUITY_OBSERVATION_MISSING
  CONTRACT_FIELD_INVALID CONTRACT_MISSING CROSS_DEVICE_CONTINUITY_FAILED CROSS_PROJECT_CONTINUITY_REQUIRED
  CROSS_PROJECT_JOURNEY_FAILED ENTRY_POINT_INVALID EVIDENCE_MISSING EVIDENCE_SOURCE_MISMATCH
  EXACT_SOURCE_REQUIRED EXPERIENCE_DESIGN_REQUIRED FEEDBACK_BOUNDARY_INVALID FINDING_INVALID FINDINGS_MISSING
  HOMEPORT_JOURNEY_UNKNOWN HOMEPORT_SCREEN_UNKNOWN INDEPENDENT_REVIEW_REQUIRED INTEGRATION_SCOPE_REQUIRED
  ISOLATED_ROLE_FIXTURE_REQUIRED JOURNEY_ACTION_INVALID JOURNEY_DESTINATION_FAILED JOURNEY_INVALID
  JOURNEY_ROLE_COVERAGE_INVALID KEYBOARD_FOCUS_FAILED KEYBOARD_REACHABILITY_FAILED MOTION_BOUNDARY_REQUIRED
  NATURAL_JOURNEY_REQUIRED OWNER_ACCEPTANCE_UNAUTHORIZED PROFILE_ADAPTER_REQUIRED RECORDING_INVALID
  RECORDING_REQUIRED REGISTRY_INVALID REPAIR_EVIDENCE_MISSING RESPONSIVENESS_FAILED RETURN_PATH_PREDICATE_REQUIRED
  RETURN_PATH_REQUIRED RETURN_WITHOUT_DEPARTURE REVIEW_PACKET_MISMATCH REVIEW_UNRESOLVED ROLE_EXPERIENCE_MISSING
  ROLE_JOURNEY_MISSING ROLE_WITNESS_REQUIRED SCREENSHOT_INVALID SEMANTIC_JOURNEY_FAILED SEMANTIC_OUTCOME_REQUIRED
  SOURCE_SNAPSHOT_INVALID STATE_CAPTURE_MISSING SUBSTANTIVE_REVIEW_MISSING TASK_OWNED_LOOPBACK_REQUIRED
  TRUSTED_ATTESTATION_POLICY_MISSING TRUSTED_ATTESTATION_REQUIRED TRUSTED_CAPTURE_OR_REVIEW_MISMATCH
  TRUSTED_OBLIGATION_CHANGED TRUSTED_POLICY_INVALID TRUSTED_REPLAY_FAILED UNREGISTERED_SURFACE USER_OUTCOME_FAILED
  VIEWPORT_UNSUPPORTED VISIBLE_CONTROL_REQUIRED ACTION_OUTCOME_NOT_OBSERVED
`
    .trim()
    .split(/\s+/u)
    .map((code) => `PRODUCT_EXPERIENCE_${code}`),
);

export function sanitizedFailureCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("PRODUCT_EXPERIENCE_")) {
    const token = message.split(":", 1)[0];
    return productExperienceFailureCodes.has(token) ? token : "PRODUCT_EXPERIENCE_FAILURE";
  }
  if (message.startsWith("SOUNDING_LINE_")) return message;
  return "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED";
}

export function browserDiagnosticRunner(diagnostics, runCommand = run) {
  return (root, command, argumentsList, options = {}) => {
    // Advance even before setup commands: their failure must not inherit an
    // earlier command's browser receipt. No random context enters the plan.
    const context = diagnostics.beginScope();
    const script = argumentsList[0] ?? "";
    const browserCommand =
      ["scripts/sounding-line/browser-authority.mjs", "scripts/sounding-line/run-browser-suite.mjs"].includes(script) ||
      /^scripts\/(?:admiralty|tideglass|homeport)\/run-.*(?:journeys|e2e)/u.test(script);
    const protectedScript = command === process.execPath ? protectedBrowserScripts.get(script) : undefined;
    const executionArguments = protectedScript ? [protectedScript, ...argumentsList.slice(1)] : argumentsList;
    return runCommand(root, command, executionArguments, {
      ...options,
      env: { ...options.env, ...(browserCommand ? context : {}) },
    });
  };
}
export function exceptionCommandRunner(plan, runCommand, authorize = assertExceptionExecution) {
  return async (root, command, argumentsList, options = {}) => {
    if (plan.exception && argumentsList[0] === "scripts/sounding-line/run-browser-suite.mjs") {
      const lease = await authorize({ root, plan, kind: "technical", claim: true });
      options = { ...options, env: { ...options.env, SOUNDING_LINE_EXCEPTION_LEASE: lease.lease } };
    }
    return runCommand(root, command, argumentsList, options);
  };
}

export async function completeOrdinaryVerification({
  root,
  plan,
  result,
  verification,
  diagnostics,
  verifyExperience = verifyProductExperience,
  replay = runTrustedExperienceReplay,
}) {
  // Verification has returned, so retain its observations even if a later stage fails.
  // These fields do not change the overall FAIL decision or qualify a replay.
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
  await withVerificationStage("TECHNICAL_COMPLETE", () => markExceptionTechnicalComplete(root, plan.productExperience));
  if (plan.productExperience.applicable) diagnostics.clearScope();
  result.productExperienceDecision = await withVerificationStage("HISTORICAL_EXPERIENCE", () =>
    verifyExperience(root, plan.candidateSha, plan.productExperience),
  );
  result.productExperienceReplay = await withVerificationStage("EXPERIENCE_REPLAY", () =>
    replay({
      root,
      plan: plan.productExperience,
      environment: verificationEnvironment(plan, process.execPath, ["scripts/sounding-line/browser-authority.mjs"]),
      diagnostics,
    }),
  );
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
  let diagnostics;
  let r14Observation, currentAdmissionObservation, activeObservation;
  try {
    plan = await withVerificationStage("CLASSIFICATION", () => buildPlan({ root, baseSha, candidateSha, mode }));
    if (plan.productExperience.exception && mode !== "ordinary")
      throw new Error("PRODUCT_EXPERIENCE_EXCEPTION_RELEASE_FORBIDDEN");
    const exceptionLease = plan.productExperience.applicable
      ? await withVerificationStage("ORDINARY_ADMISSION", () =>
          assertExceptionExecution({ root, plan: plan.productExperience, kind: "ordinary", claim: true }),
        )
      : null;
    if (exceptionLease) {
      process.env.SOUNDING_LINE_EXCEPTION_ORDINARY_LEASE = exceptionLease.lease;
      process.env.SOUNDING_LINE_BASE_SHA = baseSha;
    }
    result = {
      ...plan,
      planDigest: hash(plan),
      startedAt,
      timing: { classificationPreflightMs: Date.now() - preflightStartedAt, commands: [] },
      failureCategory: null,
      decision: "FAIL",
    };
    let authenticatedEvidence;
    if (completedEvidenceEnvironmentClass(plan) === "github-actions-nonbrowser-controlled") {
      const intakeStartedAt = Date.now();
      try {
        authenticatedEvidence = await authenticateCompletedEvidence({ root, plan });
        result.completedEvidenceIntake = {
          status: authenticatedEvidence.admitted ? "AUTHENTICATED_ELIGIBLE_RECEIPTS" : "NO_ELIGIBLE_RECEIPTS_FRESH",
          admitted: authenticatedEvidence.admitted,
          provenance: authenticatedEvidence.provenance,
          rejections: authenticatedEvidence.rejections,
          qualification: false,
        };
      } catch (error) {
        result.completedEvidenceIntake = {
          status: "CONSERVATIVE_FRESH_FALLBACK",
          reason: /^SOUNDING_LINE_COMPLETED_EVIDENCE_[A-Z0-9_]+$/u.test(error?.message ?? "")
            ? error.message
            : "SOUNDING_LINE_COMPLETED_EVIDENCE_UNAVAILABLE",
          qualification: false,
        };
      }
      result.timing.evidenceIntakeMs = Date.now() - intakeStartedAt;
    } else result.completedEvidenceIntake = { status: "UNSUPPORTED_ENVIRONMENT_FRESH", qualification: false };
    diagnostics = createBrowserDiagnosticSession(root, { baseSha, candidateSha, planDigest: result.planDigest });
    r14Observation = createR14Observation({ root, plan: plan.productExperience });
    currentAdmissionObservation = createCurrentAdmissionObservation({ root, plan: plan.productExperience });
    activeObservation = currentAdmissionObservation ?? r14Observation;
    const verify = async () => {
      const verification = await withVerificationStage("TECHNICAL_VERIFICATION", () =>
        runReconciledVerification(
          root,
          plan,
          exceptionCommandRunner(plan.productExperience, browserDiagnosticRunner(diagnostics)),
          { completedEvidenceRoot: completedEvidenceDirectory(root), authenticatedEvidence },
        ),
      );
      await completeOrdinaryVerification({ root, plan, result, verification, diagnostics });
    };
    if (activeObservation) await withSourceDiagnosticCapture(activeObservation, verify);
    else await verify();
    const browserDiagnostics = await diagnostics.read();
    result.browserQualification = browserDiagnostics.runtime;
    result.browserSuiteProfile = browserDiagnostics.profile;
    if (result.browserQualification?.failureCategory)
      result.failureCategory = result.browserQualification.failureCategory;
    if (result.browserSuiteProfile?.failureCategory)
      result.failureCategory = result.browserSuiteProfile.failureCategory;
    result.decision = "PASS";
  } catch (error) {
    activeObservation?.rememberFinalFailure(error);
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
    result.failureObservation = verificationFailureObservation(error);
    result.failureCategory = failureCategoryFor(error);
    result.timing.commands = error?.soundingLineTimings ?? result.timing.commands;
    const browserDiagnostics = await diagnostics?.read();
    result.browserQualification = browserDiagnostics?.runtime ?? null;
    result.browserSuiteProfile = browserDiagnostics?.profile ?? null;
    if (result.browserQualification?.failureCategory)
      result.failureCategory = result.browserQualification.failureCategory;
    if (result.browserSuiteProfile?.failureCategory)
      result.failureCategory = result.browserSuiteProfile.failureCategory;
  }
  if (activeObservation) {
    const field = currentAdmissionObservation ? "currentAdmissionObservation" : "r14Observation";
    try {
      result[field] = await activeObservation.finish();
    } catch {
      result[field] = { status: "EVIDENCE_LOSS", evidenceLoss: true };
    }
    if (result[field].status !== "COMPLETE" && result.decision === "PASS") {
      result.decision = "FAIL";
      result.error = currentAdmissionObservation
        ? "SOUNDING_LINE_CURRENT_ADMISSION_OBSERVATION_INCOMPLETE"
        : "SOUNDING_LINE_R14_OBSERVATION_INCOMPLETE";
      result.failureCategory = "EXECUTION_UNKNOWN";
    }
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

/* Generate the one active, case-level Sounding Line registry. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import ts from "typescript";
import { promisify } from "node:util";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", ".next", "coverage", "artifacts"]);
const homeportContracts = JSON.parse(await fs.readFile(path.join(root, "testing", "contracts.json"), "utf8"))
  .contracts.map((contract) => contract.id)
  .filter((contractId) => contractId.startsWith("homeport."));
const wakebookContracts = JSON.parse(await fs.readFile(path.join(root, "testing", "contracts.json"), "utf8"))
  .contracts.map((contract) => contract.id)
  .filter((contractId) => contractId.startsWith("wakebook."));
const hash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 20);
const execFileAsync = promisify(execFile);
const normal = (value) => value.replaceAll("\\", "/");

function ownerFor(file) {
  if (file.includes("wakebook") || file.includes("api/passport/voyages")) return "project-wakebook";
  if (file.includes("deepwater")) return "project-deepwater";
  if (file.includes("homeport")) return "project-homeport";
  if (file.includes("private-content")) return "sealed-hold";
  if (file.includes("community")) return "harborlight";
  if (file.includes("wayfarer") || file.includes("passport")) return "wayfarer";
  if (file.includes("animation") || file.includes("lanternwake") || file.includes("journal")) return "lanternwake";
  if (file.includes("navigation")) return "platform-foundation";
  if (file.includes("chronicle") || file.includes("invitation") || file.includes("access-gates")) return "one-voyage";
  return "platform-foundation";
}

function unitFamily(file) {
  if (file.startsWith("src/wakebook/") || file.includes("api/passport/voyages")) return "unit.wakebook";
  if (file.startsWith("scripts/deepwater/") || file.startsWith("tests/deepwater/")) return "unit.deepwater";
  if (file.startsWith("src/homeport/") || file.startsWith("scripts/homeport/") || file.startsWith("tests/homeport/"))
    return "unit.homeport";
  if (file.startsWith("scripts/sounding-line/") || file.startsWith("tests/sounding-line/")) return "unit.sounding-line";
  if (file.startsWith("scripts/features/") || file.includes("feature-catalog")) return "unit.feature-catalog";
  if (file.includes("private-content")) return "unit.private-content";
  if (file.includes("community")) return "unit.community";
  if (file.includes("wayfarer") || file.includes("passport")) return "unit.wayfarer";
  if (file.includes("animation")) return "unit.animation";
  if (file.includes("journal")) return "unit.journal";
  if (file.includes("navigation")) return "unit.true-north";
  if (file.startsWith("src/app/api/") || file.includes("login") || file.includes("access")) return "unit.auth";
  if (file.includes("chronicle") || file.includes("/gm/") || file.includes("/server/") || file.includes("/domain/"))
    return "unit.one-voyage";
  if (file.includes("auth") || file.includes("access") || file.includes("login")) return "unit.auth";
  return "unit.platform-foundation";
}

function componentFamily(file) {
  if (file.includes("components/wakebook")) return "component.wakebook";
  if (file.includes("components/homeport")) return "component.homeport";
  if (file.includes("components/animation")) return "component.animation";
  if (file.includes("components/community")) return "component.community";
  if (file.includes("components/studio/Private")) return "component.private-operations";
  if (file.includes("components/studio")) return "component.studio";
  if (file.includes("components/wayfarer")) return "component.passport";
  if (file.includes("components/player/journal")) return "component.journal";
  if (file.includes("components/player/workspace/Artifact") || file.includes("Treasure")) return "component.artifacts";
  if (file.includes("components/player/workspace")) return "component.player-shell";
  if (file.includes("components/platform") || file.includes("AccessGate") || file.includes("SignIn"))
    return "component.auth";
  if (file.includes("components/gm") || file.includes("components/tales")) return "component.captain";
  if (file.includes("components/shell") || file.includes("Navigation")) return "component.navigation";
  return "component.player-shell";
}

function browserFamily(project, file, title) {
  const value = `${file} ${title}`.toLowerCase();
  // Only the dedicated project is the fast, dependency-free access sentinel.
  // Chromium/WebKit copies remain primary browser.auth cases and must not
  // inherit a fixture-free ownership contract they do not satisfy.
  if (file.endsWith("access-gates.spec.ts") && project === "sounding-line-access-sentinel")
    return "browser.access-sentinel";
  if (value.includes("wakebook")) return "browser.wakebook";
  if (value.includes("homeport") || project.includes("homeport")) return "browser.homeport";
  if (file.endsWith("chronicle-platform.spec.ts") || file.endsWith("acceptance.spec.ts"))
    return "browser.player-library";
  if (value.includes("access-gates") || value.includes("authentication") || value.includes("sign-in"))
    return "browser.auth";
  if (value.includes("invitation") || value.includes("project-one-voyage")) return "browser.invitations";
  if (value.includes("artifact") || value.includes("cabinet")) return "browser.artifacts";
  if (value.includes("passport") || value.includes("wayfarer")) return "browser.passport";
  if (value.includes("sealed-hold") || value.includes("private-content")) return "browser.private-operations";
  if (value.includes("harborlight") || value.includes("community")) return "browser.community";
  if (value.includes("studio")) return "browser.studio";
  if (value.includes("command-center") || value.includes("captain")) return "browser.captain";
  if (value.includes("true-north") || value.includes("navigation")) return "browser.navigation";
  if (value.includes("accessibility") || value.includes("keyboard") || value.includes("aria-"))
    return "browser.accessibility";
  if (value.includes("viewport") || value.includes("responsive") || value.includes("mobile"))
    return "browser.responsive";
  if (value.includes("animation") || value.includes("lifecycle") || value.includes("pageflip"))
    return "browser.animation-lifecycle";
  if (value.includes("journal") || value.includes("lanternwake")) return "browser.player-journal";
  if (value.includes("platform") || value.includes("acceptance")) return "browser.player-library";
  return "browser.cross-project";
}

function contractFor(file, family) {
  if (file.includes("wakebook") || family.includes("wakebook")) return wakebookContracts;
  if (file.includes("deepwater") || family === "unit.deepwater") return ["deepwater.capability-realization-integrity"];
  if (file.includes("homeport") || family === "unit.homeport") return homeportContracts;
  if (file.includes("private-content")) return ["sealed-hold-private-delivery", "public-privacy-projection"];
  if (file.includes("community")) return ["community-public-projection"];
  if (file.includes("wayfarer") || file.includes("passport")) return ["wayfarer-history-projection"];
  if (file.includes("artifact")) return ["artifact-grant-projection"];
  if (family.includes("journal") || family.includes("animation")) return ["journal-ready-state"];
  if (family.includes("auth") || file.includes("access") || file.includes("login"))
    return ["authentication-authorization"];
  if (family.includes("one-voyage") || family.includes("invitations")) return ["invitation-acceptance"];
  return ["authentication-authorization"];
}

function metadata(file, family, browser = null) {
  const privateOrCommunity =
    /deepwater|wakebook|homeport|private-content|community|wayfarer|passport|invitation|session/u.test(file);
  const high = privateOrCommunity || Boolean(browser);
  const ui = Boolean(browser) || file.endsWith(".tsx");
  return {
    owner: ownerFor(file),
    tier: browser ? 4 : family.startsWith("component.") ? 2 : 1,
    risk: high ? "HIGH" : "MODERATE",
    contracts: contractFor(file, family),
    sourcePaths: [file],
    consumerPaths: [],
    dependencies: [],
    fixtureFamily: browser ? "isolated-browser-fixture" : "repository-fixtures",
    fixture: browser
      ? "task-owned isolated fixture declared by the selected browser project"
      : "repository-owned deterministic fixtures",
    databaseOwnership: browser
      ? "task-owned copied or generated database; canonical database forbidden"
      : "no browser database ownership",
    browserOwnership: browser ? "task-owned Playwright context and state" : "not applicable",
    portOwnership: browser ? "task-owned allowlisted local application port" : "not applicable",
    resources: browser
      ? ["application-port", "sqlite-clone", "browser-chromium", "trace-root"]
      : ["node-slot", "vitest-worker-pool"],
    parallelSafety: browser ? "ISOLATED_MUTABLE_PARALLEL" : "READ_ONLY_PARALLEL",
    browserRequirements: browser ? [browser.project] : ["NOT_APPLICABLE"],
    deviceRequirements: browser ? ["configured-project"] : ["NOT_APPLICABLE"],
    viewportRequirements: browser ? ["governed-family-viewport"] : ["NOT_APPLICABLE"],
    motionRequirements: browser ? ["reduced-motion-declared"] : ["NOT_APPLICABLE"],
    networkRequirements: browser ? ["isolated-local-network"] : ["NOT_APPLICABLE"],
    positiveCases: ["declared-source-case"],
    negativeCases: high ? ["declared-negative-contract"] : ["NOT_APPLICABLE"],
    accessibilityRelevance: ui ? "RELEVANT" : "NOT_APPLICABLE",
    privacyRelevance: privateOrCommunity ? "RELEVANT" : "NOT_APPLICABLE",
    securityRelevance: high ? "RELEVANT" : "NOT_APPLICABLE",
    dataMutationClass: browser ? "ISOLATED_TEST_CLONE" : "READ_ONLY",
    expectedDurationMs: browser ? 120000 : 30000,
    hardBudgetMs: browser ? 600000 : 180000,
    retryPolicy: "NONE",
    releaseRelevance: browser
      ? "authoritative subsystem, mainline, and release evidence"
      : "authoritative registered contract evidence",
    gates: browser
      ? ["subsystem", "mainline", "release-candidate"]
      : ["local-change", "subsystem", "mainline", "release-candidate"],
    supersessionPolicy: "ACTIVE",
    historicalAliases: [],
    currentStatus: "ACTIVE",
  };
}

async function discoverPlaywright() {
  const { stdout } = await execFileAsync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--list"], {
    cwd: root,
    env: {
      ...process.env,
      HOMEPORT_PHASE4_EVIDENCE_ROOT: path.join(root, "artifacts", "sounding-line", "registry-discovery"),
    },
    maxBuffer: 8 * 1024 * 1024,
  });
  const cases = [];
  for (const entry of stdout.split(/\r?\n/u)) {
    const match = entry.match(/^\s+\[([^\]]+)\]\s+\S+\s+([^:]+):(\d+):\d+\s+\S+\s+(.+)$/u);
    if (!match) continue;
    const [, project, filename, line, title] = match;
    const file = `tests/e2e/${filename}`;
    const browser = { project, file, line: Number(line), title };
    const suiteId = browserFamily(project, file, title);
    cases.push({
      id: `sl-test-${hash(`${project}:${file}:${line}:${title}`)}`,
      title,
      line: Number(line),
      file,
      project,
      suiteId,
      ...metadata(file, suiteId, browser),
    });
  }
  if (!cases.length) throw new Error("PLAYWRIGHT_DISCOVERY_EMPTY");
  return cases;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (
      /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/u.test(entry.name) ||
      (directory.endsWith("scripts") && entry.name.endsWith(".ps1"))
    )
      files.push(absolute);
  }
  return files;
}

function collect(source, relative) {
  const cases = [];
  const isTest = (expression) => {
    if (ts.isIdentifier(expression)) return ["test", "it"].includes(expression.text);
    return (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === "each" &&
      ts.isIdentifier(expression.expression.expression) &&
      ["test", "it"].includes(expression.expression.expression.text)
    );
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && isTest(node.expression)) {
      const title = node.arguments[0];
      if (title && (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))) {
        const caseTitle = ts.isStringLiteralLike(title) ? title.text : title.getText(source);
        cases.push({
          id: `sl-test-${hash(`${relative}:${caseTitle}`)}`,
          title: caseTitle,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return cases;
}

const sources = await Promise.all(
  ["src", "tests", "scripts"].map(async (name) => (await walk(path.join(root, name))).filter(Boolean)),
);
const cases = [];
for (const absolute of sources.flat()) {
  const file = normal(path.relative(root, absolute));
  if (file.startsWith("tests/e2e/")) continue;
  const suiteId = file.endsWith(".ps1")
    ? "validation.powershell"
    : file.endsWith(".tsx")
      ? componentFamily(file)
      : unitFamily(file);
  const source = ts.createSourceFile(file, await fs.readFile(absolute, "utf8"), ts.ScriptTarget.Latest, true);
  const discovered = absolute.endsWith(".ps1")
    ? [
        {
          id: `sl-test-${hash(`${file}:powershell-validation`)}`,
          title: `${path.basename(file)} governed PowerShell validation`,
          line: 1,
        },
      ]
    : collect(source, file);
  for (const test of discovered) cases.push({ ...test, file, suiteId, ...metadata(file, suiteId) });
}
cases.push(...(await discoverPlaywright()));
const ids = new Set();
for (const entry of cases) {
  if (ids.has(entry.id)) throw new Error(`DUPLICATE_TEST_ID:${entry.id}`);
  ids.add(entry.id);
}
await fs.mkdir(path.join(root, "testing", "generated"), { recursive: true });
const registryPath = path.join(root, "testing", "generated", "active-test-registry.json");
const prettierConfig = (await resolveConfig(registryPath)) ?? {};
await fs.writeFile(
  registryPath,
  await format(JSON.stringify({ version: 2, schemaVersion: "2.0.0", generated: true, cases }), {
    ...prettierConfig,
    parser: "json",
  }),
);
console.log(
  `Generated ${cases.length} governed test-case definitions across ${new Set(cases.map((entry) => entry.suiteId)).size} owned families.`,
);

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { promisify } from "node:util";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", ".next", "coverage", "artifacts"]);
const hash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 20);
const execFileAsync = promisify(execFile);

async function discoverPlaywright() {
  const { stdout } = await execFileAsync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--list"], {
    cwd: root,
    maxBuffer: 4 * 1024 * 1024,
  });
  const cases = [];
  for (const entry of stdout.split(/\r?\n/u)) {
    const match = entry.match(/^\s+\[([^\]]+)\]\s+›\s+([^:]+):(\d+):\d+\s+›\s+(.+)$/u);
    if (!match) continue;
    const [, project, filename, line, title] = match;
    const file = `tests/e2e/${filename}`;
    cases.push({
      id: `sl-test-${hash(`${project}:${file}:${line}:${title}`)}`,
      title,
      line: Number(line),
      file,
      project,
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

const ownership = JSON.parse(await fs.readFile(path.join(root, "testing", "ownership.json"), "utf8"));
const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
      .replace(/\*\*/gu, "§")
      .replace(/\*/gu, "[^/]*")
      .replace(/§/gu, ".*")}$`,
    "u",
  );
function classify(file) {
  const common = {
    risk: "MODERATE",
    sourcePaths: [file],
    consumerPaths: [],
    dependencies: [],
    fixtureFamily: "repository-fixtures",
    resources: ["node-slot"],
    parallelSafety: "READ_ONLY_PARALLEL",
    expectedDurationMs: 30000,
    hardBudgetMs: 60000,
    retryPolicy: "NONE",
    gates: ["local-change", "mainline"],
    supersessionPolicy: "ACTIVE",
  };
  const declared = ownership.owners.find((owner) => owner.testPaths.some((pattern) => glob(pattern).test(file)));
  if (declared) return { ...common, owner: declared.id, contracts: [...declared.contractIds] };
  if (file.includes("/private-content/"))
    return {
      ...common,
      owner: "sealed-hold",
      contracts: ["sealed-hold-private-delivery"],
      risk: "HIGH",
      resources: ["node-slot", "scanner"],
    };
  if (file.includes("/community/"))
    return { ...common, owner: "harborlight", contracts: ["community-public-projection"] };
  if (file.includes("/wayfarer/")) return { ...common, owner: "wayfarer", contracts: ["wayfarer-history-projection"] };
  if (file.includes("/animation/") || file.includes("/player/"))
    return { ...common, owner: "lanternwake", contracts: ["journal-ready-state"] };
  if (file.includes("/chronicle/") || file.includes("/access-gates"))
    return { ...common, owner: "one-voyage", contracts: ["invitation-acceptance"] };
  return { ...common, owner: "platform-foundation", contracts: ["authentication-authorization"] };
}

function collect(source, relative) {
  const cases = [];
  const isTestCallee = (expression) => {
    if (ts.isIdentifier(expression)) return ["test", "it"].includes(expression.text);
    if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return false;
    return (
      expression.expression.name.text === "each" &&
      ts.isIdentifier(expression.expression.expression) &&
      ["test", "it"].includes(expression.expression.expression.text)
    );
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && isTestCallee(node.expression)) {
      const title = node.arguments[0];
      if (title && (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))) {
        // Dynamic loop titles use their stable source identity until the family is
        // decomposed; this prevents an active case from becoming invisible.
        const caseTitle = ts.isStringLiteralLike(title) ? title.text : title.getText(source);
        const identity = `${relative}:${caseTitle}`;
        cases.push({
          id: `sl-test-${hash(identity)}`,
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

const files = await Promise.all(
  ["src", "tests", "scripts"].map(async (name) => (await walk(path.join(root, name))).filter(Boolean)),
);
const cases = [];
for (const absolute of files.flat()) {
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (relative.startsWith("tests/e2e/")) continue;
  const source = ts.createSourceFile(relative, await fs.readFile(absolute, "utf8"), ts.ScriptTarget.Latest, true);
  const meta = classify(relative);
  const discovered = absolute.endsWith(".ps1")
    ? [
        {
          id: `sl-test-${hash(`${relative}:powershell-validation`)}`,
          title: `${path.basename(relative)} governed PowerShell validation`,
          line: 1,
        },
      ]
    : collect(source, relative);
  for (const test of discovered)
    cases.push({
      ...test,
      file: relative,
      suiteId: "unit.core",
      tier: 1,
      ...meta,
    });
}
for (const browserCase of await discoverPlaywright()) {
  const meta = classify(browserCase.file);
  cases.push({
    ...browserCase,
    suiteId: "browser.player-journal",
    tier: 4,
    ...meta,
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    parallelSafety: "ISOLATED_MUTABLE_PARALLEL",
    expectedDurationMs: 120000,
    hardBudgetMs: 600000,
    browser: { engines: [browserCase.project], devices: ["configured-project"], inputModes: ["mouse", "keyboard"] },
  });
}
const ids = new Set();
for (const entry of cases) {
  if (ids.has(entry.id)) throw new Error(`DUPLICATE_TEST_ID:${entry.id}`);
  ids.add(entry.id);
}
await fs.mkdir(path.join(root, "testing", "generated"), { recursive: true });
await fs.writeFile(
  path.join(root, "testing", "generated", "active-test-registry.json"),
  `${JSON.stringify({ version: 1, generated: true, cases }, null, 2)}\n`,
);
console.log(`Generated ${cases.length} governed test-case definitions.`);

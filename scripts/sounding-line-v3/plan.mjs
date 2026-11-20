import { execFileSync } from "node:child_process";
import { posix } from "node:path";

export function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
}

export function commit(ref) {
  return git(["rev-parse", "--verify", "--end-of-options", ref + "^{commit}"]).trim();
}

export function changes(base, tree) {
  const entries = git(["diff", "--raw", "--no-abbrev", "--no-renames", "-z", base, tree, "--"])
    .split("\0")
    .slice(0, -1);
  const result = [];
  for (let index = 0; index < entries.length; index += 2) {
    const [, mode, , , status] = entries[index].split(" ");
    result.push({ file: entries[index + 1], mode, status });
  }
  return result;
}

const image = /\.(png|jpe?g|webp|gif|svg|pdf)$/i;
const passiveRoot = /^(?:docs|Development_Docs|Experience_Images|Developer_Journals)\//;
const executable =
  /<\s*(?:script|iframe|object|embed|foreignObject|form|link|style)\b|\bon[a-z]+\s*=|(?:(?:javascript|vbscript)\s*:|data\s*:\s*text\/html)|<!ENTITY\b|\b(?:src|href|xlink:href)\s*=\s*["'](?:https?:|\/\/)/gi;
const authorityPath =
  /^(?:\.github\/|\.agents\/|testing\/|scripts\/sounding-line(?:-v3)?\/|tests\/sounding-line(?:-v3)?\/|scripts\/workspaces\/|tests\/workspaces\/|tests\/sounding-line-v3\.test\.mjs$)/;
const formatting = /^(?:\.prettier(?:ignore|rc\.json)|eslint\.config\.mjs|\.editorconfig)$/;
const toolchain =
  /^(?:package(?:-lock)?\.json|\.node-version|\.nvmrc|tsconfig\.json|vitest(?:\.config|\.setup)\.ts|(?:next\.config\.ts|postcss\.config\.mjs))$/;
const shared = /^(?:src\/(?:proxy\.ts|instrumentation\.ts|lib\/|platform\/|types\/|styles\/|app\/layout\.)|prisma\/)/;
const protectedPath = /(?:^|\/)(?:auth|authorization|sign-in|security|private-content|proxy\.ts)(?:[/.=-]|$)/i;
const scalar = (text) =>
  text
    .toLowerCase()
    .replace(/^project[- ]/, "")
    .replace(/[^a-z0-9]+/g, "-");
const matches = (file, rule) => file === rule || file.startsWith(rule + "/") || posix.matchesGlob(file, rule);

export function passive(change, read) {
  const { file, mode, status } = change;
  if (!passiveRoot.test(file) && (file.includes("/") || !/\.md$/i.test(file))) return false;
  if (!/\.(?:mdx?|png|jpe?g|webp|gif|svg|pdf)$/i.test(file)) return false;
  if (status === "D") return true;
  if (!/^100644$/.test(mode)) return false;
  if (!/\.(?:mdx?|svg)$/i.test(file)) return true;
  const source = read(file).toString("utf8");
  const content = /\.md$/i.test(file) ? source.replace(/^`{3,}[^\n]*\n[\s\S]*?^`{3,}[^\n]*$/gm, "") : source;
  return (
    content.search(executable) === -1 &&
    (!/\.mdx$/i.test(file) || !/[{}]|<(?:[A-Z][\w.]*)\b|^\s*(?:import|export)\s/m.test(content)) &&
    (!/\.svg$/i.test(file) || !/(?:url\s*\(|<\s*(?:use|image|animate|set)\b|&(?:#|[A-Za-z]+\s*;))/i.test(content))
  );
}

export function metadata(labels) {
  const request = { projects: [], suites: [], mode: undefined, full: false };
  for (const label of labels) {
    if (label === "sl:full") request.full = true;
    if (label.startsWith("sl:project:")) request.projects.push(label.slice(11));
    if (label.startsWith("sl:suite:")) request.suites.push(label.slice(9));
    if (label.startsWith("sl:mode:")) {
      const mode = label.slice(8);
      if (request.mode && request.mode !== mode) throw new Error("Apply only one sl:mode label.");
      request.mode = mode;
    }
  }
  return request;
}

export function registry(tree = "HEAD") {
  const json = (file) => JSON.parse(git(["show", tree + ":testing/" + file]));
  return {
    files: git(["ls-tree", "-rz", "--name-only", tree]).split("\0").filter(Boolean),
    suites: json("suites.json").suites,
    mappings: json("impact-map.json").pathMappings,
    cases: json("generated/active-test-registry.json").cases,
  };
}

export function select(entries, read, request, data, readBase) {
  const { suites, mappings, cases, files: tracked } = data;
  const trackedFiles = new Set(tracked);
  const trackedUnit = tracked.filter((file) =>
    /(?:^src\/|^tests\/(?:private-content|tideglass)\/|^scripts\/features\/).*\.test\.tsx?$|\.test\.mjs$/.test(file),
  );
  const trackedBrowser = tracked.filter((file) => /^tests\/e2e\/.*\.spec\.ts$/.test(file));
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  const selected = new Map();
  const projects = new Set();
  const notes = [];
  const checks = new Set(["diff"]);
  const directUnit = new Set();
  const directBrowser = new Set();
  let category = "documentation";
  const directNode = new Set();
  let broadUnit = false;
  let broadBrowser = false;

  const selectSuite = (id, reason) => {
    if (!byId.has(id)) throw new Error("Unknown suite " + id);
    if (!selected.has(id)) selected.set(id, new Set());
    selected.get(id).add(reason);
    projects.add(scalar(byId.get(id).owner));
  };
  const selectShared = (reason, browser = false) => {
    broadUnit = true;
    broadBrowser ||= browser;
    checks.add("types");
    notes.push(reason);
  };

  const verificationScriptsOnly = (file) => {
    if (!readBase || file !== "package.json") return false;
    const redact = (raw) => {
      const manifest = JSON.parse(raw);
      for (const script of ["sl", "sl:integrate", "test:changed", "test:release", "validate"])
        delete manifest.scripts?.[script];
      return JSON.stringify(manifest);
    };
    return redact(readBase(file)) === redact(read(file));
  };
  for (const entry of entries) {
    const { file, status } = entry;
    if (passive(entry, read)) {
      checks.add("docs");
      continue;
    }
    if (authorityPath.test(file) || formatting.test(file) || toolchain.test(file)) {
      if (category === "documentation") category = "maintenance";
      if (authorityPath.test(file)) {
        checks.add("workflow");
        if (/^testing\//.test(file)) selectShared("Verification registry changed");
        if (/^(?:scripts\/workspaces|tests\/workspaces)\//.test(file))
          for (const test of trackedUnit.filter((path) => path.startsWith("tests/workspaces/"))) directNode.add(test);
      }
      if (formatting.test(file)) checks.add("format");
      if (file === "package.json" && status === "M" && verificationScriptsOnly(file)) {
        checks.add("workflow");
        continue;
      }
      if (toolchain.test(file)) {
        selectShared("Shared package or toolchain changed");
        if (!/^(?:tsconfig|vitest)/.test(file)) checks.add("build");
      }
      continue;
    }
    if (status !== "D" && (trackedUnit.includes(file) || trackedBrowser.includes(file))) {
      if (category === "documentation") category = "maintenance";
      if (file.endsWith(".test.mjs")) directNode.add(file);
      else if (trackedBrowser.includes(file)) directBrowser.add(file);
      else directUnit.add(file);
      continue;
    }
    category = "product";
    if (image.test(file) || /\.mdx?$/i.test(file)) checks.add("docs");
    if (!file.startsWith("public/") && (passiveRoot.test(file) || !file.includes("/")) && /\.(?:mdx?|svg)$/i.test(file))
      selectShared("Active document or SVG: " + file);
    if (shared.test(file)) {
      selectShared("Shared application input: " + file);
      if (/^prisma\//.test(file)) checks.add("schema");
    }
    if (protectedPath.test(file)) {
      for (const id of ["unit.auth", "unit.private-content", "browser.access-sentinel"]) {
        if (byId.has(id)) selectSuite(id, "Security-sensitive path: " + file);
      }
    }
    const matching = new Set(mappings.filter((rule) => matches(file, rule.path)).flatMap((rule) => rule.suiteIds));
    if (matching.size === 0) {
      for (const suite of suites) {
        if (suite.affectedPaths?.some((path) => matches(file, path))) matching.add(suite.id);
      }
    }
    if (/\.test\.mjs$/.test(file) && status !== "D") directNode.add(file);
    if (/\.test\.tsx?$/.test(file) && status !== "D") directUnit.add(file);
    if (/^tests\/e2e\/.*\.spec\.ts$/.test(file) && status !== "D") directBrowser.add(file);
    for (const id of matching) selectSuite(id, file);
    if (!matching.size && !directUnit.has(file) && !directNode.has(file) && !directBrowser.has(file)) {
      selectShared("Unmapped path: " + file, /^(?:src\/app\/|src\/components\/|public\/|tests\/e2e\/)/.test(file));
    }
    if (/\.[cm]?[jt]sx?$/.test(file) && !directUnit.has(file)) checks.add("types");
  }
  for (const project of request.projects ?? []) {
    const owned = suites.filter((suite) => scalar(suite.owner) === scalar(project));
    if (!owned.length) throw new Error("No registered test suites for project " + project);
    for (const suite of owned) selectSuite(suite.id, "Declared project: " + project);
  }
  for (const id of request.suites ?? []) selectSuite(id, "Explicit suite request");
  const levels = ["documentation", "maintenance", "product", "full"];
  if (selected.size && category === "documentation") category = "product";
  if (request.mode && !levels.includes(request.mode)) throw new Error("Unknown verification mode " + request.mode);
  if (levels.indexOf(request.mode) > levels.indexOf(category)) category = request.mode;
  if (category === "product" && entries.every((entry) => passive(entry, read)) && selected.size === 0)
    selectShared("Product verification explicitly requested");
  if (request.full || category === "full") {
    category = "full";
    broadUnit = true;
    broadBrowser = true;
    for (const check of ["docs", "format", "workflow", "types", "build", "schema", "privacy", "compatibility"])
      checks.add(check);
  }

  const jobs = new Map(Array.from(checks, (kind) => [kind, { id: kind, kind, files: [] }]));
  const add = (id, kind, files) => jobs.set(id, { id, kind, files: [...new Set(files)].sort() });
  for (const [id] of selected) {
    const suite = byId.get(id);
    const files = cases.filter((item) => item.suiteId === id && trackedFiles.has(item.file)).map((item) => item.file);
    const inferFiles = (available) =>
      available.filter((file) => suite.affectedPaths?.some((rule) => matches(file, rule)));
    switch (suite.adapter) {
      case "vitest-family":
      case "vitest-family-serial": {
        if (!files.length) files.push(...inferFiles(trackedUnit));
        const nodeFiles = files.filter((file) => file.endsWith(".test.mjs"));
        const vitest = files.filter((file) => !file.endsWith(".test.mjs"));
        for (const file of vitest) directUnit.delete(file);
        if (nodeFiles.length) add(id + "-node", "node", nodeFiles);
        if ((!broadUnit || suite.adapter === "vitest-family-serial") && vitest.length)
          add(id, suite.adapter === "vitest-family-serial" ? "vitest-serial" : "vitest", vitest);
        if (!files.length) throw new Error("No registered tests for " + id);
        break;
      }
      case "playwright-family":
      case "admiralty-phase2-browser":
        if (!files.length) files.push(...inferFiles(trackedBrowser));
        for (const file of files) directBrowser.add(file);
        if (!files.length) throw new Error("No registered browser tests for " + id);
        break;
      case "docs":
        add("docs", "docs", []);
        break;
      case "static":
        add("types", "types", []);
        break;
      case "build":
        add("build", "build", []);
        break;
      case "sqlite-validate":
      case "mysql-validate":
        add("schema", "schema", []);
        break;
      case "node-test-browser-family":
        add("legacy-regressions", "legacy-regressions", []);
        break;
      case "p34-retirement":
      case "powershell-family":
        add("compatibility", "compatibility", []);
        break;
      default:
        throw new Error("Unsupported suite adapter for " + id);
    }
  }
  if (directNode.size) add("changed-node-tests", "node", directNode);
  if (broadUnit) add("all-vitest", "vitest", []);
  else if (directUnit.size) add("changed-tests", "vitest", directUnit);
  if (broadBrowser) add("browser", "browser-full", []);
  else if (directBrowser.size) add("browser", "browser", directBrowser);
  return {
    category,
    projects: [...projects].sort(),
    jobs: [...jobs.values()],
    reasons: Object.fromEntries(Array.from(selected, ([id, reasons]) => [id, [...reasons]])),
    notes,
  };
}

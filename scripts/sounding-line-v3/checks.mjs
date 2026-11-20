import { spawn } from "node:child_process";
import { once } from "node:events";
import { posix, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { git } from "./plan.mjs";

const npm = process.platform === "win32"
  ? [process.execPath, process.env.npm_execpath ?? resolve(process.execPath, "../node_modules/npm/bin/npm-cli.js")]
  : ["npm"];
const node = (...args) => [process.execPath, ...args];
const runNpm = (name, ...args) => [...npm, "run", name, ...(args.length ? ["--", ...args] : [])];
const prisma = (...args) => node("node_modules/prisma/build/index.js", ...args);
const isText = /\.(?:mdx?|svg|ya?ml|json|[cm]?[jt]sx?|html|css|txt|env|toml)$/i;
const forbidden = /(?:\.ftprivate|\.ftkey|(?:^|\/)(?:private-exports|decrypted-private-content)(?:\/|$))/i;
const secret = /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----|(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,}|sk-(?:proj-)?[a-zA-Z0-9_-]{35,})/;
const testSentinel = "SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL-73A9C1";
const signatures = {
  ".png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
    bytes.subarray(-8, -4).toString() === "IEND",
  ".jpg": (bytes) => bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9,
  ".webp": (bytes) => bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length,
  ".gif": (bytes) => /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString()) && bytes.at(-1) === 0x3b,
  ".pdf": (bytes) => bytes.subarray(0, 5).toString() === "%PDF-" &&
    bytes.subarray(-1024).toString().trimEnd().endsWith("%%EOF"),
  ".svg": (bytes) => /^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(bytes.toString()) &&
    /(?:<\/svg\s*>|\/>)\s*$/i.test(bytes.toString()),
};

async function command([executable, ...args], env = {}) {
  const started = performance.now();
  const child = spawn(executable, args, {
    stdio: "inherit", windowsHide: true, env: { ...process.env, ...env },
  });
  const [code, signal] = await once(child, "exit");
  console.log("%s finished in %d ms", executable, Math.round(performance.now() - started));
  if (code !== 0) throw new Error(executable + " failed (" + (signal ?? code) + ")");
}

function chunks(files) {
  const parts = [[]];
  for (const file of files) {
    if (parts.at(-1).join(" ").length + file.length > 5_500) parts.push([]);
    parts.at(-1).push("./" + file);
  }
  return parts;
}

export function snapshotReader(tree) {
  const blobs = new Map();
  return (file) => {
    if (!blobs.has(file)) {
      blobs.set(file, git(["show", tree + ":" + file], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }));
    }
    return blobs.get(file);
  };
}

function checkDiff({ base, tree, entries, read }) {

  for (const { file, status, mode } of entries) {
    if (status === "D") continue;
    if (forbidden.test(file)) throw new Error("Protected-content path in the diff.");
    if (!mode.startsWith("100") || !isText.test(file)) continue;
    // The guarded synthetic fixture uses this literal itself. Filter by path, as in the existing staged scanner.
    const canContainSentinel = /^((?:src|scripts|tests)\/.*private-content\/|scripts\/sounding-line-v3\/checks\.mjs$|Development_Docs\/Archive\/Private_Content_Test_Plan\.md$)/.test(file);
    const text = read(file).toString("utf8");
    if (secret.test(text) || (!canContainSentinel && text.includes(testSentinel)))
      throw new Error("A private key, token, or protected-content marker was detected. Inspect the diff locally.");
  }
  try {
    git(["-c", "core.whitespace=-blank-at-eol", "diff", "--check", "--no-ext-diff", "--no-textconv", base, tree, "--"]);
  } catch {
    throw new Error("Git diff sanity failed. Run git diff --check locally to see the affected lines.");
  }
}

function checkDocs({ base, tree, entries, read }) {
  const paths = new Set(git(["ls-tree", "-rz", "--name-only", tree]).split("\0"));
  const removed = new Set(entries.filter(({ status }) => status === "D").map(({ file }) => file));
  const invalid = [];
  for (const { file, status, mode } of entries) {
    if (status === "D" || !mode.startsWith("100")) continue;
    const ext = posix.extname(file).toLowerCase().replace(".jpeg", ".jpg");
    if (signatures[ext]) {
      try {
        if (!signatures[ext](read(file))) invalid.push("Invalid " + ext + " file: " + file);
      } catch {
        invalid.push("Unreadable " + ext + " file: " + file);
      }
    }
    if (!/\.mdx?$/i.test(file)) continue;
    const added = git(["diff", "--no-ext-diff", "--no-textconv", "-U0", base, tree, "--", ":(literal)" + file])
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1)).join("\n");
    for (const link of added.matchAll(/\]\((?:<([^>]+)>|([^\s\)]+))(?:\s+["'][^"']+["'])?\)/g)) {
      const target = (link[1] ?? link[2]).split("#")[0];
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
      const decoded = decodeURIComponent(target);
      const fromRoot = decoded.startsWith("/") ? decoded.slice(1) : posix.join(posix.dirname(file), decoded);
      const normalized = posix.normalize(fromRoot).replace(/\/$/, "");
      if (normalized === ".") continue;
      if (!paths.has(normalized) && !Array.from(paths).some((entry) => entry.startsWith(normalized + "/")))
        invalid.push("Broken added link in " + file + ": " + target);
    }
  }
  const indexPath = "Development_Docs/document-index.json";
  if (paths.has(indexPath) && entries.some(({ file }) => file === indexPath || file.startsWith("Development_Docs/"))) {
    const index = JSON.parse(read(indexPath));
    const indexed = new Set();
    for (const { path } of index.records) {
      if (indexed.has(path) || removed.has(path) || (!paths.has(path) && entries.some(({ file }) => file === indexPath)))
        invalid.push("Invalid document-index entry: " + path);
      indexed.add(path);
    }
  }
  if (invalid.length) throw new Error(invalid.join("\n"));
}

export function needsDependencies(kind) {
  return !["diff", "docs", "workflow", "node"].includes(kind);
}

export async function runJob(job, context) {
  const { kind, files } = job;
  const { tree, entries } = context;
  const database = { DATABASE_URL: "file:./.sounding-line-v3-unused.sqlite" };
  const setupPrisma = () => command(runNpm("db:generate"), database);
  const vitest = (files, args = []) => node("node_modules/vitest/vitest.mjs", "run", ...args, ...files);
  switch (kind) {
    case "diff": return checkDiff(context);
    case "docs": return checkDocs(context);
    case "workflow":
      await command(node("--test", "tests/sounding-line-v3.test.mjs"));
      if (entries.some(({ file }) => /^\.github\/workflows\/.*\.ya?ml$/.test(file))) {
        if (process.env.GITHUB_ACTIONS === "true") {
          await command(["go", "run", "github.com/rhysd/actionlint/cmd/actionlint@v1.7.7", "-shellcheck=", "-pyflakes="]);
        } else {
          console.log("Hosted workflow check also runs actionlint.");
        }
      }
      return;
    case "node":
      for (const part of chunks(files)) await command(node("--test", ...part));
      return;
    case "vitest":
    case "vitest-serial":
      await setupPrisma();
      for (const part of chunks(files))
        await command(vitest(part, kind === "vitest-serial" ? ["--maxWorkers=1"] : []), database);
      return;
    case "types":
      await setupPrisma();
      return command(runNpm("typecheck"), database);
    case "format": {
      const paths = context.plan.category === "full" ? ["."] :
        entries.filter(({ file, status }) => status !== "D" && isText.test(file)).map(({ file }) => file);
      for (const part of chunks(paths)) {
        if (part.length) await command(node("node_modules/prettier/bin/prettier.cjs", "--check", ...part));
      }
      return;
    }
    case "build":
      await setupPrisma();
      return command(runNpm("build"), database);
    case "privacy":
      return command(runNpm("private-content:scan"));
    case "schema":
      for (const schema of ["prisma/schema.sqlite.prisma", "prisma/schema.prisma"]) {
        await command(prisma("validate", "--schema", schema), {
          DATABASE_URL: schema.includes(".sqlite.") ? database.DATABASE_URL : "mysql://root:unused@127.0.0.1:3306/v3",
        });
      }
      for (const script of ["landfall:migrations", "landfall:phase2:migrations", "drydock:migrations:sqlite",
        "tideglass:migrations:sqlite", "helm:a2:migrations", "admiralty:migrations"]) {
        await command(runNpm(script), database);
      }
      return;
    case "compatibility":
      await command(runNpm("test:validation-runtime-safety"));
      return command(runNpm("deepwater:test"));
    case "legacy-regressions":
      return command(runNpm("test:sounding-line"));
    case "browser":
    case "browser-full": {
      const { verificationCommands, verificationEnvironment } = await import("../sounding-line/ordinary.mjs");
      const browserTests = kind === "browser-full"
        ? git(["ls-tree", "-rz", "--name-only", tree, "--", "tests/e2e"]).split("\0")
            .filter((file) => file.endsWith(".spec.ts"))
        : files;
      if (!browserTests.length) throw new Error("Browser suite has no selected specs.");
      await setupPrisma();
      const browserPlan = {
        mode: "ordinary", candidateSha: tree, selected: { unitTests: [], browserTests },
        buildRequired: true, safetyPaths: [], lintPaths: [], databaseUrl: "file:./.sounding-line-v3-browser.sqlite",
      };
      const commands = verificationCommands(browserPlan);
      const build = commands.findIndex(([executable, args]) => executable === "npm" && args.join(" ") === "run build");
      if (build < 0) throw new Error("Browser fixture planner did not provide a build.");
      for (const [executable, args] of commands.slice(build)) {
        const env = verificationEnvironment(browserPlan, executable, args);
        const argv = executable === "npm" ? [...npm, ...args] :
          executable === "npx" && args.includes("prisma") ? prisma(...args.slice(args.indexOf("prisma") + 1)) :
          [executable, ...args];
        await command(argv, { DATABASE_URL: browserPlan.databaseUrl, ...env });
      }
      return;
    }
    default: throw new Error("Unsupported check kind " + kind);
  }
}

export async function runLocal(plan, context) {
  // These dependency-free checks only read Git objects. Serialize the remaining
  // jobs locally because Prisma and Next share generated output in this checkout.
  const readOnly = (job) => ["diff", "docs", "workflow", "node"].includes(job.kind);
  const failures = await Promise.allSettled(plan.jobs.filter(readOnly).map((job) => runJob(job, context)));
  for (const job of plan.jobs.filter((job) => !readOnly(job))) {
    try { await runJob(job, context); } catch (reason) { failures.push({ status: "rejected", reason }); }
  }
  const errors = failures.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length) throw new Error(errors.map((error) => error.message).join("\n"));
}

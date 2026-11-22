import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { posix, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { formatApplicable, git } from "./plan.mjs";
import { checkFormatting } from "./format.mjs";

const npm =
  process.platform === "win32"
    ? [process.execPath, process.env.npm_execpath ?? resolve(process.execPath, "../node_modules/npm/bin/npm-cli.js")]
    : ["npm"];
const node = (...args) => [process.execPath, ...args];
const runNpm = (name, ...args) => [...npm, "run", name, ...(args.length ? ["--", ...args] : [])];
const prisma = (...args) => node("node_modules/prisma/build/index.js", ...args);
const isText = /\.(?:mdx?|svg|ya?ml|json|[cm]?[jt]sx?|html|css|txt|env|toml)$/i;
const forbidden = /(?:\.ftprivate|\.ftkey|(?:^|\/)(?:private-exports|decrypted-private-content)(?:\/|$))/i;
const secret =
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----|(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,}|sk-(?:proj-)?[a-zA-Z0-9_-]{35,})/;
const testSentinel = "SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL-73A9C1";
const signatures = {
  ".png": (bytes) =>
    bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) && bytes.subarray(-8, -4).toString() === "IEND",
  ".jpg": (bytes) => bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9,
  ".webp": (bytes) =>
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length,
  ".gif": (bytes) => /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString()) && bytes.at(-1) === 0x3b,
  ".pdf": (bytes) =>
    bytes.subarray(0, 5).toString() === "%PDF-" && bytes.subarray(-1024).toString().trimEnd().endsWith("%%EOF"),
  ".svg": (bytes) =>
    /^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(bytes.toString()) &&
    /(?:<\/svg\s*>|\/>)\s*$/i.test(bytes.toString()),
};

async function command([executable, ...args], env = {}) {
  const started = performance.now();
  const environment = { ...process.env, ...env };
  for (const key of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "GITHUB_OUTPUT",
    "GITHUB_ENV",
    "GITHUB_PATH",
    "SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE",
  ])
    delete environment[key];
  const child = spawn(executable, args, { stdio: "inherit", windowsHide: true, env: environment });
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
    const canContainSentinel =
      /^((?:src|scripts|tests)\/.*private-content\/|scripts\/sounding-line-v3\/checks\.mjs$|Development_Docs\/Archive\/Private_Content_Test_Plan\.md$)/.test(
        file,
      );
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
      .map((line) => line.slice(1))
      .join("\n");
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
      if (
        indexed.has(path) ||
        removed.has(path) ||
        (!paths.has(path) && entries.some(({ file }) => file === indexPath))
      )
        invalid.push("Invalid document-index entry: " + path);
      indexed.add(path);
    }
  }
  if (invalid.length) throw new Error(invalid.join("\n"));
}

export function browserProfileBatches(profile, files, fullBrowser) {
  const extended = "tests/e2e/phase3-lifecycle-extended.spec.ts";
  if (fullBrowser || profile !== "lanternwake-phase3" || !files.includes(extended)) return [files];
  const audioSuite = "Project Lanternwake Phase 3 audio lifecycle";
  // Complementary filters retain every extended case within separate runner deadlines.
  return [
    files.filter((file) => file !== extended),
    [extended, "--grep-invert", audioSuite],
    [extended, "--grep", audioSuite],
  ].filter((batch) => batch.length);
}

async function runBrowserProfile(profileId, browserArgs, tree, fullBrowser, shard) {
  const { browserSuiteProfiles, isolatedBrowserFixtureCredentials } = await import(
    "../sounding-line/browser-suite-profiles.mjs"
  );
  const profile = browserSuiteProfiles[profileId];
  if (!profile?.validationIsolation || !browserArgs.length)
    throw new Error("Missing browser profile or test files: " + profileId);
  const profileRoot = resolve("artifacts", "sounding-line", profileId + "-" + tree.slice(0, 12));
  mkdirSync(profileRoot, { recursive: true });
  const identity = randomBytes(16).toString("hex");
  const task = resolve(profileRoot, identity);
  const db = resolve(profileRoot, "validation-isolated-19700101-000000000-" + identity + ".db");
  const env = {
    ...profile.environment,
    DATABASE_URL: "file:" + db.replaceAll("\\", "/"),
    SOUNDING_LINE_SUITE_PROFILE: profileId,
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    SOUNDING_LINE_V3_FULL_BROWSER: fullBrowser ? "1" : "0",
    FOREVER_VALIDATION_ISOLATION: "1",
    FOREVER_VALIDATION_NONCE_HASH: randomBytes(32).toString("hex"),
    FOREVER_VALIDATION_PRODUCTION_IDENTITY: "1",
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_PHASE7_TASK_ROOT: task,
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: resolve(task, "outbox", "messages.jsonl"),
    VALIDATION_ARTIFACTS: task,
    ...(profile.homeportPhase3Runtime ? { HOMEPORT_PHASE3_DATABASE_PATH: db } : {}),
    ...(profileId === "generic"
      ? {
          SOUNDING_LINE_INTERNAL_RUNTIME: "1",
          ...isolatedBrowserFixtureCredentials(profileId),
        }
      : {}),
  };
  if (profile.bootstrap)
    await command(node("scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", env.DATABASE_URL), env);
  if (profile.seed) await command(node("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"), env);
  for (const preparer of profile.preparers ?? []) {
    const engine = preparer.runtime === "tsx" ? ["node_modules/tsx/dist/cli.mjs"] : [];
    await command(node(...engine, preparer.script, ...(preparer.arguments ?? [])), env);
  }
  await command(
    node(
      "scripts/sounding-line/browser-authority.mjs",
      ...profile.fixtureArguments.flatMap((file) => ["--fixture", file]),
      ...(profile.fixtureProject ? ["--fixture-project", profile.fixtureProject] : []),
      "--",
      ...browserArgs,
      ...(profile.browserArguments ?? []),
      ...(shard && shard !== "1/1" ? ["--shard=" + shard] : []),
      "--project",
      profile.browserProject ?? "chromium",
    ),
    env,
  );
}

export function needsDependencies(kind) {
  return !["diff", "docs", "workflow", "node", "compatibility"].includes(kind);
}

export async function runJob(job, context) {
  const { kind, files } = job;
  const { base, tree, entries } = context;
  const database = { DATABASE_URL: "file:./.sounding-line-v3-unused.sqlite" };
  const setupPrisma = () => command(runNpm("db:generate"), database);
  const vitest = (files, args = []) => node("node_modules/vitest/vitest.mjs", "run", ...args, ...files);
  switch (kind) {
    case "diff":
      return checkDiff(context);
    case "docs":
      return checkDocs(context);
    case "workflow":
      await command(node("--test", "tests/sounding-line-v3.test.mjs"));
      const workflows = entries
        .filter(({ file, status }) => status !== "D" && /^\.github\/workflows\/.*\.ya?ml$/.test(file))
        .map(({ file }) => file);
      if (workflows.length) {
        if (process.env.GITHUB_ACTIONS === "true") {
          await command([
            "go",
            "run",
            "github.com/rhysd/actionlint/cmd/actionlint@v1.7.7",
            "-shellcheck=",
            "-pyflakes=",
            ...workflows,
          ]);
        } else {
          console.log("Hosted workflow check also runs actionlint.");
        }
      }
      return;
    case "node":
    case "node-homeport":
      for (const part of chunks(files)) await command(node("--test", ...part));
      return;
    case "vitest":
    case "vitest-serial":
      await setupPrisma();
      for (const part of chunks(files))
        await command(vitest(part, kind === "vitest-serial" ? ["--maxWorkers=1"] : []), database);
      return;
    case "bridgewatch-vitest":
      return command([...npm, "--workspace", "bridgewatch", "test"]);
    case "types":
      await setupPrisma();
      return command(runNpm("typecheck"), database);
    case "format": {
      const full = context.plan.category === "full";
      const paths = full
        ? [["."]]
        : chunks(
            entries
              .filter(
                ({ file, mode, status }) => status !== "D" && /^100(?:644|755)$/.test(mode) && formatApplicable(file),
              )
              .map(({ file }) => file),
          ).filter((part) => part.length);
      return checkFormatting({ tree, entries, full, paths });
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
      const { DatabaseSync } = await import("node:sqlite");
      const sqlite = new DatabaseSync(":memory:");
      try {
        const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort();
        for (const migration of migrations) {
          try {
            sqlite.exec(readFileSync("prisma/migrations/" + migration + "/migration.sql", "utf8"));
          } catch (error) {
            throw new Error("SQLite migration " + migration + " failed: " + error.message);
          }
        }
        if (sqlite.prepare("PRAGMA foreign_key_check").all().length)
          throw new Error("Migrated SQLite schema has foreign key errors.");
        console.log("Applied %d SQLite migrations to an isolated in-memory database.", migrations.length);
      } finally {
        sqlite.close();
      }
      return command(runNpm("landfall:migrations"), database);
    case "compatibility":
      return command(runNpm("test:validation-runtime-safety"));
    case "legacy-regressions":
      return command(runNpm("test:sounding-line"));
    case "browser":
    case "browser-full": {
      const { verificationCommands, verificationEnvironment } = await import("../sounding-line/ordinary.mjs");
      const browserTests =
        kind === "browser-full"
          ? git(["ls-tree", "-rz", "--name-only", tree, "--", "tests/e2e"])
              .split("\0")
              .filter((file) => file.endsWith(".spec.ts"))
          : files;
      if (!browserTests.length) throw new Error("Browser suite has no selected specs.");
      const taskRoot = resolve("artifacts", "sounding-line");
      mkdirSync(taskRoot, { recursive: true });
      const databaseRoot = mkdtempSync(resolve(taskRoot, "v3-build-"));
      const databasePath = resolve(databaseRoot, ".sounding-line-" + tree.slice(0, 12) + ".sqlite");
      const browserPlan = {
        mode: "ordinary",
        candidateSha: tree,
        selected: { unitTests: [], browserTests },
        buildRequired: true,
        safetyPaths: [],
        lintPaths: [],
        databaseUrl: "file:" + databasePath.replaceAll("\\", "/"),
      };
      const commands = verificationCommands(browserPlan);
      const build = commands.findIndex(([executable, args]) => executable === "npm" && args.join(" ") === "run build");
      if (build < 0) throw new Error("Browser fixture planner did not provide a build.");
      const buildEnvironment = {
        DATABASE_URL: browserPlan.databaseUrl,
        SOUNDING_LINE_BASE_SHA: base,
      };
      const fullBrowser = kind === "browser-full";
      const dedicated = [];
      const profiles = [];
      for (const step of commands.slice(build + 1)) {
        const [, args] = step;
        if (args[0] !== "scripts/sounding-line/run-browser-suite.mjs") {
          if (!fullBrowser || job.id === "browser") dedicated.push(step);
          continue;
        }
        const profile = args[args.indexOf("--profile") + 1];
        const matchesFullJob =
          profile === "generic"
            ? Boolean(job.shard)
            : job.id === (profile === "lanternwake-phase3" ? "browser-lanternwake" : "browser-profiles");
        if (!fullBrowser || matchesFullJob) profiles.push({ profile, specs: args.slice(args.indexOf("--") + 1) });
      }
      // The legacy planner always emits a Prisma step, even without dedicated fixtures.
      const hasDedicatedFixtures = dedicated.some(([executable]) => executable !== "npx");
      if (!hasDedicatedFixtures && !profiles.length) throw new Error("Browser job has no fixture commands: " + job.id);
      if (hasDedicatedFixtures) {
        await setupPrisma();
        await command(runNpm("build"), buildEnvironment);
        for (const [executable, args] of dedicated) {
          const env = verificationEnvironment(browserPlan, executable, args);
          const argv =
            executable === "npx" && args.includes("prisma")
              ? prisma(...args.slice(args.indexOf("prisma") + 1))
              : [executable, ...args];
          await command(argv, { ...buildEnvironment, ...env });
        }
      }
      if (profiles.length) {
        await setupPrisma();
        // Dedicated runners can rebuild .next. Prepare the profile build after
        // those runners finish, with the existing test-only settings enabled.
        await command(runNpm("build"), {
          ...buildEnvironment,
          SOUNDING_LINE_TASK_OWNED_HTTP: "1",
          SOUNDING_LINE_SUITE_PROFILE: "v3-browser",
        });
      }
      const profileFailures = [];
      for (const { profile, specs } of profiles) {
        try {
          for (const browserArgs of browserProfileBatches(profile, specs, fullBrowser)) {
            await runBrowserProfile(profile, browserArgs, tree, fullBrowser, job.shard);
          }
        } catch (error) {
          if (!fullBrowser) throw error;
          profileFailures.push(profile);
          console.error("Browser profile %s failed: %s", profile, error.message);
        }
      }
      if (profileFailures.length) throw new Error("Failed browser profiles: " + profileFailures.join(", "));
      return;
    }
    default:
      throw new Error("Unsupported check kind " + kind);
  }
}

export async function runLocal(plan, context) {
  // These dependency-free checks only read Git objects. Serialize the remaining
  // jobs locally because Prisma and Next share generated output in this checkout.
  const readOnly = (job) => ["diff", "docs", "workflow", "node"].includes(job.kind);
  const failures = await Promise.allSettled(plan.jobs.filter(readOnly).map((job) => runJob(job, context)));
  for (const job of plan.jobs.filter((job) => !readOnly(job))) {
    try {
      await runJob(job, context);
    } catch (reason) {
      failures.push({ status: "rejected", reason });
    }
  }
  const errors = failures.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length) throw new Error(errors.map((error) => error.message).join("\n"));
}

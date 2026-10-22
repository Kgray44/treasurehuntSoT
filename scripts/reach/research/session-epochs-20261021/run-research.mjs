// Explicit generated research reproduction; no production, camera, model or recording route.
// Usage: node scripts/reach/research/session-epochs-20261021/run-research.mjs --output <new absolute directory> [--append-only-authority]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnOwnedProcess, processExit, stopOwnedProcess, bounded } from "../../../sounding-line/owned-process.mjs";
const self = fileURLToPath(import.meta.url),
  here = path.dirname(self),
  root = path.resolve(here, "../../../..");
const childMode = process.argv[2] === "--child",
  args = process.argv.slice(childMode ? 3 : 2);
if (
  (args.length !== 2 && args.length !== 3) ||
  args[0] !== "--output" ||
  !path.isAbsolute(args[1]) ||
  (args.length === 3 && args[2] !== "--append-only-authority")
)
  throw Error("EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
const authorityMode = args.length === 3,
  expectedTests = authorityMode ? 2 : 42,
  scope = authorityMode ? "GENERATED_APPEND_ONLY_AUTHORITY_DIAGNOSTIC" : "GENERATED_SESSION_EPOCH_RESEARCH_ONLY";
const out = path.resolve(args[1]),
  LIMIT = (authorityMode ? 2 : 32) * 1048576,
  LOG = 65536,
  RESERVE = 5 * LOG;
const relativeOutput = path.relative(root, out);
if (!path.isAbsolute(relativeOutput) && relativeOutput !== ".." && !relativeOutput.startsWith(`..${path.sep}`))
  throw Error("OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
if (authorityMode && process.platform === "win32") {
  const parent = fs.realpathSync(path.dirname(out));
  if (path.parse(out).root.toUpperCase() !== "D:\\" || path.parse(parent).root.toUpperCase() !== "D:\\")
    throw Error("AUTHORITY_OUTPUT_REQUIRES_D_DRIVE");
  if (!childMode) {
    const space = fs.statfsSync(parent, { bigint: true });
    if (space.bavail * space.bsize < 64n * 1048576n) throw Error("AUTHORITY_PARENT_FREE_SPACE_64M_REQUIRED");
  }
}
const base = path.relative(root, here).replaceAll("\\", "/");
const originalExperiments = [
  "pointing-session-epoch",
  "calibration-epoch-compatibility",
  "session-epoch-perception",
].map((n) => `${base}/${n}.experiment.ts`);
const authorityExperiment = `${base}/session-epoch-authority.experiment.ts`,
  experiments = authorityMode ? [authorityExperiment] : originalExperiments;
const sources = [
  path.relative(root, self),
  ...originalExperiments,
  `${base}/pointing-session-epoch.ts`,
  `${base}/calibration-epoch-compatibility.ts`,
  ...[
    "index-image-tracker",
    "calibration",
    "sample-window",
    "coordinates",
    "index-image-readiness",
    "foundation-scenarios",
    "index-image-observation",
    "index-source-association",
    "temporal-index-track",
    "index-ncc",
    "hand-detection-authority",
    "observation",
  ].map((n) => `src/reach/${n}.ts`),
  ...["owned-process.mjs", "owned-process-windows.ps1", "owned-process-linux.py"].map(
    (n) => `scripts/sounding-line/${n}`,
  ),
  ...(authorityMode ? [authorityExperiment] : []),
];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const snapshot = () =>
  sources.map((file) => {
    const b = fs.readFileSync(path.join(root, file));
    return { file, bytes: b.length, sha256: sha(b) };
  });
const same = (pins) => JSON.stringify(snapshot()) === JSON.stringify(pins);
const write = (name, value) =>
  fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const bytes = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const p = path.join(dir, e.name),
      s = fs.lstatSync(p);
    if (s.isSymbolicLink() || (!s.isDirectory() && !s.isFile())) throw Error("OUTPUT_LINK_OR_SPECIAL_FILE");
    return n + (s.isDirectory() ? bytes(p) : s.size);
  }, 0);
if (childMode) {
  if (process.env.REACH_RESEARCH_OWNED_OUTPUT !== out) throw Error("OWNED_CHILD_ONLY");
  const pins = JSON.parse(fs.readFileSync(path.join(out, "source-pins.json"), "utf8"));
  const r = {
    qualification: false,
    scope,
    expectedTests,
    pass: false,
    startedAt: new Date().toISOString(),
  };
  let ctx,
    consoleFd,
    consoleBytes = 0,
    consoleOverflow = false;
  try {
    if (!same(pins)) throw Error("SOURCE_CHANGED_BEFORE_TESTS");
    consoleFd = fs.openSync(path.join(out, "generated-console.log"), "wx");
    const { startVitest } = await import(pathToFileURL(path.join(root, "node_modules/vitest/dist/node.js")).href);
    await bounded(
      () =>
        startVitest(
          "test",
          [],
          {
            root,
            config: false,
            run: true,
            watch: false,
            pool: "threads",
            maxWorkers: 1,
            fileParallelism: false,
            reporters: [
              "json",
              {
                onInit(v) {
                  ctx = v;
                },
              },
            ],
            outputFile: path.join(out, "tests.json"),
          },
          {
            root,
            cacheDir: path.join(out, "cache"),
            resolve: {
              alias: { "@": path.join(root, "src"), vitest: path.join(root, "node_modules/vitest/dist/index.js") },
            },
            test: {
              include: experiments,
              environment: "node",
              pool: "threads",
              maxWorkers: 1,
              fileParallelism: false,
              watch: false,
              onConsoleLog(log) {
                const b = Buffer.from(log);
                if (consoleBytes + b.length > LOG) consoleOverflow = true;
                else {
                  fs.writeSync(consoleFd, b);
                  consoleBytes += b.length;
                }
                return false;
              },
            },
          },
          {
            packageInstaller: {
              async ensureInstalled() {
                throw Error("INSTALL_FORBIDDEN");
              },
            },
          },
        ),
      45000,
      "RESEARCH_45S_DEADLINE",
    );
    const j = JSON.parse(fs.readFileSync(path.join(out, "tests.json"), "utf8"));
    Object.assign(r, {
      total: j.numTotalTests,
      passed: j.numPassedTests,
      failed: j.numFailedTests,
      pending: j.numPendingTests,
      todo: j.numTodoTests,
    });
    r.pass =
      r.total === expectedTests &&
      r.passed === expectedTests &&
      r.failed === 0 &&
      r.pending === 0 &&
      r.todo === 0 &&
      !consoleOverflow;
  } catch (e) {
    r.error = String(e.stack || e);
  } finally {
    try {
      await bounded(() => ctx?.close(), 5000, "VITEST_CLOSE_DEADLINE");
      r.vitestClosed = !!ctx;
    } catch (e) {
      r.closeError = String(e);
      r.pass = false;
    }
    if (consoleFd !== undefined) fs.closeSync(consoleFd);
    Object.assign(r, {
      consoleBytes,
      consoleOverflow,
      finishedAt: new Date().toISOString(),
      memory: process.memoryUsage(),
    });
    try {
      r.pinsUnchanged = same(pins);
      if (!r.pinsUnchanged || bytes(out) > LIMIT - RESERVE) r.pass = false;
    } catch (e) {
      r.pinOrBudgetError = String(e);
      r.pass = false;
    }
    write("execution.json", r);
    if (!r.pass || !r.vitestClosed) process.exitCode = 1;
  }
} else {
  fs.mkdirSync(out); // Existing directories are never adopted, emptied or overwritten.
  const temp = path.join(out, "temp");
  fs.mkdirSync(temp);
  process.env.TEMP = temp;
  process.env.TMP = temp;
  process.env.TMPDIR = temp;
  const r = {
    qualification: false,
    scope,
    expectedTests,
    innerDeadlineMs: 45000,
    ownerDeadlineMs: 60000,
    directoryLimitBytes: LIMIT,
    logLimitBytes: LOG,
    startedAt: new Date().toISOString(),
  };
  let child, monitor, pins, error, exit, cleanup, trip;
  const descriptors = [],
    counts = { stdout: 0, stderr: 0 },
    overrun = new Promise((_, reject) => {
      trip = reject;
    });
  try {
    pins = snapshot();
    write("source-pins.json", pins);
    const fds = Object.fromEntries(
      ["stdout", "stderr"].map((k) => {
        const fd = fs.openSync(path.join(out, `${k}.log`), "wx");
        descriptors.push(fd);
        return [k, fd];
      }),
    );
    child = spawnOwnedProcess(
      process.execPath,
      [
        "--max-old-space-size=1024",
        self,
        "--child",
        "--output",
        out,
        ...(authorityMode ? ["--append-only-authority"] : []),
      ],
      {
        root,
        env: {
          ...process.env,
          REACH_RESEARCH_OWNED_OUTPUT: out,
          TEMP: temp,
          TMP: temp,
          TMPDIR: temp,
          NODE_DISABLE_COMPILE_CACHE: "1",
          NODE_COMPILE_CACHE: "",
          APPDATA: path.join(temp, "roaming"),
          LOCALAPPDATA: path.join(temp, "local"),
          XDG_CACHE_HOME: path.join(temp, "cache"),
        },
      },
    );
    for (const k of ["stdout", "stderr"]) {
      child[k].unpipe(k === "stdout" ? process.stdout : process.stderr);
      child[k].on("data", (b) => {
        try {
          if (counts[k] + b.length > LOG) throw Error("LOG_64K_CAP");
          fs.writeSync(fds[k], b);
          counts[k] += b.length;
        } catch (e) {
          trip(e);
        }
      });
    }
    monitor = setInterval(() => {
      try {
        if (bytes(out) > LIMIT - RESERVE) throw Error(authorityMode ? "OUTPUT_2M_CAP" : "OUTPUT_32M_CAP");
      } catch (e) {
        trip(e);
      }
    }, 250);
    exit = await Promise.race([bounded(() => processExit(child), 60000, "OWNER_60S_DEADLINE"), overrun]);
  } catch (e) {
    error = String(e.stack || e);
  } finally {
    clearInterval(monitor);
    try {
      cleanup = await stopOwnedProcess(child);
    } catch (e) {
      cleanup = { status: "FAIL", error: String(e) };
    }
    for (const fd of descriptors) fs.closeSync(fd);
    let pinsUnchanged = false;
    try {
      pinsUnchanged = !!pins && same(pins);
    } catch (e) {
      error ||= String(e);
    }
    const directoryBytesBeforeReceipt = bytes(out);
    Object.assign(r, {
      exit,
      cleanup,
      error: error || null,
      pinsUnchanged,
      directoryBytesBeforeReceipt,
      logs: counts,
      finishedAt: new Date().toISOString(),
    });
    r.lifecyclePass =
      !error &&
      cleanup?.status === "PASS" &&
      cleanup.treeReaped === true &&
      cleanup.streamsClosed === true &&
      pinsUnchanged &&
      directoryBytesBeforeReceipt <= LIMIT - LOG;
    r.suitePass = exit?.code === 0 && exit.supervisionFailure !== true;
    const receipt = Buffer.from(JSON.stringify(r, null, 2) + "\n");
    if (receipt.length > LOG || directoryBytesBeforeReceipt + receipt.length > LIMIT)
      throw Error("FINAL_RECEIPT_BUDGET");
    fs.writeFileSync(path.join(out, "owned.json"), receipt, { flag: "wx" });
    console.log(JSON.stringify({ suitePass: r.suitePass, lifecyclePass: r.lifecyclePass }));
    if (!r.suitePass || !r.lifecyclePass) process.exitCode = 1;
  }
}

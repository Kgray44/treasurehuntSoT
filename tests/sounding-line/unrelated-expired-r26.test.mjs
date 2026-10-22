// Inert Git repositories and fixed clocks only; no provider, campaign or private key.
import assert from "node:assert/strict";
import test from "node:test";
import childProcess, { execFileSync, spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindExperienceException, trustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const installed = "408f37389e6dd358b1ab005d91f3f588405f61db";
const registryFile = "testing/product-experience-exceptions.json";
const registryBytes = execFileSync("git", ["show", installed + ":" + registryFile], {
  cwd: sourceRoot,
  maxBuffer: 16 * 1024 * 1024,
});
const fixed = Date.parse("2026-10-22T04:05:21Z");
const expired = /PRODUCT_EXPERIENCE_EXCEPTION_R26_RECORD_OR_EXPIRY_CHANGED/u;
function fixture(t, mutate = () => {}, addCandidate = () => {}) {
  const temp = mkdtempSync(path.join(tmpdir(), "r26-unrelated-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, "repo");
  mkdirSync(root);
  const git = (...args) =>
    execFileSync("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", ...args], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Synthetic");
  git("config", "user.email", "synthetic@example.invalid");
  mkdirSync(path.join(root, "testing"));
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  const registry = JSON.parse(registryBytes);
  mutate(registry);
  writeFileSync(path.join(root, registryFile), JSON.stringify(registry));
  writeFileSync(path.join(root, "testing/contracts.json"), '{"contracts":[]}\n');
  writeFileSync(path.join(root, "scripts/sounding-line/experience-current-r26.mjs"), "// inert installed sentinel\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "inert installed registry");
  const baseSha = git("rev-parse", "HEAD");
  writeFileSync(path.join(root, "unrelated.txt"), "synthetic unrelated maintenance\n");
  git("add", ".");
  addCandidate(root, registry);
  git("add", ".");
  git("commit", "--quiet", "-m", "unrelated change");
  const candidateSha = git("rev-parse", "HEAD");
  const clock = path.join(temp, "clock.mjs");
  writeFileSync(
    clock,
    `const OriginalDate=Date;globalThis.Date=class extends OriginalDate{constructor(...a){super(...(a.length?a:[${fixed}]));}static now(){return ${fixed};}};\n`,
  );
  const output = path.join(temp, "output.txt"),
    event = path.join(temp, "event.json");
  const snapshot = () => ({
    refs: git("for-each-ref", "--format=%(refname) %(objectname)"),
    head: git("rev-parse", "HEAD"),
    registry: readFileSync(path.join(root, registryFile)).toString("base64"),
  });
  const cli = (operation, prNumber, selectedCandidate = candidateSha) => {
    writeFileSync(
      event,
      JSON.stringify({ pull_request: { number: prNumber }, inputs: { experience_mode: "ordinary" } }),
    );
    writeFileSync(output, "SYNTHETIC_OUTPUT_PREFIX\n");
    const result = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=512",
        "--import",
        pathToFileURL(clock).href,
        path.join(sourceRoot, "scripts/sounding-line/experience-exception.mjs"),
        "--operation",
        operation,
        "--workspace",
        root,
        "--base",
        baseSha,
        "--candidate",
        selectedCandidate,
      ],
      {
        cwd: root,
        windowsHide: true,
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, GITHUB_SHA: baseSha, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output, GH_TOKEN: "" },
      },
    );
    assert.equal(result.error, undefined);
    return { ...result, output: readFileSync(output, "utf8") };
  };
  return { root, baseSha, candidateSha, git, snapshot, cli };
}
function clock(t) {
  t.mock.timers.enable({ apis: ["Date"], now: fixed });
}
test(
  "unrelated changed-head and same-source lookup retain every history signal within bounded reads",
  { timeout: 30000 },
  (t) => {
    const f = fixture(t);
    clock(t);
    const before = f.snapshot();
    const nativeExec = childProcess.execFileSync,
      reads = [];
    t.mock.method(childProcess, "execFileSync", function (...args) {
      if (args[0] === "git") reads.push(args[1]);
      return Reflect.apply(nativeExec, this, args);
    });
    syncBuiltinESMExports();
    t.after(() => {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    });
    for (const candidateSha of [f.candidateSha, f.baseSha]) {
      const start = reads.length;
      assert.equal(bindExperienceException({ ...f, candidateSha, plan: {}, prNumber: 788 }), null);
      const calls = reads.slice(start);
      assert(calls.length <= 100, `unrelated scope exceeded 100 immutable Git reads: ${calls.length}`);
      if (candidateSha !== f.baseSha) {
        assert.equal(calls.filter((a) => a[0] === "ls-tree" && a[1] === "-rz" && a.length === 3).length, 2);
        t.diagnostic(`changed-head comparison: ${calls.length} Git reads, two complete inventories`);
      }
      for (const operation of ["reserve", "seal"]) {
        const r = f.cli(operation, 788, candidateSha);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(r.stdout, "");
        assert.equal(r.stderr, "");
        assert.equal(r.output, "SYNTHETIC_OUTPUT_PREFIX\ncampaign=false\n");
      }
    }
    assert.deepEqual(f.snapshot(), before);
  },
);

test(
  "recognized R26 work retains live expiry rejection with no binding, slot or output write",
  { timeout: 30000 },
  (t) => {
    const f = fixture(t);
    clock(t);
    const before = f.snapshot();
    assert.throws(() => trustedExceptions(f.root, f.baseSha), expired);
    assert.throws(() => bindExperienceException({ ...f, plan: {}, prNumber: 721 }), expired);
    for (const operation of ["reserve", "seal"]) {
      const r = f.cli(operation, 721);
      assert.equal(r.status, 1);
      assert.equal(r.stdout, "");
      assert.match(r.stderr, expired);
      assert.equal(r.output, "SYNTHETIC_OUTPUT_PREFIX\n");
    }
    assert.deepEqual(f.snapshot(), before);
  },
);
test(
  "unrelated scope cannot hide malformed R26 records or reactivate a changed predecessor",
  { timeout: 60000 },
  (t) => {
    clock(t);
    const mutations = [
      (r) => {
        r.exceptions[0].status = "RETIRED";
      },
      (r) => {
        r.exceptions[25].ownerApproval.executionDeadlineUtc = "2026-10-23T03:59:59Z";
      },
      (r) => {
        r.exceptions[25].status = "RETIRED";
      },
      (r) => {
        r.exceptions[25].expiresAt = "2026-10-23T23:59:59Z";
      },
      (r) => {
        r.exceptions.pop();
      },
    ];
    for (const mutate of mutations) {
      const f = fixture(t, mutate),
        before = f.snapshot();
      assert.throws(
        () => bindExperienceException({ ...f, plan: {}, prNumber: 788 }),
        /PRODUCT_EXPERIENCE_EXCEPTION_R26_/u,
      );
      for (const operation of ["reserve", "seal"]) {
        const r = f.cli(operation, 788);
        assert.equal(r.status, 1);
        assert.equal(r.stdout, "");
        assert.match(r.stderr, /PRODUCT_EXPERIENCE_EXCEPTION_R26_/u);
        assert.equal(r.output, "SYNTHETIC_OUTPUT_PREFIX\n");
      }
      assert.deepEqual(f.snapshot(), before);
    }
  },
);

test(
  "history files and directories remain campaign signals while shared review requires its exact blob",
  { timeout: 60000 },
  (t) => {
    clock(t);
    const original = JSON.parse(registryBytes).exceptions[25];
    const shared = "Development_Docs/Testing/Product_Experience/candidate-review.json";
    const ordinaryPath = original.immutableHistory.find(
      (p) => p.path !== shared && p.path.startsWith("Development_Docs/"),
    ).path;
    const sharedPin = original.immutableHistory.find((p) => p.path === shared);
    assert(sharedPin);
    function add(root, file, bytes, directory = false) {
      const target = path.resolve(root, file);
      assert(target.startsWith(root + path.sep));
      mkdirSync(path.dirname(target), { recursive: true });
      if (directory) {
        mkdirSync(target);
        writeFileSync(path.join(target, "synthetic.txt"), "owned inert directory marker");
      } else writeFileSync(target, bytes);
    }
    const exact = execFileSync("git", ["cat-file", "blob", sharedPin.blob], {
      cwd: sourceRoot,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5000,
    });
    for (const [file, bytes, directory, related] of [
      [ordinaryPath, "synthetic history file", false, true],
      [ordinaryPath, "", true, true],
      [shared, exact, false, true],
      [shared, "synthetic unrelated review", false, false],
    ]) {
      const f = fixture(
          t,
          () => {},
          (root) => add(root, file, bytes, directory),
        ),
        before = f.snapshot();
      const bind = () => bindExperienceException({ ...f, plan: {}, prNumber: 788 });
      if (related) assert.throws(bind, expired);
      else assert.equal(bind(), null);
      for (const operation of ["reserve", "seal"]) {
        const r = f.cli(operation, 788);
        assert.equal(r.status, related ? 1 : 0, r.stderr);
        assert.equal(r.stdout, "");
        if (related) assert.match(r.stderr, expired);
        else assert.equal(r.stderr, "");
        assert.equal(r.output, related ? "SYNTHETIC_OUTPUT_PREFIX\n" : "SYNTHETIC_OUTPUT_PREFIX\ncampaign=false\n");
      }
      assert.deepEqual(f.snapshot(), before);
    }
  },
);

// Inert Git repositories and fixed clocks only; no provider, campaign or private key.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
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
function fixture(t, mutate = () => {}) {
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
  "unrelated same-source lookup with an unchanged expired R26 record obtains no campaign binding or custody writes",
  { timeout: 30000 },
  (t) => {
    const f = fixture(t);
    f.candidateSha = f.baseSha;
    clock(t);
    const before = f.snapshot();
    assert.equal(bindExperienceException({ ...f, plan: {}, prNumber: 788 }), null);
    for (const operation of ["reserve", "seal"]) {
      const r = f.cli(operation, 788, f.candidateSha);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, "");
      assert.equal(r.output, "SYNTHETIC_OUTPUT_PREFIX\ncampaign=false\n");
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

// Inert, task-owned repositories only. No execution admission, API or custody.
import assert from "node:assert/strict";
import test from "node:test";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recognizeExceptionExecution } from "../../scripts/sounding-line/experience-exception.mjs";
import {
  sourceDiagnosticGit,
  withReplayAdmissionScope,
  withSourceDiagnosticCapture,
} from "../../scripts/sounding-line/source-diagnostics.mjs";

const sourceRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const nativeExec = childProcess.execFileSync;
const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
function fixture(t, { emptyHistory = false, emptySrc = false, rows = 26 } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "recognition-immutable-"));
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("recognition-immutable-"));
    rmSync(root, { recursive: true, force: true });
  });
  const git = (args, input) =>
    nativeExec("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", ...args], {
      cwd: root,
      input,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  const put = (file, bytes) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), bytes);
  };
  const commit = () => {
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "inert synthetic revision"]);
    return git(["rev-parse", "HEAD"]);
  };
  const addEmptyRootTree = (name, sha) => {
    const entries = git(["ls-tree", "HEAD"])
      .split("\n")
      .filter((line) => line && line.split("\t")[1] !== name);
    entries.push(`040000 tree ${sha}\t${name}`);
    const tree = git(["mktree"], entries.join("\n") + "\n");
    const head = git(["commit-tree", tree, "-p", "HEAD"], "inert explicit empty tree\n");
    git(["update-ref", "HEAD", head]);
    git(["read-tree", tree]);
    return head;
  };
  git(["init", "--quiet"]);
  git(["config", "user.name", "Synthetic"]);
  git(["config", "user.email", "synthetic@example.invalid"]);
  assert.equal(git(["mktree"], ""), emptyTree);
  const history = emptyHistory
    ? [{ path: "Development_Docs/empty-history", blob: "1".repeat(40) }]
    : Array.from({ length: 64 }, (_, index) => ({
        path: `Development_Docs/history/entry-${index}.json`,
        blob: "1".repeat(40),
      }));
  const records = Array.from({ length: rows }, (_, index) => ({
    id: `INERT_RECOGNITION_${index}`,
    pullRequest: 7000 + index,
    frozenReferenceSha: "f".repeat(40),
    frozenHistoricalBaseSha: "e".repeat(40),
    immutableHistory: history,
    ...(emptySrc ? { frozenTrees: { src: emptyTree } } : {}),
  }));
  put("testing/product-experience-exceptions.json", JSON.stringify({ version: 1, exceptions: records }));
  put("testing/contracts.json", '{"contracts":[]}\n');
  if (!emptyHistory && !emptySrc) for (const entry of history) put(entry.path, "inert inherited history\n");
  let baseSha = commit();
  if (emptyHistory) {
    const docsTree = git(["mktree"], `040000 tree ${emptyTree}\tempty-history\n`);
    baseSha = addEmptyRootTree("Development_Docs", docsTree);
    put("Development_Docs/empty-history/populated.txt", "previously present directory\n");
  }
  put("unrelated.txt", "inert unrelated change\n");
  let candidateSha = commit();
  if (emptySrc) candidateSha = addEmptyRootTree("src", emptyTree);
  git(["update-ref", "refs/remotes/origin/main", baseSha]);
  return { root, git, put, commit, baseSha, candidateSha };
}
function observe(t, fixture) {
  const reads = [];
  let installedReads = 0;
  let failPresence = false;
  t.mock.method(childProcess, "execFileSync", function (command, args, options = {}) {
    assert.equal(command, "git");
    reads.push(args);
    assert(reads.length <= 128, "recognition exceeded 128 immutable Git reads");
    const installedRead = typeof options.cwd === "string" && path.resolve(options.cwd) === sourceRoot;
    if (installedRead) installedReads++;
    if (failPresence && args[0] === "ls-tree" && args[1] === "-rtz") throw Error("INERT_PRESENCE_READ_FAILURE");
    return nativeExec(command, args, {
      ...options,
      ...(installedRead ? { cwd: fixture.root } : {}),
      windowsHide: true,
      timeout: 5000,
    });
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return {
    reads,
    failPresence(value) {
      failPresence = value;
    },
    recognize(overrides = {}) {
      reads.length = 0;
      installedReads = 0;
      try {
        return recognizeExceptionExecution({ ...fixture, environment: {}, ...overrides });
      } finally {
        assert(installedReads >= 3, "installed identity and registry must be read from the inert repository");
      }
    },
  };
}

test(
  "recognition shares immutable reads across inherited records and reads afresh after failure",
  { timeout: 60000 },
  (t) => {
    const f = fixture(t),
      observed = observe(t, f);
    assert.equal(observed.recognize(), false);
    assert.equal(observed.reads.filter((args) => args[0] === "ls-tree" && args[1] === "-rtz").length, 2);
    const firstReads = observed.reads.length;
    observed.failPresence(true);
    assert.throws(() => observed.recognize(), /INERT_PRESENCE_READ_FAILURE/u);
    observed.failPresence(false);
    assert.equal(observed.recognize(), false);
    assert.equal(observed.reads.length, firstReads);
    t.diagnostic(`79 recognition rows retain inherited history using ${firstReads} Git reads per invocation`);
  },
);

test(
  "recognition preserves empty history tree presence and recognizes copied empty frozen src",
  { timeout: 60000 },
  (t) => {
    const inherited = fixture(t, { emptyHistory: true, rows: 1 });
    const inheritedObservation = observe(t, inherited);
    assert.equal(inheritedObservation.recognize(), false);
    t.mock.restoreAll();
    syncBuiltinESMExports();
    const copied = fixture(t, { emptySrc: true, rows: 1 });
    const copiedObservation = observe(t, copied);
    assert.equal(copiedObservation.recognize(), true);
    assert(copiedObservation.reads.some((args) => args[0] === "ls-tree" && args[1] === "-rtz"));
  },
);

test(
  "recognition retains explicit PR and base mismatch short circuits and new refit signals",
  { timeout: 60000 },
  (t) => {
    const f = fixture(t, { rows: 1 }),
      observed = observe(t, f);
    assert.equal(observed.recognize({ environment: { SOUNDING_LINE_PR_NUMBER: "7000" } }), true);
    assert.equal(
      observed.reads.some((args) => args[1] === "-rtz"),
      false,
    );
    assert.equal(observed.recognize({ baseSha: f.candidateSha }), true);
    assert.equal(
      observed.reads.some((args) => args[1] === "-rtz"),
      false,
    );
    f.put("another-unrelated.txt", "a real distinct inert base\n");
    const mismatchedBase = f.commit();
    assert.notEqual(mismatchedBase, f.baseSha);
    assert.notEqual(mismatchedBase, f.candidateSha);
    assert.equal(observed.recognize({ baseSha: mismatchedBase }), true);
    assert.equal(
      observed.reads.some((args) => args[1] === "-rtz"),
      false,
    );
    f.put("testing/contracts.json", '{"contracts":[{"id":"crossdeck.refit.companion"}]}\n');
    const candidateSha = f.commit();
    assert.equal(observed.recognize({ candidateSha }), true);
    f.git(["update-ref", "-d", "refs/remotes/origin/main"]);
    assert.equal(observed.recognize(), true);
    assert.equal(
      observed.reads.some((args) => args[1] === "-rtz"),
      false,
    );
  },
);

test("source diagnostics captures only the fixed full-SHA tree-presence read shape", { timeout: 30000 }, (t) => {
  const f = fixture(t, { rows: 1 });
  let captured = 0;
  const capture = {
    executeGitRead(execute, args, options) {
      captured++;
      return execute("git", args, options);
    },
  };
  const read = (args) =>
    withSourceDiagnosticCapture(capture, () =>
      withReplayAdmissionScope(() =>
        sourceDiagnosticGit("EXPERIENCE_EXCEPTION", args, {
          cwd: f.root,
          encoding: "utf8",
          windowsHide: true,
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        }),
      ),
    );
  assert(read(["ls-tree", "-rtz", f.candidateSha]).includes("testing/contracts.json"));
  assert.equal(captured, 1);
  assert(read(["ls-tree", "-rtz", "HEAD"]).includes("testing/contracts.json"));
  assert(read(["ls-tree", "-rtz", f.candidateSha, "--", "testing"]).includes("testing/contracts.json"));
  assert.equal(captured, 1);
  withSourceDiagnosticCapture(capture, () =>
    withReplayAdmissionScope(() =>
      sourceDiagnosticGit("PRODUCT_EXPERIENCE", ["ls-tree", "-rtz", f.candidateSha], {
        cwd: f.root,
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      }),
    ),
  );
  assert.equal(captured, 1);
});

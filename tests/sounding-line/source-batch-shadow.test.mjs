import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compareSourceBatchShadow,
  SOURCE_BATCH_SHADOW_LIMITS,
} from "../../scripts/sounding-line/source-batch-shadow.mjs";

const sha = "a".repeat(40),
  blob = (bytes) =>
    createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`))
      .update(bytes)
      .digest("hex"),
  empty = Buffer.alloc(0),
  tree = (...rows) => Buffer.from(rows.map((row) => `${row}\0`).join("")),
  query = (id, operation, file, value = empty) => ({
    id,
    operation,
    path: file,
    revision: sha,
    legacy: { ok: true, value },
  });

test("native complete-tree/blob batching agrees with independent original Git reads", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "source-batch-shadow-"));
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("source-batch-shadow-"));
    rmSync(root, { recursive: true, force: true });
  });
  const config = path.join(root, "empty.gitconfig");
  writeFileSync(config, "");
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: config,
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_AUTHOR_NAME: "Synthetic",
    GIT_AUTHOR_EMAIL: "synthetic@example.invalid",
    GIT_COMMITTER_NAME: "Synthetic",
    GIT_COMMITTER_EMAIL: "synthetic@example.invalid",
    GIT_AUTHOR_DATE: "2026-11-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-11-01T00:00:00Z",
  };
  const git = (args, options = {}) =>
    execFileSync("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", ...args], {
      cwd: root,
      env,
      timeout: 5000,
      maxBuffer: SOURCE_BATCH_SHADOW_LIMITS.readBytes,
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });
  git(["init", "--quiet", "--template="]);
  mkdirSync(path.join(root, "src", "nested"), { recursive: true });
  const binary = Buffer.from([0, 255, 13, 10, 1]);
  writeFileSync(path.join(root, "src", "nested", "binary.bin"), binary);
  writeFileSync(path.join(root, "src", "same.bin"), binary);
  writeFileSync(path.join(root, "src", "script.sh"), "#!/bin/sh\nexit 0\n");
  git(["add", "src"]);
  git(["update-index", "--chmod=+x", "src/script.sh"]);
  git(["commit", "--quiet", "-m", "Synthetic source-batch baseline"]);
  const first = git(["rev-parse", "HEAD"]).toString().trim();
  const linkBlob = git(["hash-object", "-w", "--stdin"], { input: Buffer.from("src/same.bin") })
    .toString()
    .trim();
  git(["update-index", "--add", "--cacheinfo", `120000,${linkBlob},link`]);
  git(["update-index", "--add", "--cacheinfo", `160000,${first},modules/child`]);
  git(["commit", "--quiet", "-m", "Synthetic modes and submodule"]);
  const revision = git(["rev-parse", "HEAD"]).toString().trim();
  const queries = [];
  const begin = performance.now();
  for (let i = 0; i < 5; i++)
    for (const [operation, file] of [
      ["ls-tree-path", "src/nested/binary.bin"],
      ["ls-tree-path", "src/missing"],
      ["ls-tree-path", "modules/child"],
      ["identity", "src/nested"],
      ["identity", "src/script.sh"],
      ["blob", "src/nested/binary.bin"],
      ["blob", "src/same.bin"],
      ["blob", "link"],
    ]) {
      const args =
        operation === "ls-tree-path"
          ? ["ls-tree", revision, "--", file]
          : operation === "identity"
            ? ["rev-parse", `${revision}:${file}`]
            : ["show", `${revision}:${file}`];
      queries.push({ ...query(`q${queries.length}`, operation, file, git(args)), revision });
    }
  const originalMs = performance.now() - begin;
  const shadowBegin = performance.now();
  const result = compareSourceBatchShadow({ queries, read: git });
  const shadowMs = performance.now() - shadowBegin;
  assert.equal(result.stats.matched, queries.length);
  assert.equal(result.stats.batchGitReads, 3);
  assert.equal(result.stats.mismatched, 0);
  assert.equal(result.productionReadsReplaced, 0);
  assert.equal(result.reuseAuthorized, false);
  for (let i = 0; i < queries.length; i++) assert.equal(result.rows[i].legacy, queries[i].legacy);
  console.log(
    JSON.stringify({
      kind: "SYNTHETIC_SOURCE_BATCH_COMPARISON",
      originalReads: queries.length,
      batchReads: 3,
      originalMs,
      shadowMs,
      qualification: false,
    }),
  );
});

test("failed outcomes preserve their exact identity and never trigger batch work", () => {
  const error = Error("original immutable failure");
  const legacy = { ok: false, error };
  const result = compareSourceBatchShadow({
    queries: [{ ...query("failure", "blob", "src/a"), legacy }],
    read() {
      assert.fail("failed read must remain failed without another attempt");
    },
  });
  assert.equal(result.rows[0].status, "ORIGINAL_FAILURE");
  assert.equal(result.rows[0].legacy, legacy);
  assert.equal(result.rows[0].legacy.error, error);
  assert.equal(result.stats.batchGitReads, 0);
});

test("unknown quoting/pathspec selectors remain fresh without inventing output", () => {
  const paths = ["src/[id]/page.tsx", "src/a?", "src/*", "../src/a", "/src/a", "src//a", "src/a\n", "src/é"];
  const queries = paths.map((file, i) => query(`q${i}`, "identity", file, Buffer.from("original\n")));
  const result = compareSourceBatchShadow({
    queries,
    read() {
      assert.fail("unsupported selector must delegate unchanged");
    },
  });
  assert.equal(result.stats.unavailable, queries.length);
  for (let i = 0; i < queries.length; i++) assert.equal(result.rows[i].legacy, queries[i].legacy);
});

test("malformed or incomplete full trees fail closed instead of guessing identities", () => {
  for (const bytes of [
    Buffer.from(`100644 blob ${sha}\ta`),
    tree(`100644 tree ${sha}\ta`),
    tree(`100644 blob ${sha}\ta`, `100644 blob ${sha}\ta`),
    tree(`100644 blob ${sha}\tsrc/a`),
    tree(`100644 blob ${sha}\t../a`),
    tree(`100644 blob ${sha}\ta\nb`),
    Buffer.concat([Buffer.from(`100644 blob ${sha}\t`), Buffer.from([255, 0])]),
    Buffer.alloc(SOURCE_BATCH_SHADOW_LIMITS.readBytes + 1),
  ]) {
    const result = compareSourceBatchShadow({ queries: [query("q", "ls-tree-path", "a")], read: () => bytes });
    assert.equal(result.rows[0].status, "UNAVAILABLE");
    assert.equal(result.reuseAuthorized, false);
  }
});

test("a returned wrong blob cannot gain even shadow equivalence", () => {
  const original = Buffer.from("original"),
    wanted = blob(original),
    wrong = Buffer.from("mutation");
  const result = compareSourceBatchShadow({
    queries: [query("q", "blob", "a", original)],
    read(args) {
      if (args[0] === "ls-tree") return tree(`100644 blob ${wanted}\ta`);
      if (args[1] === "--batch-check") return Buffer.from(`${wanted} blob ${wrong.length}\n`);
      return Buffer.concat([Buffer.from(`${wanted} blob ${wrong.length}\n`), wrong, Buffer.from("\n")]);
    },
  });
  assert.equal(result.rows[0].status, "UNAVAILABLE");
  assert.equal(result.rows[0].comparisonSha256, null);
});

test("comparison differences remain explicit while original outcomes are unchanged", () => {
  const q = query("q", "identity", "a", Buffer.from(`${"b".repeat(40)}\n`));
  const result = compareSourceBatchShadow({ queries: [q], read: () => tree(`100644 blob ${sha}\ta`) });
  assert.equal(result.rows[0].status, "MISMATCH");
  assert.equal(result.rows[0].legacy, q.legacy);
  assert.equal(result.stats.mismatched, 1);
  assert.notEqual(result.rows[0].comparisonSha256, result.rows[0].originalSha256);
});

test("fixed request/revision bounds cannot silently expand or grant partial credit", () => {
  const queries = Array.from({ length: SOURCE_BATCH_SHADOW_LIMITS.revisions + 1 }, (_, i) => ({
    ...query(`q${i}`, "identity", "a"),
    revision: (i + 1).toString(16).padStart(40, "0"),
  }));
  const result = compareSourceBatchShadow({
    queries,
    read() {
      assert.fail("revision budget must precede I/O");
    },
  });
  assert.equal(result.stats.unavailable, queries.length);
  assert.throws(
    () => compareSourceBatchShadow({ queries: Array(SOURCE_BATCH_SHADOW_LIMITS.queries + 1), read() {} }),
    /SHADOW_INVALID/u,
  );
  assert.throws(
    () =>
      compareSourceBatchShadow({
        queries: [query("same", "identity", "a"), query("same", "identity", "a")],
        read() {},
      }),
    /SHADOW_INVALID/u,
  );
});

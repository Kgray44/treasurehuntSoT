import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  runPublicOwnerStorageProbe,
  finalizeOwnerCustodyResult,
} from "../../scripts/sounding-line/registry-custody-owner.mjs";

test("late file or journal failure cannot expose a success receipt or replace the primary failure", () => {
  const completedCanary = { publicFixture: true, canaryPassed: true };
  for (const failure of ["OWNER_CUSTODY_COPY_READBACK", "OWNER_CUSTODY_DIRECTORY_ACL_CHANGED"]) {
    const result = finalizeOwnerCustodyResult({
      receipt: completedCanary,
      failure,
      journalFailures: [{ stage: "CLOSED", error: "OWNER_CUSTODY_JOURNAL_FAILED" }],
    });
    assert.equal(result.receipt, null);
    assert.equal(result.failure, failure);
    assert.equal(result.qualification, false);
    assert.equal(result.reuseAuthorized, false);
  }
  const journalOnly = finalizeOwnerCustodyResult({
    receipt: completedCanary,
    failure: null,
    journalFailures: [{ stage: "CLOSED", error: "OWNER_CUSTODY_JOURNAL_FAILED" }],
  });
  assert.equal(journalOnly.receipt, null);
  assert.equal(journalOnly.failure, "OWNER_CUSTODY_JOURNAL_FAILED");
});

const entry = fileURLToPath(new URL("../../scripts/sounding-line/registry-custody-owner.mjs", import.meta.url));
test("captured owner operation refuses before private setup; observation grants no presence", () => {
  const invoke = (...args) =>
    spawnSync(process.execPath, [entry, ...args], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, CODEX_THREAD_ID: "public-test-capture" },
    });
  const check = invoke("--operation", "check-private-console");
  assert.equal(check.status, 0);
  const observation = JSON.parse(check.stdout);
  assert.equal(observation.ready, false);
  assert.equal(observation.ownerPresenceProved, false);
  assert.equal(observation.ownerKeyOperations, 0);
  const prepare = invoke("--operation", "owner-prepare");
  assert.equal(prepare.status, 1);
  assert.equal(prepare.stdout, "");
  assert.equal(prepare.stderr.trim(), "OWNER_CUSTODY_PRIVATE_OWNER_CONSOLE_REQUIRED");
  const provider = ["--operation", "owner-open-provider-registry", "4000", "8000", "900", "a".repeat(64), "D"];
  const open = invoke(...provider);
  assert.equal(open.status, 1);
  assert.equal(open.stdout, "");
  assert.equal(open.stderr.trim(), "OWNER_CUSTODY_PRIVATE_OWNER_CONSOLE_REQUIRED");
  for (const [index, value] of [
    [2, "9007199254740992"],
    [4, "721"],
    [4, "776"],
    [4, "805"],
    [5, "not-a-digest"],
    [6, "E"],
  ]) {
    const bad = provider.slice();
    bad[index] = value;
    const denied = invoke(...bad);
    assert.equal(denied.status, 1);
    assert.equal(denied.stdout, "");
    assert.equal(denied.stderr.trim(), "OWNER_CUSTODY_ARGUMENTS");
  }
  for (const args of [[], ["--operation", "decrypt"], ["--operation", "owner-prepare", "--key", "public-fixture"]]) {
    const result = invoke(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "OWNER_CUSTODY_ARGUMENTS");
  }
});

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vw-owner-public-test-"));
  const first = path.join(root, "first"),
    second = path.join(root, "second");
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  try {
    run(first, second);
  } finally {
    // Only exact fixture files known to the test may be removed, never a tree.
    for (const parent of [first, second]) {
      for (const name of fs.readdirSync(parent)) {
        assert.match(name, /^owner-custody-public-storage-/);
        const directory = path.join(parent, name);
        for (const file of fs.readdirSync(directory)) {
          assert.ok(["public-canary.bin", "unexpected-public.txt"].includes(file));
          fs.unlinkSync(path.join(directory, file));
        }
        fs.rmdirSync(directory);
      }
      fs.rmdirSync(parent);
    }
    fs.rmdirSync(root);
  }
}

test("create-only public writer verifies two copies and retires its exact public fixtures", () =>
  fixture((first, second) => {
    const result = runPublicOwnerStorageProbe(first, second);
    assert.equal(result.ownerKeyOperations, 0);
    assert.equal(result.qualification, false);
    assert.equal(result.reuseAuthorized, false);
    assert.equal(result.copies.length, 2);
    assert.equal(result.copies[0].sha256, result.copies[1].sha256);
    assert.ok(result.cleanup.every((row) => row.status === "VERIFIED_PUBLIC_PROBE_RETIRED"));
    assert.deepEqual(fs.readdirSync(first), []);
    assert.deepEqual(fs.readdirSync(second), []);
  }));

test("partial public write preserves original error and holds changed content", () =>
  fixture((first, second) => {
    const original = fs.writeSync;
    const failure = Error("PUBLIC_TEST_PARTIAL_WRITE");
    fs.writeSync = function (fd, bytes, ...args) {
      if (Buffer.isBuffer(bytes) && bytes.toString().startsWith("VW_PUBLIC_OWNER_STORAGE_PROBE")) {
        original.call(fs, fd, bytes, 0, 4);
        throw failure;
      }
      return original.call(fs, fd, bytes, ...args);
    };
    try {
      assert.throws(
        () => runPublicOwnerStorageProbe(first, second),
        (error) => {
          assert.equal(error, failure);
          assert.equal(error.publicProbeCleanup.length, 1);
          assert.equal(error.publicProbeCleanup[0].status, "HELD");
          assert.equal(
            fs.readFileSync(path.join(error.publicProbeCleanup[0].directory, "public-canary.bin"), "utf8"),
            "VW_P",
          );
          return true;
        },
      );
    } finally {
      fs.writeSync = original;
    }
  }));

test("unknown entries prevent public fixture retirement", () =>
  fixture((first, second) => {
    const original = fs.fsyncSync;
    fs.fsyncSync = function (fd) {
      original.call(fs, fd);
      const directory = path.join(first, fs.readdirSync(first)[0]);
      fs.writeFileSync(path.join(directory, "unexpected-public.txt"), "PUBLIC ONLY", { flag: "wx" });
    };
    try {
      assert.throws(
        () => runPublicOwnerStorageProbe(first, second),
        (error) => {
          assert.ok(error.publicProbeCleanup.some((row) => row.status === "HELD"));
          assert.equal(
            fs.readFileSync(path.join(first, fs.readdirSync(first)[0], "unexpected-public.txt"), "utf8"),
            "PUBLIC ONLY",
          );
          return true;
        },
      );
    } finally {
      fs.fsyncSync = original;
    }
  }));

test(
  "Windows directory helper protects only newly created public fixture leaves and refuses reuse",
  { skip: process.platform !== "win32" },
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vw-owner-acl-public-test-"));
    const parents = ["first", "second"].map((name) => path.join(root, name));
    for (const parent of parents) fs.mkdirSync(parent);
    const source = fs.readFileSync(
      new URL("../../scripts/sounding-line/registry-custody-owner-windows.ps1", import.meta.url),
      "utf8",
    );
    const original = "foreach($drive in @('C:','D:'))";
    assert.equal(source.split(original).length, 2);
    const instrumented = source
      .replace(original, `foreach($drive in @(${parents.map((p) => `'${p.replaceAll("'", "''")}'`).join(",")}))`)
      .replace(
        "$leaf=Join-Path $drive '\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001'",
        "$leaf=Join-Path $drive 'VoyagewrightRecovery\\SoundingLine\\B\\generation-0001'",
      )
      .replace("error='DIRECTORY_PREPARATION_FAILED'", "error=$_.Exception.Message");
    assert.ok(!instrumented.includes("'C:'") && !instrumented.includes("'D:'"));
    const script = path.join(root, "public-fixture-only.ps1");
    fs.writeFileSync(script, instrumented, { flag: "wx" });
    const created = [];
    try {
      const childEnv = { ...process.env };
      delete childEnv.PSModulePath;
      const invoke = (operation = "directories") =>
        spawnSync(
          path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"),
          ["-NoProfile", "-NonInteractive", "-File", script, "-Operation", operation],
          { encoding: "utf8", timeout: 15000, maxBuffer: 65536, env: childEnv },
        );
      const result = invoke();
      const receipt = JSON.parse(result.stdout.replace(/^\uFEFF/u, ""));
      for (const directory of receipt.created) {
        assert.ok(parents.some((parent) => directory.startsWith(parent + path.sep)));
        created.push(directory);
      }
      assert.equal(result.status, 0, JSON.stringify(receipt));
      assert.equal(receipt.status, "NEW_DIRECTORIES_ONLY");
      assert.equal(receipt.keyFilesWritten, 0);
      assert.equal(receipt.directories.length, 2);
      assert.equal(created.length, 8);
      for (const row of receipt.directories) {
        assert.ok(row.acl.includes("D:P"));
        assert.deepEqual(fs.readdirSync(row.path), []);
      }
      const repeated = invoke();
      assert.equal(repeated.status, 1);
      const refused = JSON.parse(repeated.stdout.replace(/^\uFEFF/u, ""));
      assert.equal(refused.status, "INCOMPLETE_DIRECTORIES");
      assert.deepEqual(refused.created, []);
      const publicFile = path.join(receipt.directories[0].path, "package-created.public.json");
      fs.writeFileSync(publicFile, '{"publicFixture":true}\n', { flag: "wx" });
      try {
        const verification = invoke("verify");
        assert.equal(verification.status, 0, verification.stdout);
        assert.equal(JSON.parse(verification.stdout).status, "VERIFIED_EXISTING_CUSTODY_ACL");
        const unexpected = path.join(receipt.directories[0].path, "unexpected-public.txt");
        fs.writeFileSync(unexpected, "PUBLIC ONLY", { flag: "wx" });
        try {
          assert.equal(invoke("verify").status, 1);
        } finally {
          fs.unlinkSync(unexpected);
        }
      } finally {
        fs.unlinkSync(publicFile);
      }
    } finally {
      for (const directory of created.reverse()) fs.rmdirSync(directory);
      fs.unlinkSync(script);
      for (const parent of parents) fs.rmdirSync(parent);
      fs.rmdirSync(root);
    }
  },
);

test(
  "private console launcher rejects captured tools without running its runtime",
  { skip: process.platform !== "win32" },
  () => {
    const script = fileURLToPath(
      new URL("../../scripts/sounding-line/registry-custody-owner-console.ps1", import.meta.url),
    );
    const result = spawnSync(
      path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-File", script],
      {
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 16384,
        env: { ...process.env, CODEX_THREAD_ID: "public-test-capture" },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /OWNER_CUSTODY_CAPTURED_SESSION_REFUSED/);
  },
);

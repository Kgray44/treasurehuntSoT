import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createImmutableSuccessReuse,
  recognitionGitRead,
  withImmutableRecognitionReads,
} from "../../scripts/sounding-line/immutable-recognition-reads.mjs";
import { CROSSDECK_CAMPAIGN, recognizeExceptionExecution } from "../../scripts/sounding-line/experience-exception.mjs";
import {
  withSourceDiagnosticCapture,
  withReplayAdmissionScope,
} from "../../scripts/sounding-line/source-diagnostics.mjs";

const base = "a".repeat(40),
  candidate = "b".repeat(40);
const options = {
  cwd: path.resolve("immutable-read-fixture"),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  maxBuffer: 1024 * 1024,
};
const args = ["show", `${base}:testing/contracts.json`];

test("native immutable values and absence are reused while HEAD stays live", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "sounding-line-immutable-native-"));
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("sounding-line-immutable-native-"));
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
    GIT_OPTIONAL_LOCKS: "0",
    GIT_AUTHOR_DATE: "2026-10-22T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-10-22T00:00:00Z",
  };
  const native = (ar) =>
    execFileSync("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", ...ar], {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
  native(["init", "--quiet", "--template="]);
  native(["config", "user.name", "Synthetic"]);
  native(["config", "user.email", "synthetic@example.invalid"]);
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src/payload.txt"), "first\n");
  native(["add", "src/payload.txt"]);
  native(["commit", "--quiet", "-m", "first"]);
  const first = native(["rev-parse", "HEAD"]).trim();
  writeFileSync(path.join(root, "src/payload.txt"), "second\n");
  native(["add", "src/payload.txt"]);
  native(["commit", "--quiet", "-m", "second"]);
  const second = native(["rev-parse", "HEAD"]).trim();
  native(["update-ref", "HEAD", first]);
  const reads = [];
  const exec = (command, ar, opts) => {
    assert.equal(command, "git");
    reads.push([...ar]);
    return execFileSync(command, ar, { ...opts, env, timeout: 5000 });
  };
  const opts = { ...options, cwd: root };
  withImmutableRecognitionReads(() => {
    for (let i = 0; i < 2; i++)
      assert.equal(recognitionGitRead(exec, ["show", `${first}:src/payload.txt`], opts), "first\n");
    for (let i = 0; i < 2; i++)
      assert.equal(recognitionGitRead(exec, ["ls-tree", first, "--", "src/missing.txt"], opts), "");
    assert.match(recognitionGitRead(exec, ["ls-tree", first, "--", "src"], opts), /^040000 tree [a-f0-9]{40}\tsrc\n$/u);
    assert.equal(recognitionGitRead(exec, ["rev-parse", "HEAD"], opts).trim(), first);
    native(["update-ref", "HEAD", second]);
    assert.equal(recognitionGitRead(exec, ["rev-parse", "HEAD"], opts).trim(), second);
  });
  assert.equal(reads.filter((r) => r[0] === "show").length, 1);
  assert.equal(reads.filter((r) => r[3] === "src/missing.txt").length, 1);
  assert.equal(reads.filter((r) => r[1] === "HEAD").length, 2);
  const failures = [];
  const failureExec = (c, ar, opts) => {
    try {
      return exec(c, ar, opts);
    } catch (error) {
      failures.push(error);
      throw error;
    }
  };
  withImmutableRecognitionReads(() => {
    for (let i = 0; i < 2; i++)
      assert.throws(
        () => recognitionGitRead(failureExec, ["show", `${first}:src/missing.txt`], opts),
        (e) => e === failures.at(-1) && e.status !== 0,
      );
  });
  assert.equal(failures.length, 2);
});

test("production recognizer scope reuses success, preserves caught ancestry failures and starts fresh", () => {
  const registry = "testing/product-experience-exceptions.json",
    contracts = "testing/contracts.json";
  const history = CROSSDECK_CAMPAIGN.immutableHistory[0].path;
  const counts = new Map();
  const capture = {
    executeGitRead(_exec, ar) {
      const key = JSON.stringify(ar);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (ar[0] === "rev-parse") return (ar[1] === "HEAD" ? base : "c".repeat(40)) + "\n";
      if (ar[0] === "show" && ar[1].endsWith(":" + registry)) return '{"version":1,"exceptions":[]}';
      if (ar[0] === "ls-tree" && ar[1] === "-rz") return `100644 blob ${base}\t${history}\0`;
      if (ar[0] === "ls-tree") return [registry, history].includes(ar[3]) ? `100644 blob ${base}\t${ar[3]}\n` : "";
      if (ar[0] === "merge-base") throw Object.assign(new Error("synthetic nonancestor"), { status: 1 });
      throw new Error("UNEXPECTED_INERT_READ:" + ar[0]);
    },
  };
  for (let i = 0; i < 2; i++) {
    const value = withSourceDiagnosticCapture(capture, () =>
      withReplayAdmissionScope(() =>
        recognizeExceptionExecution({
          root: options.cwd,
          baseSha: "c".repeat(40),
          candidateSha: candidate,
          environment: {},
        }),
      ),
    );
    assert.equal(value, false);
    assert.equal(counts.get(JSON.stringify(["ls-tree", candidate, "--", contracts])), i + 1);
    assert.equal(
      counts.get(JSON.stringify(["merge-base", "--is-ancestor", CROSSDECK_CAMPAIGN.frozenReferenceSha, candidate])),
      2 * (i + 1),
    );
  }
});

test("first errors retain identity and a caller's later successful read can be reused", () => {
  for (const spec of [
    { code: "ENOENT" },
    { code: "EACCES" },
    { code: "ETIMEDOUT", signal: "SIGTERM" },
    { code: "ENOBUFS", stdout: Buffer.from("partial") },
    { status: 1 },
    { status: 128 },
  ]) {
    const error = Object.freeze(Object.assign(new Error("native boundary"), spec));
    const reader = createImmutableSuccessReuse();
    let calls = 0;
    const exec = (_command, ar, opts) => {
      assert.equal(ar, args);
      assert.equal(opts, options);
      if (++calls === 1) throw error;
      return "complete";
    };
    assert.throws(
      () => reader.executeGitRead(exec, args, options),
      (e) => e === error,
    );
    assert.equal(reader.stats.entries, 0);
    assert.equal(calls, 1);
    assert.equal(reader.executeGitRead(exec, args, options), "complete");
    assert.equal(reader.executeGitRead(exec, args, options), "complete");
    assert.equal(calls, 2);
  }
});

test("immutable keys distinguish material input and copy retained buffers", () => {
  const reader = createImmutableSuccessReuse();
  let calls = 0;
  const exec = (_command, _ar, opts) => {
    calls++;
    return opts.encoding === null ? Buffer.from("value") : "value";
  };
  const variations = [
    [[...args], { ...options, cwd: path.resolve("another-fixture") }],
    [["show", `${candidate}:testing/contracts.json`], options],
    [["show", `${base}:testing/other.json`], options],
    [args, { ...options, encoding: null }],
    [args, { ...options, stdio: ["ignore", "pipe", "inherit"] }],
    [args, { ...options, maxBuffer: 512 }],
  ];
  reader.executeGitRead(exec, args, options);
  for (const [ar, opts] of variations) reader.executeGitRead(exec, ar, opts);
  assert.equal(calls, 7);
  const bufferOptions = { ...options, encoding: null },
    a = reader.executeGitRead(exec, args, bufferOptions);
  a[0] = 0;
  const b = reader.executeGitRead(exec, args, bufferOptions);
  assert.deepEqual(b, Buffer.from("value"));
  assert.notEqual(a, b);
});

test("mutable, private, material-env and inherited-output reads always pass through", () => {
  const reader = createImmutableSuccessReuse();
  let calls = 0;
  const exec = () => String(++calls);
  for (const [ar, opts] of [
    [["rev-parse", "HEAD"], options],
    [["rev-parse", "origin/main"], options],
    [["show", `${base}:PRIVATE_CONTEXT_FILE`], options],
    [args, { ...options, env: {} }],
    [args, { ...options, stdio: ["ignore", "pipe", "inherit"] }],
  ])
    assert.notEqual(reader.executeGitRead(exec, ar, opts), reader.executeGitRead(exec, ar, opts));
  assert.equal(calls, 10);
  assert.equal(reader.stats.entries, 0);
  let getters = 0;
  const special = { ...options };
  Object.defineProperty(special, "encoding", {
    enumerable: true,
    get() {
      getters++;
      return "utf8";
    },
  });
  reader.executeGitRead(exec, args, special);
  reader.executeGitRead(exec, args, special);
  assert.equal(getters, 0);
});

test("fixed cache limits preserve original reads when retention is exhausted", () => {
  for (const limits of [
    { maxEntries: 0, maxBytes: 4 },
    { maxEntries: 1, maxBytes: 3 },
  ]) {
    const reader = createImmutableSuccessReuse(limits);
    let calls = 0;
    const exec = () => {
      calls++;
      return "data";
    };
    assert.equal(reader.executeGitRead(exec, args, options), "data");
    assert.equal(reader.executeGitRead(exec, args, options), "data");
    assert.equal(calls, 2);
    assert.equal(reader.stats.entries, 0);
  }
  const reader = createImmutableSuccessReuse({ maxEntries: 1, maxBytes: 4 });
  let calls = 0;
  const exec = () => {
    calls++;
    return "data";
  };
  reader.executeGitRead(exec, args, options);
  for (let i = 0; i < 2; i++) reader.executeGitRead(exec, ["show", `${candidate}:testing/contracts.json`], options);
  reader.executeGitRead(exec, args, options);
  assert.equal(calls, 3);
  assert.equal(reader.stats.entries, 1);
});

test("successful malformed bytes are reparsed and never become cached validation", () => {
  const reader = createImmutableSuccessReuse();
  let calls = 0;
  const exec = () => {
    calls++;
    return "{";
  };
  const errors = [];
  for (let i = 0; i < 2; i++) {
    try {
      JSON.parse(reader.executeGitRead(exec, args, options));
    } catch (error) {
      assert(error instanceof SyntaxError);
      errors.push(error);
    }
  }
  assert.equal(calls, 1);
  assert.equal(errors.length, 2);
  assert.notEqual(errors[0], errors[1]);
  assert.equal(errors[0].message, errors[1].message);
});

test("scopes clear on return, throw, nesting and inherited async work", async () => {
  let calls = 0;
  const exec = () => {
    calls++;
    return "data";
  };
  const read = () => recognitionGitRead(exec, args, options);
  withImmutableRecognitionReads(() => {
    read();
    read();
    withImmutableRecognitionReads(() => {
      read();
      read();
    });
    read();
  });
  assert.equal(calls, 2);
  const error = new Error("operation");
  assert.throws(
    () =>
      withImmutableRecognitionReads(() => {
        read();
        throw error;
      }),
    (e) => e === error,
  );
  withImmutableRecognitionReads(() => {
    read();
    read();
  });
  assert.equal(calls, 4);
  let later;
  withImmutableRecognitionReads(() => {
    read();
    later = Promise.resolve().then(() => {
      read();
      read();
    });
  });
  await later;
  assert.equal(calls, 7);
  let alternateCalls = 0;
  const alternate = () => {
    alternateCalls++;
    return "different";
  };
  withImmutableRecognitionReads(() => {
    assert.equal(read(), "data");
    assert.equal(recognitionGitRead(alternate, args, options), "different");
    assert.equal(recognitionGitRead(alternate, args, options), "different");
    assert.equal(read(), "data");
  });
  assert.equal(alternateCalls, 2);
  assert.equal(calls, 8);
});

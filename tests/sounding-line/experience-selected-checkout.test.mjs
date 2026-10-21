import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import net from "node:net";
import { checkoutHydration } from "../../scripts/sounding-line/experience-checkout-hydration.mjs";
import { sourceSnapshot } from "../../scripts/sounding-line/product-experience.mjs";
import {
  selectedCheckout as protectedCheckout,
  requireCheckoutCleanup,
  validatePreservationInventories,
  advancingGitProgress,
  checkoutClock,
  gitProgressDecoder,
} from "../../scripts/sounding-line/experience-selected-checkout.mjs";
const selectedCheckout = (options) => protectedCheckout({ readerRevisions: [], readerObjects: [], ...options });
const git = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root, file, text) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};
function fixture(t, { large = 0, longPath = false, historicalReaders = false } = {}) {
  const owned = mkdtempSync(path.join(tmpdir(), "sl-selected-"));
  t.after(() => rmSync(owned, { recursive: true, force: true }));
  const seed = path.join(owned, "seed");
  mkdirSync(seed);
  git(seed, "init", "-qb", "main");
  git(seed, "config", "user.name", "Selected fixture");
  git(seed, "config", "user.email", "fixture@example.invalid");
  if (longPath && process.platform === "win32") git(seed, "config", "core.longpaths", "true");
  git(seed, "config", "uploadpack.allowFilter", "true");
  git(seed, "config", "uploadpack.allowAnySHA1InWant", "true");
  put(seed, "kept.txt", "immutable evidence\n");
  const readerFiles = [
    "Development_Docs/old-required.json",
    ".agents/README.md",
    "tools/unused.ts",
    "src/unused.test.ts",
  ];
  if (historicalReaders)
    for (const file of readerFiles)
      put(seed, file, file.endsWith(".json") ? '{"actualReader":true}\n' : `historical reader fixture:${file}\n`);
  if (longPath) put(seed, `${"long-directory/".repeat(20)}evidence.txt`, "long path evidence\n");
  put(seed, "unneeded-historical.bin", Buffer.from(Array.from({ length: 131072 }, (_, i) => (i * 73 + 19) % 251)));
  for (let i = 0; i < large; i++)
    put(seed, `large/${String(i).padStart(5, "0")}-${"literal".repeat(20)}.txt`, `kept ${i}\n`);
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "original");
  const ancestor = git(seed, "rev-parse", "HEAD");
  const historicalBlob = git(seed, "rev-parse", "HEAD:unneeded-historical.bin");
  git(seed, "rm", "unneeded-historical.bin");
  if (historicalReaders) git(seed, "rm", ...readerFiles);
  const pins = git(seed, "ls-tree", "-rz", ancestor)
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const [metadata, path] = row.split("\t"),
        [mode, , blob] = metadata.split(" ");
      return { path, mode, blob };
    })
    .filter((pin) => pin.path !== "unneeded-historical.bin" && !(historicalReaders && readerFiles.includes(pin.path)));
  put(
    seed,
    "testing/product-experience-exceptions.json",
    JSON.stringify({
      exceptions: [
        {
          frozenReferenceSha: ancestor,
          immutableHistory: pins,
          currentSourceAdmission: { preservationRevision: ancestor },
        },
      ],
    }),
  );
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "base");
  const base = git(seed, "rev-parse", "HEAD");
  git(seed, "checkout", "-qb", "side");
  put(seed, "side.txt", "selected side\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "side");
  const side = git(seed, "rev-parse", "HEAD");
  git(seed, "checkout", "-q", "main");
  put(seed, "candidate.txt", "candidate\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "candidate");
  git(seed, "merge", "--no-ff", "-qm", "merge ancestry", "side");
  const candidate = git(seed, "rev-parse", "HEAD");
  git(seed, "checkout", "--orphan", "custody");
  git(seed, "rm", "-rf", ".");
  put(seed, "seal.txt", "separate immutable seal\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "orphan seal");
  const custody = git(seed, "rev-parse", "HEAD");
  const custodyBlob = git(seed, "rev-parse", "HEAD:seal.txt");
  git(seed, "tag", "selected-seal");
  git(seed, "checkout", "-qb", "unrelated", base);
  put(seed, "unrelated.txt", "must not be fetched\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "unrelated");
  git(seed, "tag", "unrelated-tag");
  return {
    owned,
    seed,
    remote: pathToFileURL(seed).href,
    base,
    candidate,
    ancestor,
    side,
    custody,
    custodyBlob,
    historicalBlob,
  };
}
test("fresh selected checkout has complete merge and side ancestry, literal preservation and no unrelated refs", async (t) => {
  const f = fixture(t),
    root = path.join(f.owned, "candidate");
  const receipt = await selectedCheckout({
    root,
    remote: f.remote,
    baseSha: f.base,
    candidateSha: f.candidate,
    roots: [f.custody],
    readerObjects: [{ sha: f.custodyBlob, type: "blob" }],
    progress: false,
  });
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.preservationPins, 1);
  assert(receipt.verified.unneededHistoricalBlobsAbsent >= 1);
  assert.throws(() => git(root, "cat-file", "-e", f.historicalBlob));
  assert.throws(() => git(root, "fetch", "origin", f.ancestor), /transport.*not allowed/u);
  const globalConfig = path.join(f.owned, "permissive-global.config");
  writeFileSync(globalConfig, '[protocol "file"]\nallow = always\n');
  assert.throws(
    () =>
      execFileSync("git", ["fetch", "origin", f.ancestor], {
        cwd: root,
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
        stdio: "pipe",
      }),
    /transport.*not allowed/u,
  );
  assert.equal(git(root, "config", "--local", "remote.origin.promisor"), "false");
  assert(receipt.commands.every((x) => x.cleanup.status === "PASS"));
  assert.equal(git(root, "rev-parse", "HEAD"), f.candidate);
  assert.equal(git(root, "rev-parse", "--is-shallow-repository"), "false");
  for (const sha of [f.ancestor, f.base, f.side]) git(root, "merge-base", "--is-ancestor", sha, f.candidate);
  assert.equal(git(root, "show", `${f.custody}:seal.txt`), "separate immutable seal");
  assert.equal(git(root, "rev-parse", "refs/remotes/origin/main"), f.base);
  assert(!git(root, "for-each-ref", "--format=%(refname)").includes("unrelated"));
  assert.throws(() => git(root, "show", "refs/tags/unrelated-tag:unrelated.txt"));
  assert.equal(JSON.parse(readFileSync(path.join(f.owned, "candidate.checkout.json"))).status, "PASS");
  // A second invocation cannot overwrite or silently reuse this object store.
  await assert.rejects(
    selectedCheckout({
      root,
      remote: f.remote,
      baseSha: f.base,
      candidateSha: f.candidate,
      roots: [],
      progress: false,
    }),
    /EEXIST/u,
  );
});
test("missing required selected root fails without wildcard fallback and preserves failure", async (t) => {
  const f = fixture(t),
    root = path.join(f.owned, "missing"),
    missing = "f".repeat(40);
  await assert.rejects(
    selectedCheckout({
      root,
      remote: f.remote,
      baseSha: f.base,
      candidateSha: f.candidate,
      roots: [missing],
      progress: false,
    }),
    /GIT_FAILED/u,
  );
  const receipt = JSON.parse(readFileSync(path.join(f.owned, "missing.checkout.json")));
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.commands.filter((x) => x.args[0] === "fetch").length, 1);
  assert(receipt.commands.every((x) => x.cleanup.treeReaped && x.cleanup.streamsClosed));
});
async function stalled(t, { abort, inactivity = false }) {
  const owned = mkdtempSync(path.join(tmpdir(), "sl-selected-stall-")),
    sockets = new Set();
  const controller = new AbortController();
  let sent;
  const received = new Promise((resolve) => {
    sent = resolve;
  });
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("data", () => {
      sent();
      if (abort) controller.abort();
    });
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    rmSync(owned, { recursive: true, force: true });
  });
  const root = path.join(owned, "candidate"),
    began = Date.now();
  const operation = selectedCheckout({
    root,
    remote: `git://127.0.0.1:${server.address().port}/stall`,
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    roots: [],
    budgetMs: abort || inactivity ? 60000 : 10000,
    stallBudgetMs: inactivity ? 2000 : 600000,
    signal: controller.signal,
    progress: false,
  });
  // Attach rejection before waiting for the server to prevent unhandled errors.
  const rejected = assert.rejects(operation, abort ? /CANCELLED/u : inactivity ? /STALLED/u : /DEADLINE/u);
  await Promise.race([
    received,
    operation.then(
      () => {
        throw Error("TRANSPORT_NEVER_STARTED");
      },
      (error) => {
        throw Error(`TRANSPORT_NEVER_STARTED:${error.message}`);
      },
    ),
  ]);
  await rejected;
  const receipt = JSON.parse(readFileSync(path.join(owned, "candidate.checkout.json")));
  assert.equal(receipt.status, "FAIL");
  assert(receipt.commands.every((x) => x.cleanup.status === "PASS"));
  assert(Date.now() - began < (abort || inactivity ? 60000 : 12000));
  assert(server.listening, "cancelling owned Git must not stop the independent fixture server");
}
test("cancellation during a real stalled Git fetch reaps owned processes and closes streams", async (t) =>
  stalled(t, { abort: true }));
test("one checkout deadline bounds a real stalled transport", { skip: process.platform === "win32" }, async (t) =>
  stalled(t, { abort: false }),
);
test("lack of forward progress cancels a real stalled transport before its separate total deadline", async (t) =>
  stalled(t, { abort: false, inactivity: true }));
test("only monotonic local Git counts or byte advances reset inactivity", () => {
  const maxima = new Map();
  for (const line of [
    "remote: Receiving objects: 1% (1/100)",
    "keepalive",
    "fatal: stalled",
    "Receiving objects: unknown",
  ])
    assert.equal(advancingGitProgress(line, maxima), false);
  assert(advancingGitProgress("Receiving objects: 1% (1/100), 1.00 MiB | 1 MiB/s", maxima));
  assert(!advancingGitProgress("Receiving objects: 1% (1/100), 1.00 MiB | 2 MiB/s", maxima));
  assert(advancingGitProgress("Receiving objects: 1% (1/100), 2.00 MiB | 1 MiB/s", maxima));
  assert(!advancingGitProgress("Receiving objects: 0% (0/100), 1.00 MiB | 1 MiB/s", maxima));
  assert(advancingGitProgress("Receiving objects: 2% (2/100), 2.00 MiB | 1 MiB/s", maxima));
  assert(advancingGitProgress("Resolving deltas: 10% (10/100)", maxima));
  assert(!advancingGitProgress("Resolving deltas: 10% (10/100)", maxima));
  assert(advancingGitProgress("Updating files: 25% (25/100)", maxima));
  assert(!advancingGitProgress("Updating files: 24% (24/100)", maxima));
  assert(!advancingGitProgress("Updating files: 26% (26/101)", maxima));
  assert(!advancingGitProgress("Receiving objects: 99% (99/100), 99 MiB", maxima));
  assert(!advancingGitProgress("\u001b[0mUpdating files: 27% (27/100)", maxima));
});
test("split progress is decoded once and expired inactivity or absolute deadlines cannot be revived", () => {
  let observed = 0;
  const feed = gitProgressDecoder(() => observed++);
  for (const part of [
    "Receiv",
    "ing objects: 1% (1/100), 1.00 MiB | 1 MiB/s\r",
    "\nReceiving objects: 1% (1/100), 1.00 MiB | 2 MiB/s\r",
    "Receiving objects: 2% (2/100), 2.00 MiB | 1 MiB/s",
    "\r\n",
  ])
    feed(Buffer.from(part));
  assert.equal(observed, 2);
  feed(Buffer.from("x".repeat(16385)));
  feed(Buffer.from("Receiving objects: 3% (3/100), 3.00 MiB | 1 MiB/s\r"));
  feed(Buffer.from("remote: Receiving objects: 3% (3/100), 3.00 MiB | 1 MiB/s\r"));
  assert.equal(observed, 2);
  let time = 0;
  const stalledClock = checkoutClock({ budgetMs: 100, stallBudgetMs: 40, cleanupReserveMs: 5, now: () => time });
  time = 40;
  assert.throws(() => stalledClock.advance(), /STALLED/u);
  time = 41;
  assert.throws(() => stalledClock.advance(), /STALLED/u);
  assert.equal(stalledClock.progressAdvances, 0);
  time = 0;
  const totalClock = checkoutClock({ budgetMs: 100, stallBudgetMs: 40, cleanupReserveMs: 5, now: () => time });
  for (time of [30, 60, 90]) totalClock.advance();
  time = 95;
  assert.throws(() => totalClock.advance(), /DEADLINE/u);
  assert.equal(totalClock.progressAdvances, 3);
  assert.throws(() => totalClock.assertLive(), /DEADLINE/u);
});

test("large literal inventories drain completely before successful parsing", async (t) => {
  const f = fixture(t, { large: 2048 }),
    root = path.join(f.owned, "large-candidate");
  const receipt = await selectedCheckout({
    root,
    remote: f.remote,
    baseSha: f.base,
    candidateSha: f.candidate,
    roots: [f.custody],
    progress: false,
  });
  assert.equal(receipt.preservationPins, 2049);
  assert(Buffer.byteLength(git(root, "ls-tree", "-rz", f.ancestor)) > 256 * 1024);
  assert(receipt.commands.every((command) => command.cleanup.status === "PASS" && command.cleanup.streamsClosed));
  assert.equal(
    JSON.parse(git(root, "show", `${f.base}:testing/product-experience-exceptions.json`)).exceptions[0].immutableHistory
      .length,
    2049,
  );
});
test("ambient Git path and configuration injection cannot redirect owned writes", async (t) => {
  const f = fixture(t),
    root = path.join(f.owned, "sanitized"),
    before = readFileSync(path.join(f.seed, ".git/config")),
    head = git(f.seed, "rev-parse", "HEAD"),
    index = path.join(f.owned, "sentinel.index");
  writeFileSync(index, "UNRELATED_INDEX_SENTINEL");
  const injected = {
    GIT_DIR: path.join(f.seed, ".git"),
    GIT_WORK_TREE: f.seed,
    GIT_COMMON_DIR: path.join(f.seed, ".git"),
    GIT_INDEX_FILE: index,
    GIT_OBJECT_DIRECTORY: path.join(f.seed, ".git/objects"),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(f.seed, ".git/objects"),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.worktree",
    GIT_CONFIG_VALUE_0: f.seed,
  };
  const prior = Object.fromEntries(Object.keys(injected).map((key) => [key, process.env[key]]));
  Object.assign(process.env, injected);
  try {
    await selectedCheckout({
      root,
      remote: f.remote,
      baseSha: f.base,
      candidateSha: f.candidate,
      roots: [f.custody],
      progress: false,
    });
  } finally {
    for (const [key, value] of Object.entries(prior))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
  assert.equal(git(root, "rev-parse", "HEAD"), f.candidate);
  assert.equal(git(f.seed, "rev-parse", "HEAD"), head);
  assert.deepEqual(readFileSync(path.join(f.seed, ".git/config")), before);
  assert.equal(readFileSync(index, "utf8"), "UNRELATED_INDEX_SENTINEL");
});
for (const change of ["changed", "deleted", "mode"])
  test(`candidate preservation ${change} fails even when the original reference is intact`, async (t) => {
    const f = fixture(t);
    git(f.seed, "checkout", "--detach", f.candidate);
    if (change === "changed") put(f.seed, "kept.txt", "changed historical evidence\n");
    if (change === "deleted") git(f.seed, "rm", "kept.txt");
    if (change === "mode") git(f.seed, "update-index", "--chmod=+x", "kept.txt");
    if (change !== "mode") git(f.seed, "add", ".");
    git(f.seed, "commit", "-qm", `candidate ${change}`);
    const candidate = git(f.seed, "rev-parse", "HEAD"),
      root = path.join(f.owned, "rejected");
    await assert.rejects(
      selectedCheckout({
        root,
        remote: f.remote,
        baseSha: f.base,
        candidateSha: candidate,
        roots: [f.custody],
        progress: false,
      }),
      /PRESERVATION_CHANGED/u,
    );
    const receipt = JSON.parse(readFileSync(path.join(f.owned, "rejected.checkout.json")));
    assert.equal(receipt.status, "FAIL");
    assert(receipt.commands.every((command) => command.cleanup.status === "PASS"));
  });
test("cleanup failure cannot become checkout PASS after tree and pipe cleanup", () => {
  assert.throws(
    () => requireCheckoutCleanup({ status: "FAIL", treeReaped: true, streamsClosed: true }),
    /CLEANUP_FAILED/u,
  );
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => requireCheckoutCleanup({ status: "PASS", treeReaped: true, streamsClosed: true }, controller.signal),
    /CANCELLED/u,
  );
});
test("historical closure covers actual sourceSnapshot and exact metadata reads while omitting unused blobs", async (t) => {
  const f = fixture(t, { historicalReaders: true }),
    root = path.join(f.owned, "reader-candidate");
  const receipt = await selectedCheckout({
    root,
    remote: f.remote,
    baseSha: f.base,
    candidateSha: f.candidate,
    roots: [f.custody],
    readerRevisions: [f.ancestor],
    progress: false,
  });
  assert.equal(receipt.status, "PASS");
  assert.deepEqual(sourceSnapshot(root, f.ancestor), sourceSnapshot(f.seed, f.ancestor));
  assert.equal(git(root, "show", `${f.ancestor}:.agents/README.md`), "historical reader fixture:.agents/README.md");
  for (const file of ["tools/unused.ts", "src/unused.test.ts", "unneeded-historical.bin"])
    assert.throws(() => git(root, "show", `${f.ancestor}:${file}`));
  assert.throws(() => git(root, "fetch", "origin", f.ancestor), /transport.*not allowed/u);
});

test("owned checkout materializes preserved paths longer than the Windows default limit", async (t) => {
  const f = fixture(t, { longPath: true }),
    root = path.join(f.owned, "long-candidate");
  const receipt = await selectedCheckout({
    root,
    remote: f.remote,
    baseSha: f.base,
    candidateSha: f.candidate,
    roots: [f.custody],
    progress: false,
  });
  const file = path.join(root, `${"long-directory/".repeat(20)}evidence.txt`);
  assert(file.length > 260);
  assert.equal(readFileSync(file, "utf8"), "long path evidence\n");
  assert.equal(receipt.preservationPins, 2);
  if (process.platform === "win32") assert.equal(git(root, "config", "--local", "core.longpaths"), "true");
});

test("only the exact historical manifest to accepted publication replacement is allowed", () => {
  const publication = {
    path: "candidate-review.json",
    historicalMode: "100644",
    historicalBlob: "a".repeat(40),
    publishedMode: "100644",
    publishedBlob: "b".repeat(40),
  };
  const other = { path: "other.json", mode: "100644", blob: "c".repeat(40) };
  const pins = [{ path: publication.path, mode: publication.historicalMode, blob: publication.historicalBlob }, other];
  const historical = new Map(pins.map((pin) => [pin.path, `${pin.mode} blob ${pin.blob}`]));
  const current = new Map(historical);
  current.set(publication.path, `${publication.publishedMode} blob ${publication.publishedBlob}`);
  assert.deepEqual(validatePreservationInventories(pins, historical, current, publication), [publication]);
  for (const invalid of [
    undefined,
    `100755 blob ${publication.publishedBlob}`,
    `100644 blob ${publication.historicalBlob}`,
    `100644 blob ${"d".repeat(40)}`,
  ]) {
    const changed = new Map(current);
    if (invalid === undefined) changed.delete(publication.path);
    else changed.set(publication.path, invalid);
    assert.throws(
      () => validatePreservationInventories(pins, historical, changed, publication),
      /CURRENT_MANIFEST_PIN_CHANGED/u,
    );
  }
  const otherChanged = new Map(current);
  otherChanged.set(other.path, `100644 blob ${publication.publishedBlob}`);
  assert.throws(
    () => validatePreservationInventories(pins, historical, otherChanged, publication),
    /PRESERVATION_CHANGED/u,
  );
  const forged = pins.map((pin) => (pin.path === publication.path ? { ...pin, blob: "d".repeat(40) } : pin));
  const forgedHistory = new Map(historical);
  forgedHistory.set(publication.path, `100644 blob ${"d".repeat(40)}`);
  assert.throws(
    () => validatePreservationInventories(forged, forgedHistory, current, publication),
    /HISTORICAL_MANIFEST_PIN_CHANGED/u,
  );
});

test("closure verification rejects missing commit, tree, blob and incorrect object types without transport", async (t) => {
  const f = fixture(t),
    closure = path.join(f.owned, "closure.json"),
    input = path.join(f.owned, "input.json");
  const executable = git(f.seed, "--exec-path");
  const gitPath = path.join(executable, process.platform === "win32" ? "git.exe" : "git");
  for (const type of ["commit", "tree", "blob"]) {
    writeFileSync(closure, JSON.stringify({ objects: [{ sha: "f".repeat(40), type }] }));
    writeFileSync(
      input,
      JSON.stringify({ operation: "verify", root: f.seed, git: gitPath, closure, roots: [f.candidate] }),
    );
    await assert.rejects(checkoutHydration(input), /MISSING_REQUIRED_OBJECT/u);
    if (type !== "blob") {
      writeFileSync(input, JSON.stringify({ operation: "hydrate", root: f.seed, git: gitPath, closure }));
      await assert.rejects(checkoutHydration(input), /MISSING_COMMIT_OR_TREE/u);
    }
  }
  writeFileSync(closure, JSON.stringify({ objects: [{ sha: f.historicalBlob, type: "commit" }] }));
  writeFileSync(input, JSON.stringify({ operation: "hydrate", root: f.seed, git: gitPath, closure }));
  await assert.rejects(checkoutHydration(input), /OBJECT_TYPE_CHANGED/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import net from "node:net";
import { selectedCheckout } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
const git = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root, file, text) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};
function fixture(t) {
  const owned = mkdtempSync(path.join(tmpdir(), "sl-selected-"));
  t.after(() => rmSync(owned, { recursive: true, force: true }));
  const seed = path.join(owned, "seed");
  mkdirSync(seed);
  git(seed, "init", "-qb", "main");
  git(seed, "config", "user.name", "Selected fixture");
  git(seed, "config", "user.email", "fixture@example.invalid");
  put(seed, "kept.txt", "immutable evidence\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "original");
  const ancestor = git(seed, "rev-parse", "HEAD"),
    blob = git(seed, "rev-parse", "HEAD:kept.txt");
  put(
    seed,
    "testing/product-experience-exceptions.json",
    JSON.stringify({
      exceptions: [
        {
          frozenReferenceSha: ancestor,
          immutableHistory: [{ path: "kept.txt", mode: "100644", blob }],
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
  git(seed, "tag", "selected-seal");
  git(seed, "checkout", "-qb", "unrelated", base);
  put(seed, "unrelated.txt", "must not be fetched\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "unrelated");
  git(seed, "tag", "unrelated-tag");
  return { owned, seed, remote: pathToFileURL(seed).href, base, candidate, ancestor, side, custody };
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
    progress: false,
  });
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.preservationPins, 1);
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
async function stalled(t, { abort }) {
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
    budgetMs: abort ? 600000 : 10000,
    signal: controller.signal,
    progress: false,
  });
  // Attach rejection before waiting for the server to prevent unhandled errors.
  const rejected = assert.rejects(operation, abort ? /CANCELLED/u : /DEADLINE/u);
  await received;
  await rejected;
  const receipt = JSON.parse(readFileSync(path.join(owned, "candidate.checkout.json")));
  assert.equal(receipt.status, "FAIL");
  assert(receipt.commands.every((x) => x.cleanup.status === "PASS"));
  assert(Date.now() - began < (abort ? 60000 : 12000));
  assert(server.listening, "cancelling owned Git must not stop the independent fixture server");
}
test("cancellation during a real stalled Git fetch reaps owned processes and closes streams", async (t) =>
  stalled(t, { abort: true }));
test("one checkout deadline bounds a real stalled transport", { skip: process.platform === "win32" }, async (t) =>
  stalled(t, { abort: false }),
);

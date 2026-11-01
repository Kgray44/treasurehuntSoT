import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectedCheckout } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
import { documentationCheckoutProposal } from "../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
const git = (root, args, input, encoding = "utf8") =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
const entries = (value) =>
  value
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const tab = row.indexOf("\t"),
        [mode, type, sha] = row.slice(0, tab).split(" ");
      return { path: row.slice(tab + 1), mode, type, sha };
    });
test("inert full versus selected transport retains exact tree/ancestry/reader pins and excludes only proven payloads with transport locked", async (t) => {
  const owner = mkdtempSync(path.join(tmpdir(), "ordinary-doc-transport-"));
  t.after(() => rmSync(owner, { recursive: true, force: true }));
  const seed = path.join(owner, "seed");
  mkdirSync(seed);
  git(seed, ["init", "-qb", "main"]);
  git(seed, ["config", "user.name", "Inert selected-read-set fixture"]);
  git(seed, ["config", "user.email", "fixture@example.invalid"]);
  git(seed, ["config", "uploadpack.allowFilter", "true"]);
  git(seed, ["config", "uploadpack.allowAnySHA1InWant", "true"]);
  const put = (file, bytes) => {
    mkdirSync(path.dirname(path.join(seed, file)), { recursive: true });
    writeFileSync(path.join(seed, file), bytes);
  };
  put("unread-history.bin", Buffer.alloc(32768, 47));
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert ancestor"]);
  const ancestor = git(seed, ["rev-parse", "HEAD"]).trim();
  git(seed, ["rm", "unread-history.bin"]);
  put("src/example.ts", "export const value=1;\n");
  put("public/required-runtime.png", Buffer.alloc(8192, 11));
  put("tests/required-fixture.zip", Buffer.alloc(4096, 19));
  put("Development_Docs/.next-keep/preserve.png", Buffer.from("generated-directory-shape"));
  const media = [
    "Development_Docs/old [set]/frame #! Δ.png",
    "Development_Docs/old [set]/trace.zip",
    "Development_Docs/old [set]/recording.webm",
  ];
  media.forEach((file, index) => put(file, Buffer.alloc(32768 + index * 16384, 91 + index)));
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert base"]);
  const base = git(seed, ["rev-parse", "HEAD"]).trim(),
    pin = git(seed, ["rev-parse", `${base}:${media[0]}`]).trim();
  put("Development_Docs/incident.md", "# Inert documented candidate\n");
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert candidate"]);
  const candidate = git(seed, ["rev-parse", "HEAD"]).trim();
  const options = {
    remote: pathToFileURL(seed).href,
    baseSha: base,
    candidateSha: candidate,
    roots: [ancestor],
    readerRevisions: [],
    readerObjects: [{ sha: pin, type: "blob" }],
    budgetMs: 120000,
    stallBudgetMs: 60000,
    progress: false,
    preservation: async () => ({ preservationPins: 0, historicalManifestPinsRetained: [] }),
  };
  const fullRoot = path.join(owner, "full"),
    selectedRoot = path.join(owner, "selected");
  const full = await selectedCheckout({ ...options, root: fullRoot });
  let proposed;
  const selected = await selectedCheckout({
    ...options,
    root: selectedRoot,
    selectReadSet: async ({ command }) => {
      const baseline = entries(await command(["ls-tree", "-rz", base])),
        current = entries(await command(["ls-tree", "-rz", candidate]));
      proposed = documentationCheckoutProposal({
        baseEntries: baseline,
        candidateEntries: current,
        anchorEntries: baseline,
        prNumber: 819,
      });
      assert.equal(proposed.profile, "DOCUMENTATION_ONLY_SOURCE_BOUND_V1");
      return { applied: true, proposal: proposed };
    },
  });
  assert.equal(full.status, "PASS");
  assert.equal(selected.status, "PASS");
  assert.equal(selected.readSet.applied, true);
  assert.equal(git(fullRoot, ["ls-tree", "-rz", candidate]), git(selectedRoot, ["ls-tree", "-rz", candidate]));
  assert.equal(git(selectedRoot, ["rev-parse", "--is-shallow-repository"]).trim(), "false");
  git(selectedRoot, ["merge-base", "--is-ancestor", ancestor, candidate]);
  const omitted = new Set(proposed.omissions.map((x) => x.path));
  assert.deepEqual([...omitted].sort(), media.sort());
  for (const entry of entries(git(fullRoot, ["ls-tree", "-rz", candidate]))) {
    const a = path.join(fullRoot, entry.path),
      b = path.join(selectedRoot, entry.path);
    assert(existsSync(a));
    if (omitted.has(entry.path)) assert.equal(existsSync(b), false, entry.path);
    else assert(readFileSync(a).equals(readFileSync(b)), entry.path);
  }
  assert.equal(git(selectedRoot, ["cat-file", "-t", pin]).trim(), "blob");
  assert.throws(() => git(selectedRoot, ["show", `${candidate}:Development_Docs/old [set]/trace.zip`]));
  assert.equal(selected.lateGitTransport, "DISABLED");
  assert(selected.verified.requiredBlobBytes < full.verified.requiredBlobBytes);
  assert.equal(git(selectedRoot, ["status", "--porcelain", "--untracked-files=no"]).trim(), "");
});

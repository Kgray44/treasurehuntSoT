import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificationPreflight } from "../../scripts/sounding-line/verification-preflight.mjs";
import { failureCategoryFor } from "../../scripts/sounding-line/ordinary.mjs";
const source = fileURLToPath(new URL("../../", import.meta.url));
const git = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
async function fixture(t) {
  const owned = await mkdtemp(path.join(tmpdir(), "verification-preflight-"));
  t.after(() => rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "candidate"),
    authorityRoot = path.join(owned, "authority");
  await mkdir(path.join(root, "scripts/sounding-line"), { recursive: true });
  await mkdir(path.join(root, "testing"));
  const files = [
    "ordinary.mjs",
    "ordinary-supervised.mjs",
    "verification-budget.mjs",
    "verification-job-clock.mjs",
    "verification-preflight.mjs",
    "verification-supervisor.mjs",
    "verification-capacity-820.mjs",
    "verification-source-join-820.mjs",
    "owned-process.mjs",
    "owned-process-linux.py",
    "owned-process-windows.ps1",
  ];
  for (const file of files)
    await copyFile(path.join(source, "scripts/sounding-line", file), path.join(root, "scripts/sounding-line", file));
  await copyFile(
    path.join(source, "testing/sounding-line-authority.json"),
    path.join(root, "testing/sounding-line-authority.json"),
  );
  git(root, "init", "-qb", "main");
  git(root, "config", "user.name", "Preflight fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-qm", "authority");
  const baseSha = git(root, "rev-parse", "HEAD");
  git(root, "worktree", "add", "--detach", authorityRoot, baseSha);
  await writeFile(path.join(root, "candidate.txt"), "synthetic candidate\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "candidate");
  return { root, authorityRoot, baseSha, candidateSha: git(root, "rev-parse", "HEAD") };
}
test("preflight binds exact source, controller, policy and runtime without claiming qualification", async (t) => {
  const input = await fixture(t),
    result = await verificationPreflight(input);
  assert.equal(result.candidateSha, input.candidateSha);
  assert.equal(result.baseSha, input.baseSha);
  for (const key of ["executionId", "controllerDigest", "policyDigest"]) assert.match(result[key], /^[a-f0-9]{64}$/u);
  assert.equal(result.qualification, false);
  assert.equal(result.gitSubprocesses, 5);
  assert.equal(result.runtime, process.version);
  await assert.rejects(verificationPreflight({ ...input, candidateSha: input.baseSha }), /HEAD_CHANGED/u);
  await writeFile(path.join(input.authorityRoot, "scripts/sounding-line/ordinary.mjs"), "changed controller\n");
  await assert.rejects(verificationPreflight(input), /AUTHORITY_CONTENT_CHANGED/u);
});
test("controller fingerprint includes the exact native clock source bytes", async (t) => {
  const input = await fixture(t),
    original = await verificationPreflight(input);
  const clock = path.join(input.authorityRoot, "scripts/sounding-line/verification-job-clock.mjs");
  await writeFile(clock, (await readFile(clock, "utf8")) + "\n// inert fixture clock change\n");
  git(input.authorityRoot, "add", ".");
  git(input.authorityRoot, "commit", "-qm", "changed clock authority");
  const baseSha = git(input.authorityRoot, "rev-parse", "HEAD");
  git(input.root, "merge", "--no-edit", baseSha);
  const changed = await verificationPreflight({
    ...input,
    baseSha,
    candidateSha: git(input.root, "rev-parse", "HEAD"),
  });
  assert.notEqual(changed.controllerDigest, original.controllerDigest);
  assert.equal(changed.policyDigest, original.policyDigest);
});

test("tool, resource, transport and unknown failures are not classified as product failures", () => {
  for (const [code, expected] of [
    ["ENOENT", "TOOL_FAILURE"],
    ["ENOSPC", "RESOURCE_FAILURE"],
    ["ECONNRESET", "TRANSPORT_FAILURE"],
  ])
    assert.equal(failureCategoryFor(Object.assign(new Error("private detail"), { code })), expected);
  assert.equal(
    failureCategoryFor(Object.assign(new Error("formatter argument failure"), { status: 249 })),
    "TOOL_TRANSPORT_FAILURE",
  );
  assert.equal(failureCategoryFor(new Error("unclassified")), "EXECUTION_UNKNOWN");
  const hostile = new Error("unknown");
  for (const key of ["code", "status", "message"])
    Object.defineProperty(hostile, key, {
      get() {
        throw new Error("unsafe getter");
      },
    });
  assert.equal(failureCategoryFor(hostile), "EXECUTION_UNKNOWN");
  assert.equal(
    failureCategoryFor(new Error("SOUNDING_LINE_VERIFICATION_COMMAND_BUDGET_EXHAUSTED")),
    "EXECUTION_BUDGET_FAILURE",
  );
});

test("controller fingerprint binds the capacity grant source and rejects dirty installed authority", async (t) => {
  const input = await fixture(t),
    original = await verificationPreflight(input);
  const file = path.join(input.authorityRoot, "scripts/sounding-line/verification-capacity-820.mjs");
  await writeFile(file, (await readFile(file, "utf8")) + "\n// inert capacity source fixture change\n");
  await assert.rejects(verificationPreflight(input), /AUTHORITY_CONTENT_CHANGED/u);
  git(input.authorityRoot, "add", ".");
  git(input.authorityRoot, "commit", "-qm", "changed capacity authority");
  const baseSha = git(input.authorityRoot, "rev-parse", "HEAD");
  git(input.root, "merge", "--no-edit", baseSha);
  const changed = await verificationPreflight({
    ...input,
    baseSha,
    candidateSha: git(input.root, "rev-parse", "HEAD"),
  });
  assert.notEqual(changed.controllerDigest, original.controllerDigest);
  assert.equal(changed.policyDigest, original.policyDigest);
  assert.equal(changed.qualification, false);
});

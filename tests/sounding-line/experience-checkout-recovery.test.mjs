import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const workflowPath = ".github/workflows/sounding-line-ordinary.yml";
const current = readFileSync(path.join(root, workflowPath), "utf8").replace(/\r\n/gu, "\n");
const previous = execFileSync("git", ["show", `bfea71aad2c7fafdec0590ba1ac09ee3399e08d5:${workflowPath}`], {
  cwd: root,
  encoding: "utf8",
});
const preparation = (text) => text.split("\n  experience-preparation:\n")[1].split(/\n  [a-z][a-z-]*:\n/u)[0];
function assertBoundedCheckout(text) {
  const job = preparation(text),
    steps = job
      .split(/\n      - /u)
      .slice(1)
      .filter((step) => step.includes("uses: actions/checkout@v4"));
  assert.match(job, /^    timeout-minutes: 40$/mu);
  assert.equal(steps.length, 3);
  for (const [index, step] of steps.entries()) {
    assert.match(step, /^        timeout-minutes: 10$/mu);
    assert.match(step, /^          show-progress: true$/mu);
    assert.match(step, /^          persist-credentials: false$/mu);
    assert.doesNotMatch(step, /continue-on-error|retry|sparse-checkout|filter:/u);
    assert.match(step, new RegExp(`^          fetch-depth: ${index === 1 ? 0 : 1}$`, "mu"));
  }
  assert.match(steps[0], /^name: Checkout exact protected authority\n        id: authority-checkout\n/u);
  assert.match(steps[0], /^          ref: \$\{\{ inputs\.base_sha \}\}$/mu);
  assert.match(steps[0], /^          fetch-tags: false$/mu);
  assert.match(steps[1], /^name: Checkout complete candidate history\n        id: candidate-checkout\n/u);
  assert.match(steps[1], /^          ref: \$\{\{ inputs\.candidate_sha \}\}$/mu);
  assert.match(steps[2], /^name: Checkout review evidence\n        id: evidence-checkout\n/u);
  const restored = text
    .replace(
      /      - name: Checkout (?:exact protected authority|complete candidate history|review evidence)\n        id: (?:authority|candidate|evidence)-checkout\n        uses:/gu,
      "      - uses:",
    )
    .replace(/^        timeout-minutes: 10\n/gmu, "")
    .replace(/^          (?:show-progress: true|fetch-tags: false)\n/gmu, "")
    .replace(/(ref: \$\{\{ inputs\.base_sha \}\}\n          path: authority\n          fetch-depth:) 1/u, "$1 0");
  assert.equal(
    restored,
    previous,
    "only the preparation checkouts may change; all browser/authority/upload behavior stays exact",
  );
}
test("checkout recovery pins only authority snapshot and enforces ten-minute step deadlines without changing browser budget", () => {
  assertBoundedCheckout(current);
  for (const changed of [
    current.replace("timeout-minutes: 40", "timeout-minutes: 10"),
    current.replace("        timeout-minutes: 10", "          timeout-minutes: 10"),
    current.replace(
      "          fetch-depth: 1\n          fetch-tags: false",
      "          fetch-depth: 0\n          fetch-tags: false",
    ),
    current.replace(
      "          path: candidate\n          fetch-depth: 0\n          show-progress",
      "          path: candidate\n          fetch-depth: 1\n          show-progress",
    ),
    current.replace("          show-progress: true", "          show-progress: false"),
    current.replace(
      "        id: authority-checkout",
      "        id: authority-checkout\n        continue-on-error: true",
    ),
  ])
    assert.throws(() => assertBoundedCheckout(changed));
});

test("actual preparation imports and installed-snapshot reader work with shallow authority while candidate retains complete ancestry and tags", (t) => {
  const owned = mkdtempSync(path.join(tmpdir(), "checkout-source-only-"));
  assert(owned.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(owned, { recursive: true, force: true }));
  const seed = path.join(owned, "seed"),
    authority = path.join(owned, "authority"),
    candidate = path.join(owned, "candidate");
  mkdirSync(seed);
  mkdirSync(authority);
  const git = (cwd, ...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(seed, "init", "-qb", "main");
  git(seed, "config", "user.name", "Source-only checkout");
  git(seed, "config", "user.email", "fixture@example.invalid");
  writeFileSync(path.join(seed, ".gitignore"), "node_modules/\n");
  writeFileSync(path.join(seed, "history.txt"), "owned synthetic ancestor\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "ancestor");
  const ancestor = git(seed, "rev-parse", "HEAD");
  mkdirSync(path.join(seed, "scripts/sounding-line"), { recursive: true });
  mkdirSync(path.join(seed, "testing"));
  for (const file of readdirSync(path.join(root, "scripts/sounding-line")))
    if (file.endsWith(".mjs"))
      copyFileSync(path.join(root, "scripts/sounding-line", file), path.join(seed, "scripts/sounding-line", file));
  copyFileSync(
    path.join(root, "testing/product-experience-exceptions.json"),
    path.join(seed, "testing/product-experience-exceptions.json"),
  );
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "actual authority modules and registry snapshot");
  const base = git(seed, "rev-parse", "HEAD");
  git(seed, "checkout", "-qb", "unrelated", ancestor);
  writeFileSync(path.join(seed, "canary.txt"), "separate owned history\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "unrelated history");
  git(seed, "tag", "history-canary");
  git(seed, "checkout", "-q", "main");
  writeFileSync(path.join(seed, "candidate-only.txt"), "inert candidate metadata\n");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "candidate");
  const head = git(seed, "rev-parse", "HEAD"),
    remote = pathToFileURL(seed).href;
  git(authority, "init", "-q");
  git(authority, "remote", "add", "origin", remote);
  git(authority, "fetch", "--no-tags", "--depth=1", "--progress", "origin", base);
  git(authority, "checkout", "--detach", "FETCH_HEAD");
  git(owned, "clone", "--quiet", remote, candidate);
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(authority, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(git(authority, "rev-parse", "HEAD"), base);
  assert.equal(git(authority, "rev-parse", "--is-shallow-repository"), "true");
  assert.throws(() => git(authority, "cat-file", "-e", `${ancestor}^{commit}`));
  assert.equal(git(candidate, "rev-parse", "--is-shallow-repository"), "false");
  git(candidate, "merge-base", "--is-ancestor", ancestor, head);
  git(candidate, "merge-base", "--is-ancestor", base, head);
  assert.equal(git(candidate, "show", "refs/remotes/origin/unrelated:canary.txt"), "separate owned history");
  assert(git(candidate, "rev-parse", "refs/tags/history-canary"));
  const script = `import assert from 'node:assert/strict';await import(${JSON.stringify(pathToFileURL(path.join(authority, "scripts/sounding-line/experience-prepare.mjs")).href)});const {recognizeExceptionExecution}=await import(${JSON.stringify(pathToFileURL(path.join(authority, "scripts/sounding-line/experience-exception.mjs")).href)});assert.equal(recognizeExceptionExecution({root:${JSON.stringify(candidate)},baseSha:${JSON.stringify(base)},candidateSha:${JSON.stringify(head)},environment:{SOUNDING_LINE_PR_NUMBER:'721'}}),true);console.log('SOURCE_ONLY_SNAPSHOT_AND_HISTORY_READERS_PASS');`;
  const environment = Object.fromEntries(
    ["PATH", "SystemRoot", "USERPROFILE", "HOME", "TEMP", "TMP"]
      .filter((key) => typeof process.env[key] === "string")
      .map((key) => [key, process.env[key]]),
  );
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: owned,
    env: environment,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.match(output, /SOURCE_ONLY_SNAPSHOT_AND_HISTORY_READERS_PASS/u);
});

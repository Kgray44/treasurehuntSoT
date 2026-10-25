import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  pr776CheckoutProfile,
  validatePR776CheckoutInventories,
  validatePR776CheckoutCanonical,
  validatePR776CheckoutIndexes,
} from "../../scripts/sounding-line/experience-pr776-checkout-profile.mjs";
import { checkoutHydration } from "../../scripts/sounding-line/experience-checkout-hydration.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const E = "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025";
const C = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const INDEX = "Development_Docs/document-index.json";
const MATRIX = "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
const additions = [
  "accepted-canonical.original.json",
  "independent-review.original.json",
  "captured-plan.original.json",
  "public-files-941.original.json",
  "controller-reconciliation.json",
].map((file) => `${E}/${file}`);
const read = (file) => readFileSync(path.join(root, file));
const temporary = (t) => {
  const dir = mkdtempSync(path.join(process.env.TEMP, "pr776-checkout-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test("PR776 profile requires the exact protected repository, main base, event and zero-pass record", (t) => {
  const dir = temporary(t),
    file = path.join(dir, "event.json"),
    baseSha = "a".repeat(40),
    candidateSha = "b".repeat(40);
  writeFileSync(file, JSON.stringify({ inputs: { pr_number: "776", base_sha: baseSha, candidate_sha: candidateSha } }));
  const env = {
    GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
    GITHUB_SHA: baseSha,
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_EVENT_PATH: file,
  };
  const profile = pr776CheckoutProfile({ authorityRoot: root, baseSha, candidateSha, env });
  assert.equal(profile.budgetMs, 600000);
  assert.equal(profile.stallBudgetMs, 600000);
  assert.deepEqual(profile.roots, [
    "7036562034b19a70d10bd0d87ea66d208af11d64",
    "819c992fb15ef0b87299ddaaed143427bd00a13d",
    "f265f062767d40618df9152aa8900eaf17bfa92d",
    "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
    "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  ]);
  assert.deepEqual(profile.readerRevisions, profile.roots);
  assert.deepEqual(profile.readerObjects, []);
  assert.deepEqual(profile.readerPaths, [
    ...[INDEX, MATRIX].map((file) => ({ revision: "7036562034b19a70d10bd0d87ea66d208af11d64", path: file })),
    ...["e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab", "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5"].map((revision) => ({
      revision,
      path: ".github/workflows/sounding-line-ordinary.yml",
    })),
  ]);
  for (const changed of [
    { GITHUB_REPOSITORY: "fork/repo" },
    { GITHUB_SHA: candidateSha },
    { GITHUB_REF: "refs/heads/other" },
  ])
    assert.throws(
      () => pr776CheckoutProfile({ authorityRoot: root, baseSha, candidateSha, env: { ...env, ...changed } }),
      /UNTRUSTED_BASE/u,
    );
  writeFileSync(file, JSON.stringify({ inputs: { pr_number: "721", base_sha: baseSha, candidate_sha: candidateSha } }));
  assert.throws(() => pr776CheckoutProfile({ authorityRoot: root, baseSha, candidateSha, env }), /UNTRUSTED_EVENT/u);
});

test("PR776 transport preserves all941 original pins and938 immutable current files", () => {
  const inventory = JSON.parse(read(`${E}/public-files-941.original.json`));
  const original = new Map(inventory.map((row) => [row.path, `100644 blob ${row.blob}`]));
  const current = new Map(original);
  for (const file of [C, INDEX, MATRIX]) current.set(file, `100644 blob ${"a".repeat(40)}`);
  validatePR776CheckoutInventories(inventory, original, current);
  const immutable = inventory.find((row) => ![C, INDEX, MATRIX].includes(row.path));
  current.set(immutable.path, `100644 blob ${"a".repeat(40)}`);
  assert.throws(() => validatePR776CheckoutInventories(inventory, original, current), /IMMUTABLE_EVIDENCE_CHANGED/u);
  assert.throws(() => validatePR776CheckoutInventories(inventory.slice(1), original, current), /INVENTORY_CHANGED/u);
  assert.throws(() => validatePR776CheckoutInventories(inventory, new Map(), current), /ORIGINAL_EVIDENCE_CHANGED/u);
});

test("PR776 canonical permits only a positive reviewArtifactId and never changes original rows", () => {
  const original = read(`${E}/accepted-canonical.original.json`);
  const published = JSON.parse(original);
  validatePR776CheckoutCanonical(original, original);
  published.reviewArtifactId = 123;
  validatePR776CheckoutCanonical(original, JSON.stringify(published));
  published.reviews[0].iterations++;
  assert.throws(() => validatePR776CheckoutCanonical(original, JSON.stringify(published)), /CANONICAL_CHANGED/u);
  for (const id of [0, -1, "123", 1.5])
    assert.throws(
      () => validatePR776CheckoutCanonical(original, JSON.stringify({ ...JSON.parse(original), reviewArtifactId: id })),
      /REVIEW_ID_INVALID/u,
    );
  assert.throws(() => validatePR776CheckoutCanonical(Buffer.from("{}"), original), /CANONICAL_ORIGINAL_CHANGED/u);
});

test("PR776 indexes preserve old rows and only exact protected Engineering additions", () => {
  const oldIndex = { records: [{ path: "old.md", status: "preserved" }] };
  const baseIndex = { records: additions.map((path) => ({ path, status: "preserved" })) };
  const currentIndex = { records: [...oldIndex.records, ...baseIndex.records] };
  const oldCSV = '"old.md",preserved\n';
  const currentCSV = oldCSV + additions.map((file) => `"${file}",preserved`).join("\n");
  validatePR776CheckoutIndexes(oldIndex, baseIndex, currentIndex, oldCSV, currentCSV);
  assert.throws(
    () =>
      validatePR776CheckoutIndexes(oldIndex, baseIndex, { records: currentIndex.records.slice(1) }, oldCSV, currentCSV),
    /INDEX_CHANGED/u,
  );
  assert.throws(
    () =>
      validatePR776CheckoutIndexes(
        oldIndex,
        baseIndex,
        { records: [...currentIndex.records, { path: "extra.md" }] },
        oldCSV,
        currentCSV,
      ),
    /INDEX_CHANGED/u,
  );
  assert.throws(
    () =>
      validatePR776CheckoutIndexes(oldIndex, baseIndex, currentIndex, oldCSV, currentCSV + '\n"extra.md",preserved'),
    /MATRIX_CHANGED/u,
  );
});

test("explicit historical CSV reader is compiled and missing declarations fail closed", async (t) => {
  const dir = temporary(t);
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git(["init", "-q"]);
  git(["config", "user.name", "PR776 transport fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  mkdirSync(path.dirname(path.join(dir, MATRIX)), { recursive: true });
  writeFileSync(path.join(dir, MATRIX), '"immutable.csv",preserved\n');
  writeFileSync(path.join(dir, "unneeded.bin"), "not a reader");
  git(["add", "."]);
  git(["commit", "-qm", "historical CSV reader"]);
  const revision = git(["rev-parse", "HEAD"]),
    csv = git(["rev-parse", `HEAD:${MATRIX}`]);
  const input = {
    operation: "compile",
    root: dir,
    git: "git",
    snapshots: [],
    readerSnapshots: [revision],
    objects: [],
    readerPaths: [{ revision, path: MATRIX }],
    output: path.join(dir, "closure.json"),
  };
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify(input));
  await checkoutHydration(file);
  const closure = JSON.parse(readFileSync(input.output));
  assert(closure.objects.some((value) => value.sha === csv && value.type === "blob"));
  assert(!closure.objects.some((value) => value.sha === git(["rev-parse", "HEAD:unneeded.bin"])));
  writeFileSync(
    file,
    JSON.stringify({
      ...input,
      readerPaths: [{ revision, path: "missing.csv" }],
      output: path.join(dir, "missing.json"),
    }),
  );
  await assert.rejects(checkoutHydration(file), /MISSING_READER_PATH/u);
});

test("all active PR776 consumers select ten-minute profile while Crossdeck keeps its original21-minute steps", () => {
  const workflow = read(".github/workflows/sounding-line-ordinary.yml").toString();
  const steps = workflow
    .split("      - ")
    .filter((step) => step.includes("name: Checkout PR776 complete history and explicit reader closure"));
  assert.equal(steps.length, 4);
  for (const step of steps) {
    assert.match(step, /timeout-minutes: 10/u);
    assert.match(step, /--candidate "\$CANDIDATE_SHA" --pr 776/u);
    assert.match(step, /number == 776/u);
  }
  const legacy = workflow
    .split("      - ")
    .filter((step) => step.includes("name: Checkout selected complete consumer history"));
  assert.equal(legacy.length, 4);
  for (const step of legacy) {
    assert.match(step, /timeout-minutes: 21/u);
    assert.match(step, /number == 721/u);
    assert(!step.includes("--pr 776"));
  }
});

test("historical workflow reader closure retains both versions while omitting unrelated historical blobs", async (t) => {
  const dir = temporary(t);
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const workflow = ".github/workflows/sounding-line-ordinary.yml";
  git(["init", "-q"]);
  git(["config", "user.name", "Historical workflow fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  mkdirSync(path.dirname(path.join(dir, workflow)), { recursive: true });
  const readers = [];
  const blobs = [];
  for (const version of ["previous", "current"]) {
    writeFileSync(path.join(dir, workflow), `name: synthetic ${version} workflow\n`);
    writeFileSync(path.join(dir, "unneeded.bin"), "not a historical reader");
    git(["add", "."]);
    git(["commit", "-qm", version]);
    readers.push({ revision: git(["rev-parse", "HEAD"]), path: workflow });
    blobs.push(git(["rev-parse", `HEAD:${workflow}`]));
  }
  const input = {
    operation: "compile",
    root: dir,
    git: "git",
    snapshots: [],
    readerSnapshots: readers.map((reader) => reader.revision),
    objects: [],
    readerPaths: readers,
    output: path.join(dir, "workflow-closure.json"),
  };
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify(input));
  await checkoutHydration(file);
  const closure = JSON.parse(readFileSync(input.output));
  for (const blob of blobs) assert(closure.objects.some((object) => object.sha === blob && object.type === "blob"));
  for (const reader of readers)
    assert(closure.objects.some((object) => object.sha === reader.revision && object.type === "commit"));
  assert(!closure.objects.some((object) => object.sha === git(["rev-parse", "HEAD:unneeded.bin"])));
});

test("only PR776 joins the existing ninety-minute final verification budget", () => {
  const workflow = read(".github/workflows/sounding-line-ordinary.yml").toString();
  const jobs = workflow.split(/\n  (?=[a-z][a-z-]*:\n)/u).filter((section) => /^[a-z][a-z-]*:\n/u.test(section));
  const deadlines = Object.fromEntries(
    jobs.map((section) => [section.split(":")[0], /^    timeout-minutes: (.+)$/mu.exec(`  ${section}`)?.[1]]),
  );
  assert.equal(deadlines["campaign-custody"], "35");
  assert.equal(deadlines["experience-preparation"], "${{ inputs.experience_mode == 'capture' && 70 || 40 }}");
  assert.equal(deadlines["mainline-decision"], "35");
  const addedScope = " || github.event.pull_request.number == 776 || inputs.pr_number == '776'";
  const previous = "${{ (github.event.pull_request.number == 721 || inputs.pr_number == '721') && 90 || 45 }}";
  assert.equal(deadlines["final-check"], previous.replace(") &&", `${addedScope}) &&`));
  assert.equal(deadlines["final-check"].replace(addedScope, ""), previous);
});

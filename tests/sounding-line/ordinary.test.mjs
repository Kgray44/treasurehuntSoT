import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { assertBinding, classifyChanges, selectAffectedTests } from "../../scripts/sounding-line/ordinary.mjs";

test("ordinary classification ignores retired generated state and rejects active control-plane edits", () => {
  const result = classifyChanges([
    "src/app/community/voyage-logs/[slug]/page.tsx",
    "testing/generated/active-test-registry.json",
    "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    "scripts/sounding-line/ordinary.mjs",
  ]);
  assert.deepEqual(result.ignoredPaths, [
    "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    "testing/generated/active-test-registry.json",
  ]);
  assert.deepEqual(result.controlPlanePaths, ["scripts/sounding-line/ordinary.mjs"]);
});

test("ordinary selection finds Harborlight browser proof structurally", () => {
  const selection = selectAffectedTests({
    changedPaths: ["src/app/community/voyage-logs/[slug]/page.tsx"],
    unitTests: ["src/community/feed.test.ts", "src/auth/session.test.ts"],
    browserTests: ["tests/e2e/harborlight-phase3.spec.ts", "tests/e2e/access-gates.spec.ts"],
  });
  assert.deepEqual(selection.unitTests, ["src/community/feed.test.ts"]);
  assert.deepEqual(selection.browserTests, ["tests/e2e/harborlight-phase3.spec.ts"]);
  assert.equal(selection.widened, false);
});

test("unknown impact widens and release mode is exhaustive", () => {
  const ordinary = selectAffectedTests({
    changedPaths: ["misc/unknown-file.txt"],
    unitTests: ["src/a.test.ts", "src/b.test.ts"],
    browserTests: ["tests/e2e/a.spec.ts"],
  });
  assert.deepEqual(ordinary.unitTests, ["src/a.test.ts", "src/b.test.ts"]);
  assert.deepEqual(ordinary.browserTests, []);
  assert.equal(ordinary.widened, true);
  const release = selectAffectedTests({
    changedPaths: [],
    unitTests: ["src/b.test.ts", "src/a.test.ts"],
    browserTests: ["tests/e2e/a.spec.ts"],
    mode: "release",
  });
  assert.deepEqual(release.unitTests, ["src/a.test.ts", "src/b.test.ts"]);
  assert.deepEqual(release.browserTests, ["tests/e2e/a.spec.ts"]);
});

test("candidate binding requires distinct exact commit and tree identities", () => {
  assert.doesNotThrow(() =>
    assertBinding({
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      baseTree: "c".repeat(40),
      candidateTree: "d".repeat(40),
    }),
  );
  assert.throws(() =>
    assertBinding({
      baseSha: "a".repeat(40),
      candidateSha: "a".repeat(40),
      baseTree: "c".repeat(40),
      candidateTree: "d".repeat(40),
    }),
  );
});

test("ordinary admission has no orchestration or generated-state prerequisites", () => {
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  const workflowNames = readdirSync(".github/workflows").sort();
  assert.deepEqual(workflowNames, [
    "sounding-line-control-plane.yml",
    "sounding-line-exhaustive-release.yml",
    "sounding-line-ordinary.yml",
  ]);
  assert.equal(scripts.test, "vitest run");
  for (const key of Object.keys(scripts))
    assert.doesNotMatch(key, /nightwatch|bosun|mainline|maintenance|project-trim/u);
  const ordinaryWorkflow = readFileSync(".github/workflows/sounding-line-ordinary.yml", "utf8");
  assert.match(ordinaryWorkflow, /pull_request_target/u);
  assert.match(ordinaryWorkflow, /Sounding Line \/ Mainline Decision/u);
  assert.doesNotMatch(ordinaryWorkflow, /nightwatch|bosun|baseline|deepwater|feature catalog|P34|maintenance|train/iu);
  const releaseWorkflow = readFileSync(".github/workflows/sounding-line-exhaustive-release.yml", "utf8");
  assert.match(releaseWorkflow, /--mode release/u);
  const controlPlaneWorkflow = readFileSync(".github/workflows/sounding-line-control-plane.yml", "utf8");
  assert.match(controlPlaneWorkflow, /workflow_dispatch/u);
  assert.match(controlPlaneWorkflow, /Sounding Line \/ Mainline Decision/u);
  assert.doesNotMatch(
    controlPlaneWorkflow,
    /pull_request_target|nightwatch|bosun|baseline|deepwater|feature catalog|P34|maintenance|train/iu,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ordinaryCheckoutProfile } from "../../scripts/sounding-line/ordinary-checkout.mjs";

const baseSha = "a".repeat(40),
  candidateSha = "b".repeat(40);
const env = {
  GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
  GITHUB_SHA: baseSha,
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
};
const event = { inputs: { pr_number: "819", base_sha: baseSha, candidate_sha: candidateSha } };
test("PR819 transport is exact-source-bound and keeps the existing ten-minute ceiling", async () => {
  const profile = ordinaryCheckoutProfile({ baseSha, candidateSha, env, event });
  assert.equal(profile.budgetMs, 600000);
  assert.equal(profile.stallBudgetMs, 600000);
  assert.equal(profile.readerPaths.length, 4);
  assert(profile.readerPaths.some((reader) => reader.path.endsWith("Documentation_Migration_Matrix.csv")));
  assert.deepEqual(await profile.preservation(), { preservationPins: 0, historicalManifestPinsRetained: [] });
});
test("ordinary transport cannot select finite campaign routes or an untrusted event", () => {
  for (const pr_number of ["721", "776", "0", "NaN"])
    assert.throws(() =>
      ordinaryCheckoutProfile({ baseSha, candidateSha, env, event: { inputs: { ...event.inputs, pr_number } } }),
    );
  for (const override of [
    { GITHUB_SHA: candidateSha },
    { GITHUB_REF: "refs/heads/untrusted" },
    { GITHUB_REPOSITORY: "other/repo" },
    { GITHUB_EVENT_NAME: "pull_request" },
  ])
    assert.throws(() => ordinaryCheckoutProfile({ baseSha, candidateSha, env: { ...env, ...override }, event }));
  assert.throws(() =>
    ordinaryCheckoutProfile({
      baseSha,
      candidateSha,
      env,
      event: { inputs: { ...event.inputs, candidate_sha: baseSha } },
    }),
  );
});
test("pull_request_target must bind both repository identities and both exact source revisions", () => {
  const repo = { full_name: env.GITHUB_REPOSITORY };
  const pull = { number: 819, base: { sha: baseSha, repo }, head: { sha: candidateSha, repo } };
  const target = { ...env, GITHUB_EVENT_NAME: "pull_request_target" };
  assert.equal(
    ordinaryCheckoutProfile({ baseSha, candidateSha, env: target, event: { pull_request: pull } }).budgetMs,
    600000,
  );
  for (const side of ["head", "base"])
    assert.throws(() =>
      ordinaryCheckoutProfile({
        baseSha,
        candidateSha,
        env: target,
        event: { pull_request: { ...pull, [side]: { ...pull[side], repo: { full_name: "attacker/fork" } } } },
      }),
    );
});
test("the installed workflow uses exact ordinary transport and an explicit always-running required gate", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  const gate = workflow.split("\n  mainline-decision:\n")[1];
  assert(gate);
  const condition = gate.split("\n").find((line) => line.startsWith("    if:"));
  assert.match(condition, /always\(\)/u);
  assert.doesNotMatch(condition, /draft/u);
  assert.match(gate, /test "\$CUSTODY_RESULT" = success && test "\$VERIFICATION_RESULT" = success/u);
  assert.match(gate, /protected-merge-transaction\.mjs --operation gate/u);
  assert.doesNotMatch(workflow, /fetch-depth: 0|continue-on-error|filter: blob:none/u);
  assert.equal(workflow.match(/ordinary-checkout\.mjs --workspace candidate/gu).length, 4);
  assert.equal(workflow.match(/experience-selected-checkout\.mjs --workspace candidate/gu).length, 8);
  assert.match(workflow, /ordinary-supervised\.mjs --mode ordinary/u);
  assert.match(workflow, /always\(\).*verification_supervision_path/u);
});

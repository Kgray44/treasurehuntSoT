import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ordinaryCheckoutProfile,
  NONCAMPAIGN_CUSTODY_CHECKOUT_MODE,
} from "../../scripts/sounding-line/ordinary-checkout.mjs";
import "./ordinary-documentation-checkout.test.mjs";
import "./ordinary-documentation-materialization.test.mjs";
import "./ordinary-custody-probe.test.mjs";
import "./ordinary-documentation-certificate.test.mjs";

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
  assert.throws(
    () => ordinaryCheckoutProfile({ baseSha, candidateSha, env, event, purpose: "campaign-custody" }),
    /CUSTODY_JOB_REQUIRED/u,
  );
  assert.throws(
    () => ordinaryCheckoutProfile({ baseSha, candidateSha, env, event, purpose: "unknown" }),
    /INVALID_PURPOSE/u,
  );
  assert.equal(
    ordinaryCheckoutProfile({
      baseSha,
      candidateSha,
      env: { ...env, GITHUB_JOB: "campaign-custody" },
      event,
      purpose: "campaign-custody",
    }).budgetMs,
    600000,
  );
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
  assert.match(workflow, /converted_to_draft/u);
  assert.doesNotMatch(condition, /draft/u);
  assert.match(gate, /test "\$CUSTODY_RESULT" = success && test "\$VERIFICATION_RESULT" = success/u);
  assert.match(gate, /protected-merge-transaction\.mjs --operation gate/u);
  assert.doesNotMatch(workflow, /fetch-depth: 0|continue-on-error|filter: blob:none/u);
  assert.equal(workflow.match(/ordinary-checkout\.mjs --workspace candidate/gu).length, 4);
  assert.equal(workflow.match(/experience-selected-checkout\.mjs --workspace candidate/gu).length, 8);
  assert.match(workflow, /ordinary-supervised\.mjs --mode ordinary/u);
  const retention = workflow
    .split("- name: Retain verification supervision after every outcome")[1]
    .split("- name:")[0];
  assert.match(retention, /always\(\).*steps\.route\.outputs\.kind == 'ordinary'/u);
  assert.doesNotMatch(retention, /steps\.ordinary-verifier\.outputs/u);
  for (const file of ["initial", "preflight", "terminal", "controller-failure"])
    assert(retention.includes(`session-*/${file}.json`));
  assert.match(retention, /if-no-files-found: error/u);
});

test("installed custody gate preserves purpose, cancellation, held owners and FULL uncertainty", async () => {
  assert(["SHADOW", "ACTIVE"].includes(NONCAMPAIGN_CUSTODY_CHECKOUT_MODE));
  const active = NONCAMPAIGN_CUSTODY_CHECKOUT_MODE === "ACTIVE";
  const controller = new AbortController();
  controller.abort();
  let treeReads = 0;
  const context = {
    baseSha,
    candidateSha,
    signal: controller.signal,
    command: async (args) => {
      assert.deepEqual(args.slice(0, 2), ["ls-tree", "-rz"]);
      treeReads++;
      return "";
    },
    binaryCommand: async () => assert.fail("no binary transport is admitted by this incomplete context"),
    readOnlyBinaryCommand: async () => assert.fail("no worker is admitted by this incomplete context"),
  };
  const profile = (purpose, pr = "819") =>
    ordinaryCheckoutProfile({
      baseSha,
      candidateSha,
      env: { ...env, GITHUB_JOB: "campaign-custody" },
      event: { inputs: { ...event.inputs, pr_number: pr } },
      purpose,
    });
  const verification = await profile("verification").selectReadSet(context);
  assert.equal(verification.applied, false);
  assert.equal(verification.proposal.profile, "FULL_SNAPSHOT");
  assert.equal(treeReads, 2);
  if (active) {
    await assert.rejects(profile("campaign-custody").selectReadSet(context), /SELECTED_CHECKOUT_CANCELLED/u);
    assert.equal(treeReads, 2);
  }
  for (const pr of ["805", "820", "819"]) {
    const result = await profile("campaign-custody", pr).selectReadSet({ ...context, signal: undefined });
    assert.equal(result.applied, false);
    assert.equal(result.proposal.profile, "FULL_SNAPSHOT");
    if (active) {
      assert.equal(result.proposal.reason, pr === "819" ? "PROOF_CONTEXT_UNAVAILABLE" : "HELD_OR_UNBOUND_OWNER");
      assert.equal(treeReads, 2);
    }
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ordinary pull request events retain cheap classification but cannot run a protected binding decision", async () => {
  const workflow = await readFile(".github/workflows/sounding-line-protected-merge-binding.yml", "utf8");
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && always\(\)/u);
  assert.equal((workflow.match(/github\.event_name == 'workflow_dispatch' && always\(\)/gu) ?? []).length, 3);
  assert.match(workflow, /root-maintenance-preflight:/u);
  assert.doesNotMatch(workflow, /bind-root-maintenance:/u);
  assert.match(workflow, /record-only-evidence:[\s\S]*?github\.event_name == 'workflow_dispatch'/u);
});

test("Nightwatch binding dispatch carries exact authority and candidate identities", async () => {
  const workflow = await readFile(".github/workflows/sounding-line-protected-binding-dispatch.yml", "utf8");
  for (const input of [
    "pr_number",
    "candidate_sha",
    "candidate_ref",
    "base_sha",
    "authority_run_id",
    "authority_kind",
    "nightwatch_dispatch_key",
  ])
    assert.match(workflow, new RegExp(`\\n      ${input}:`, "u"));
  assert.match(workflow, /protected-merge-binding-ci\.mjs/u);
  assert.match(workflow, /git merge-tree --write-tree/u);
  assert.match(workflow, /NIGHTWATCH_BINDING_PR_IDENTITY_MISMATCH/u);
  assert.match(workflow, /nightwatch-protected-binding-receipt/u);
  assert.match(workflow, /run-name: Sounding Line protected binding/u);
  assert.match(workflow, /NIGHTWATCH_BINDING_AUTHORITY_KIND_INVALID/u);
  assert.match(workflow, /inputs\.authority_kind == 'root_maintenance'/u);
  assert.match(workflow, /trusted-root-maintenance-bind\.mjs/u);
  assert.match(workflow, /root-maintenance-binding-input\.json/u);
  assert.match(workflow, /ROOT_MAINTENANCE_TRUSTED_BIND_HELPER_UNAVAILABLE/u);
  assert.match(workflow, /--replay-ledger/u);
  assert.doesNotMatch(workflow, /root-maintenance-selection\.mjs|root-maintenance-artifact\.mjs|\[int\]\$env:AUTHORITY_RUN_ID/u);
  assert.match(workflow, /qualifyRootMaintenanceProtectedMerge/u);
  assert.match(workflow, /Sounding Line \/ Mainline Decision/u);
  assert.match(workflow, /run-id: "\$\{\{ inputs\.authority_run_id \}\}"/u);
});

test("authoritative candidate qualification can be durably rediscovered without changing its acceptance semantics", async () => {
  const workflow = await readFile(".github/workflows/sounding-line-authoritative.yml", "utf8");
  assert.match(workflow, /nightwatch_dispatch_key/u);
  assert.match(workflow, /run-name: Sounding Line authoritative/u);
  assert.match(workflow, /authority_mode/u);
  assert.match(workflow, /SOUNDING_LINE_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED/u);
});

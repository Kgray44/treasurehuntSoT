import assert from "node:assert/strict";
import test from "node:test";
import {
  requireQualificationBoundary,
  requireSuccessfulMergeDecision,
  protectedMergeTransaction,
} from "../../scripts/sounding-line/protected-merge-transaction.mjs";
const repo = "Kgray44/treasurehuntSoT",
  head = "a".repeat(40),
  base = "b".repeat(40),
  merged = "c".repeat(40);
const time = "2026-10-31T00:00:00Z",
  ready = "2026-10-31T00:01:00Z",
  active = "2026-10-31T00:02:00Z";
function fixture() {
  return {
    pr: 900,
    head,
    base,
    pull: {
      number: 900,
      state: "open",
      merged: false,
      draft: false,
      created_at: time,
      head: { sha: head, repo: { full_name: repo } },
      base: { sha: base, ref: "main", repo: { full_name: repo } },
    },
    run: {
      id: 42,
      run_attempt: 1,
      event: "pull_request_target",
      path: ".github/workflows/sounding-line-ordinary.yml",
      head_sha: head,
      repository: { full_name: repo },
      head_repository: { full_name: repo },
      pull_requests: [{ number: 900, head: { sha: head }, base: { sha: base } }],
      created_at: active,
      status: "completed",
      conclusion: "success",
    },
    timeline: [
      { event: "convert_to_draft", created_at: time },
      { event: "ready_for_review", created_at: ready },
    ],
    protection: {
      required_status_checks: {
        strict: true,
        checks: [{ context: "Sounding Line / Mainline Decision", app_id: 15368 }],
      },
      enforce_admins: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
    },
    rulesets: [],
    check: {
      id: 123,
      name: "Sounding Line / Mainline Decision",
      head_sha: head,
      status: "completed",
      conclusion: "success",
      app: { id: 15368 },
      details_url: `https://github.com/${repo}/actions/runs/42/job/123`,
      completed_at: active,
    },
    job: {
      id: 123,
      run_id: 42,
      run_attempt: 1,
      name: "Sounding Line / Mainline Decision",
      status: "completed",
      conclusion: "success",
      started_at: active,
    },
  };
}
test("PR776 draft/skipped/ready/base-advance ordering cannot become an accepted transaction", () => {
  const draft = fixture();
  draft.pull.draft = true;
  draft.check.conclusion = "skipped";
  assert.throws(() => requireSuccessfulMergeDecision(draft), /NOT_READY/u);
  const transitioned = fixture();
  transitioned.run.created_at = time;
  transitioned.check.conclusion = "skipped";
  assert.throws(() => requireSuccessfulMergeDecision(transitioned), /PRE_READY_QUALIFICATION/u);
  const advanced = fixture();
  advanced.pull.base.sha = "d".repeat(40);
  assert.throws(() => requireQualificationBoundary(advanced), /SOURCE_MOVED/u);
  const later = fixture();
  assert.equal(requireSuccessfulMergeDecision(later).runId, 42);
  later.run.conclusion = "failure";
  assert.throws(() => requireSuccessfulMergeDecision(later), /RUN_NOT_SUCCESSFUL/u);
  assert.equal(draft.check.conclusion, "skipped", "failed historical observations are not rewritten");
});
test("only a successful exact-head check from the trusted app, workflow, run and job qualifies", () => {
  for (const conclusion of ["skipped", "neutral", "cancelled", "failure", "timed_out", null]) {
    const value = fixture();
    value.check.conclusion = conclusion;
    assert.throws(() => requireSuccessfulMergeDecision(value), /CHECK_NOT_SUCCESSFUL/u);
  }
  for (const mutate of [
    (v) => {
      v.check = null;
    },
    (v) => {
      v.check.head_sha = base;
    },
    (v) => {
      v.check.app.id = 1;
    },
    (v) => {
      v.run.path = ".github/workflows/forged.yml";
    },
    (v) => {
      v.run.event = "workflow_dispatch";
    },
    (v) => {
      v.job.run_id = 41;
    },
    (v) => {
      v.check.details_url = `https://github.com/${repo}/actions/runs/41/job/123`;
    },
    (v) => {
      v.run.pull_requests[0].base.sha = head;
    },
    (v) => {
      v.protection.enforce_admins.enabled = false;
    },
    (v) => {
      v.protection.required_status_checks.strict = false;
    },
    (v) => {
      v.protection.required_status_checks.checks[0].app_id = 1;
    },
    (v) => {
      v.rulesets.push({ bypass_actors: [{ actor_id: 1 }] });
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => requireSuccessfulMergeDecision(value));
  }
});
function server(snapshot, { advance = false, reject = false } = {}) {
  let pulls = 0,
    merges = 0;
  const api = async (endpoint, options = []) => {
    if (endpoint === "user") return { login: "Kgray44" };
    if (endpoint.endsWith("/permission")) return { permission: "admin" };
    if (endpoint.endsWith("/merge")) {
      merges++;
      assert(options.includes(`sha=${head}`), "the server must receive an exact-head compare-and-swap");
      if (reject) throw new Error("HTTP 405: strict server gate refused");
      return { merged: true, sha: merged };
    }
    if (endpoint.endsWith(`/git/commits/${merged}`)) return { parents: [{ sha: base }, { sha: head }] };
    if (endpoint.endsWith("/pulls/900")) {
      if (merges) return { ...snapshot.pull, merged: true, merge_commit_sha: merged };
      const pull = structuredClone(snapshot.pull);
      if (++pulls > 1 && advance) pull.base.sha = "e".repeat(40);
      return pull;
    }
    if (endpoint.includes("/check-runs?")) return { check_runs: [snapshot.check] };
    if (endpoint.includes("/timeline?")) return snapshot.timeline;
    if (endpoint.includes("/rulesets?")) return snapshot.rulesets;
    if (endpoint.endsWith("/protection")) return snapshot.protection;
    if (endpoint.endsWith("/runs/42")) return snapshot.run;
    if (endpoint.endsWith("/jobs/123")) return snapshot.job;
    throw new Error(`Unexpected endpoint ${endpoint}`);
  };
  return { api, merges: () => merges };
}
test("automation rechecks after recording and aborts a moved base without submitting a merge", async () => {
  const mocked = server(fixture(), { advance: true }),
    records = [];
  await assert.rejects(
    protectedMergeTransaction({
      pr: 900,
      head,
      base,
      runId: 42,
      api: mocked.api,
      record: async (value) => records.push(value),
    }),
    /SOURCE_MOVED/u,
  );
  assert.equal(mocked.merges(), 0);
  assert.equal(records[0].event, "MERGE_PREFLIGHT");
});
test("server refusal remains a failure; success requires observed two-parent landing", async () => {
  const refused = server(fixture(), { reject: true });
  await assert.rejects(protectedMergeTransaction({ pr: 900, head, base, runId: 42, api: refused.api }), /HTTP 405/u);
  const passed = server(fixture()),
    records = [];
  const result = await protectedMergeTransaction({
    pr: 900,
    head,
    base,
    runId: 42,
    api: passed.api,
    record: async (value) => records.push(value),
  });
  assert.equal(result.merge, merged);
  assert.equal(passed.merges(), 1);
  assert.deepEqual(
    records.map((r) => r.event),
    ["MERGE_PREFLIGHT", "MERGE_OBSERVED"],
  );
});

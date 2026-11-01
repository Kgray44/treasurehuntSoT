import assert from "node:assert/strict";
import test from "node:test";
import {
  verificationBudget,
  verificationJobLimit,
  commandDeadline,
  commandTransport,
} from "../../scripts/sounding-line/verification-budget.mjs";
import { currentVerificationJob } from "../../scripts/sounding-line/ordinary-supervised.mjs";
test("setup is debited once and finalization retains its reserved tail", () => {
  const budget = verificationBudget({ jobStartedAt: "2026-10-31T00:00:00Z", now: Date.parse("2026-10-31T00:10:00Z") });
  assert.deepEqual(budget, { limitMs: 2700000, setupMs: 600000, tailMs: 120000, executionMs: 1980000 });
  assert.equal(verificationJobLimit(721), 5400000);
  assert.equal(verificationJobLimit(776), 7200000);
  assert.equal(verificationJobLimit(819), 2700000);
});
test("spent, invalid or future job clocks cannot reset the execution allowance", () => {
  for (const jobStartedAt of ["invalid", "2026-11-01T00:00:00Z", "2026-10-30T00:00:00Z"])
    assert.throws(() => verificationBudget({ jobStartedAt, now: Date.parse("2026-10-31T00:00:00Z") }));
  for (const deadline of [undefined, "NaN", -1, 1000]) assert.throws(() => commandDeadline(deadline, 1000));
  assert.equal(commandDeadline(2000, 1000), 1000);
  assert.equal(commandDeadline(2000000, 1000), 900000);
});
test("command transport rejects overflow before execution and accounts for Unicode and shell expansion", () => {
  assert.equal(commandTransport("node", ["check.mjs"]).arguments, 1);
  for (const arg of ["x".repeat(6000), "界".repeat(2000), "space ".repeat(200), "embedded\nline", "nul\0value"])
    assert.throws(() => commandTransport("node", [arg]), /COMMAND_TRANSPORT_/u);
});
test("job allowance uses the authenticated current attempt and refuses absent, ambiguous or truncated jobs", async () => {
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_JOB: "final-check",
    GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
    GITHUB_RUN_ID: "42",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_REF: "refs/heads/main",
    GH_TOKEN: "fixture-not-a-credential",
    GITHUB_WORKFLOW_REF: "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main",
  };
  const job = {
    id: 101,
    name: "Sounding Line / Focused verification",
    status: "in_progress",
    run_id: 42,
    run_attempt: 2,
    head_sha: "b".repeat(40),
    started_at: "2026-10-31T00:00:00Z",
  };
  let requested;
  const request = async (url) => {
    requested = url;
    return { status: 200, json: async () => ({ total_count: 1, jobs: [job] }) };
  };
  const clock = () => ({
    kind: "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND",
    setupMs: 600000,
    originPid: process.pid,
  });
  const input = { env, request, candidateSha: job.head_sha, clock, monotonic: () => 1 };
  const result = await currentVerificationJob({ ...input, now: () => Date.parse("2026-10-31T00:10:00Z") });
  assert.match(requested, /\/runs\/42\/attempts\/2\/jobs\?/u);
  assert.equal(result.setupMs, 600000);
  const skewed = await currentVerificationJob({
    ...input,
    request: async () => ({
      status: 200,
      json: async () => ({ total_count: 1, jobs: [{ ...job, started_at: "2026-10-31T01:00:00Z" }] }),
    }),
    now: () => Date.parse("2026-10-31T00:10:00Z"),
  });
  assert.equal(skewed.setupMs, 600000, "the complete execution age is debited even with a future provider header");
  assert.equal(skewed.clockObservation.providerSetupMs, -3000000);
  assert.equal(skewed.clockObservation.providerJob.started_at, "2026-10-31T01:00:00Z");
  assert.equal(skewed.tailMs, 120000);
  assert.equal(skewed.limitMs, 2700000);
  const olderProvider = await currentVerificationJob({ ...input, now: () => Date.parse("2026-10-31T00:15:00Z") });
  assert.equal(olderProvider.setupMs, 900000, "an older coherent provider age cannot buy more allowance");
  for (const data of [
    { total_count: 0, jobs: [] },
    { total_count: 2, jobs: [job, job] },
    { total_count: 101, jobs: [job] },
    { total_count: 1, jobs: [{ ...job, run_id: 41 }] },
    { total_count: 1, jobs: [{ ...job, run_attempt: 1 }] },
    { total_count: 1, jobs: [{ ...job, head_sha: "c".repeat(40) }] },
    { total_count: 1, jobs: [{ ...job, id: 0 }] },
    { total_count: 1, jobs: [{ ...job, started_at: "invalid" }] },
  ])
    await assert.rejects(
      currentVerificationJob({ ...input, request: async () => ({ status: 200, json: async () => data }) }),
      /JOB_BINDING_INVALID/u,
    );
  await assert.rejects(
    currentVerificationJob({ ...input, env: { ...env, GITHUB_REF: "refs/heads/candidate" } }),
    /JOB_BINDING_INVALID/u,
  );
  for (const bad of [
    {
      clock: () => ({
        kind: "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND",
        setupMs: 1,
        originPid: process.pid + 1,
      }),
    },
    { clock: () => ({ kind: "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND", setupMs: -1, originPid: process.pid }) },
    {
      clock: () => {
        throw Error("SOUNDING_LINE_VERIFICATION_NATIVE_CLOCK_UNAVAILABLE");
      },
    },
    {
      monotonic: (() => {
        let value = 2;
        return () => value--;
      })(),
    },
  ])
    await assert.rejects(currentVerificationJob({ ...input, ...bad }), /NATIVE_CLOCK_UNAVAILABLE/u);
  await assert.rejects(
    currentVerificationJob({
      ...input,
      clock: () => ({
        kind: "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND",
        setupMs: 2700000,
        originPid: process.pid,
      }),
    }),
    /JOB_BUDGET_EXHAUSTED/u,
  );
});

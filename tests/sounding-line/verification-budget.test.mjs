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
    GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
    GITHUB_RUN_ID: "42",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_REF: "refs/heads/main",
    GH_TOKEN: "fixture-not-a-credential",
    GITHUB_WORKFLOW_REF: "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main",
  };
  const job = {
    name: "Sounding Line / Focused verification",
    status: "in_progress",
    run_id: 42,
    started_at: "2026-10-31T00:00:00Z",
  };
  let requested;
  const request = async (url) => {
    requested = url;
    return { status: 200, json: async () => ({ total_count: 1, jobs: [job] }) };
  };
  const result = await currentVerificationJob({ env, request, now: () => Date.parse("2026-10-31T00:10:00Z") });
  assert.match(requested, /\/runs\/42\/attempts\/2\/jobs\?/u);
  assert.equal(result.setupMs, 600000);
  for (const data of [
    { total_count: 0, jobs: [] },
    { total_count: 2, jobs: [job, job] },
    { total_count: 101, jobs: [job] },
    { total_count: 1, jobs: [{ ...job, run_id: 41 }] },
  ])
    await assert.rejects(
      currentVerificationJob({ env, request: async () => ({ status: 200, json: async () => data }) }),
      /JOB_BINDING_INVALID/u,
    );
  await assert.rejects(
    currentVerificationJob({ env: { ...env, GITHUB_REF: "refs/heads/candidate" }, request }),
    /JOB_BINDING_INVALID/u,
  );
});

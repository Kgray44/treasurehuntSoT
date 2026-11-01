import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CAPACITY_820,
  capacity820Grant,
  encodeCapacity820Grant,
  requireCapacity820Grant,
  validateCapacity820Provider,
  verificationCapacity820,
} from "../../scripts/sounding-line/verification-capacity-820.mjs";
const input = () => ({
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  candidateTree: "c".repeat(40),
  runId: "123",
  attempt: "1",
  sourceDigest: CAPACITY_820.sourceDigest,
  createdAt: "2026-11-01T19:00:00Z",
  now: Date.parse("2026-11-01T19:01:00Z"),
});
test("capacity is canonical, finite, exact-source and never qualification", () => {
  const grant = capacity820Grant(input()),
    encoded = encodeCapacity820Grant(grant);
  assert.equal(grant.minutes, 65);
  assert.equal(grant.qualification, false);
  const env = {
    SOUNDING_LINE_VERIFICATION_CAPACITY_GRANT: encoded.json,
    SOUNDING_LINE_VERIFICATION_CAPACITY_ID: encoded.id,
    SOUNDING_LINE_VERIFICATION_JOB_MINUTES: "65",
  };
  assert.equal(requireCapacity820Grant(grant, env), grant);
  for (const key of Object.keys(env)) {
    assert.throws(() => requireCapacity820Grant(grant, { ...env, [key]: "" }));
  }
  for (const key of ["baseSha", "candidateSha", "candidateTree", "runId"]) {
    const changed = { ...grant, [key]: key === "runId" ? "124" : "d".repeat(40) };
    assert.throws(() => requireCapacity820Grant(changed, env));
  }
  assert.throws(() =>
    requireCapacity820Grant(grant, { ...env, SOUNDING_LINE_VERIFICATION_CAPACITY_GRANT: encoded.json + " " }),
  );
});
test("expiry cannot renew itself and attempts cannot reset capacity", () => {
  for (const patch of [
    { attempt: "2" },
    { sourceDigest: "0".repeat(64) },
    { baseSha: "main" },
    { now: Date.parse(CAPACITY_820.expiresAt) },
    { now: Date.parse(CAPACITY_820.notBefore) - 1 },
    { createdAt: "2026-11-01T17:59:59Z" },
    { createdAt: "2026-11-02T01:00:00Z" },
  ]) {
    assert.throws(() => capacity820Grant({ ...input(), ...patch }));
  }
  const latest = Date.parse(CAPACITY_820.expiresAt) - 65 * 60000;
  assert.equal(capacity820Grant({ ...input(), now: latest }).minutes, 65);
  assert.throws(() => capacity820Grant({ ...input(), now: latest + 1 }));
});
function provider() {
  const repo = () => ({
    id: CAPACITY_820.repositoryId,
    full_name: CAPACITY_820.repository,
    owner: { id: CAPACITY_820.ownerId },
  });
  return {
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    env: { GITHUB_RUN_ID: "123", GITHUB_EVENT_NAME: "pull_request_target" },
    pull: {
      number: 820,
      state: "open",
      merged: false,
      draft: false,
      user: { id: CAPACITY_820.ownerId, login: "Kgray44" },
      base: { sha: "a".repeat(40), repo: repo() },
      head: { sha: "b".repeat(40), repo: repo() },
    },
    run: {
      id: 123,
      run_attempt: 1,
      event: "pull_request_target",
      repository: repo(),
      actor: { id: CAPACITY_820.ownerId },
      path: ".github/workflows/sounding-line-ordinary.yml",
    },
    main: { object: { sha: "a".repeat(40) } },
  };
}
test("provider binding rejects wrong PR, owner, repository, head, base, workflow and attempt", () => {
  validateCapacity820Provider(provider());
  for (const mutate of [
    (p) => p.pull.number++,
    (p) => (p.pull.draft = true),
    (p) => (p.pull.merged = true),
    (p) => p.pull.user.id++,
    (p) => (p.pull.user.login = "other"),
    (p) => p.pull.head.repo.id++,
    (p) => p.pull.base.repo.owner.id++,
    (p) => (p.pull.head.repo.full_name = "other/repo"),
    (p) => (p.pull.head.sha = "c".repeat(40)),
    (p) => (p.pull.base.sha = "c".repeat(40)),
    (p) => (p.main.object.sha = "c".repeat(40)),
    (p) => p.run.id++,
    (p) => p.run.run_attempt++,
    (p) => p.run.actor.id++,
    (p) => p.run.repository.id++,
    (p) => (p.run.event = "push"),
    (p) => (p.run.path = "other.yml"),
  ]) {
    const value = provider();
    mutate(value);
    assert.throws(() => validateCapacity820Provider(value));
  }
});
test("other PRs retain ordinary limits and reject injected grants; PR820 missing context fails", async () => {
  assert.equal(await verificationCapacity820({ env: { SOUNDING_LINE_PR_NUMBER: "819" } }), null);
  await assert.rejects(
    verificationCapacity820({ env: { SOUNDING_LINE_PR_NUMBER: "819", SOUNDING_LINE_VERIFICATION_JOB_MINUTES: "65" } }),
  );
  await assert.rejects(verificationCapacity820({ env: { SOUNDING_LINE_PR_NUMBER: "820" } }));
});
test("workflow output chain and fixed receipt paths do not depend on a verifier step output", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  assert(
    workflow.includes("verification_job_minutes: ${{ steps.verification-capacity.outputs.verification_job_minutes }}"),
  );
  assert(workflow.includes("needs.campaign-custody.outputs.verification_job_minutes || (("));
  const block = workflow.split("- name: Retain verification supervision after every outcome")[1].split("- name:")[0];
  assert(block.includes("always() && steps.route.outputs.kind == 'ordinary'"));
  assert(!block.includes("steps.ordinary-verifier.outputs"));
  for (const name of ["initial", "preflight", "terminal", "controller-failure"])
    assert(block.includes(`session-*/${name}.json`));
  assert(block.includes("if-no-files-found: error"));
});

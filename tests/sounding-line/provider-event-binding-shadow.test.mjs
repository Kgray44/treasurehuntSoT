import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { observeOriginalEventBinding } from "../../scripts/sounding-line/provider-event-binding-shadow.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/native-event-binding-41301367275.json", import.meta.url)));
const encoded = (value) => Buffer.from(JSON.stringify(value));
const make = () => ({
  runBytes: encoded(fixture.run),
  jobsBytes: encoded(fixture.jobs),
  nativeStepLogBytes: Buffer.from(fixture.nativeLogHex, "hex"),
  runId: 41301367275,
  attempt: 1,
  prNumber: 819,
});
const invalid = /SOUNDING_LINE_EVENT_BINDING_SHADOW_/u;
const job = (jobs) => jobs.jobs.find((value) => value.name === "Sounding Line / Focused verification");
function associatedRun(bytes) {
  const run = JSON.parse(bytes);
  // Synthetic mutable association; the preserved native sample after merge has none.
  run.pull_requests = [
    {
      number: 819,
      base: { ref: "main", sha: "a".repeat(40), repo: { id: run.repository.id } },
      head: { ref: run.head_branch, sha: "b".repeat(40), repo: { id: run.repository.id } },
    },
  ];
  return run;
}

test("retained native event-step observation preserves original source despite mutable PR association drift without authenticating it", () => {
  const input = make();
  assert.equal(createHash("sha256").update(input.nativeStepLogBytes).digest("hex"), fixture.nativeLogSha256);
  assert.equal(observeOriginalEventBinding(input).currentAssociation, null);
  const run = associatedRun(input.runBytes);
  run.pull_requests[0].head.sha = "a".repeat(40);
  run.pull_requests[0].base.sha = "b".repeat(40);
  input.runBytes = encoded(run);
  const result = observeOriginalEventBinding(input);
  assert.equal(result.originalBaseSha, "58516ec8b8f3f1a28ded02f3f63f5da2cd8889d8");
  assert.equal(result.originalCandidateSha, "86b6d0bfd1cf5cca3067d4c7d1baf91c27ffe045");
  assert.equal(result.currentAssociation.candidateSha, "a".repeat(40));
  assert.equal(result.currentAssociation.baseSha, "b".repeat(40));
  assert.equal(result.classification, "ORIGINAL_EVENT_STEP_OBSERVATION_NOT_PROVIDER_AUTHENTICATION");
  assert.equal(result.qualification, false);
  assert.equal(result.reuseAuthorized, false);
  assert.equal(authenticatedCompletedReceipt(result, {}), null);
});

test("wrong run, attempt, PR, owner, workflow, repository and finite campaigns fail closed", () => {
  for (const change of [
    (r) => r.id++,
    (r) => r.run_attempt++,
    (r) => {
      r.status = "in_progress";
    },
    (r) => {
      r.event = "workflow_dispatch";
    },
    (r) => {
      r.display_title = r.display_title.replace("ordinary 819", "ordinary 820");
    },
    (r) => {
      r.display_title = r.display_title.replace("active", "draft");
    },
    (r) => {
      r.path = "forged.yml";
    },
    (r) => {
      r.actor.login = "other";
    },
    (r) => r.actor.id++,
    (r) => r.triggering_actor.id++,
    (r) => r.repository.owner.id++,
    (r) => r.head_repository.id++,
    (r) => {
      r.referenced_workflows = [{}];
    },
    (r) => r.pull_requests[0].number++,
    (r) => {
      r.pull_requests[0].base.ref = "other";
    },
    (r) => {
      r.pull_requests[0].head.repo.id++;
    },
    (r) => {
      r.pull_requests.push(r.pull_requests[0]);
    },
    (r) => {
      r.pull_requests = [null];
    },
  ]) {
    const input = make(),
      run = associatedRun(input.runBytes);
    change(run);
    input.runBytes = encoded(run);
    assert.throws(() => observeOriginalEventBinding(input), invalid);
  }
  for (const prNumber of [721, 776, 0, 1.5, "819"])
    assert.throws(() => observeOriginalEventBinding({ ...make(), prNumber }), invalid);
});

test("provider job order and the exact pre-candidate binding step cannot be replaced by later candidate output", () => {
  for (const change of [
    (j) => j.total_count++,
    (j) => {
      j.jobs.push(job(j));
      j.total_count++;
    },
    (j) => (job(j).id = 0),
    (j) => job(j).run_attempt++,
    (j) => {
      job(j).steps[0].name = "Execute candidate";
    },
    (j) => {
      job(j).steps[1].number = 3;
    },
    (j) => {
      job(j).steps[1].name = "Candidate log imitation";
    },
    (j) => {
      job(j).steps[1].conclusion = "failure";
    },
    (j) => {
      job(j).steps[1].completed_at = "2026-11-01T11:22:09Z";
    },
    (j) => {
      job(j).steps[2].started_at = "2026-11-01T11:22:09Z";
    },
    (j) => {
      job(j).steps[1] = null;
    },
  ]) {
    const input = make(),
      jobs = JSON.parse(input.jobsBytes);
    change(jobs);
    input.jobsBytes = encoded(jobs);
    assert.throws(() => observeOriginalEventBinding(input), invalid);
  }
});

test("native log framing, exact rendered source, event type, timestamps and bounded input reject ambiguity", () => {
  const source = make().nativeStepLogBytes.toString("utf8");
  for (const text of [
    source.replaceAll("86b6d0bfd1cf5cca3067d4c7d1baf91c27ffe045", "c".repeat(40)),
    source.replaceAll("pull_request_target", "workflow_dispatch"),
    source.replace("base=58516", "base=INVALID58516"),
    source.replace('echo "base=', 'echo "base=').replace(' >> "$GITHUB_OUTPUT"', ' >> "$GITHUB_OUTPUT"; echo forged'),
    source.replace("11:22:10.5611357Z", "11:22:11.5611357Z"),
    source + "forged\n",
    source.trimEnd(),
    source.replace("##[endgroup]", "##[endgroup]\u0000"),
    source.replace("\u001b[36;1m", "\u001b[31m"),
  ])
    assert.throws(() => observeOriginalEventBinding({ ...make(), nativeStepLogBytes: Buffer.from(text) }), invalid);
  for (const bytes of [Buffer.from([255]), Buffer.alloc(16385), Buffer.alloc(0)])
    assert.throws(() => observeOriginalEventBinding({ ...make(), nativeStepLogBytes: bytes }), invalid);
  for (const bytes of [encoded(null), encoded([]), Buffer.from("{"), Buffer.alloc(2 * 1024 * 1024 + 1)])
    assert.throws(() => observeOriginalEventBinding({ ...make(), runBytes: bytes }), invalid);
});

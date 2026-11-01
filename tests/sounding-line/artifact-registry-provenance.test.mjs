import assert from "node:assert/strict";
import test from "node:test";
import { validateRegistryProviderMetadata } from "../../scripts/sounding-line/artifact-registry-provenance.mjs";
const repo = { id: 10, full_name: "Kgray44/treasurehuntSoT" };
const binding = {
  repository: repo.full_name,
  prNumber: 819,
  runId: 101,
  attempt: 2,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  sourceBindingsDigest: "c".repeat(64),
  jobKey: "experience-preparation",
};
function fixture(conclusion = "failure") {
  const path = ".github/workflows/sounding-line-ordinary.yml";
  return structuredClone({
    binding,
    artifactId: 501,
    trustedActors: ["Kgray44"],
    run: {
      id: 101,
      run_attempt: 2,
      repository: repo,
      head_repository: { ...repo },
      event: "workflow_dispatch",
      head_branch: "main",
      head_sha: binding.baseSha,
      path,
      status: "completed",
      conclusion,
      referenced_workflows: [],
      actor: { id: 20, login: "Kgray44" },
      triggering_actor: { id: 20, login: "Kgray44" },
      workflow_id: 301,
    },
    workflow: { id: 301, path, state: "active" },
    artifact: {
      id: 501,
      name: "sounding-line-context-registry-v2-101-2",
      expired: false,
      size_in_bytes: 1000,
      digest: "sha256:" + "d".repeat(64),
      workflow_run: {
        id: 101,
        repository_id: 10,
        head_repository_id: 10,
        head_sha: binding.baseSha,
        head_branch: "main",
      },
    },
    jobs: {
      total_count: 1,
      jobs: [
        {
          id: 401,
          name: "Sounding Line / Experience preparation (no mainline decision)",
          run_id: 101,
          run_attempt: 2,
          head_sha: binding.baseSha,
          status: "completed",
          conclusion,
          steps: [
            "Checkout exact protected authority",
            "Checkout exact ordinary ancestry and installed reader closure",
            "Prepare through protected-base authority",
            "Seal completed-context registry after parent cleanup",
            "Retain encrypted v2 context registry",
          ].map((name, index) => ({
            name,
            number: index + 1,
            status: "completed",
            conclusion: index === 2 ? conclusion : "success",
          })),
        },
      ],
    },
  });
}
test("a failed or cancelled producer's retained prefix never becomes whole-run acceptance", () => {
  for (const outcome of ["success", "failure", "cancelled"]) {
    const result = validateRegistryProviderMetadata(fixture(outcome));
    assert.equal(result.classification, "PROVIDER_METADATA_JOIN_NOT_AUTHENTICATED");
    assert.equal(result.qualification, false);
    assert.equal(result.reuseAuthorized, false);
    assert.equal(result.originalCandidateSha, binding.candidateSha);
    assert.equal(result.attempt, 2);
  }
});
for (const [name, change] of [
  ["finite owner scope", (x) => (x.binding.prNumber = 776)],
  ["run attempt", (x) => (x.run.run_attempt = 1)],
  ["candidate used as workflow source", (x) => (x.run.head_sha = binding.candidateSha)],
  ["candidate event", (x) => (x.run.event = "pull_request")],
  ["fork", (x) => (x.run.head_repository.id = 99)],
  ["untrusted actor", (x) => (x.run.actor.login = "other-owner")],
  ["changed triggering actor", (x) => (x.run.triggering_actor.id = 99)],
  ["reusable workflow", (x) => (x.run.referenced_workflows = [{ path: "other.yml" }])],
  ["running producer", (x) => (x.run.status = "in_progress")],
  ["unknown conclusion", (x) => (x.run.conclusion = "timed_out")],
  ["workflow identity", (x) => (x.workflow.id = 99)],
  ["expired artifact", (x) => (x.artifact.expired = true)],
  ["old attempt artifact", (x) => (x.artifact.name = "sounding-line-context-registry-v2-101-1")],
  ["foreign artifact", (x) => (x.artifact.workflow_run.repository_id = 99)],
  ["unbounded archive", (x) => (x.artifact.size_in_bytes = 10 * 1024 * 1024)],
  ["unrecognized digest", (x) => (x.artifact.digest = "self-hashed")],
  ["truncated jobs", (x) => (x.jobs.total_count = 2)],
  [
    "ambiguous job",
    (x) => {
      x.jobs.jobs.push(structuredClone(x.jobs.jobs[0]));
      x.jobs.total_count = 2;
    },
  ],
  ["wrong job head", (x) => (x.jobs.jobs[0].head_sha = binding.candidateSha)],
  ["failed upload", (x) => (x.jobs.jobs[0].steps[4].conclusion = "failure")],
  ["cleanup seal after upload", (x) => (x.jobs.jobs[0].steps[3].number = 99)],
  ["failed checkout", (x) => (x.jobs.jobs[0].steps[1].conclusion = "failure")],
])
  test(`provider observation rejects ${name}`, () => {
    const input = fixture();
    change(input);
    assert.throws(() => validateRegistryProviderMetadata(input), /REGISTRY_PROVENANCE_/u);
  });

// Structural provider join only. Callers must authenticate transport, installed
// producer source, archive bytes and decrypted registry separately. Uploaded or
// serialized copies of this result grant no authority.
import { ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM } from "./artifact-registry-archive.mjs";
const repository = "Kgray44/treasurehuntSoT";
const workflowPath = ".github/workflows/sounding-line-ordinary.yml";
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_REGISTRY_PROVENANCE_${code}`);
};
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const sha = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
export function validateRegistryProviderMetadata({
  binding,
  artifactId,
  artifact,
  run,
  workflow,
  jobs,
  trustedActors,
}) {
  need(
    binding?.repository === repository && binding.jobKey === "experience-preparation" && positive(artifactId),
    "BINDING",
  );
  need(
    [binding.prNumber, binding.runId, binding.attempt].every(positive) && ![721, 776, 805].includes(binding.prNumber),
    "ORDINARY_SCOPE",
  );
  need(
    sha(binding.baseSha) && sha(binding.candidateSha) && /^[a-f0-9]{64}$/u.test(binding.sourceBindingsDigest ?? ""),
    "BINDING",
  );
  need(
    Array.isArray(trustedActors) &&
      trustedActors.length > 0 &&
      trustedActors.length <= 100 &&
      new Set(trustedActors).size === trustedActors.length &&
      trustedActors.every((actor) => typeof actor === "string" && /^[A-Za-z0-9-]{1,39}$/u.test(actor)),
    "OWNER_POLICY",
  );
  need(
    run?.id === binding.runId &&
      run.run_attempt === binding.attempt &&
      positive(run.repository?.id) &&
      run.repository.full_name === repository &&
      run.head_repository?.id === run.repository.id &&
      run.head_repository.full_name === repository,
    "RUN_IDENTITY",
  );
  need(
    run.event === "workflow_dispatch" &&
      run.head_branch === "main" &&
      run.head_sha === binding.baseSha &&
      run.path === workflowPath &&
      run.status === "completed" &&
      ["success", "failure", "cancelled"].includes(run.conclusion) &&
      Array.isArray(run.referenced_workflows) &&
      run.referenced_workflows.length === 0,
    "RUN_SOURCE",
  );
  need(
    positive(run.actor?.id) &&
      trustedActors.includes(run.actor.login) &&
      run.triggering_actor?.id === run.actor.id &&
      run.triggering_actor.login === run.actor.login,
    "RUN_OWNER",
  );
  need(
    positive(workflow?.id) &&
      run.workflow_id === workflow.id &&
      workflow.path === workflowPath &&
      workflow.state === "active",
    "WORKFLOW",
  );
  need(
    artifact?.id === artifactId &&
      artifact.name === `sounding-line-context-registry-v2-${binding.runId}-${binding.attempt}` &&
      artifact.expired === false &&
      positive(artifact.size_in_bytes) &&
      artifact.size_in_bytes <= ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM &&
      /^sha256:[a-f0-9]{64}$/u.test(artifact.digest ?? ""),
    "ARTIFACT",
  );
  need(
    artifact.workflow_run?.id === run.id &&
      artifact.workflow_run.repository_id === run.repository.id &&
      artifact.workflow_run.head_repository_id === run.repository.id &&
      artifact.workflow_run.head_sha === binding.baseSha &&
      artifact.workflow_run.head_branch === "main",
    "ARTIFACT_RUN",
  );
  need(
    positive(jobs?.total_count) &&
      Array.isArray(jobs.jobs) &&
      jobs.jobs.length === jobs.total_count &&
      jobs.total_count <= 100,
    "JOBS_INCOMPLETE",
  );
  const matching = jobs.jobs.filter(
    (job) => job.name === "Sounding Line / Experience preparation (no mainline decision)",
  );
  need(matching.length === 1, "JOB_AMBIGUOUS");
  const job = matching[0];
  need(
    positive(job.id) &&
      job.run_id === run.id &&
      job.run_attempt === binding.attempt &&
      job.head_sha === binding.baseSha &&
      job.status === "completed" &&
      ["success", "failure", "cancelled"].includes(job.conclusion) &&
      Array.isArray(job.steps) &&
      job.steps.length <= 100,
    "JOB",
  );
  const step = (name, outcomes) => {
    const found = job.steps.filter((item) => item.name === name);
    need(
      found.length === 1 &&
        positive(found[0].number) &&
        found[0].status === "completed" &&
        outcomes.includes(found[0].conclusion),
      "STEP",
    );
    return found[0];
  };
  const authority = step("Checkout exact protected authority", ["success"]);
  const checkout = step("Checkout exact ordinary ancestry and installed reader closure", ["success"]);
  const prepare = step("Prepare through protected-base authority", ["success", "failure", "cancelled"]);
  const seal = step("Seal completed-context registry after parent cleanup", ["success"]);
  const upload = step("Retain encrypted v2 context registry", ["success"]);
  need(
    authority.number < checkout.number &&
      checkout.number < prepare.number &&
      prepare.number < seal.number &&
      seal.number < upload.number,
    "STEP_ORDER",
  );
  return {
    classification: "PROVIDER_METADATA_JOIN_NOT_AUTHENTICATED",
    repository,
    artifactId,
    artifactDigest: artifact.digest,
    archiveBytes: artifact.size_in_bytes,
    runId: run.id,
    attempt: binding.attempt,
    jobId: job.id,
    owner: run.actor.login,
    originalBaseSha: binding.baseSha,
    originalCandidateSha: binding.candidateSha,
    qualification: false,
    reuseAuthorized: false,
  };
}

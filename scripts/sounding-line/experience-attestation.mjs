import {
  isReviewedEvidenceAdoption,
  historicalReviewedPlan,
  validateReviewedIdentity,
  reviewedEvidenceAdoption,
} from "./experience-reviewed-adoption.mjs";
import { validatePreSourceCaptureBinding } from "./experience-review-source-gate.mjs";
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { experienceDigest } from "./product-experience.mjs";
import { verifyExceptionAttestation } from "./experience-exception.mjs";
import { r8FormatEvidencePlan, validateR8FormatEvidenceIdentity } from "./experience-r8-format.mjs";
import { isCurrentAdmissionPlan, validateCurrentCaptureIdentity } from "./experience-current-admission.mjs";
import { mediaFirstReviewProvenanceBinding } from "./experience-media-first-binding.mjs";
import {
  createBoundedArtifactIntake,
  createLocalMediaArtifactIntake,
  intakeResponse,
  readBoundedArtifactMetadata,
} from "./experience-artifact-intake.mjs";
import { capacityBinding, EXPERIENCE_INTAKE_LIMITS } from "./experience-capacity.mjs";

const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_${code}`);
};
export function artifactJson(archive, filename) {
  // Read the named file through the ZIP central directory, never extract paths.
  for (let offset = 0; offset + 46 <= archive.length; offset++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (name !== filename && name !== `artifacts/sounding-line/product-experience-submission/${filename}`) continue;
    const method = archive.readUInt16LE(offset + 10);
    const size = archive.readUInt32LE(offset + 20);
    const expected = archive.readUInt32LE(offset + 24);
    const local = archive.readUInt32LE(offset + 42);
    if (archive.readUInt32LE(local) !== 0x04034b50 || expected > 8 * 1024 * 1024) fail("ATTESTATION_ARCHIVE_INVALID");
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const compressed = archive.subarray(start, start + size);
    const bytes =
      method === 0
        ? compressed
        : method === 8
          ? inflateRawSync(compressed, { maxOutputLength: 8 * 1024 * 1024 })
          : null;
    if (!bytes || bytes.length !== expected) fail("ATTESTATION_ARCHIVE_INVALID");
    try {
      return JSON.parse(bytes.toString());
    } catch {
      fail("ATTESTATION_JSON_INVALID");
    }
  }
  fail("ATTESTATION_MANIFEST_MISSING");
}
export function validateAttestationProvenance({ artifact, run, workflow, plan, kind, repository, actors }) {
  const expectedName = `product-experience-${kind}-${plan.sourceDigest.slice(0, 16)}`;
  if (
    artifact.expired ||
    artifact.name !== expectedName ||
    !/^sha256:[a-f0-9]{64}$/u.test(artifact.digest ?? "") ||
    artifact.workflow_run?.id !== run.id ||
    run.event !== "workflow_dispatch" ||
    run.head_branch !== "main" ||
    run.head_sha !== plan.baseSha ||
    run.head_repository?.full_name !== repository ||
    !actors.includes(run.actor?.login) ||
    workflow.path !== ".github/workflows/sounding-line-ordinary.yml" ||
    run.conclusion !== "success" ||
    (plan.exception && (run.run_attempt !== 1 || run.triggering_actor?.login !== run.actor?.login))
  )
    fail("ATTESTATION_PROVENANCE_INVALID");
  return true;
}
function frozenContext(value) {
  const copy = structuredClone(value),
    queue = [copy],
    seen = new Set();
  while (queue.length) {
    const item = queue.pop();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    if (seen.size >= 100000) fail("ATTESTATION_CONTEXT_LIMIT");
    seen.add(item);
    queue.push(...Object.values(item));
    Object.freeze(item);
  }
  return copy;
}
function provenanceIdentity(artifact, run, workflow) {
  return experienceDigest({
    artifact: {
      id: artifact.id,
      name: artifact.name,
      expired: artifact.expired,
      expires_at: artifact.expires_at,
      digest: artifact.digest,
      size_in_bytes: artifact.size_in_bytes,
      runId: artifact.workflow_run?.id,
    },
    run: {
      id: run.id,
      run_attempt: run.run_attempt,
      workflow_id: run.workflow_id,
      event: run.event,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      repository: run.head_repository?.full_name,
      actor: run.actor?.login,
      triggering_actor: run.triggering_actor?.login,
      conclusion: run.conclusion,
    },
    workflow: { id: workflow.id, path: workflow.path },
  });
}
export async function loadTrustedExperienceArtifact(options) {
  return trustedArtifactSession(options, (manifest) => manifest, false);
}
export async function withTrustedLocalExperienceArtifact(options, action) {
  if (typeof action !== "function") fail("LOCAL_MEDIA_ACTION_REQUIRED");
  return trustedArtifactSession(options, action, true);
}
async function trustedArtifactSession(
  { root, intakeRoot = root, plan, artifactId, kind, policy, request, signal, measure },
  action,
  localMedia,
) {
  if (!Number.isSafeInteger(artifactId) || artifactId < 1) fail("TRUSTED_ATTESTATION_REQUIRED");
  plan = frozenContext(plan);
  policy = frozenContext(policy);
  if (!["capture", "review"].includes(kind) || !Array.isArray(policy?.trustedReviewActors))
    fail("ATTESTATION_PROVENANCE_INVALID");
  const deadline = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(localMedia ? 900000 : EXPERIENCE_INTAKE_LIMITS.timeoutMs),
  ]);
  deadline.throwIfAborted();
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim();
  const repository = process.env.GITHUB_REPOSITORY ?? remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/u)?.[1];
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) fail("ATTESTATION_REPOSITORY_INVALID");
  let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!request && !token) {
    try {
      token = execFileSync("gh", ["auth", "token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
        maxBuffer: 65536,
      }).trim();
    } catch {
      fail("ATTESTATION_ACCESS_UNAVAILABLE");
    }
  }
  const responseFor = async (endpoint, binary = false, activeSignal = deadline) => {
    if (request) {
      // Retain the established in-memory injection seam for synthetic fixtures.
      // Production transport below never buffers the complete artifact.
      const value = await request(endpoint, binary);
      if (value instanceof Response) return value;
      return new Response(binary ? value : JSON.stringify(value), { status: 200 });
    }
    return fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
      signal: activeSignal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Accept-Encoding": "identity",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  };
  const api = async (endpoint) =>
    readBoundedArtifactMetadata(
      await intakeResponse((activeSignal) => responseFor(endpoint, false, activeSignal), deadline),
      deadline,
    );
  const artifact = frozenContext(await api(`actions/artifacts/${artifactId}`));
  if (!Number.isSafeInteger(artifact.workflow_run?.id) || artifact.workflow_run.id < 1)
    fail("ATTESTATION_PROVENANCE_INVALID");
  const run = frozenContext(await api(`actions/runs/${artifact.workflow_run?.id}`));
  if (!Number.isSafeInteger(run.workflow_id) || run.workflow_id < 1) fail("ATTESTATION_PROVENANCE_INVALID");
  const workflow = frozenContext(await api(`actions/workflows/${run.workflow_id}`));
  const validate = (artifact, run, workflow) => {
    validateAttestationProvenance({
      artifact,
      run,
      workflow,
      plan,
      kind,
      repository,
      actors: policy.trustedReviewActors,
    });
    if (
      artifact.id !== artifactId ||
      !Number.isSafeInteger(run.id) ||
      !Number.isSafeInteger(run.run_attempt) ||
      !Number.isSafeInteger(run.workflow_id) ||
      workflow.id !== run.workflow_id ||
      !Number.isSafeInteger(artifact.size_in_bytes) ||
      artifact.size_in_bytes < 22 ||
      artifact.size_in_bytes > EXPERIENCE_INTAKE_LIMITS.archiveBytes ||
      !Number.isFinite(Date.parse(artifact.expires_at)) ||
      Date.parse(artifact.expires_at) <= Date.now()
    )
      fail("ATTESTATION_PROVENANCE_INVALID");
  };
  validate(artifact, run, workflow);
  const binding = capacityBinding({
    repository,
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    planDigest: experienceDigest(plan),
    runId: String(run.id),
    runAttempt: String(run.run_attempt),
  });
  const factory = localMedia ? createLocalMediaArtifactIntake : createBoundedArtifactIntake;
  const result = await factory({
    root: localMedia ? intakeRoot : root,
    ...(localMedia && measure ? { measure } : {}),
  }).withArtifact(
    {
      binding,
      expectedBytes: artifact.size_in_bytes,
      expectedDigest: artifact.digest,
      signal: deadline,
      request: (activeSignal) => responseFor(`actions/artifacts/${artifactId}/zip`, true, activeSignal),
    },
    async (archive) => {
      const manifest = await archive.readJson(`${kind}.json`);
      if (
        manifest.baseSha !== plan.baseSha ||
        manifest.sourceDigest !== plan.sourceDigest ||
        manifest.contractDigest !== plan.contractDigest ||
        (plan.exception && experienceDigest(manifest.exception) !== experienceDigest(plan.exception))
      )
        fail("ATTESTATION_SOURCE_MISMATCH");
      const afterArtifact = await api(`actions/artifacts/${artifactId}`);
      const afterRun = await api(`actions/runs/${run.id}`);
      const afterWorkflow = await api(`actions/workflows/${run.workflow_id}`);
      validate(afterArtifact, afterRun, afterWorkflow);
      if (provenanceIdentity(artifact, run, workflow) !== provenanceIdentity(afterArtifact, afterRun, afterWorkflow))
        fail("ATTESTATION_PROVENANCE_CHANGED");
      deadline.throwIfAborted();
      const trustedManifest = frozenContext({
        ...manifest,
        trustedArtifact: { id: artifact.id, digest: artifact.digest, runId: run.id, runAttempt: run.run_attempt },
      });
      const value = await action(trustedManifest, archive);
      if (localMedia) {
        const finalArtifact = await api(`actions/artifacts/${artifactId}`),
          finalRun = await api(`actions/runs/${run.id}`),
          finalWorkflow = await api(`actions/workflows/${run.workflow_id}`);
        validate(finalArtifact, finalRun, finalWorkflow);
        if (provenanceIdentity(artifact, run, workflow) !== provenanceIdentity(finalArtifact, finalRun, finalWorkflow))
          fail("ATTESTATION_PROVENANCE_CHANGED");
      }
      deadline.throwIfAborted();
      return value;
    },
  );
  validate(artifact, run, workflow);
  deadline.throwIfAborted();
  return result;
}
export async function verifyTrustedExperienceAttestation({
  root,
  plan,
  evidence,
  custodyRequest,
  loadArtifact = loadTrustedExperienceArtifact,
}) {
  if (!plan.applicable) return { status: "NOT_APPLICABLE" };
  if (!plan.attestationPolicy?.required) fail("TRUSTED_ATTESTATION_POLICY_MISSING");
  const currentPlan = plan;
  if (isReviewedEvidenceAdoption(plan)) {
    validateReviewedIdentity(plan, evidence);
    plan = historicalReviewedPlan(plan);
  }
  validateR8FormatEvidenceIdentity(plan, evidence);
  plan = r8FormatEvidencePlan(plan);
  const capture = await loadArtifact({
    root,
    plan,
    artifactId: evidence.captureArtifactId,
    kind: "capture",
    policy: plan.attestationPolicy,
  });
  const review = await loadArtifact({
    root,
    plan,
    artifactId: evidence.reviewArtifactId,
    kind: "review",
    policy: plan.attestationPolicy,
  });
  validateCurrentCaptureIdentity(isReviewedEvidenceAdoption(currentPlan) ? plan : currentPlan, capture, evidence);
  validatePreSourceCaptureBinding(
    isReviewedEvidenceAdoption(currentPlan) ? plan : currentPlan,
    evidence,
    capture,
    undefined,
    root,
  );
  const identities = (artifacts) =>
    artifacts.map(({ id, sha256, type, contractId, state, device, role, motionMode }) => ({
      id,
      sha256,
      type,
      contractId,
      state,
      device,
      role,
      motionMode,
    }));
  if (
    experienceDigest(identities(capture.artifacts)) !== experienceDigest(identities(evidence.artifacts)) ||
    experienceDigest(capture.journeys) !== experienceDigest(evidence.journeys) ||
    experienceDigest(capture.pairedEvidence ?? null) !== experienceDigest(evidence.pairedEvidence ?? null) ||
    (plan.paired && review.pairedEvidenceDigest !== experienceDigest(evidence.pairedEvidence)) ||
    review.captureArtifactId !== evidence.captureArtifactId ||
    experienceDigest(review.reviews) !== experienceDigest(evidence.reviews) ||
    Object.entries(
      mediaFirstReviewProvenanceBinding(isReviewedEvidenceAdoption(currentPlan) ? plan : currentPlan, evidence),
    ).some(([key, value]) => review[key] !== value)
  )
    fail("TRUSTED_CAPTURE_OR_REVIEW_MISMATCH");
  const exceptionCustody = await verifyExceptionAttestation({
    root,
    plan: currentPlan,
    evidence,
    capture,
    review,
    request: custodyRequest,
  });
  return {
    status: "PASS",
    ...reviewedEvidenceAdoption(currentPlan),
    ...(exceptionCustody ? { exception: currentPlan.exception, exceptionCustody } : {}),
    ...(isCurrentAdmissionPlan(currentPlan)
      ? {
          currentBaseSha: currentPlan.baseSha,
          currentSourceDigest: currentPlan.sourceDigest,
          currentContractDigest: currentPlan.contractDigest,
          currentCandidateSha: currentPlan.candidateSha,
        }
      : {}),
    ...(currentPlan.exception?.nonExecutingReconciliation
      ? {
          currentBaseSha: currentPlan.baseSha,
          currentSourceDigest: currentPlan.sourceDigest,
          reviewedBaseSha: plan.baseSha,
          reviewedSourceDigest: plan.sourceDigest,
          nonExecutingReconciliation: currentPlan.exception.nonExecutingReconciliation,
        }
      : {}),
    captureArtifactId: evidence.captureArtifactId,
    reviewArtifactId: evidence.reviewArtifactId,
    provenance: "PROTECTED_WORKFLOW_AUTHENTICATED_SUBMISSION",
    ownerAcceptance: "NOT_CLAIMED",
  };
}

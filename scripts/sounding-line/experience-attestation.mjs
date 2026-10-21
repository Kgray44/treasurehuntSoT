import { isR24, r24HistoricalPlan, validateR24ReviewedIdentity, r24Adoption } from "./experience-current-r24.mjs";
import { validatePreSourceCaptureBinding } from "./experience-review-source-gate.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { experienceDigest } from "./product-experience.mjs";
import { verifyExceptionAttestation } from "./experience-exception.mjs";
import { r8FormatEvidencePlan, validateR8FormatEvidenceIdentity } from "./experience-r8-format.mjs";
import { isCurrentAdmissionPlan, validateCurrentCaptureIdentity } from "./experience-current-admission.mjs";
import { mediaFirstReviewProvenanceBinding } from "./experience-media-first-binding.mjs";

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
export async function loadTrustedExperienceArtifact({ root, plan, artifactId, kind, policy, request }) {
  if (!Number.isSafeInteger(artifactId) || artifactId < 1) fail("TRUSTED_ATTESTATION_REQUIRED");
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim();
  const repository = process.env.GITHUB_REPOSITORY ?? remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/u)?.[1];
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) fail("ATTESTATION_REPOSITORY_INVALID");
  let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!request && !token) {
    try {
      token = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      fail("ATTESTATION_ACCESS_UNAVAILABLE");
    }
  }
  const api =
    request ??
    (async (endpoint, binary = false) => {
      const response = await fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!response.ok) fail(`ATTESTATION_ACCESS_FAILED_${response.status}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
    });
  const artifact = await api(`actions/artifacts/${artifactId}`);
  const run = await api(`actions/runs/${artifact.workflow_run?.id}`);
  const workflow = await api(`actions/workflows/${run.workflow_id}`);
  validateAttestationProvenance({
    artifact,
    run,
    workflow,
    plan,
    kind,
    repository,
    actors: policy.trustedReviewActors,
  });
  const archive = await api(`actions/artifacts/${artifactId}/zip`, true);
  if (`sha256:${createHash("sha256").update(archive).digest("hex")}` !== artifact.digest)
    fail("ATTESTATION_ARCHIVE_DIGEST_MISMATCH");
  const manifest = artifactJson(archive, `${kind}.json`);
  if (
    manifest.baseSha !== plan.baseSha ||
    manifest.sourceDigest !== plan.sourceDigest ||
    manifest.contractDigest !== plan.contractDigest ||
    (plan.exception && experienceDigest(manifest.exception) !== experienceDigest(plan.exception))
  )
    fail("ATTESTATION_SOURCE_MISMATCH");
  return {
    ...manifest,
    trustedArtifact: { id: artifact.id, digest: artifact.digest, runId: run.id, runAttempt: run.run_attempt },
  };
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
  if (isR24(plan)) {
    validateR24ReviewedIdentity(plan, evidence);
    plan = r24HistoricalPlan(plan);
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
  validateCurrentCaptureIdentity(isR24(currentPlan) ? plan : currentPlan, capture, evidence);
  validatePreSourceCaptureBinding(isR24(currentPlan) ? plan : currentPlan, evidence, capture, undefined, root);
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
    Object.entries(mediaFirstReviewProvenanceBinding(isR24(currentPlan) ? plan : currentPlan, evidence)).some(
      ([key, value]) => review[key] !== value,
    )
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
    ...r24Adoption(currentPlan),
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

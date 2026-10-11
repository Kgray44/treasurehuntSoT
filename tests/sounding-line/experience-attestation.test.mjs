import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAttestationProvenance,
  verifyTrustedExperienceAttestation,
} from "../../scripts/sounding-line/experience-attestation.mjs";

const plan = {
  applicable: true,
  baseSha: "a".repeat(40),
  sourceDigest: "b".repeat(64),
  contractDigest: "c".repeat(64),
  attestationPolicy: { required: true, trustedReviewActors: ["Kgray44"] },
};
function provenance() {
  return {
    artifact: {
      name: "product-experience-capture-" + "b".repeat(16),
      expired: false,
      digest: "sha256:" + "d".repeat(64),
      workflow_run: { id: 12 },
    },
    run: {
      id: 12,
      event: "workflow_dispatch",
      head_branch: "main",
      head_sha: plan.baseSha,
      head_repository: { full_name: "Kgray44/treasurehuntSoT" },
      actor: { login: "Kgray44" },
      conclusion: "success",
    },
    workflow: { path: ".github/workflows/sounding-line-ordinary.yml" },
    plan,
    kind: "capture",
    repository: "Kgray44/treasurehuntSoT",
    actors: ["Kgray44"],
  };
}
test("only protected-base, authenticated workflow artifacts establish capture provenance", () => {
  assert.equal(validateAttestationProvenance(provenance()), true);
});
for (const [name, mutation] of [
  [
    "candidate workflow cannot attest itself",
    (value) => {
      value.run.head_sha = "e".repeat(40);
    },
  ],
  [
    "untrusted actor cannot submit review",
    (value) => {
      value.run.actor.login = "candidate-bot";
    },
  ],
  [
    "ordinary PR cannot self-authorize review",
    (value) => {
      value.run.event = "pull_request";
    },
  ],
  [
    "another workflow is not an acceptance authority",
    (value) => {
      value.workflow.path = ".github/workflows/untrusted.yml";
    },
  ],
  [
    "expired artifact is not reusable evidence",
    (value) => {
      value.artifact.expired = true;
    },
  ],
  [
    "artifact without immutable digest is rejected",
    (value) => {
      delete value.artifact.digest;
    },
  ],
  [
    "failed submission is not accepted",
    (value) => {
      value.run.conclusion = "failure";
    },
  ],
  [
    "another source capture cannot be relabeled",
    (value) => {
      value.artifact.name = "product-experience-capture-wrong-source";
    },
  ],
])
  test(name, () => {
    const value = provenance();
    mutation(value);
    assert.throws(() => validateAttestationProvenance(value), /ATTESTATION_PROVENANCE_INVALID/u);
  });

test("reviewed artifact metadata and journey claims must match trusted capture", async () => {
  const capture = {
    artifacts: [
      {
        id: "screen",
        sha256: "f".repeat(64),
        type: "screenshot",
        state: "READY",
        device: "MOBILE",
        role: "PLAYER",
        motionMode: "REDUCED",
      },
    ],
    journeys: [{ id: "natural-entry", status: "PASS" }],
  };
  const review = {
    captureArtifactId: 10,
    reviews: [{ reviewerContext: "/root/independent-review", status: "ACCEPTED" }],
  };
  const evidence = {
    captureArtifactId: 10,
    reviewArtifactId: 11,
    ...structuredClone(capture),
    reviews: structuredClone(review.reviews),
  };
  const verify = () =>
    verifyTrustedExperienceAttestation({
      root: "unused",
      plan,
      evidence,
      loadArtifact: async ({ kind }) => (kind === "capture" ? capture : review),
    });
  assert.equal((await verify()).status, "PASS");
  evidence.artifacts[0].state = "ERROR";
  await assert.rejects(verify(), /TRUSTED_CAPTURE_OR_REVIEW_MISMATCH/u);
  evidence.artifacts[0].state = "READY";
  evidence.reviews[0].reviewerContext = "fabricated-reviewer";
  await assert.rejects(verify(), /TRUSTED_CAPTURE_OR_REVIEW_MISMATCH/u);
});
test("mandatory trusted attestation cannot be silently disabled by a missing policy", async () => {
  await assert.rejects(
    verifyTrustedExperienceAttestation({ root: "unused", plan: { ...plan, attestationPolicy: null }, evidence: {} }),
    /TRUSTED_ATTESTATION_POLICY_MISSING/u,
  );
});

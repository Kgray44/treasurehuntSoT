import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  attestationArchiveDigest,
  artifactJson,
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
  evidence.artifacts[0].contractId = "another-contract";
  await assert.rejects(verify(), /TRUSTED_CAPTURE_OR_REVIEW_MISMATCH/u);
  delete evidence.artifacts[0].contractId;
  evidence.reviews[0].reviewerContext = "fabricated-reviewer";
  await assert.rejects(verify(), /TRUSTED_CAPTURE_OR_REVIEW_MISMATCH/u);
});
test("mandatory trusted attestation cannot be silently disabled by a missing policy", async () => {
  await assert.rejects(
    verifyTrustedExperienceAttestation({ root: "unused", plan: { ...plan, attestationPolicy: null }, evidence: {} }),
    /TRUSTED_ATTESTATION_POLICY_MISSING/u,
  );
});

test("archive digest hashes bounded chunks, a nonzero Buffer view and its final partial chunk", () => {
  const size = 8 * 1024 * 1024;
  const backing = Buffer.alloc(3 * size + 31, 0x59);
  const archive = backing.subarray(13, backing.length - 7);
  archive[0] = 0x11;
  archive[archive.length - 1] = 0x82;
  const expected = "sha256:" + createHash("sha256").update(archive).digest("hex");
  const ranges = [];
  const subarray = archive.subarray.bind(archive);
  archive.subarray = (start, end) => {
    const part = subarray(start, end);
    assert(part.length <= size, "every crypto input must remain at most8MiB");
    ranges.push([start, Math.min(end, archive.length)]);
    return part;
  };
  assert.equal(attestationArchiveDigest(archive), expected);
  assert.deepEqual(ranges, [
    [0, size],
    [size, 2 * size],
    [2 * size, 3 * size],
    [3 * size, archive.length],
  ]);
});
test("archive digest preserves empty input and detects a changed final byte", () => {
  const empty = Buffer.alloc(0);
  assert.equal(attestationArchiveDigest(empty), "sha256:" + createHash("sha256").digest("hex"));
  const archive = Buffer.alloc(8 * 1024 * 1024 + 1, 0x42);
  const first = attestationArchiveDigest(archive);
  archive[archive.length - 1] ^= 1;
  assert.notEqual(attestationArchiveDigest(archive), first);
});
function attestationZipFixture(name, content, { method = 0, expected = content.length, badLocal = false } = {}) {
  const filename = Buffer.from(name),
    compressed = method === 8 ? deflateRawSync(content) : content;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(badLocal ? 0 : 0x04034b50, 0);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(expected, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE(0, 42);
  return Buffer.concat([local, filename, compressed, central, filename]);
}
test("chunked hash does not change stored/deflated manifest selection or the8MiB bound", () => {
  const payload = Buffer.from(JSON.stringify({ sourceDigest: "current", unchanged: true }));
  for (const method of [0, 8])
    for (const name of ["capture.json", "artifacts/sounding-line/product-experience-submission/capture.json"]) {
      const archive = attestationZipFixture(name, payload, { method });
      assert.equal(attestationArchiveDigest(archive), "sha256:" + createHash("sha256").update(archive).digest("hex"));
      assert.deepEqual(artifactJson(archive, "capture.json"), { sourceDigest: "current", unchanged: true });
    }
  assert.throws(
    () =>
      artifactJson(attestationZipFixture("capture.json", payload, { expected: 8 * 1024 * 1024 + 1 }), "capture.json"),
    /ATTESTATION_ARCHIVE_INVALID/u,
  );
  assert.throws(
    () => artifactJson(attestationZipFixture("capture.json", payload, { method: 99 }), "capture.json"),
    /ATTESTATION_ARCHIVE_INVALID/u,
  );
  assert.throws(
    () => artifactJson(attestationZipFixture("capture.json", payload, { badLocal: true }), "capture.json"),
    /ATTESTATION_ARCHIVE_INVALID/u,
  );
  assert.throws(
    () => artifactJson(attestationZipFixture("untrusted/capture.json", payload), "capture.json"),
    /ATTESTATION_MANIFEST_MISSING/u,
  );
});
test("invalid JSON and oversized deflate stay rejected by the original manifest reader", () => {
  assert.throws(
    () => artifactJson(attestationZipFixture("capture.json", Buffer.from("{")), "capture.json"),
    /ATTESTATION_JSON_INVALID/u,
  );
  const oversized = Buffer.alloc(8 * 1024 * 1024 + 1, 0x20);
  assert.throws(() =>
    artifactJson(
      attestationZipFixture("capture.json", oversized, { method: 8, expected: 8 * 1024 * 1024 }),
      "capture.json",
    ),
  );
});

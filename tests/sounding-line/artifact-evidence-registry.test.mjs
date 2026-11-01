import { artifactRegistryFixture } from "./fixtures/artifact-registry-v2.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { planArtifactPreservationShadow } from "../../scripts/sounding-line/artifact-preservation-shadow.mjs";
import {
  createArtifactDependencyGraph,
  artifactDependencyClosure,
} from "../../scripts/sounding-line/artifact-dependency-graph.mjs";
import {
  artifactLogicalKey,
  sealArtifactManifest,
  validateArtifactManifest,
  createClosedContextCheckpoint,
} from "../../scripts/sounding-line/artifact-evidence-registry.mjs";

const base = "a".repeat(40),
  candidate = "b".repeat(40);
const fixture = artifactRegistryFixture;

test("a complete v2 registry validates only as untrusted retention data", () => {
  const manifest = fixture();
  const result = validateArtifactManifest(manifest, { expectedCoverage: manifest.requiredCoverage });
  assert.equal(result.requiredCoverage, 6);
  assert.equal(result.completedContexts, 1);
  assert.equal(result.authentication, "RETENTION_ONLY_NOT_AUTHENTICATED");
  assert.equal(result.qualification, false);
});

test("shadow preservation joins complete closure and byte bindings without granting reuse or rewriting originals", () => {
  const graph = createArtifactDependencyGraph([
    { id: "context", type: "CONTEXT", digest: digest("context"), dependencies: [] },
  ]);
  const closure = artifactDependencyClosure(graph, ["context"]);
  const manifest = fixture({ graphDigest: graph.graphDigest, dependencyClosureDigest: closure.closureDigest });
  const model = {
    graph,
    requiredCoverage: manifest.requiredCoverage,
    contexts: [{ id: "context", dependencies: ["context"], requiredCoverage: manifest.requiredCoverage }],
    artifactDefinitions: manifest.artifacts.map((value) => ({
      contextId: "context",
      logicalKey: value.logicalKey,
      definitionFingerprint: value.definitionFingerprint,
      dependencyClosureDigest: closure.closureDigest,
    })),
  };
  const result = planArtifactPreservationShadow({ original: model, current: model, manifest, prNumber: 900 });
  assert.equal(result.plans[0].disposition, "WOULD_PRESERVE_COMPLETE_CONTEXT");
  assert.deepEqual(result.plans[0].originalArtifacts, manifest.artifacts);
  assert.deepEqual(result.plans[0].originalContext, manifest.completedContexts[0]);
  assert.equal(result.reuseAuthorized, false);
  assert.equal(result.plans[0].differentialReviewRequired, true);
  result.plans[0].originalArtifacts[0].id = "mutated";
  assert.equal(manifest.artifacts[0].id, "original-artifact-0");
  for (const mutation of [
    (value) => {
      value.artifactDefinitions[0].definitionFingerprint = digest("changed");
    },
    (value) => {
      value.artifactDefinitions[0].dependencyClosureDigest = digest("changed");
    },
    (value) => {
      value.graph = createArtifactDependencyGraph([
        { id: "context", type: "CONTEXT", digest: digest("changed"), dependencies: [] },
      ]);
    },
    (value) => {
      value.graph = createArtifactDependencyGraph([
        { id: "context", type: "CONTEXT", digest: digest("context"), dependencies: [], unknown: true },
      ]);
    },
  ]) {
    const current = structuredClone(model);
    mutation(current);
    assert.equal(
      planArtifactPreservationShadow({ original: model, current, manifest, prNumber: 900 }).plans[0].disposition,
      "FRESH",
    );
  }
  for (const prNumber of [721, 776, 805])
    assert.throws(
      () => planArtifactPreservationShadow({ original: model, current: model, manifest, prNumber }),
      /ORDINARY_SCOPE_REQUIRED/u,
    );
  assert.throws(
    () =>
      planArtifactPreservationShadow({
        original: { ...model, graph: { ...graph, graphDigest: digest("forged") } },
        current: model,
        manifest,
        prNumber: 900,
      }),
    /ORIGINAL_GRAPH_MISMATCH/u,
  );
});

test("a closed checkpoint preserves original identities while excluding unfinished contexts", () => {
  const manifest = fixture();
  const original = structuredClone(manifest);
  manifest.completedContexts.push({ id: "unfinished", status: "RUNNING", artifactIds: [] });
  manifest.artifacts.push({ id: "unfinished-artifact" });
  const checkpoint = createClosedContextCheckpoint(manifest, "original-context", {
    expectedCoverage: original.requiredCoverage,
  });
  assert.deepEqual(checkpoint.artifacts, original.artifacts);
  assert.deepEqual(checkpoint.completedContexts, original.completedContexts);
  assert.equal(checkpoint.originalCandidateSha, original.originalCandidateSha);
  assert.equal(checkpoint.fullRequiredCoverageDigest, original.fullRequiredCoverageDigest);
  assert.equal(checkpoint.kind, "CLOSED_CONTEXT_CHECKPOINT");
  assert.throws(() => validateArtifactManifest(checkpoint), /PARTIAL_MANIFEST_NOT_ACCEPTANCE/u);
  checkpoint.artifacts[0].id = "mutated-return";
  assert.equal(manifest.artifacts[0].id, original.artifacts[0].id);
});

test("checkpoint projection cannot bypass cleanup, coverage, or context identity", () => {
  const manifest = fixture();
  const options = { expectedCoverage: manifest.requiredCoverage };
  assert.throws(() => createClosedContextCheckpoint(manifest, "original-context"), /EXPECTED_COVERAGE_REQUIRED/u);
  assert.throws(() => createClosedContextCheckpoint(manifest, "missing", options), /CONTEXT_IDENTITY/u);
  for (const change of [
    (value) => {
      value.runtimeCleanupReceipts[0].status = "FAIL";
    },
    (value) => {
      value.artifacts.pop();
    },
    (value) => {
      value.completedContexts[0].closed = false;
    },
    (value) => {
      value.artifacts[0].originalCandidateSha = "d".repeat(40);
    },
  ]) {
    const broken = structuredClone(manifest);
    change(broken);
    assert.throws(
      () => createClosedContextCheckpoint(broken, "original-context", options),
      /SOUNDING_LINE_ARTIFACT_REGISTRY_/u,
    );
  }
});

test("content identity never substitutes for a different logical state", () => {
  const manifest = fixture({ secondScreenshot: true });
  assert.equal(manifest.artifacts[0].objectSha256, manifest.artifacts.at(-1).objectSha256);
  assert.notEqual(
    artifactLogicalKey(manifest.artifacts[0].logicalKey),
    artifactLogicalKey(manifest.artifacts.at(-1).logicalKey),
  );
  assert.equal(validateArtifactManifest(manifest).requiredCoverage, 7);
  manifest.artifacts.pop();
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), /MISSING_REQUIRED_COVERAGE/u);
});

for (const [name, mutate, code] of [
  [
    "missing coverage",
    (m) => {
      m.artifacts.pop();
    },
    /MISSING_REQUIRED_COVERAGE/u,
  ],
  [
    "duplicate coverage",
    (m) => {
      m.requiredCoverage.push(m.requiredCoverage[0]);
    },
    /DUPLICATE_REQUIRED_COVERAGE/u,
  ],
  [
    "substituted object",
    (m) => {
      m.artifacts[0].objectSha256 = digest("substitution");
    },
    /CONTEXT_BYTE_BINDING/u,
  ],
  [
    "rewritten candidate identity",
    (m) => {
      m.artifacts[0].originalCandidateSha = "d".repeat(40);
    },
    /UNBOUND_FOREIGN_ARTIFACT/u,
  ],
  [
    "incomplete context",
    (m) => {
      m.completedContexts[0].closed = false;
    },
    /INCOMPLETE_CONTEXT/u,
  ],
  [
    "missing closed context",
    (m) => {
      m.completedContexts = [];
      m.journeyReceipts = [];
    },
    /ARTIFACT_CONTEXT_UNCLOSED/u,
  ],
  [
    "failed runtime cleanup",
    (m) => {
      m.runtimeCleanupReceipts[0].portsClosed = false;
    },
    /RUNTIME_CLEANUP_INCOMPLETE/u,
  ],
  [
    "missing runtime witness",
    (m) => {
      m.runtimeAttestations = [];
    },
    /RUNTIME_CLEANUP_INCOMPLETE/u,
  ],
  [
    "journey scope substitution",
    (m) => {
      m.journeyReceipts[0].artifactIds = ["missing"];
    },
    /JOURNEY_ARTIFACT_SCOPE/u,
  ],
  [
    "absolute immutable location",
    (m) => {
      m.artifacts[0].immutableLocation.path = "C:/outside";
    },
    /IMMUTABLE_LOCATION/u,
  ],
  [
    "path traversal",
    (m) => {
      m.artifacts[0].immutableLocation.path = "context/../outside";
    },
    /IMMUTABLE_LOCATION/u,
  ],
  [
    "unexpected media",
    (m) => {
      m.artifacts[0].mediaType = "text/html";
    },
    /MEDIA_TYPE/u,
  ],
  [
    "forged release authority",
    (m) => {
      m.qualification = true;
    },
    /RETENTION_IDENTITY/u,
  ],
])
  test(`rejects ${name} even after the manifest is self-rehashed`, () => {
    const manifest = fixture();
    mutate(manifest);
    assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), code);
  });

test("a closed-context checkpoint cannot stand in for a complete final manifest", () => {
  const manifest = sealArtifactManifest({ ...fixture(), kind: "CLOSED_CONTEXT_CHECKPOINT" });
  assert.throws(() => validateArtifactManifest(manifest), /PARTIAL_MANIFEST_NOT_ACCEPTANCE/u);
  assert.equal(validateArtifactManifest(manifest, { requireComplete: false }).completedContexts, 1);
  const wrong = fixture().requiredCoverage.map((key) => ({ ...key, role: "OTHER_OWNER" }));
  assert.throws(
    () => validateArtifactManifest(manifest, { requireComplete: false, expectedCoverage: wrong }),
    /EXPECTED_COVERAGE_MISMATCH/u,
  );
});

test("inheritance adds a current binding while every original source identity remains intact", () => {
  const parent = fixture();
  const current = structuredClone(parent);
  current.manifestId = "successor-manifest";
  current.originalBaseSha = "d".repeat(40);
  current.originalCandidateSha = "e".repeat(40);
  current.producerIdentity = { ...current.producerIdentity, runId: 102, workflowSha: current.originalBaseSha };
  current.inheritance = current.artifacts.map((artifact) => ({
    artifactId: artifact.id,
    originalArtifactId: artifact.id,
    originalManifestDigest: parent.manifestDigest,
    exactIntervalProofDigest: digest("independent interval proof"),
    originalBaseSha: artifact.originalBaseSha,
    originalCandidateSha: artifact.originalCandidateSha,
    currentCandidateSha: current.originalCandidateSha,
    lineage: [parent.manifestDigest],
  }));
  const sealed = sealArtifactManifest(current);
  assert.equal(validateArtifactManifest(sealed).artifacts, 6);
  assert.equal(sealed.completedContexts[0].originalCandidateSha, candidate);
  assert.equal(sealed.artifacts[0].originalCandidateSha, candidate);
  sealed.inheritance[0].lineage.push(parent.manifestDigest);
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(sealed)), /LINEAGE_CYCLE_OR_BOUND/u);
});

test("review metadata cannot reset a spent ordinal or silently change its scope", () => {
  const manifest = fixture();
  manifest.reviewReceipts = [
    {
      id: "original-review",
      contractId: "contract",
      originalOrdinal: 3,
      originalCandidateSha: candidate,
      originalPacketDigest: digest("original packet"),
      artifactIds: manifest.artifacts.map((artifact) => artifact.id),
      priorFindingIds: ["original-blocker"],
    },
  ];
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), /UNAUTHORIZED_REVIEW_ORDINAL/u);
  assert.equal(
    validateArtifactManifest(sealArtifactManifest(manifest), { spentReviewOrdinals: { contract: 3 } }).qualification,
    false,
  );
  manifest.reviewReceipts[0].originalOrdinal = 1;
  assert.throws(
    () => validateArtifactManifest(sealArtifactManifest(manifest), { spentReviewOrdinals: { contract: 3 } }),
    /UNAUTHORIZED_REVIEW_ORDINAL/u,
  );
});

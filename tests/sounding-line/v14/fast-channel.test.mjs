import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTypedPreparedLayerManifest } from "../../../scripts/sounding-line/v14/foundation.mjs";
import {
  deriveV14WorkerPreparation,
  deriveWorkerPreparation,
} from "../../../scripts/sounding-line/worker-preparation.mjs";
import {
  FileEvidenceStore,
  FileLayerTransport,
  V14_FAILURE_ROUTES,
  V14_RISK_FLOORS,
  closeReleaseCandidate,
  contentManifestFromDirectory,
  finalizeV14,
  importLegacyEvidence,
  prepareV14Worker,
  sealedRecord,
  selectV14Mainline,
  typedFailure,
  validateLayerConsumption,
  validateSelfHostedPreparedEvidence,
  validateV14Binding,
  verifySealedRecord,
} from "../../../scripts/sounding-line/v14/fast-channel.mjs";

const sha = (letter) => letter.repeat(40);
const fingerprint = (value = "fingerprint") => ({ fingerprintDigest: value });
const identity = { candidateSha: sha("a"), gate: "mainline", policyDigest: "policy", fingerprintDigest: "fingerprint" };
const receipt = (id, overrides = {}) => ({
  id,
  obligationId: "unit.example",
  fingerprint: fingerprint(),
  producer: "governed-worker",
  planDigest: "plan",
  authorityVersion: "1.4",
  candidateSha: identity.candidateSha,
  gate: identity.gate,
  policyDigest: identity.policyDigest,
  ...overrides,
});

test("durable evidence is canonical, immutable, producer-unique, and lineage verifies ancestors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-evidence-"));
  try {
    const store = new FileEvidenceStore(root);
    const fresh = await store.writeFreshReceipt(receipt("fresh"));
    assert.equal(verifySealedRecord(fresh, "receipts").valid, true);
    assert.equal((await store.resolveCurrentProducer("unit.example", identity)).id, "fresh");
    await assert.rejects(store.writeFreshReceipt(receipt("fresh")), /EEXIST/);
    await store.writeFreshReceipt(receipt("duplicate"));
    await assert.rejects(store.resolveCurrentProducer("unit.example", identity), /DUPLICATE_PRODUCER/);
    const uniqueRoot = await mkdtemp(path.join(os.tmpdir(), "sl14-lineage-"));
    const chainStore = new FileEvidenceStore(uniqueRoot);
    await chainStore.writeFreshReceipt(receipt("origin"));
    await chainStore.deriveReceipt({
      originalReceiptId: "origin",
      receipt: receipt("rebound"),
      priorFingerprint: fingerprint(),
      currentFingerprint: fingerprint(),
      decision: { disposition: "REBOUND", reasonCodes: ["BASE_MOVED"] },
      changedInterval: { oldBase: sha("b"), newBase: sha("c") },
    });
    assert.equal((await chainStore.readLineage("rebound")).length, 1);
    assert.equal((await chainStore.resolveCurrentProducer("unit.example", identity)).id, "rebound");
    await writeFile(path.join(uniqueRoot, "receipts", "origin.json"), "{}\n");
    await assert.rejects(chainStore.readLineage("rebound"), /CORRUPT_RECEIPT/);
    await rm(uniqueRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("risk floors and unknown mapping produce sealed, explained plans without silent omission", () => {
  const suites = [
    { id: "static.core", domains: ["security"] },
    { id: "unit.auth", domains: ["security"] },
    { id: "browser.navigation", domains: ["navigation"], dependencies: ["unit.auth"] },
    { id: "unit.unrelated", domains: ["feature"] },
  ];
  const known = selectV14Mainline({
    changedPaths: ["src/app/nav.ts"],
    suites,
    conditionalSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [{ path: "src/app/**", suiteIds: ["browser.navigation"] }], contractMappings: [] },
  });
  assert.equal(verifySealedRecord(known, "plan").valid, true);
  assert.equal(known.ledger.find((entry) => entry.suiteId === "browser.navigation").selected, true);
  assert.ok(known.selectedSuiteIds.includes("unit.auth"));
  assert.equal(known.nodes.find((entry) => entry.id === "browser.navigation").execution.wave, 1);
  assert.equal(
    known.ledger.find((entry) => entry.suiteId === "unit.unrelated").selectionReason,
    "SEMANTICALLY_UNCHANGED",
  );
  const unknown = selectV14Mainline({
    changedPaths: ["unknown/new.ts"],
    changedContracts: ["debt-contract"],
    suites,
    conditionalSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    mappingDebt: [{ contractId: "debt-contract", owner: "owner-a" }],
  });
  assert.equal(unknown.fallback.disposition, "CONSERVATIVE_FALLBACK");
  assert.ok(unknown.ledger.every((entry) => entry.selected));
  assert.equal(unknown.ledger[0].debt[0].owner, "owner-a");
  assert.ok(V14_RISK_FLOORS.some((entry) => entry.id === "persistence"));
});

test("release closure, typed recovery, and legacy adoption fail closed", () => {
  const failed = closeReleaseCandidate({
    mandatoryObligationIds: ["a", "b"],
    producers: [
      { id: "one", obligationId: "a" },
      { id: "two", obligationId: "a" },
    ],
  });
  assert.equal(failed.decision, "REJECT");
  assert.ok(failed.errors.some((entry) => entry.startsWith("DUPLICATE_PRODUCER")));
  assert.equal(V14_FAILURE_ROUTES.CORRUPT_LAYER, "REJECT");
  assert.deepEqual(typedFailure("MAPPING_DEBT"), { code: "MAPPING_DEBT", recovery: "CONSERVATIVE_EXPAND" });
  const adoption = importLegacyEvidence({
    receipt: { result: "PASSED" },
    immutableFacts: {},
    currentFingerprint: fingerprint(),
    compatibility: {
      v13AuthorityIdentity: "v1.3",
      v14AuthorityIdentity: "v1.4",
      suiteIdentity: "unit.example",
      requiredReconstructedInputs: ["policy"],
      prohibitedAssumptions: ["missing identities"],
    },
  });
  assert.notEqual(adoption.requiredAction, "ADOPT");
});

test("v1.4 finalization requires one sealed current producer and clean owned resources", () => {
  const plan = sealedRecord("plan", {
    authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE",
    candidateSha: sha("a"),
    policyDigest: "policy",
  });
  const producer = sealedRecord("receipts", {
    id: "proof",
    obligationId: "a",
    authorityVersion: "1.4",
    planDigest: plan.digest,
    candidateSha: sha("a"),
    policyDigest: "policy",
  });
  const cleanup = {
    version: "1.4",
    resources: [
      {
        id: "tmp",
        type: "temporary-workspace",
        allocated: "tmp",
        createdIdentity: "tmp",
        leaseOwner: "run",
        cleanupAction: "remove",
        cleanupTimestamp: "2026-08-13T00:00:00.000Z",
        finalState: "ABSENT",
        result: "CLEAN",
      },
    ],
  };
  assert.equal(
    finalizeV14({ plan, requiredObligationIds: ["a"], producers: [producer], cleanup, runId: "run" }).decision,
    "V14_QUALIFIED",
  );
  assert.equal(
    finalizeV14({ plan, requiredObligationIds: ["a"], producers: [producer, producer], cleanup, runId: "run" })
      .decision,
    "V14_QUALIFICATION_NO_GO",
  );
});

test("content-addressed layer transport rehashes bytes and worker prep never shares mutable state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-layer-"));
  try {
    const source = path.join(root, "source");
    const destination = path.join(root, "destination");
    await (await import("node:fs/promises")).mkdir(source);
    await writeFile(path.join(source, "module.txt"), "trusted bytes");
    const contentManifest = await contentManifestFromDirectory(source);
    const manifest = createTypedPreparedLayerManifest({
      layerType: "dependency",
      sourceInputs: {
        packageJsonDigest: "package",
        packageLockDigest: "lock",
        nodeVersion: "22",
        npmVersion: "11",
        os: process.platform,
        architecture: process.arch,
        nativeDependencyClass: "none",
        installPolicyDigest: "npm-ci",
      },
      contentManifest,
      producer: "trusted",
      platform: { os: process.platform, arch: process.arch },
      policyDigest: "policy",
      securityScan: { status: "CLEAN" },
      retentionClass: "shared",
      consumerConstraints: { os: process.platform, architecture: process.arch },
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    const transport = new FileLayerTransport(path.join(root, "transport"), { trustedProducers: ["trusted"] });
    await transport.publish(manifest, source);
    const restored = await transport.restore(manifest.identityDigest, destination);
    assert.equal(restored.hit, true);
    const preparation = prepareV14Worker({
      planNode: { id: "unit.example" },
      layers: [{ identity: manifest.identityDigest }],
      restoreResults: [restored],
      runId: "run-1",
      mutableResources: [{ id: "sqlite-run-1", type: "sqlite-clone" }],
    });
    assert.equal(preparation.layerResults[0].action, "RESTORE_VERIFIED_READ_ONLY");
    assert.equal(preparation.mutableResources[0].leaseOwner, "run-1");
    await writeFile(path.join(root, "transport", manifest.identityDigest, "content", "module.txt"), "poisoned");
    await assert.rejects(transport.restore(manifest.identityDigest, path.join(root, "other")), /LAYER_CONTENT_CORRUPT/);
    assert.equal(
      validateLayerConsumption({ ...manifest, revocationState: "REVOKED" }, { trustedProducers: ["trusted"] }).valid,
      false,
    );
    assert.equal(
      validateLayerConsumption(
        { ...manifest, retentionState: { expiresAt: "2020-01-01T00:00:00.000Z" } },
        { trustedProducers: ["trusted"] },
      ).code,
      "EXPIRED_EVIDENCE",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lightweight binding rejects identity, cleanup, evidence, and layer failures without product execution", () => {
  const plan = sealedRecord("plan", {
    authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE",
    authorityVersion: "1.4",
    candidateSha: sha("a"),
    candidateTreeSha: sha("b"),
    qualifiedBaseSha: sha("c"),
    qualifiedBaseTreeSha: sha("d"),
  });
  const cleanup = {
    version: "1.4",
    resources: [
      {
        id: "temp",
        type: "temporary-workspace",
        allocated: "tmp",
        createdIdentity: "path",
        leaseOwner: "run-1",
        cleanupAction: "remove",
        cleanupTimestamp: "2026-08-13T00:00:00.000Z",
        finalState: "ABSENT",
        result: "CLEAN",
      },
    ],
  };
  const binding = validateV14Binding({
    plan,
    finalization: { planDigest: plan.digest, authorityVersion: "1.4", runId: "run-1" },
    evidence: [],
    cleanup,
  });
  assert.equal(binding.decision, "QUALIFIED");
  assert.equal(binding.heavyProofExecuted, false);
  const rejected = validateV14Binding({
    plan: { ...plan, candidateTreeSha: "not-a-sha" },
    finalization: { planDigest: plan.digest, authorityVersion: "1.4", runId: "run-1" },
    cleanup,
  });
  assert.equal(rejected.decision, "REJECT");
  assert.ok(
    rejected.errors.includes("AUTHORITY_VERSION_MISMATCH") || rejected.errors.includes("TREE_IDENTITY_MISMATCH"),
  );
});

test("v1.3 worker preparation is unchanged and v1.4 preparation is explicitly version gated", () => {
  assert.equal(deriveWorkerPreparation({ id: "static.core", adapter: "static", resources: [] }).version, 1);
  assert.throws(
    () =>
      deriveV14WorkerPreparation({ plan: { authorityVersion: "1.3" }, node: { id: "unit.example" }, runId: "run-1" }),
    /V14_WORKER_AUTHORITY_BOUNDARY_REQUIRED/,
  );
  const plan = {
    authorityVersion: "1.4",
    authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE",
    nodes: [{ id: "unit.example", adapter: "static", resources: [], preparedLayers: [] }],
  };
  const preparation = deriveV14WorkerPreparation({ plan, node: plan.nodes[0], runId: "run-1" });
  assert.equal(preparation.authorityBoundary, "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE");
  assert.equal(preparation.runtimeConformance.result, "PASSED");
  assert.equal(
    deriveV14WorkerPreparation({
      plan: { ...plan, authorityBoundary: "CURRENT_AUTHORITATIVE_V14" },
      node: plan.nodes[0],
      runId: "run-1",
    }).runtimeConformance.result,
    "PASSED",
  );
  const candidatePreparation = deriveV14WorkerPreparation({
    plan: { ...plan, authorityBoundary: "V14_CANDIDATE_QUALIFICATION" },
    node: plan.nodes[0],
    runId: "run-1",
  });
  assert.equal(candidatePreparation.authorityBoundary, "V14_CANDIDATE_QUALIFICATION");
  assert.equal(candidatePreparation.runtimeConformance.result, "PASSED");
  assert.throws(
    () =>
      deriveV14WorkerPreparation({
        plan: { ...plan, authorityBoundary: "UNRECOGNIZED_AUTHORITY_BOUNDARY" },
        node: plan.nodes[0],
        runId: "run-1",
      }),
    /V14_WORKER_AUTHORITY_BOUNDARY_REQUIRED/u,
  );
});

test("future self-hosted consumers fail closed without approved identity, attestation, run ownership, and scrub proof", () => {
  const attestation = {
    workerId: "approved-worker",
    bootAttestationDigest: "a".repeat(64),
    runtimeAttestationDigest: "b".repeat(64),
    layerIdentity: "layer-identity",
    layerMutable: false,
    owner: "team-a",
    workspace: { owner: "team-a", runId: "run-1", runOwned: true },
    scrub: { owner: "team-a", runId: "run-1", result: "CLEAN", finalState: "ABSENT" },
    staleState: false,
    tampered: false,
  };
  const options = {
    layerIdentity: "layer-identity",
    runId: "run-1",
    owner: "team-a",
    approvedWorkers: ["approved-worker"],
  };
  assert.equal(validateSelfHostedPreparedEvidence({ attestation, ...options }).valid, true);
  assert.equal(
    validateSelfHostedPreparedEvidence({ attestation: { ...attestation, workerId: "unknown" }, ...options }).code,
    "SELF_HOSTED_WORKER_UNAPPROVED",
  );
  assert.equal(
    validateSelfHostedPreparedEvidence({ attestation: { ...attestation, staleState: true }, ...options }).code,
    "SELF_HOSTED_STALE_STATE_REJECTED",
  );
  assert.equal(
    validateSelfHostedPreparedEvidence({ attestation: { ...attestation, tampered: true }, ...options }).code,
    "SELF_HOSTED_TAMPER_REJECTED",
  );
  assert.equal(
    validateSelfHostedPreparedEvidence({ attestation: { ...attestation, owner: "wrong" }, ...options }).code,
    "SELF_HOSTED_OWNER_MISMATCH",
  );
  assert.equal(
    validateSelfHostedPreparedEvidence({
      attestation: { ...attestation, scrub: { ...attestation.scrub, result: "DIRTY" } },
      ...options,
    }).code,
    "SELF_HOSTED_SCRUB_PROOF_REQUIRED",
  );
});

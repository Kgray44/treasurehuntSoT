import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildShadowPlan,
  canonicalJson,
  classifyImpact,
  compareEvidenceFingerprints,
  createEvidenceFingerprint,
  createEvidenceLineage,
  createPreparedLayerManifest,
  createTypedPreparedLayerManifest,
  createTreeIdentity,
  deriveContractClosure,
  reconstructLegacyEvidence,
  treesEqual,
  validateCleanupManifest,
  verifyPreparedLayerManifest,
} from "../../../scripts/sounding-line/v14/foundation.mjs";
import {
  buildSyntheticIntegrationTree,
  rebuildAfterWithdrawal,
} from "../../../scripts/sounding-line/v14/synthetic-tree.mjs";

const exec = (file, args, options = {}) =>
  new Promise((resolve, reject) =>
    execFile(file, args, options, (error, stdout, stderr) =>
      error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim()),
    ),
  );
const sha = (letter) => letter.repeat(40);
const fingerprintInput = (overrides = {}) => ({
  suiteId: "unit.example",
  protectedContractIds: ["beta", "alpha"],
  sourceClosureDigest: "source",
  contractClosureDigest: "contracts",
  testDefinitionDigest: "tests",
  fixtureDigest: "fixtures",
  schemaDigest: "schema",
  migrationDigest: "migrations",
  dependencyDigest: "lock",
  toolchainDigest: "node",
  browserDigest: "browser",
  runtimeEnvironmentDigest: "runtime",
  policyDigest: "policy",
  authorityDigest: "authority",
  adapterDigest: "adapter",
  resourceDeclarationDigest: "resources",
  originalSourceSha: sha("a"),
  originalTreeSha: sha("b"),
  ...overrides,
});

test("fingerprints are deterministic, canonical, and detect each material identity", () => {
  const first = createEvidenceFingerprint(fingerprintInput({ protectedContractIds: ["beta", "alpha"] }));
  const second = createEvidenceFingerprint(fingerprintInput({ protectedContractIds: ["alpha", "beta"] }));
  assert.equal(first.fingerprintDigest, second.fingerprintDigest);
  assert.equal(first.protectedContractIds.join(","), "alpha,beta");
  for (const field of [
    "sourceClosureDigest",
    "contractClosureDigest",
    "testDefinitionDigest",
    "fixtureDigest",
    "schemaDigest",
    "migrationDigest",
    "dependencyDigest",
    "toolchainDigest",
    "browserDigest",
    "policyDigest",
  ]) {
    const changed = createEvidenceFingerprint(fingerprintInput({ [field]: `changed-${field}` }));
    assert.ok(compareEvidenceFingerprints({ prior: first, current: changed }).changedFields.includes(field));
  }
  assert.equal(canonicalJson({ b: [2, 1], a: { z: 1, y: 2 } }), canonicalJson({ a: { y: 2, z: 1 }, b: [1, 2] }));
});

test("evidence disposition is explicit, fail-closed, and lineage is immutable", () => {
  const prior = createEvidenceFingerprint(fingerprintInput());
  const current = createEvidenceFingerprint(fingerprintInput());
  assert.equal(compareEvidenceFingerprints({ prior, current, priorReceiptId: "receipt-1" }).disposition, "PRESERVED");
  assert.equal(compareEvidenceFingerprints({ prior, current, corruption: true }).disposition, "CORRUPT");
  assert.equal(compareEvidenceFingerprints({ prior: null, current }).disposition, "UNKNOWN_REQUIRES_EXECUTION");
  assert.equal(compareEvidenceFingerprints({ prior: { ...prior, version: 9 }, current }).disposition, "INCOMPATIBLE");
  const lineage = createEvidenceLineage({
    originalReceiptId: "receipt-1",
    priorFingerprint: prior,
    currentFingerprint: current,
    decision: { disposition: "REBOUND", reasonCodes: ["BASE_TREE_EQUAL"] },
  });
  assert.equal(lineage.immutable, true);
  assert.equal(lineage.originalReceiptId, "receipt-1");
});

test("contract closure declares incomplete graph rather than hashing a known subset", () => {
  const closed = deriveContractClosure({
    suiteId: "unit.x",
    directContractIds: ["a"],
    contractRelations: [{ from: "a", to: "b" }],
    knownContractIds: ["a", "b"],
  });
  assert.equal(closed.complete, true);
  assert.deepEqual(closed.contractIds, ["a", "b"]);
  const incomplete = deriveContractClosure({
    suiteId: "unit.x",
    directContractIds: ["a"],
    contractRelations: [{ from: "a", to: "missing" }],
    knownContractIds: ["a"],
  });
  assert.equal(incomplete.state, "INCOMPLETE");
  assert.equal(incomplete.reason, "UNKNOWN_REQUIRES_EXECUTION");
});

test("legacy reconstruction refuses missing runtime, policy, and schema identity", () => {
  const current = createEvidenceFingerprint(fingerprintInput());
  const complete = reconstructLegacyEvidence({
    receipt: { result: "PASSED", ...fingerprintInput() },
    currentFingerprint: current,
  });
  assert.equal(complete.classification, "RECONSTRUCTABLE");
  const partial = reconstructLegacyEvidence({
    receipt: { result: "PASSED", ...fingerprintInput({ runtimeEnvironmentDigest: undefined }) },
    currentFingerprint: current,
  });
  assert.equal(partial.classification, "PARTIALLY_RECONSTRUCTABLE");
  assert.ok(partial.reasonCodes.includes("RERUN_REQUIRED"));
  assert.equal(
    reconstructLegacyEvidence({
      receipt: { result: "PASSED", ...fingerprintInput({ policyDigest: "old" }) },
      currentFingerprint: current,
    }).classification,
    "RERUN_REQUIRED",
  );
  assert.equal(
    reconstructLegacyEvidence({
      receipt: { result: "PASSED", ...fingerprintInput({ schemaDigest: "old" }) },
      currentFingerprint: current,
    }).classification,
    "RERUN_REQUIRED",
  );
});

const impactMap = {
  pathMappings: [
    { path: "src/admiralty/**", suiteIds: ["unit.admiralty"], contractIds: ["admiralty.contract"] },
    { path: "prisma/**", suiteIds: ["database.sqlite"], contractIds: ["schema.contract"] },
  ],
  contractMappings: [
    { contractId: "admiralty.contract", suiteIds: ["unit.admiralty", "component.admiralty"] },
    { contractId: "schema.contract", suiteIds: ["database.sqlite", "migration.mysql"] },
  ],
};

test("impact classification handles direct, transitive, schema, unknown, and unmapped cases conservatively", () => {
  const direct = classifyImpact({
    changedPaths: ["src/admiralty/page.ts"],
    impactMap,
    allSuiteIds: ["static.core", "unit.admiralty"],
    riskFloorSuiteIds: ["static.core"],
  });
  assert.deepEqual(direct.selectedSuiteIds, ["component.admiralty", "static.core", "unit.admiralty"]);
  const schema = classifyImpact({
    changedPaths: ["prisma/schema.prisma"],
    impactMap,
    allSuiteIds: ["static.core", "database.sqlite"],
    riskFloorSuiteIds: ["static.core"],
  });
  assert.ok(schema.selectedSuiteIds.includes("migration.mysql"));
  const unknown = classifyImpact({
    changedPaths: ["new/unknown.ts"],
    impactMap,
    allSuiteIds: ["static.core", "unit.admiralty"],
    riskFloorSuiteIds: ["static.core"],
  });
  assert.equal(unknown.mappingConfidence, "UNKNOWN");
  assert.deepEqual(unknown.selectedSuiteIds, ["static.core", "unit.admiralty"]);
  const unmapped = classifyImpact({
    changedContractIds: ["unmapped"],
    impactMap,
    allSuiteIds: ["static.core", "unit.admiralty"],
    riskFloorSuiteIds: ["static.core"],
  });
  assert.equal(unmapped.mappingConfidence, "UNKNOWN");
  const debt = classifyImpact({
    changedContractIds: ["known-but-unprotected"],
    impactMap,
    mappingDebt: [{ contractId: "known-but-unprotected", classification: "NO_CURRENT_TEST_PROTECTOR" }],
    allSuiteIds: ["static.core", "unit.admiralty"],
    riskFloorSuiteIds: ["static.core"],
  });
  assert.equal(debt.mappingConfidence, "UNKNOWN");
  assert.deepEqual(debt.mappingDebtContracts, ["known-but-unprotected"]);
});

test("shadow comparison never loses a current obligation and explains conditional omission", () => {
  const currentPlan = {
    gate: "mainline",
    planDigest: "plan",
    nodes: [{ id: "static.core" }, { id: "unit.admiralty" }],
  };
  const plan = buildShadowPlan({
    currentPlan,
    gate: { id: "mainline", conditionalSuites: ["component.admiralty", "browser.admiralty"] },
    suites: [
      { id: "static.core" },
      { id: "unit.admiralty" },
      { id: "component.admiralty" },
      { id: "browser.admiralty" },
    ],
    impactMap,
    changedPaths: ["src/admiralty/page.ts"],
    alwaysFreshSpine: ["static.core"],
  });
  assert.equal(plan.comparison.status, "SHADOW_SAFE");
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "component.admiralty").proposedV14, "SELECTED");
  assert.equal(
    plan.ledger.find((entry) => entry.suiteId === "browser.admiralty").reasonCodes[0],
    "CONDITIONAL_NOT_IMPACTED",
  );
});

test("prepared layers are content-addressed, platform-aware, corruption-checked, and immutable", () => {
  const content = [{ path: "node_modules/a", digest: "a", bytes: 1 }];
  const manifest = createPreparedLayerManifest({
    layerType: "dependency",
    sourceInputs: { packageLockDigest: "lock", node: "22", npm: "10", installFlags: ["ci"] },
    contentManifest: content,
    producer: "test",
    platform: { os: "linux", arch: "x64" },
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(verifyPreparedLayerManifest(manifest, content).valid, true);
  assert.equal(
    verifyPreparedLayerManifest(manifest, [{ ...content[0], digest: "changed" }]).reason,
    "LAYER_CONTENT_CORRUPT",
  );
  assert.throws(
    () =>
      createPreparedLayerManifest({
        layerType: "browser-profile",
        sourceInputs: {},
        contentManifest: content,
        producer: "test",
        platform: {},
      }),
    /MUTABLE_RESOURCE_REJECTED/,
  );
  const typed = {
    dependency: {
      packageLockDigest: "lock",
      nodeVersion: "22",
      npmVersion: "11",
      os: "linux",
      arch: "x64",
      installPolicy: "npm-ci",
    },
    "prisma-generated": {
      dependencyLayerIdentity: "dependency",
      prismaVersion: "6",
      schemaDigest: "schema",
      generatorConfiguration: "client",
      os: "linux",
      arch: "x64",
    },
    chromium: { playwrightVersion: "1", browserRevision: "100", os: "linux", arch: "x64" },
    webkit: { playwrightVersion: "1", browserRevision: "200", os: "linux", arch: "x64" },
    "sqlite-baseline": {
      schemaDigest: "schema",
      migrationDigest: "migrations",
      seedFixtureDigest: "seed",
      prismaIdentity: "prisma",
      sqliteRuntimeIdentity: "sqlite",
      baselineVersion: "1",
    },
  };
  for (const [layerType, sourceInputs] of Object.entries(typed))
    assert.equal(
      createTypedPreparedLayerManifest({
        layerType,
        sourceInputs,
        contentManifest: content,
        producer: "test",
        platform: { os: "linux", arch: "x64" },
      }).mutable,
      false,
    );
  assert.throws(
    () =>
      createTypedPreparedLayerManifest({
        layerType: "dependency",
        sourceInputs: { ...typed.dependency, npmVersion: null },
        contentManifest: content,
        producer: "test",
        platform: {},
      }),
    /PREPARED_LAYER_IDENTITY_INCOMPLETE/,
  );
});

test("tree identity distinguishes commit from content identity", () => {
  const one = createTreeIdentity({
    commitSha: sha("a"),
    treeSha: sha("b"),
    baseSha: sha("c"),
    baseTreeSha: sha("d"),
    candidateSha: sha("e"),
    candidateTreeSha: sha("f"),
    resultingIntegrationTreeSha: sha("b"),
    mergeMethod: "test",
  });
  const two = { ...one, commitSha: sha("f") };
  assert.equal(treesEqual(one, two), true);
  assert.equal(treesEqual(one, { ...two, treeSha: sha("1") }), false);
});

test("cleanup provenance rejects missing cleanup, wrong owners, survivors, and corrupt structure", () => {
  const manifest = {
    version: 1,
    resources: [
      {
        id: "db-1",
        type: "sqlite",
        leaseOwner: "run-1",
        allocated: "tmp/db",
        createdIdentity: "x",
        cleanupAction: "remove",
        cleanupTimestamp: "2026-01-01T00:00:00Z",
        finalState: "ABSENT",
        result: "CLEAN",
      },
    ],
  };
  assert.equal(validateCleanupManifest(manifest, { owner: "run-1" }).valid, true);
  assert.equal(validateCleanupManifest(manifest, { owner: "other" }).valid, false);
  assert.equal(validateCleanupManifest(manifest, { owner: "run-1", existingResourceIds: ["db-1"] }).valid, false);
  assert.equal(validateCleanupManifest({ version: 1 }, { owner: "run-1" }).valid, false);
});

test("synthetic integration trees are deterministic and conflicts, withdrawals, and base changes are explicit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-tree-"));
  const git = (...args) => exec("git", ["-C", root, ...args]);
  try {
    await git("init");
    await git("config", "user.name", "test");
    await git("config", "user.email", "test@example.invalid");
    await writeFile(path.join(root, "base.txt"), "base\n");
    await git("add", ".");
    await git("commit", "-m", "base");
    const base = await git("rev-parse", "HEAD");
    await git("checkout", "-b", "a");
    await writeFile(path.join(root, "a.txt"), "a\n");
    await writeFile(path.join(root, "base.txt"), "a change\n");
    await git("add", ".");
    await git("commit", "-m", "a");
    const a = await git("rev-parse", "HEAD");
    await git("checkout", base);
    await git("checkout", "-b", "b");
    await writeFile(path.join(root, "b.txt"), "b\n");
    await git("add", ".");
    await git("commit", "-m", "b");
    const b = await git("rev-parse", "HEAD");
    const first = await buildSyntheticIntegrationTree({ repoPath: root, baseSha: base, candidateShas: [a, b] });
    const second = await buildSyntheticIntegrationTree({ repoPath: root, baseSha: base, candidateShas: [a, b] });
    assert.equal(first.status, "READY");
    assert.equal(first.resultingTreeSha, second.resultingTreeSha);
    assert.equal(rebuildAfterWithdrawal(first, a).invalidatedCars.length, 2);
    const upstreamOnly = await buildSyntheticIntegrationTree({ repoPath: root, baseSha: base, candidateShas: [a] });
    assert.equal(first.cars[0].identity.resultingIntegrationTreeSha, upstreamOnly.resultingTreeSha);
    await git("checkout", a);
    await git("checkout", "-b", "a-mutation");
    await writeFile(path.join(root, "a.txt"), "a changed\n");
    await git("add", ".");
    await git("commit", "-m", "a mutation");
    const mutated = await buildSyntheticIntegrationTree({
      repoPath: root,
      baseSha: base,
      candidateShas: [await git("rev-parse", "HEAD"), b],
    });
    assert.notEqual(
      mutated.cars[0].identity.resultingIntegrationTreeSha,
      first.cars[0].identity.resultingIntegrationTreeSha,
    );
    await git("checkout", base);
    await git("checkout", "-b", "base-advance");
    await writeFile(path.join(root, "external.txt"), "advance\n");
    await git("add", ".");
    await git("commit", "-m", "base advance");
    const advanced = await buildSyntheticIntegrationTree({
      repoPath: root,
      baseSha: await git("rev-parse", "HEAD"),
      candidateShas: [a, b],
    });
    assert.notEqual(advanced.resultingTreeSha, first.resultingTreeSha);
    await git("checkout", base);
    await git("checkout", "-b", "conflict");
    await writeFile(path.join(root, "base.txt"), "conflict\n");
    await git("add", ".");
    await git("commit", "-m", "conflict");
    const conflict = await buildSyntheticIntegrationTree({
      repoPath: root,
      baseSha: a,
      candidateShas: [await git("rev-parse", "HEAD")],
    });
    assert.equal(conflict.status, "CONFLICT");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

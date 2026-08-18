import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const testingJson = async (name) =>
  JSON.parse(await readFile(new URL(`../../../testing/${name}`, import.meta.url), "utf8"));
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

test("Bridgewatch v1.2 uses its complete mapped impact surface without fresh-selecting unrelated product families", async () => {
  const [suiteInventory, impact] = await Promise.all([testingJson("suites.json"), testingJson("impact-map.json")]);
  const changedPaths = [
    "CHANGELOG.md",
    "Development_Docs/INDEX.md",
    "Development_Docs/Project_Bridgewatch_Phase_3_Deployment_Runbook.md",
    "Development_Docs/Project_Bridgewatch_v1.2_Data_Fidelity_and_Capability_Audit.md",
    "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
    "Development_Docs/Project_Bridgewatch_v1.2_Validation_Record.md",
    "Development_Docs/README.md",
    "Development_Docs/document-index.json",
    "bridgewatch/.env.example",
    "bridgewatch/.gitignore",
    "bridgewatch/README.md",
    "bridgewatch/lib/github.ts",
    "bridgewatch/lib/server.ts",
    "bridgewatch/lib/store.ts",
    "bridgewatch/package.json",
    "bridgewatch/public/app.js",
    "bridgewatch/public/index.html",
    "bridgewatch/public/style.css",
    "bridgewatch/scripts/bridgewatch-lifecycle.ps1",
    "bridgewatch/src/comparison.ts",
    "bridgewatch/src/discovery.ts",
    "bridgewatch/src/domain.ts",
    "bridgewatch/src/history.ts",
    "bridgewatch/src/reconciliation.ts",
    "bridgewatch/src/repository-evidence.ts",
    "bridgewatch/src/sounding-line.ts",
    "bridgewatch/test/comparison.test.ts",
    "bridgewatch/test/discovery.test.ts",
    "bridgewatch/test/github.test.ts",
    "bridgewatch/test/history.test.ts",
    "bridgewatch/test/mission-control-ui.test.ts",
    "bridgewatch/test/reconciliation.test.ts",
    "bridgewatch/test/repository-evidence.test.ts",
    "bridgewatch/test/server.test.ts",
    "bridgewatch/test/sounding-line-projection.test.ts",
    "bridgewatch/test/store.test.ts",
    "deploy/nginx.conf",
    "scripts/sounding-line/status-projection.mjs",
    "src/admiralty/bridgewatch-gateway.test.ts",
    "src/admiralty/bridgewatch-gateway.ts",
  ];
  const plan = selectV14Mainline({
    changedPaths,
    suites: suiteInventory.suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
    impact,
    selectionContract: { selectionMode: "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS" },
  });

  assert.equal(plan.fallback, null);
  assert.deepEqual(plan.selectedSuiteIds, [
    "browser.access-sentinel",
    "browser.admiralty",
    "build.production",
    "component.admiralty",
    "database.sqlite",
    "service.admiralty",
    "static.core",
    "unit.admiralty",
    "unit.bridgewatch",
    "unit.platform-foundation",
    "unit.sounding-line",
    "validation.documentation",
  ]);
  for (const suiteId of [
    "unit.bridgewatch",
    "unit.sounding-line",
    "unit.admiralty",
    "browser.admiralty",
    "component.admiralty",
    "service.admiralty",
    "unit.platform-foundation",
    "database.sqlite",
    "build.production",
    "static.core",
    "validation.documentation",
    "browser.access-sentinel",
  ])
    assert.equal(plan.ledger.find((entry) => entry.suiteId === suiteId).evidenceDisposition, "FRESH", suiteId);
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "browser.admiralty").selectionReason, "DIRECT_IMPACT");
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "unit.admiralty").selectionReason, "DIRECT_IMPACT");
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "component.admiralty").selectionReason, "DEPENDENCY");
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "service.admiralty").selectionReason, "DEPENDENCY");
  for (const suiteId of [
    "browser.captain",
    "component.captain",
    "browser.studio",
    "component.studio",
    "browser.helm",
    "component.helm",
    "unit.helm",
    "unit.wayfarer",
    "browser.passport",
    "component.passport",
    "browser.artifacts",
    "component.artifacts",
    "browser.wakebook",
    "component.wakebook",
    "unit.wakebook",
    "browser.community",
    "component.community",
    "unit.community",
    "browser.player-journal",
    "unit.journal",
  ]) {
    const entry = plan.ledger.find((candidate) => candidate.suiteId === suiteId);
    assert.equal(entry.evidenceDisposition, "PRESERVED", suiteId);
    assert.equal(entry.selectionReason, "SEMANTICALLY_UNCHANGED", suiteId);
  }
});

test("Bridgewatch documentation remains documentation evidence while UI changes select the bounded mounted-route browser proof", async () => {
  const [suiteInventory, impact] = await Promise.all([testingJson("suites.json"), testingJson("impact-map.json")]);
  const select = (changedPaths) =>
    selectV14Mainline({
      changedPaths,
      suites: suiteInventory.suites,
      requiredSuiteIds: ["browser.access-sentinel"],
      ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
      impact,
    });
  for (const changedPath of [
    "CHANGELOG.md",
    "Development_Docs/INDEX.md",
    "Development_Docs/README.md",
    "Development_Docs/document-index.json",
    "Development_Docs/Project_Bridgewatch_v1.2_Validation_Record.md",
  ]) {
    const document = select([changedPath]);
    assert.equal(document.fallback, null, changedPath);
    assert.deepEqual(
      document.selectedSuiteIds,
      ["browser.access-sentinel", "static.core", "validation.documentation"],
      changedPath,
    );
  }
  const documentation = select(["Development_Docs/Project_Bridgewatch_v1.2_Validation_Record.md"]);
  assert.equal(
    documentation.ledger.find((entry) => entry.suiteId === "unit.bridgewatch").evidenceDisposition,
    "PRESERVED",
  );
  assert.equal(
    documentation.ledger.find((entry) => entry.suiteId === "browser.admiralty").evidenceDisposition,
    "PRESERVED",
  );

  const ui = select(["bridgewatch/public/app.js"]);
  assert.equal(ui.fallback, null);
  assert.equal(ui.ledger.find((entry) => entry.suiteId === "browser.admiralty").selectionReason, "DIRECT_IMPACT");
  assert.equal(ui.ledger.find((entry) => entry.suiteId === "unit.bridgewatch").selectionReason, "DIRECT_IMPACT");
  assert.equal(ui.ledger.find((entry) => entry.suiteId === "component.admiralty").selectionReason, "DEPENDENCY");
  assert.equal(ui.ledger.find((entry) => entry.suiteId === "browser.captain").evidenceDisposition, "PRESERVED");
});

test("Project Trim Phase 1 selects its governed minimum sufficient evidence without broad browser fallback", async () => {
  const [suiteInventory, impact] = await Promise.all([testingJson("suites.json"), testingJson("impact-map.json")]);
  const projectTrimPhaseOnePaths = [
    ".agents/context-workflow.md",
    ".gitignore",
    "AGENTS.md",
    "agent-context-profiles.json",
    "Development_Docs/document-index.json",
    "Development_Docs/Features/FEATURE_CATALOG.md",
    "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf",
    "Development_Docs/INDEX.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Context_Profile_and_Schema.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Baseline_Audit.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Governing_Input.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Measurement_Data.json",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Benchmark_and_Dogfood_Record.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Design_and_Implementation_Record.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Token_Calibration_and_Estimator_v1.md",
    "scripts/agent-context/build-context.mjs",
    "scripts/agent-context/core.mjs",
    "scripts/agent-context/preflight.mjs",
    "scripts/agent-context/record-ledger.mjs",
    "scripts/agent-context/record-usage.mjs",
    "scripts/generate-document-index.mjs",
    "testing/generated/active-test-registry.json",
    "tests/agent-context/project-trim-phase1.test.mjs",
    "tests/fixtures/agent-context/bounded-product.json",
    "tests/fixtures/agent-context/documentation-only.json",
    "tests/fixtures/agent-context/focused-repair.json",
    "tests/fixtures/agent-context/release-closure.json",
  ];
  const plan = selectV14Mainline({
    changedPaths: projectTrimPhaseOnePaths,
    suites: suiteInventory.suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
    impact,
  });

  assert.equal(plan.fallback, null);
  assert.deepEqual(plan.selectedSuiteIds, [
    "browser.access-sentinel",
    "build.production",
    "database.sqlite",
    "static.core",
    "unit.agent-context",
    "unit.feature-catalog",
    "unit.platform-foundation",
    "unit.sounding-line",
    "validation.documentation",
  ]);
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "unit.agent-context").selectionReason, "DIRECT_IMPACT");
  assert.equal(
    plan.ledger.find((entry) => entry.suiteId === "browser.access-sentinel").selectionReason,
    "REQUIRED_SENTINEL",
  );
  for (const suiteId of [
    "unit.tideglass",
    "unit.animation",
    "browser.accessibility",
    "browser.animation-lifecycle",
    "retirement.matrix-proof",
  ])
    assert.equal(plan.ledger.find((entry) => entry.suiteId === suiteId).evidenceDisposition, "PRESERVED", suiteId);

  const known = selectV14Mainline({
    changedPaths: ["scripts/agent-context/future-profile.mjs"],
    suites: suiteInventory.suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
    impact,
  });
  assert.equal(known.fallback, null);
  assert.equal(known.ledger.find((entry) => entry.suiteId === "unit.agent-context").selectionReason, "DIRECT_IMPACT");

  for (const unknownPath of [
    "scripts/agent-contextual/unmapped.mjs",
    "Development_Docs/Programs/Project_Trim_Experimental/unmapped.md",
    "src/unmapped-project-trim-seam.ts",
  ]) {
    const unknown = selectV14Mainline({
      changedPaths: [unknownPath],
      suites: suiteInventory.suites,
      requiredSuiteIds: ["browser.access-sentinel"],
      ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
      impact,
    });
    assert.equal(unknown.fallback?.disposition, "CONSERVATIVE_FALLBACK", unknownPath);
  }
});

test("Bridgewatch discovery, reconciliation, history, collector, store, UI, and projection tests all retain the Bridgewatch obligation", async () => {
  const [suiteInventory, impact] = await Promise.all([testingJson("suites.json"), testingJson("impact-map.json")]);
  for (const changedPath of [
    "bridgewatch/test/discovery.test.ts",
    "bridgewatch/test/reconciliation.test.ts",
    "bridgewatch/test/history.test.ts",
    "bridgewatch/test/github.test.ts",
    "bridgewatch/test/store.test.ts",
    "bridgewatch/test/mission-control-ui.test.ts",
    "bridgewatch/test/sounding-line-projection.test.ts",
  ]) {
    const plan = selectV14Mainline({
      changedPaths: [changedPath],
      suites: suiteInventory.suites,
      ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
      impact,
    });
    assert.equal(plan.fallback, null, changedPath);
    assert.equal(
      plan.ledger.find((entry) => entry.suiteId === "unit.bridgewatch").selectionReason,
      "DIRECT_IMPACT",
      changedPath,
    );
  }
});

test("conservative fallback reports only exact unmapped inputs and active debt on every selected ledger entry", () => {
  const suites = [
    { id: "unit.bridgewatch", dependencies: [], domains: ["bridgewatch"] },
    { id: "unit.shared-consumer", dependencies: ["unit.bridgewatch"], domains: ["shared"] },
    { id: "unit.unrelated", dependencies: [], domains: ["unrelated"] },
  ];
  const mapped = selectV14Mainline({
    changedPaths: ["bridgewatch/src/store.ts"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: {
      pathMappings: [
        { path: "bridgewatch/**", suiteIds: ["unit.bridgewatch"] },
        { path: "src/shared/bridgewatch-contract.ts", suiteIds: ["unit.shared-consumer"] },
      ],
      contractMappings: [],
    },
    mappingDebt: [{ contractId: "unrelated-contract", owner: "another-project" }],
  });
  assert.equal(mapped.fallback, null);
  assert.equal(mapped.ledger.find((entry) => entry.suiteId === "unit.bridgewatch").selectionReason, "DIRECT_IMPACT");
  assert.equal(mapped.ledger.find((entry) => entry.suiteId === "unit.unrelated").evidenceDisposition, "PRESERVED");

  const sharedContract = selectV14Mainline({
    changedPaths: ["bridgewatch/src/shared-contract.ts"],
    changedContracts: ["bridgewatch.shared-mounted-route"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: {
      pathMappings: [{ path: "bridgewatch/**", suiteIds: ["unit.bridgewatch"] }],
      contractMappings: [{ contractId: "bridgewatch.shared-mounted-route", suiteIds: ["unit.shared-consumer"] }],
    },
  });
  assert.equal(sharedContract.fallback, null);
  assert.equal(
    sharedContract.ledger.find((entry) => entry.suiteId === "unit.shared-consumer").selectionReason,
    "DIRECT_IMPACT",
  );
  assert.equal(
    sharedContract.ledger.find((entry) => entry.suiteId === "unit.bridgewatch").selectionReason,
    "DIRECT_IMPACT",
  );

  const pathFallbackWithUnrelatedDebt = selectV14Mainline({
    changedPaths: ["unknown/new.ts"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    mappingDebt: [{ contractId: "unrelated-contract", owner: "another-project", reason: "Unrelated debt" }],
  });
  assert.deepEqual(pathFallbackWithUnrelatedDebt.fallback, {
    disposition: "CONSERVATIVE_FALLBACK",
    failure: "UNKNOWN_IMPACT",
    reasons: [{ code: "UNMAPPED_CHANGED_PATH", paths: ["unknown/new.ts"] }],
  });
  assert.deepEqual(pathFallbackWithUnrelatedDebt.ledger[0].debt, []);

  const fallback = selectV14Mainline({
    changedPaths: ["bridgewatch/src/store.ts", "unknown/new.ts"],
    changedContracts: ["known-contract", "unknown-contract", "debt-contract"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: {
      pathMappings: [{ path: "bridgewatch/**", suiteIds: ["unit.bridgewatch"] }],
      contractMappings: [{ contractId: "known-contract", suiteIds: ["unit.bridgewatch"] }],
    },
    mappingDebt: [
      { contractId: "debt-contract", owner: "bridgewatch", reason: "No current test protector" },
      { contractId: "unrelated-contract", owner: "another-project", reason: "Unrelated debt" },
    ],
  });
  assert.deepEqual(fallback.fallback, {
    disposition: "CONSERVATIVE_FALLBACK",
    failure: "UNKNOWN_IMPACT",
    reasons: [
      {
        code: "MAPPING_DEBT",
        debts: [{ contractId: "debt-contract", owner: "bridgewatch", reason: "No current test protector" }],
      },
      { code: "UNMAPPED_CHANGED_CONTRACT", contractIds: ["debt-contract", "unknown-contract"] },
      { code: "UNMAPPED_CHANGED_PATH", paths: ["unknown/new.ts"] },
    ],
  });
  for (const entry of fallback.ledger) {
    assert.equal(entry.evidenceDisposition, "CONSERVATIVE_FALLBACK");
    assert.deepEqual(entry.fallbackReasons, fallback.fallback.reasons);
    assert.deepEqual(entry.debt, [{ id: "debt-contract", owner: "bridgewatch" }]);
  }
});

test("exact Tideglass impact uses only direct work and the mandatory sentinel in the earliest wave", () => {
  const suites = [
    { id: "unit.tideglass", dependencies: [], domains: ["tideglass"] },
    { id: "unit.one-voyage", dependencies: [], domains: ["one-voyage"] },
    { id: "browser.access-sentinel", dependencies: [], domains: ["authorization"] },
    { id: "browser.helm", dependencies: ["unit.helm"], domains: ["helm"] },
    { id: "unit.helm", dependencies: [], domains: ["helm"] },
  ];
  const plan = selectV14Mainline({
    changedPaths: ["tests/tideglass/canonicalization.test.ts"],
    suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [{ path: "tests/tideglass/**", suiteIds: ["unit.tideglass"] }], contractMappings: [] },
    selectionContract: { selectionMode: "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS" },
  });
  assert.deepEqual(plan.selectedSuiteIds, ["browser.access-sentinel", "unit.tideglass"]);
  assert.equal(
    plan.nodes.every((node) => node.execution.wave === 0),
    true,
  );
  assert.equal(plan.ledger.find((entry) => entry.suiteId === "unit.tideglass").selectionReason, "DIRECT_IMPACT");
  assert.equal(
    plan.ledger.find((entry) => entry.suiteId === "browser.access-sentinel").selectionReason,
    "REQUIRED_SENTINEL",
  );
  const helm = plan.ledger.find((entry) => entry.suiteId === "browser.helm");
  assert.equal(helm.evidenceDisposition, "PRESERVED");
  assert.equal(helm.preservationBasis, "EXACT_SEMANTIC_INTERVAL");
  assert.deepEqual(plan.evidenceDispositionCounts, { FRESH: 2, PRESERVED: 3 });
});

test("a mapped non-accessibility source change preserves the broad accessibility family while unknown source fails closed", () => {
  const suites = [
    { id: "static.core", domains: ["static"] },
    { id: "unit.drydock", domains: ["drydock"] },
    { id: "browser.accessibility", domains: ["accessibility"] },
  ];
  const mapped = selectV14Mainline({
    changedPaths: ["src/drydock/variables.ts"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: {
      pathMappings: [{ path: "src/drydock/**", suiteIds: ["unit.drydock", "static.core"] }],
      contractMappings: [],
    },
  });
  assert.equal(
    mapped.nodes.some((node) => node.id === "browser.accessibility"),
    false,
  );
  assert.deepEqual(
    mapped.ledger.find((entry) => entry.suiteId === "browser.accessibility"),
    {
      suiteId: "browser.accessibility",
      selected: false,
      selectionReason: "SEMANTICALLY_UNCHANGED",
      affectedContracts: [],
      affectedPaths: ["src/drydock/variables.ts"],
      closureConfidence: "EXACT",
      evidenceDisposition: "PRESERVED",
      preservationBasis: "EXACT_SEMANTIC_INTERVAL",
      debt: [],
    },
  );
  const unknown = selectV14Mainline({
    changedPaths: ["src/unmapped/new.ts"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
  });
  assert.equal(
    unknown.nodes.some((node) => node.id === "browser.accessibility"),
    true,
  );
  assert.equal(
    unknown.ledger.find((entry) => entry.suiteId === "browser.accessibility").evidenceDisposition,
    "CONSERVATIVE_FALLBACK",
  );
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

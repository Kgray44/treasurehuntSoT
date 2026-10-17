// One current whole qualification; original R13 evidence retains its old identity.
import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { R8_FORMAT } from "./experience-r8-format.mjs";
import { CROSSDECK_R13, r13HistoricalEvidencePlan, validateR13Registry } from "./experience-r13.mjs";
import { validateR9FinalDecision, validateR9HistoricalCustody } from "./experience-r9.mjs";
import {
  R14_HISTORICAL_FOCUSED,
  validateR14HistoricalFocusedTechnicalProof,
} from "./experience-r14-technical-proof.mjs";

export const CROSSDECK_R14 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R14",
  recordDigest: "bea95bd1cebc6118910abef360107e3ea7a5220f99e506238eff8ea0e59df670",
  frozenReferenceSha: R14_HISTORICAL_FOCUSED.candidateSha,
  requiredProtectedBaseAncestorSha: "ba27c3395da43c54c1f90d7f18e2ce07f7523fd4",
  oldRegistryDigest: "efb7bced7d8c8c9482fb41e745e91ac3726cffb8b253ec52faa1951848928e60",
  inheritedRemotePredecessorDigest: "8191c3ccd3c9c506fe0b8e460cffdd5bae96d2254b4623920e46e0ecd3c526e3",
  bridgeId: "PE-R14-INSTRUMENTED-QUALIFICATION-BRIDGE-20261017",
});

// Literal B3-to-installed-authority paths; every other reviewed path remains exact E.
export const R14_OVERLAY_PATHS = [
  ".agents/README.md",
  ".agents/crossdeck-ordinary6-historical-validation-diagnostic.md",
  ".agents/crossdeck-ordinary6-posttechnical-diagnostic.md",
  ".agents/crossdeck-ordinary6-source-diagnostic.md",
  ".agents/crossdeck-r14-instrumented-qualification.md",
  ".agents/replay-admission-git-diagnostics.md",
  ".github/workflows/sounding-line-ordinary.yml",
  ".github/workflows/sounding-line-replay-admission-diagnostic.yml",
  ".github/workflows/sounding-line-replay-historical-validation-diagnostic.yml",
  ".github/workflows/sounding-line-replay-posttechnical-diagnostic.yml",
  "Development_Docs/INDEX.md",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R14_Instrumented_Qualification_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Historical_Validation_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Posttechnical_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Ordinary6_Source_Diagnostic_20261017.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Replay_Admission_Git_Diagnostics_20261017.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r14-instrumented-qualification-20261017/ordinary6-causal-disposition.derived.json",
  "Development_Docs/document-index.json",
  "package.json",
  "scripts/sounding-line/experience-checkout-probe.mjs",
  "scripts/sounding-line/experience-diagnosed-continuation.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/experience-r10.mjs",
  "scripts/sounding-line/experience-r11.mjs",
  "scripts/sounding-line/experience-r14-observability.mjs",
  "scripts/sounding-line/experience-r14-technical-proof.mjs",
  "scripts/sounding-line/experience-r14.mjs",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/replay-admission-source-diagnostic.mjs",
  "scripts/sounding-line/replay-historical-validation-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-suite.mjs",
  "scripts/sounding-line/run-browser-suite.mjs",
  "scripts/sounding-line/source-diagnostics.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-exception.test.mjs",
  "tests/sounding-line/experience-r10.test.mjs",
  "tests/sounding-line/experience-r11.test.mjs",
  "tests/sounding-line/experience-r13.test.mjs",
  "tests/sounding-line/experience-r14-observability.test.mjs",
  "tests/sounding-line/experience-r14.test.mjs",
  "tests/sounding-line/experience-r9.test.mjs",
  "tests/sounding-line/historical-validation-diagnostic.test.mjs",
  "tests/sounding-line/ordinary.test.mjs",
];
const REGISTRY = "testing/product-experience-exceptions.json";
const MERGED = [
  ".agents/README.md",
  "Development_Docs/INDEX.md",
  "Development_Docs/Testing/Product_Experience/README.md",
];
const REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
const ORIGINAL = R14_HISTORICAL_FOCUSED;
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R14_${code}`);
};
const git = (root, args, binary = false) =>
  sourceDiagnosticGit("DIAGNOSED_CONTINUATION", args, {
    cwd: root,
    encoding: binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const json = (root, revision, file) => JSON.parse(git(root, ["show", `${revision}:${file}`]));
const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const [identity, file] = line.split("\t");
        return [file, identity];
      }),
  );
const keysEqual = (value, keys) => hash(Object.keys(value ?? {}).sort()) === hash([...keys].sort());

export function validateR14Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record?.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R14.recordDigest ||
    record.version !== 14 ||
    record.id !== CROSSDECK_R14.id ||
    record.frozenReferenceSha !== ORIGINAL.candidateSha ||
    record.authorityOverlayBaseSha !== ORIGINAL.baseSha ||
    record.authorityOverlayCandidateSha !== ORIGINAL.candidateSha ||
    record.expiresAt !== "2026-10-22T23:59:59Z" ||
    record.predecessor?.id !== ORIGINAL.exceptionId ||
    record.predecessor.recordDigest !== ORIGINAL.recordDigest ||
    hash(record.inheritedRemotePredecessor) !== CROSSDECK_R14.inheritedRemotePredecessorDigest ||
    record.focusedTechnicalDiagnostics !== undefined ||
    hash(record.supportingTechnicalProof) !==
      hash({
        classification: "HISTORICAL_R13_SUPPORT_NOT_CURRENT_READINESS_OR_QUALIFICATION",
        exceptionId: ORIGINAL.exceptionId,
        recordDigest: ORIGINAL.recordDigest,
        baseSha: ORIGINAL.baseSha,
        candidateSha: ORIGINAL.candidateSha,
        candidateTree: ORIGINAL.candidateTree,
        sourceDigest: ORIGINAL.sourceDigest,
        contractDigest: ORIGINAL.contractDigest,
        bindingDigest: ORIGINAL.bindingDigest,
        exceptionBindingDigest: ORIGINAL.exceptionBindingDigest,
        publicationDirectory: `${ORIGINAL.evidenceDirectory}/focused-technical`,
        newFocusedInvocations: 0,
        newReadinessAttempts: 0,
      }) ||
    hash(record.executionBudget) !== "864a970314028f3c724122d5559eb4f8d3464a00504dccf18aaafc09b20cf4ee"
  )
    fail("RECORD_CHANGED");
}

export function assertR14Mode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R14.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
}

export function validateR14Bridge(bridge) {
  if (
    !keysEqual(bridge, ["version", "id", "status", "exceptionId", "recordDigest", "overlay"]) ||
    bridge.version !== 1 ||
    bridge.id !== CROSSDECK_R14.bridgeId ||
    bridge.status !== "ACTIVE" ||
    bridge.exceptionId !== CROSSDECK_R14.id ||
    bridge.recordDigest !== CROSSDECK_R14.recordDigest ||
    !Array.isArray(bridge.overlay) ||
    bridge.overlay.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry)) ||
    hash(bridge.overlay.map((entry) => entry.path).sort()) !== hash([...R14_OVERLAY_PATHS].sort()) ||
    new Set(bridge.overlay.map((entry) => entry.path)).size !== R14_OVERLAY_PATHS.length ||
    bridge.overlay.some(
      (entry) =>
        !keysEqual(entry, ["path", "oldMode", "oldBlob", "newMode", "newBlob"]) ||
        entry.newMode !== "100644" ||
        !/^[a-f0-9]{40}$/u.test(entry.newBlob ?? "") ||
        !(
          (entry.oldMode === null && entry.oldBlob === null) ||
          (entry.oldMode === "100644" && /^[a-f0-9]{40}$/u.test(entry.oldBlob ?? ""))
        ),
    )
  )
    fail("BRIDGE_CHANGED");
}

export function validateR14Registry(registry) {
  const records = Array.isArray(registry?.exceptions)
    ? registry.exceptions.filter((record) => record?.id === CROSSDECK_R14.id)
    : [];
  if (
    !keysEqual(registry, ["version", "exceptions", "reconciliations"]) ||
    registry.version !== 1 ||
    records?.length !== 1 ||
    registry.exceptions.length !== 14 ||
    registry.reconciliations?.length !== 7 ||
    registry.exceptions.at(-1) !== records[0]
  )
    fail("REGISTRY_CHANGED");
  validateR14Record(records[0]);
  const old = {
    ...registry,
    exceptions: registry.exceptions.slice(0, 13),
    reconciliations: registry.reconciliations.slice(0, 6),
  };
  if (hash(old) !== CROSSDECK_R14.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
  const previous = validateR13Registry(old);
  if (hash(previous.remotePredecessor) !== hash(records[0].inheritedRemotePredecessor)) fail("PREDECESSOR_CHANGED");
  validateR14Bridge(registry.reconciliations[6]);
  return records[0];
}

function historicalBinding(record) {
  return {
    id: record.id,
    recordDigest: hash(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    version: record.version,
    predecessor: record.predecessor,
    attemptHistory: record.attemptHistory,
  };
}
function originalR13Exception(registry) {
  const record = registry.exceptions[12];
  const original = {
    ...historicalBinding(record),
    nonExecutingReconciliation: {
      version: 1,
      id: CROSSDECK_R13.bridgeId,
      recordDigest: hash(registry.reconciliations[5]),
      originalBaseSha: R8_FORMAT.baseSha,
      originalSourceDigest: R8_FORMAT.sourceDigest,
      originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
      currentBaseSha: ORIGINAL.baseSha,
      currentSourceDigest: ORIGINAL.sourceDigest,
      overlay: registry.reconciliations[5].overlay,
      candidateTestCorrection: record.candidateTestCorrection,
      historicalException: historicalBinding(
        registry.exceptions.find((entry) => entry.id === "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8"),
      ),
    },
  };
  if (
    hash(original) !== ORIGINAL.exceptionBindingDigest ||
    hash({
      exception: original,
      baseSha: ORIGINAL.baseSha,
      sourceDigest: ORIGINAL.sourceDigest,
      contractDigest: ORIGINAL.contractDigest,
    }) !== ORIGINAL.bindingDigest
  )
    fail("HISTORICAL_BINDING_CHANGED");
  return original;
}

export function pendingR14Reconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R14.id) return null;
  if (!/^[a-f0-9]{40}$/u.test(baseSha ?? "") || !/^[a-f0-9]{64}$/u.test(plan.sourceDigest ?? ""))
    fail("CURRENT_SOURCE_INVALID");
  const registry = json(root, baseSha, REGISTRY);
  const current = validateR14Registry(registry);
  if (hash(current) !== hash(record)) fail("RECORD_CHANGED");
  const bridge = registry.reconciliations[6];
  return {
    version: 1,
    id: CROSSDECK_R14.bridgeId,
    recordDigest: hash(bridge),
    originalBaseSha: ORIGINAL.baseSha,
    originalSourceDigest: ORIGINAL.sourceDigest,
    originalPublicationCandidateSha: ORIGINAL.candidateSha,
    currentBaseSha: baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    historicalException: originalR13Exception(registry),
    historicalBindingDigest: ORIGINAL.bindingDigest,
  };
}

export function r14HistoricalEvidencePlan(plan) {
  if (plan.exception?.id !== CROSSDECK_R14.id) return plan;
  const binding = plan.exception.nonExecutingReconciliation;
  if (
    !keysEqual(binding, [
      "version",
      "id",
      "recordDigest",
      "originalBaseSha",
      "originalSourceDigest",
      "originalPublicationCandidateSha",
      "currentBaseSha",
      "currentSourceDigest",
      "overlay",
      "historicalException",
      "historicalBindingDigest",
    ]) ||
    plan.exception.recordDigest !== CROSSDECK_R14.recordDigest ||
    hash(plan.exception.inheritedRemotePredecessor) !== CROSSDECK_R14.inheritedRemotePredecessorDigest ||
    binding.version !== 1 ||
    binding.id !== CROSSDECK_R14.bridgeId ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    binding.originalBaseSha !== ORIGINAL.baseSha ||
    binding.originalSourceDigest !== ORIGINAL.sourceDigest ||
    binding.originalPublicationCandidateSha !== ORIGINAL.candidateSha ||
    binding.historicalBindingDigest !== ORIGINAL.bindingDigest ||
    hash(binding.historicalException) !== ORIGINAL.exceptionBindingDigest ||
    plan.contractDigest !== ORIGINAL.contractDigest
  )
    fail("BINDING_CHANGED");
  const bridge = {
    version: 1,
    id: CROSSDECK_R14.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R14.id,
    recordDigest: CROSSDECK_R14.recordDigest,
    overlay: binding.overlay,
  };
  validateR14Bridge(bridge);
  if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
  return r13HistoricalEvidencePlan({
    ...plan,
    baseSha: ORIGINAL.baseSha,
    candidateSha: ORIGINAL.candidateSha,
    candidateTree: ORIGINAL.candidateTree,
    sourceDigest: ORIGINAL.sourceDigest,
    exception: binding.historicalException,
  });
}

export function validateR14Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
  validateR14Bridge(bridge);
  const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
  for (const [file, entry] of allowed) {
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...MERGED, ...REGENERATED].includes(file)
        ? !/^100644 blob [a-f0-9]{40}$/u.test(candidate.get(file) ?? "")
        : candidate.get(file) !== acceptedBase.get(file))
    )
      fail("OVERLAY_CHANGED");
  }
  for (const file of new Set([...originalBase.keys(), ...acceptedBase.keys()]))
    if (file !== REGISTRY && !allowed.has(file) && originalBase.get(file) !== acceptedBase.get(file))
      fail("BASE_SCOPE_CHANGED");
  for (const file of new Set([...originalSource.keys(), ...candidate.keys()]))
    if (file !== REGISTRY && !allowed.has(file) && originalSource.get(file) !== candidate.get(file))
      fail("REVIEWED_SOURCE_CHANGED");
  if (candidate.get(REGISTRY) !== acceptedBase.get(REGISTRY)) fail("REGISTRY_CHANGED");
}

function validateMergedMetadata({ root, baseSha, candidateSha }) {
  for (const file of MERGED) {
    const directory = mkdtempSync(path.join(tmpdir(), "r12-readme-"));
    try {
      const files = ["current", "base", "other"].map((name) => path.join(directory, name));
      for (const [index, revision] of [baseSha, ORIGINAL.baseSha, ORIGINAL.candidateSha].entries())
        writeFileSync(files[index], git(root, ["show", `${revision}:${file}`], true));
      const merged = sourceDiagnosticGit(
        "DIAGNOSED_CONTINUATION",
        ["merge-file", "--stdout", ...files],
        { cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
        { file, revisions: [baseSha, ORIGINAL.baseSha, ORIGINAL.candidateSha] },
      );
      const blob = createHash("sha1").update(`blob ${merged.length}\0`).update(merged).digest("hex");
      if (git(root, ["rev-parse", `${candidateSha}:${file}`]).trim() !== blob) fail("MERGED_METADATA_CHANGED");
    } finally {
      if (!directory.startsWith(path.resolve(tmpdir()) + path.sep)) fail("TEMP_PATH_INVALID");
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

export function bindR14Reconciliation({ root, baseSha, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R14.id) return null;
  if (!/^[a-f0-9]{40}$/u.test(candidateSha ?? "")) fail("CURRENT_SOURCE_INVALID");
  const binding = pendingR14Reconciliation({ root, baseSha, plan, record });
  git(root, ["merge-base", "--is-ancestor", CROSSDECK_R14.requiredProtectedBaseAncestorSha, baseSha]);
  git(root, ["merge-base", "--is-ancestor", ORIGINAL.candidateSha, candidateSha]);
  if (git(root, ["rev-parse", `${ORIGINAL.candidateSha}^{tree}`]).trim() !== ORIGINAL.candidateTree)
    fail("HISTORICAL_SOURCE_CHANGED");
  validateR14Overlay({
    bridge: {
      version: 1,
      id: CROSSDECK_R14.bridgeId,
      status: "ACTIVE",
      exceptionId: CROSSDECK_R14.id,
      recordDigest: CROSSDECK_R14.recordDigest,
      overlay: binding.overlay,
    },
    originalBase: inventory(root, ORIGINAL.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, ORIGINAL.candidateSha),
    candidate: inventory(root, candidateSha),
  });
  validateMergedMetadata({ root, baseSha, candidateSha });
  const original = sourceSnapshot(root, ORIGINAL.candidateSha),
    actual = sourceSnapshot(root, candidateSha);
  const normalized = new Map(actual.entries.map((entry) => [entry.path, entry]));
  const originals = new Map(original.entries.map((entry) => [entry.path, entry]));
  const contents = new Map(actual.contents);
  for (const entry of binding.overlay) {
    if (originals.has(entry.path)) normalized.set(entry.path, originals.get(entry.path));
    else normalized.delete(entry.path);
    if (original.contents.has(entry.path)) contents.set(entry.path, original.contents.get(entry.path));
    else contents.delete(entry.path);
  }
  if (
    productSourceDigest(original) !== ORIGINAL.sourceDigest ||
    productSourceDigest(actual) !== plan.sourceDigest ||
    productSourceDigest({ entries: [...normalized.values()], contents }) !== ORIGINAL.sourceDigest
  )
    fail("REVIEWED_SOURCE_CHANGED");
  for (const entry of record.immutableHistory) {
    const file = path.join(root, entry.path);
    if (
      !lstatSync(file).isFile() ||
      lstatSync(file).isSymbolicLink() ||
      (entry.sha256 && bytesHash(readFileSync(file)) !== entry.sha256)
    )
      fail("PRESERVED_ORIGINAL_CHANGED");
  }
  return binding;
}

export async function validateR14PublishedTechnicalProof({ root, candidateSha, plan, record }) {
  validateR14Record(record);
  r14HistoricalEvidencePlan(plan);
  if (record.id !== plan.exception?.id || candidateSha !== plan.candidateSha) fail("CURRENT_PROOF_BINDING_CHANGED");
  const rebound = bindR14Reconciliation({ root, baseSha: plan.baseSha, candidateSha, plan, record });
  if (hash(rebound) !== hash(plan.exception.nonExecutingReconciliation)) fail("CURRENT_PROOF_BINDING_CHANGED");
  return validateR14HistoricalFocusedTechnicalProof({ root, candidateSha });
}
export async function validateR14HistoricalCustody({ plan, ...options }) {
  if (plan) r14HistoricalEvidencePlan(plan);
  return validateR9HistoricalCustody(options);
}
export function validateR14FinalDecision(options) {
  r14HistoricalEvidencePlan(options.plan);
  if (
    options.decision.productExperienceReplay?.status !== "PASS" ||
    options.decision.productExperienceReplay?.sourceDigest !== options.plan.sourceDigest
  )
    fail("CURRENT_REPLAY_REQUIRED");
  const observed = options.decision.r14Observation;
  if (
    observed?.version !== 1 ||
    observed.status !== "COMPLETE" ||
    observed.observationId !== "CROSSDECK-R14-ORDINARY-OBSERVATION-20261017" ||
    observed.exceptionId !== CROSSDECK_R14.id ||
    observed.repository !== "Kgray44/treasurehuntSoT" ||
    observed.baseSha !== options.plan.baseSha ||
    observed.candidateSha !== options.plan.candidateSha ||
    observed.sourceDigest !== options.plan.sourceDigest ||
    !Number.isSafeInteger(options.run?.runId) ||
    options.run.runId <= 0 ||
    observed.runId !== options.run.runId ||
    observed.runAttempt !== 1 ||
    observed.job !== "final-check" ||
    observed.keyId !== "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc" ||
    observed.format !== "VW-POSTTECHNICAL-EVIDENCE-1" ||
    !/^[a-f0-9]{64}$/u.test(observed.ciphertextDigest ?? "") ||
    !Number.isSafeInteger(observed.ciphertextBytes) ||
    observed.ciphertextBytes <= 0 ||
    observed.memberCount !== 2 ||
    !Number.isSafeInteger(observed.rawBytes) ||
    observed.rawBytes < 0 ||
    observed.evidenceLoss !== false ||
    observed.cleanup !== true ||
    observed.sourceUnchanged !== true ||
    observed.coverage !== "SUPPORTED_REPLAY_ADMISSION_GIT_READS_AND_FINAL_PROPAGATED_ERROR" ||
    !Number.isSafeInteger(observed.supportedGitReads) ||
    observed.supportedGitReads <= 0 ||
    !Number.isSafeInteger(observed.observedGitThrows) ||
    observed.observedGitThrows < 0 ||
    observed.retainedGitThrows !== observed.observedGitThrows
  )
    fail("OBSERVATION_INTEGRITY_REQUIRED");
  return validateR9FinalDecision(options);
}

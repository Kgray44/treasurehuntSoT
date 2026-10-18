// Inert until a complete, separately reviewed record is installed on protected base.
// This module installs no record, namespace, execution allowance, or source identity.
import { createHash } from "node:crypto";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { PAIRED_CASES, PAIRED_CONTRACTS } from "./experience-paired.mjs";
import {
  CURRENT_R16,
  CURRENT_R15_FAILED_PREPARATION,
  CURRENT_R15_FAILED_RUN,
  CURRENT_R15_LEGACY_PREDECESSOR,
} from "./experience-current-r16.mjs";

export const CURRENT_ADMISSION_KIND = "CROSSDECK_CURRENT_SOURCE_ADMISSION_1";
export const CURRENT_LEGACY_REGISTRY_DIGEST = "ab123c025952b5f5f5140e55ff95f2ba1f2433a33a0de5c200885d917c1344fd";
export const CURRENT_LEGACY = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R14",
  recordDigest: "bea95bd1cebc6118910abef360107e3ea7a5220f99e506238eff8ea0e59df670",
  qualifyCommit: "7a4788550493dcbca7fae078b9e47ab03d7b06de",
  runId: 39037804106,
  repairRecaptureAttempts: 11,
  executedPreparations: 18,
  independentReviewsCompleted: 7,
  expiry: "2026-10-22T23:59:59Z",
});
export const CURRENT_PRODUCT_REFERENCE = "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f";
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value, length = 40) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const unique = (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length;
const safePath = (value) =>
  typeof value === "string" &&
  !/[\u0000-\u001f\u007f]/u.test(value) &&
  !value.includes("\\") &&
  !value.startsWith("/") &&
  value.split("/").every((part) => part && part !== "." && part !== "..");
const need = (value, code) => {
  if (!value) throw new Error(`PRODUCT_EXPERIENCE_CURRENT_ADMISSION_${code}`);
};
const same = (a, b) => hash(a) === hash(b);
const git = (root, args, binary = false) =>
  sourceDiagnosticGit("PRODUCT_EXPERIENCE", args, {
    cwd: root,
    encoding: binary ? null : "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const [metadata, file] = entry.split("\t");
        return [file, metadata];
      }),
  );
const requiredContracts = [
  "crossdeck.phase2.continuity",
  "crossdeck.refit.companion",
  "crossdeck.refit.published-lens",
  "homeport.shell.crossdeck-access-recovery",
  "homeport.shell.crossdeck-companion",
  "homeport.shell.crossdeck-companion-mobile",
  "reach.phase1.foundation",
];
const requiredBrowsers = [
  "crossdeck-phase1",
  "crossdeck-phase2",
  "crossdeck-experience-refit",
  "crossdeck-refit-recovery",
  "homeport-phase2",
  "reach-laboratory",
  "reach-device-return",
  "reach-page-accessibility",
].map((name) => `tests/e2e/${name}.spec.ts`);
export const isCurrentAdmissionRecord = (record) => record?.currentSourceAdmission?.kind === CURRENT_ADMISSION_KIND;
export const isCurrentAdmissionPlan = (plan) =>
  plan?.exception?.currentSourceAdmission?.kind === CURRENT_ADMISSION_KIND;

export function validateCurrentAdmissionRecord(record, { now = new Date(), legacyRecord, legacyCurrentRecord } = {}) {
  const a = record?.currentSourceAdmission;
  const successor = record?.version === CURRENT_R16.version;
  need(
    isCurrentAdmissionRecord(record) &&
      (record.version === 15 || successor) &&
      record.status === "ACTIVE" &&
      typeof record.id === "string" &&
      /^[A-Za-z0-9-]+$/u.test(record.id) &&
      record.id !== CURRENT_LEGACY.id &&
      record.repository === "Kgray44/treasurehuntSoT" &&
      record.pullRequest === 721 &&
      record.ownerApproval?.actor === "Kgray44" &&
      Number.isFinite(Date.parse(record.ownerApproval.approvedAtUtcMinute)) &&
      record.custody?.namespace === `sounding-line-exceptions/${record.id}` &&
      Number.isFinite(Date.parse(record.expiresAt)) &&
      Date.parse(record.expiresAt) <= Date.parse(CURRENT_LEGACY.expiry) &&
      now.getTime() < Date.parse(record.expiresAt),
    "RECORD_INVALID",
  );
  need(
    (successor
      ? same(record.predecessor, CURRENT_R15_FAILED_PREPARATION)
      : record.predecessor?.id === CURRENT_LEGACY.id &&
        record.predecessor.recordDigest === CURRENT_LEGACY.recordDigest &&
        record.predecessor.qualifyCommit === CURRENT_LEGACY.qualifyCommit &&
        record.predecessor.runId === CURRENT_LEGACY.runId &&
        sha(record.predecessor.qualifyPayloadDigest, 64) &&
        Number.isFinite(Date.parse(record.predecessor.campaignEpoch))) &&
      sha(record.frozenReferenceSha) &&
      sha(record.frozenTrees?.src) &&
      sha(a.protectedBaseAncestorSha) &&
      sha(a.preservationRevision) &&
      sha(a.sourceDigest, 64) &&
      sha(record.contractDigest, 64) &&
      unique(record.contractIds) &&
      requiredContracts.every((id) => record.contractIds.includes(id)) &&
      positive(record.contexts) &&
      positive(a.contextCount) &&
      Number.isSafeInteger(a.pairedBrowserContexts) &&
      a.pairedBrowserContexts >= 0 &&
      a.contextCount === record.contexts + a.pairedBrowserContexts &&
      unique(record.requiredTechnicalBrowserTests) &&
      requiredBrowsers.every((file) => record.requiredTechnicalBrowserTests.includes(file)) &&
      unique(a.requiredObligationIds) &&
      a.requiredObligationIds.length >= 8,
    "SOURCE_POLICY_INVALID",
  );
  const h = a.cumulativeHistory;
  need(
    h?.legacyRepairRecaptureAttempts === CURRENT_LEGACY.repairRecaptureAttempts &&
      Number.isSafeInteger(h.completedPreparationAttempts) &&
      h.completedPreparationAttempts >= CURRENT_LEGACY.executedPreparations &&
      h.currentPreparationOrdinal === h.completedPreparationAttempts + 1 &&
      Number.isSafeInteger(h.completedIndependentReviews) &&
      h.completedIndependentReviews >= CURRENT_LEGACY.independentReviewsCompleted &&
      record.remainingIndependentReviewOrdinal === h.completedIndependentReviews + 1 &&
      positive(a.requiredReviewIterations) &&
      a.requiredReviewIterations >= h.legacyRepairRecaptureAttempts &&
      safePath(a.historyLedger?.path) &&
      a.historyLedger.path.startsWith("Development_Docs/") &&
      sha(a.historyLedger.sha256, 64) &&
      safePath(a.disposition?.path) &&
      a.disposition.path.startsWith("Development_Docs/") &&
      sha(a.disposition.sha256, 64),
    "CUMULATIVE_HISTORY_INVALID",
  );
  need(
    Array.isArray(a.protectedOverlay) &&
      unique(a.protectedOverlay.map((entry) => entry.path)) &&
      a.protectedOverlay.every(
        (entry) =>
          safePath(entry.path) &&
          /^(?:scripts\/sounding-line\/|tests\/sounding-line\/|\.github\/workflows\/|\.agents\/|Development_Docs\/|(?:CHANGELOG\.md|package\.json)$)/u.test(
            entry.path,
          ) &&
          ["old", "new", "candidate"].every((prefix) =>
            entry[`${prefix}Mode`] === null
              ? entry[`${prefix}Blob`] === null
              : entry[`${prefix}Mode`] === "100644" && sha(entry[`${prefix}Blob`]),
          ),
      ),
    "PROTECTED_OVERLAY_INVALID",
  );
  need(
    Array.isArray(a.historicalRuns) &&
      a.historicalRuns.length >= 17 &&
      unique(a.historicalRuns.map((run) => run.id)) &&
      a.historicalRuns.every(
        (run) =>
          positive(run.id) &&
          run.runAttempt === 1 &&
          run.status === "completed" &&
          typeof run.conclusion === "string" &&
          sha(run.headSha) &&
          Number.isFinite(Date.parse(run.createdAt)) &&
          run.workflowId === 341545080 &&
          ["workflow_dispatch", "pull_request_target"].includes(run.event) &&
          typeof run.headBranch === "string" &&
          run.headBranch.length > 0 &&
          typeof run.displayTitle === "string" &&
          run.displayTitle.length > 0 &&
          positive(run.checkSuiteId) &&
          Date.parse(run.createdAt) >= Date.parse(record.predecessor.campaignEpoch) &&
          run.actor === "Kgray44" &&
          run.triggeringActor === "Kgray44" &&
          run.repository === record.repository,
      ) &&
      a.historicalRuns.some((run) => run.id === CURRENT_LEGACY.runId && run.conclusion === "failure"),
    "REMOTE_HISTORY_INVALID",
  );
  need(
    Array.isArray(record.immutableHistory) &&
      record.immutableHistory.length >= 1360 &&
      record.immutableHistory.every(
        (entry) =>
          safePath(entry.path) &&
          sha(entry.blob) &&
          (entry.mode === undefined || entry.mode === "100644") &&
          (entry.sha256 === undefined || sha(entry.sha256, 64)),
      ) &&
      unique(record.immutableHistory.map((entry) => entry.path)) &&
      (legacyRecord === undefined ||
        (same(record.immutableHistory, legacyRecord.immutableHistory) &&
          same(a.legacyR14History, {
            predecessor: legacyRecord.predecessor,
            inheritedRemotePredecessor: legacyRecord.inheritedRemotePredecessor,
          }))),
    "PRESERVATION_INVALID",
  );
  need(
    unique(a.publicationFiles) &&
      a.publicationFiles.includes("Development_Docs/Testing/Product_Experience/candidate-review.json") &&
      a.publicationFiles.every(
        (file) =>
          safePath(file) &&
          file.endsWith(".json") &&
          (file === "Development_Docs/Testing/Product_Experience/candidate-review.json" ||
            file.startsWith("Development_Docs/Testing/Product_Experience/evidence/")),
      ),
    "PUBLICATION_SCOPE_INVALID",
  );
  need(
    a.caps &&
      ["capture", "review", "ordinary", "technical", "replay"].every(
        (stage) => Number.isSafeInteger(a.caps[stage]) && a.caps[stage] >= 0 && a.caps[stage] <= 1,
      ) &&
      Object.keys(a.caps).length === 5 &&
      a.observation?.keyId === "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc" &&
      typeof a.observation.id === "string" &&
      /^[A-Za-z0-9-]+$/u.test(a.observation.id) &&
      a.reruns === 0 &&
      a.refunds === 0 &&
      a.paidProviderCalls === 0,
    "CAP_OR_OBSERVATION_INVALID",
  );
  if (successor) {
    need(
      record.id === CURRENT_R16.id &&
        record.frozenReferenceSha === CURRENT_R16.frozenReferenceSha &&
        a.preservationRevision === CURRENT_R16.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R16.protectedBaseAncestorSha &&
        same(record.ownerApproval, CURRENT_R16.ownerApproval) &&
        record.expiresAt === CURRENT_R16.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R16.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R16.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R16.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R16.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R16.immutableHistoryDigest &&
        a.historicalRuns.length === 18 &&
        hash(a.historicalRuns.slice(0, 17)) === CURRENT_R16.previousRunsDigest &&
        same(a.historicalRuns[17], CURRENT_R15_FAILED_RUN) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R16.previousRecordDigest),
      "R16_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  return record;
}

export function validateCurrentAdmissionRegistry(registry, now, { requiredVersion } = {}) {
  if (
    requiredVersion === 16 ||
    registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 16)
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 16, "R16_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 15) };
    need(hash(prior) === CURRENT_R16.previousRegistryDigest, "R16_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now);
    const current = registry.exceptions[15];
    need(current?.version === 16 && isCurrentAdmissionRecord(current), "R16_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[14],
    });
    return current;
  }
  const current = registry?.exceptions?.filter(isCurrentAdmissionRecord) ?? [];
  need(registry?.version === 1 && registry.exceptions.length === 15 && current.length === 1, "REGISTRY_INVALID");
  const prior = {
    ...registry,
    exceptions: registry.exceptions.filter((record) => !isCurrentAdmissionRecord(record)),
  };
  need(hash(prior) === CURRENT_LEGACY_REGISTRY_DIGEST, "LEGACY_REGISTRY_CHANGED");
  const old = prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id);
  validateCurrentAdmissionRecord(current[0], { now, legacyRecord: old });
  return current[0];
}

export function currentAdmissionBinding(record) {
  validateCurrentAdmissionRecord(record);
  return {
    id: record.id,
    version: record.version,
    recordDigest: hash(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: CURRENT_LEGACY.repairRecaptureAttempts,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    predecessor: record.predecessor,
    currentSourceAdmission: record.currentSourceAdmission,
  };
}
export function bindCurrentAdmission({ root, record, plan, baseSha, candidateSha }) {
  validateCurrentAdmissionRecord(record);
  const a = record.currentSourceAdmission;
  for (const [ancestor, descendant] of [
    [a.protectedBaseAncestorSha, baseSha],
    [baseSha, candidateSha],
    [record.frozenReferenceSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  need(
    plan.applicable &&
      plan.sourceDigest === a.sourceDigest &&
      plan.contractDigest === record.contractDigest &&
      same([...plan.contractIds].sort(), [...record.contractIds].sort()) &&
      plan.contextCount === a.contextCount &&
      (plan.paired?.browserContexts ?? 0) === a.pairedBrowserContexts,
    "PLAN_CHANGED",
  );
  const reference = inventory(root, record.frozenReferenceSha),
    candidate = inventory(root, candidateSha),
    base = inventory(root, baseSha);
  git(root, ["merge-base", "--is-ancestor", CURRENT_PRODUCT_REFERENCE, record.frozenReferenceSha]);
  const productReference = inventory(root, CURRENT_PRODUCT_REFERENCE);
  const originalProductPaths = git(root, [
    "diff",
    "--name-only",
    "--no-renames",
    "fd30aa1412072e89d04f2bb68786d9c184f82dfc",
    CURRENT_PRODUCT_REFERENCE,
  ])
    .trim()
    .split(/\r?\n/u)
    .filter((file) => /^(?:src\/|tests\/e2e\/)/u.test(file));
  need(originalProductPaths.length === 46, "PRODUCT_REFERENCE_CHANGED");
  for (const file of originalProductPaths)
    if (file !== "src/app/devices/pair/page.tsx")
      need(candidate.get(file) === productReference.get(file), "PRESERVED_CROSSDECK_PRODUCT_CHANGED");
  const contractsAt = (revision) => JSON.parse(git(root, ["show", `${revision}:testing/contracts.json`])).contracts;
  const originalContracts = contractsAt(CURRENT_PRODUCT_REFERENCE),
    currentContracts = contractsAt(candidateSha);
  for (const id of requiredContracts.filter((id) => id !== "reach.phase1.foundation"))
    need(
      same(
        originalContracts.find((contract) => contract.id === id),
        currentContracts.find((contract) => contract.id === id),
      ),
      "PRESERVED_CROSSDECK_CONTRACT_CHANGED",
    );
  need(
    plan.evidencePath === "Development_Docs/Testing/Product_Experience/candidate-review.json",
    "EVIDENCE_PATH_CHANGED",
  );
  let publicationArtifacts = [];
  if (reference.get(plan.evidencePath) !== candidate.get(plan.evidencePath)) {
    need(candidate.get(plan.evidencePath)?.startsWith("100644 blob "), "CURRENT_PUBLICATION_MODE_INVALID");
    const evidence = JSON.parse(git(root, ["show", `${candidateSha}:${plan.evidencePath}`]));
    need(
      evidence.baseSha === baseSha &&
        evidence.sourceDigest === plan.sourceDigest &&
        evidence.contractDigest === plan.contractDigest &&
        same(evidence.exception, currentAdmissionBinding(record)),
      "CURRENT_PUBLICATION_MANIFEST_UNBOUND",
    );
    validateCurrentPublicationArtifacts(evidence.artifacts);
    publicationArtifacts = evidence.artifacts;
  }
  validateCurrentAdmissionOverlay({
    record,
    reference,
    candidate,
    base,
    protectedAncestor: inventory(root, a.protectedBaseAncestorSha),
    publicationArtifacts,
  });
  const preserved = inventory(root, a.preservationRevision);
  for (const entry of record.immutableHistory)
    need(preserved.get(entry.path) === `${entry.mode ?? "100644"} blob ${entry.blob}`, "HISTORICAL_BLOB_CHANGED");
  const readProof = (proof) => {
    need(base.get(proof.path)?.startsWith("100644 blob "), "PROTECTED_PROOF_MODE_INVALID");
    const bytes = git(root, ["show", `${baseSha}:${proof.path}`], true);
    need(sha256(bytes) === proof.sha256, "PROTECTED_PROOF_CHANGED");
    return bytes;
  };
  const ledger = JSON.parse(readProof(a.historyLedger).toString());
  need(
    same(ledger.cumulativeHistory, a.cumulativeHistory) &&
      ledger.requiredReviewIterations === a.requiredReviewIterations &&
      ledger.requiredReviewOrdinal === record.remainingIndependentReviewOrdinal &&
      same(ledger.historicalRuns, a.historicalRuns),
    "LEDGER_CHANGED",
  );
  readProof(a.disposition);
  return currentAdmissionBinding(record);
}

// Pure comparison only. The caller still reads authenticated Git revisions and binds the current report.
export function validateCurrentAdmissionOverlay({
  record,
  reference,
  candidate,
  protectedAncestor,
  base,
  publicationArtifacts = [],
}) {
  validateCurrentAdmissionRecord(record);
  const a = record.currentSourceAdmission;
  const overlays = new Map(a.protectedOverlay.map((entry) => [entry.path, entry]));
  const metadata = (entry, prefix) =>
    entry[`${prefix}Mode`] === null ? undefined : `${entry[`${prefix}Mode`]} blob ${entry[`${prefix}Blob`]}`;
  for (const file of new Set([...protectedAncestor.keys(), ...base.keys()])) {
    if (file === "testing/product-experience-exceptions.json") continue;
    const overlay = overlays.get(file);
    need(
      overlay
        ? protectedAncestor.get(file) === metadata(overlay, "old") && base.get(file) === metadata(overlay, "new")
        : protectedAncestor.get(file) === base.get(file),
      "PROTECTED_BASE_OVERLAY_CHANGED",
    );
  }
  for (const entry of overlays.values()) {
    need(
      protectedAncestor.get(entry.path) === metadata(entry, "old") && base.get(entry.path) === metadata(entry, "new"),
      "PROTECTED_BASE_OVERLAY_CHANGED",
    );
    need(candidate.get(entry.path) === metadata(entry, "candidate"), "CANDIDATE_OVERLAY_CHANGED");
  }
  if (publicationArtifacts.length) validateCurrentPublicationArtifacts(publicationArtifacts);
  const publication = new Set([...a.publicationFiles, ...publicationArtifacts.map(({ path }) => path)]);
  for (const file of publication)
    need(!candidate.has(file) || candidate.get(file).startsWith("100644 blob "), "CURRENT_PUBLICATION_MODE_INVALID");
  for (const file of new Set([...reference.keys(), ...candidate.keys()])) {
    if (file === "testing/product-experience-exceptions.json" || publication.has(file) || overlays.has(file)) continue;
    need(reference.get(file) === candidate.get(file), "SOURCE_OR_UNDECLARED_PUBLICATION_CHANGED");
  }
  for (const file of new Set([...base.keys(), ...candidate.keys()]))
    if (
      /^(?:scripts\/sounding-line\/|tests\/sounding-line\/|\.github\/workflows\/)/u.test(file) ||
      file === "package.json" ||
      file === "testing/product-experience-exceptions.json"
    )
      need(base.get(file) === candidate.get(file), "CANDIDATE_AUTHORITY_CHANGED");
}

export function validateCurrentAdmissionEvidence(plan, evidence, automatedOnly = false) {
  if (!isCurrentAdmissionPlan(plan)) return;
  need(same(evidence?.exception, plan.exception), "EVIDENCE_BINDING_MISSING");
  validateCurrentPublicationArtifacts(evidence.artifacts);
  if (automatedOnly) return;
  const a = plan.exception.currentSourceAdmission;
  need(
    Array.isArray(evidence.reviews) &&
      evidence.reviews.length === plan.contractIds.length &&
      unique(evidence.reviews.map((review) => review.contractId)) &&
      new Set(evidence.reviews.map((review) => review.reviewerContext)).size === 1 &&
      same(evidence.reviews.map((review) => review.contractId).sort(), [...plan.contractIds].sort()),
    "REVIEW_SCOPE_CHANGED",
  );
  for (const review of evidence.reviews)
    need(
      review.iterations === a.requiredReviewIterations &&
        review.independentReviewOrdinal === plan.exception.independentReviewOrdinal &&
        same(review.cumulativeHistory, a.cumulativeHistory) &&
        (review.findings === undefined ||
          (Array.isArray(review.findings) &&
            new Set(review.findings.map((finding) => finding.id)).size === review.findings.length)),
      "REVIEW_HISTORY_CHANGED",
    );
}
export function validateCurrentPublicationArtifacts(artifacts) {
  need(
    Array.isArray(artifacts) &&
      artifacts.length > 0 &&
      artifacts.length <= 4096 &&
      unique(artifacts.map((artifact) => artifact.id)) &&
      artifacts.every(
        (artifact) =>
          typeof artifact.id === "string" &&
          artifact.id.length > 0 &&
          safePath(artifact.path) &&
          artifact.path.startsWith("Development_Docs/Testing/Product_Experience/evidence/") &&
          { screenshot: ".png", recording: ".webm", trace: ".zip" }[artifact.type] &&
          artifact.path.endsWith({ screenshot: ".png", recording: ".webm", trace: ".zip" }[artifact.type]) &&
          sha(artifact.sha256, 64) &&
          typeof artifact.contractId === "string" &&
          (artifact.type !== "screenshot" || typeof artifact.state === "string") &&
          typeof artifact.device === "string" &&
          typeof artifact.role === "string" &&
          typeof artifact.motionMode === "string",
      ),
    "CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID",
  );
  const byPath = new Map();
  for (const artifact of artifacts) {
    const group = byPath.get(artifact.path) ?? [];
    group.push(artifact);
    byPath.set(artifact.path, group);
  }
  for (const group of byPath.values()) {
    if (group.length === 1) continue;
    const first = group[0];
    const pairedCase = PAIRED_CASES.find((entry) => first.state === `PAIRED_${entry.id}`);
    const physicalIdentity = (artifact) => {
      const identity = { ...artifact };
      delete identity.id;
      delete identity.contractId;
      return identity;
    };
    need(
      group.length === PAIRED_CONTRACTS.length &&
        same(group.map(({ contractId }) => contractId).sort(), [...PAIRED_CONTRACTS].sort()) &&
        pairedCase &&
        first.origin === "ACTUAL_APPLICATION" &&
        first.role === "PLAYER" &&
        ["DESKTOP", "MOBILE"].includes(first.device) &&
        first.motionMode === pairedCase.motionMode &&
        group.every(
          (artifact) =>
            same(physicalIdentity(artifact), physicalIdentity(first)) &&
            artifact.id ===
              `${artifact.contractId}-${pairedCase.id}-${artifact.device}-${artifact.type}-${artifact.path.split("/").at(-1)}`,
        ),
      "CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID",
    );
  }
}
export function validateCurrentCaptureIdentity(plan, capture, evidence) {
  if (!isCurrentAdmissionPlan(plan)) return;
  validateCurrentPublicationArtifacts(capture.artifacts);
  validateCurrentPublicationArtifacts(evidence.artifacts);
  const identity = (artifacts) =>
    artifacts.map(({ id, path, sha256, type, contractId, state, device, role, motionMode }) => ({
      id,
      path,
      sha256,
      type,
      contractId,
      state,
      device,
      role,
      motionMode,
    }));
  need(same(identity(capture.artifacts), identity(evidence.artifacts)), "CURRENT_CAPTURE_PATH_OR_CONTEXT_CHANGED");
}

export function currentRunIdentity(run) {
  return {
    id: run.id,
    runAttempt: run.run_attempt,
    workflowId: run.workflow_id,
    event: run.event,
    headSha: run.head_sha,
    headBranch: run.head_branch,
    actor: run.actor?.login,
    triggeringActor: run.triggering_actor?.login,
    repository: run.head_repository?.full_name,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    displayTitle: run.display_title,
    checkSuiteId: run.check_suite_id,
  };
}
export function assertCurrentAdmissionCap(record, stage) {
  validateCurrentAdmissionRecord(record);
  need(record.currentSourceAdmission.caps[stage] === 1, "STAGE_NOT_AUTHORIZED");
}
export async function validateCurrentFailedPreparation({ record, request, storeFor }) {
  validateCurrentAdmissionRecord(record);
  need(record.version === 16, "R16_RECORD_REQUIRED");
  const p = record.predecessor;
  const spent = storeFor({
    id: p.id,
    custody: { namespace: `sounding-line-exceptions/${p.id}` },
  });
  const preparation = await spent.read("prepare");
  need(preparation?.commitSha === p.prepareCommit, "R15_SPENT_PREPARATION_CHANGED");
  const { commitSha: preparationCommit, ...preparationPayload } = preparation;
  need(
    preparationCommit === p.prepareCommit &&
      hash(preparationPayload) === p.preparePayloadDigest &&
      preparationPayload.version === 1 &&
      preparationPayload.exceptionId === p.id &&
      preparation.binding?.exception?.id === p.id &&
      preparation.binding.exception.recordDigest === p.recordDigest &&
      preparation.binding.baseSha === p.baseSha &&
      preparation.binding.sourceDigest === p.sourceDigest &&
      preparation.binding.contractDigest === p.contractDigest &&
      preparation.candidateSha === p.candidateSha &&
      preparation.run?.runId === p.runId &&
      preparation.run.runAttempt === p.runAttempt &&
      preparation.run.workflowId === p.workflowId &&
      preparation.run.headSha === p.headSha &&
      preparation.run.event === p.event &&
      preparation.status === "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING" &&
      preparation.independentReviewsCompleted === 7 &&
      preparation.reservedIndependentReviewOrdinal === 8,
    "R15_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of ["capture", "review-submit", "review8", "qualify", "qualified"])
    need(!(await spent.read(slot)), "R15_UNEXPECTED_SUCCESS_SLOT");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R15_CANDIDATE_TREE_CHANGED");
}
export async function validateCurrentAdmissionPredecessors({ record, request, storeFor }) {
  validateCurrentAdmissionRecord(record);
  const successor = record.version === 16;
  const legacyPredecessor = successor ? CURRENT_R15_LEGACY_PREDECESSOR : record.predecessor;
  const previous = storeFor({
    id: CURRENT_LEGACY.id,
    custody: {
      namespace: `sounding-line-exceptions/${CURRENT_LEGACY.id}`,
    },
  });
  const qualifier = await previous.read("qualify");
  need(
    qualifier && qualifier.commitSha === CURRENT_LEGACY.qualifyCommit && !(await previous.read("qualified")),
    "SPENT_PREDECESSOR_CHANGED",
  );
  const { commitSha, ...payload } = qualifier;
  need(
    commitSha === legacyPredecessor.qualifyCommit &&
      hash(payload) === legacyPredecessor.qualifyPayloadDigest &&
      qualifier.binding?.exception?.id === CURRENT_LEGACY.id &&
      qualifier.binding.exception.recordDigest === CURRENT_LEGACY.recordDigest &&
      qualifier.run?.runId === CURRENT_LEGACY.runId,
    "SPENT_PREDECESSOR_CHANGED",
  );
  if (successor) await validateCurrentFailedPreparation({ record, request, storeFor });
  const observed = [];
  for (const expected of record.currentSourceAdmission.historicalRuns) {
    const actual = await request(`actions/runs/${expected.id}`);
    need(same(currentRunIdentity(actual), expected), "HISTORICAL_RUN_CHANGED");
    observed.push(actual);
  }
  need(
    Array.isArray(legacyPredecessor.artifacts) && legacyPredecessor.artifacts.length > 0,
    "PREDECESSOR_ARTIFACT_REQUIRED",
  );
  for (const { expected, runId } of [
    ...legacyPredecessor.artifacts.map((expected) => ({
      expected,
      runId: CURRENT_LEGACY.runId,
    })),
    ...(successor
      ? record.predecessor.artifacts.map((expected) => ({
          expected,
          runId: record.predecessor.runId,
        }))
      : []),
  ]) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      positive(expected.id) &&
        positive(expected.bytes) &&
        sha(expected.sha256, 64) &&
        artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === runId,
      "PREDECESSOR_ARTIFACT_CHANGED",
    );
  }
  return observed;
}
export function validateCurrentAdmissionFinalDecision({
  plan,
  ordinary,
  record,
  decision,
  groups,
  run,
  publicationNonce,
}) {
  validateCurrentAdmissionRecord(record);
  const a = record.currentSourceAdmission,
    attestation = decision.productExperience?.trustedAttestation;
  need(
    isCurrentAdmissionPlan(plan) &&
      same(plan.exception, currentAdmissionBinding(record)) &&
      decision.decision === "PASS" &&
      decision.baseSha === plan.baseSha &&
      decision.candidateSha === plan.candidateSha &&
      same(ordinary.selected.browserTests, record.requiredTechnicalBrowserTests) &&
      same(decision.selected?.browserTests, record.requiredTechnicalBrowserTests) &&
      decision.productExperience?.sourceDigest === plan.sourceDigest &&
      same(decision.productExperience?.exception, plan.exception) &&
      decision.productExperience?.baseSha === plan.baseSha &&
      decision.productExperience?.contractDigest === plan.contractDigest &&
      decision.productExperience?.contextCount === a.contextCount &&
      decision.productExperienceDecision?.status === "PASS" &&
      decision.productExperienceDecision.sourceDigest === plan.sourceDigest &&
      decision.productExperienceReplay?.status === "PASS" &&
      decision.productExperienceReplay.sourceDigest === plan.sourceDigest &&
      attestation?.status === "PASS" &&
      same(attestation.exception, plan.exception) &&
      attestation.currentBaseSha === plan.baseSha &&
      attestation.currentSourceDigest === plan.sourceDigest &&
      attestation.currentContractDigest === plan.contractDigest &&
      attestation.currentCandidateSha === plan.candidateSha &&
      positive(attestation.captureArtifactId) &&
      positive(attestation.reviewArtifactId) &&
      attestation.exceptionCustody?.prepareReservation &&
      attestation.exceptionCustody?.reviewSeal,
    "FINAL_CURRENT_ATTESTATION_CHANGED",
  );
  const observation = decision.currentAdmissionObservation;
  need(
    observation?.status === "COMPLETE" &&
      observation.observationId === a.observation.id &&
      observation.exceptionId === record.id &&
      observation.recordDigest === plan.exception.recordDigest &&
      observation.repository === record.repository &&
      observation.baseSha === plan.baseSha &&
      observation.candidateSha === plan.candidateSha &&
      observation.sourceDigest === plan.sourceDigest &&
      observation.contractDigest === plan.contractDigest &&
      positive(run?.runId) &&
      observation.runId === run.runId &&
      observation.runAttempt === 1 &&
      observation.job === "final-check" &&
      observation.keyId === a.observation.keyId &&
      observation.evidenceLoss === false &&
      observation.cleanup === true &&
      observation.sourceUnchanged === true &&
      observation.publicationReady === true &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(publicationNonce ?? "") &&
      observation.publicationNonceDigest === sha256(Buffer.from(publicationNonce)) &&
      observation.memberCount === 2 &&
      observation.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      sha(observation.ciphertextDigest, 64) &&
      positive(observation.ciphertextBytes) &&
      observation.ciphertextBytes <= 64 * 1024 * 1024 &&
      positive(observation.rawBytes) &&
      observation.rawBytes <= 48 * 1024 * 1024 &&
      observation.classification === "PRIVATE_OBSERVATIONS_NOT_ACCEPTANCE" &&
      observation.coverage === "SUPPORTED_REPLAY_ADMISSION_GIT_READS_AND_FINAL_PROPAGATED_ERROR" &&
      positive(observation.supportedGitReads) &&
      Number.isSafeInteger(observation.observedGitThrows) &&
      observation.observedGitThrows >= 0 &&
      observation.retainedGitThrows === observation.observedGitThrows,
    "CURRENT_OBSERVATION_REQUIRED",
  );
  const reconciliation = decision.evidenceReconciliation,
    finalization = reconciliation?.finalization;
  const ids = groups.map((group) => group.id).sort();
  const exact = (items, field) =>
    Array.isArray(items) &&
    unique(items.map((item) => item[field])) &&
    same(items.map((item) => item[field]).sort(), ids);
  need(
    same(ids, [...a.requiredObligationIds].sort()) &&
      exact(reconciliation?.obligations, "id") &&
      exact(reconciliation?.reconciliation, "obligationId") &&
      exact(finalization?.closure, "obligationId") &&
      finalization.authority === "SOUNDING_LINE_EVIDENCE_FINALIZER" &&
      finalization.decision === "PASS" &&
      finalization.requiredObligations === groups.length &&
      reconciliation.requiredObligations === groups.length &&
      Array.isArray(finalization.errors) &&
      !finalization.errors.length &&
      Array.isArray(finalization.remainder) &&
      !finalization.remainder.length,
    "FINAL_CLOSURE_CHANGED",
  );
  for (const group of groups) {
    const obligation = reconciliation.obligations.find((item) => item.id === group.id);
    const observed = reconciliation.reconciliation.find((item) => item.obligationId === group.id);
    const closure = finalization.closure.find((item) => item.obligationId === group.id);
    need(
      same(obligation.commands, group.commandLabels) &&
        closure.satisfied === true &&
        typeof closure.receiptId === "string" &&
        closure.receiptId &&
        observed.receiptId === closure.receiptId,
      "FINAL_CLOSURE_CHANGED",
    );
    if (
      group.kind === "browser" ||
      group.commands.some(([, args]) => args[0] === "scripts/sounding-line/run-browser-suite.mjs")
    ) {
      const timings = decision.timing?.commands?.filter((entry) => entry.obligationId === group.id);
      need(
        observed.freshExecuted === true &&
          !["PRESERVED", "REBOUND"].includes(observed.disposition) &&
          timings?.length === 1 &&
          timings[0].status === "PASS",
        "FRESH_BROWSER_REQUIRED",
      );
    }
  }
  return { status: "PASS", qualification: false };
}

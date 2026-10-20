import {
  CURRENT_R23,
  R23_BASE_ADOPTION,
  R23_PRESERVED_PROOFS,
  R23_CHECKOUT_RECOVERY,
  CURRENT_R22_FAILED_PREPARATION,
  CURRENT_R22_FAILED_RUN,
} from "./experience-current-r23.mjs";
import {
  CURRENT_R22,
  R22_BASE_ADOPTION,
  R22_PRESERVED_PROOFS,
  CURRENT_R21_NONQUALIFYING_CAPTURE,
  CURRENT_R21_SUCCESSFUL_RUN,
} from "./experience-current-r22.mjs";
import { validateR22MediaFirstReview, validateR23MediaFirstReview } from "./experience-media-first-r22.mjs";
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
import { CURRENT_R17, CURRENT_R16_FAILED_PREPARATION, CURRENT_R16_FAILED_RUN } from "./experience-current-r17.mjs";
import { CURRENT_R18, CURRENT_R17_BLOCKED_CAPTURE, CURRENT_R17_SUCCESSFUL_RUN } from "./experience-current-r18.mjs";
import { CURRENT_R19, CURRENT_R18_FAILED_PREPARATION, CURRENT_R18_FAILED_RUN } from "./experience-current-r19.mjs";
import {
  CURRENT_R20,
  R20_SCOPE,
  CURRENT_R19_BLOCKED_CAPTURE,
  CURRENT_R19_SUCCESSFUL_RUN,
} from "./experience-current-r20.mjs";
import {
  CURRENT_R21,
  R21_BASE_ADOPTION,
  R21_PRESERVED_PROOFS,
  CURRENT_R20_NONQUALIFYING_CAPTURE,
  CURRENT_R20_SUCCESSFUL_RUN,
} from "./experience-current-r21.mjs";
import { validateR21MediaFirstReview } from "./experience-media-first-r21.mjs";
import {
  validateR20ScopeRecord,
  validateR20ContractSource,
  validateR20TransferDocuments,
  validateScopedR20Finding,
} from "./experience-scope-adjudication.mjs";

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
  const successor16 = record?.version === CURRENT_R16.version;
  const successor17 = record?.version === CURRENT_R17.version;
  const successor18 = record?.version === CURRENT_R18.version;
  const successor19 = record?.version === CURRENT_R19.version;
  const successor20 = record?.version === CURRENT_R20.version;
  const successor21 = record?.version === CURRENT_R21.version;
  const successor22 = record?.version === CURRENT_R22.version;
  const successor23 = record?.version === CURRENT_R23.version;
  const successor =
    successor16 ||
    successor17 ||
    successor18 ||
    successor19 ||
    successor20 ||
    successor21 ||
    successor22 ||
    successor23;
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
    (successor23
      ? same(record.predecessor, CURRENT_R22_FAILED_PREPARATION)
      : successor22
        ? same(record.predecessor, CURRENT_R21_NONQUALIFYING_CAPTURE)
        : successor21
          ? same(record.predecessor, CURRENT_R20_NONQUALIFYING_CAPTURE)
          : successor20
            ? same(record.predecessor, CURRENT_R19_BLOCKED_CAPTURE)
            : successor19
              ? same(record.predecessor, CURRENT_R18_FAILED_PREPARATION)
              : successor18
                ? same(record.predecessor, CURRENT_R17_BLOCKED_CAPTURE)
                : successor17
                  ? same(record.predecessor, CURRENT_R16_FAILED_PREPARATION)
                  : successor16
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
  if (successor16) {
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
  if (successor17) {
    need(
      record.id === CURRENT_R17.id &&
        record.frozenReferenceSha === CURRENT_R17.frozenReferenceSha &&
        a.preservationRevision === CURRENT_R17.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R17.protectedBaseAncestorSha &&
        same(record.ownerApproval, CURRENT_R17.ownerApproval) &&
        record.expiresAt === CURRENT_R17.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R17.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R17.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R17.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R17.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R17.immutableHistoryDigest &&
        a.historicalRuns.length === 19 &&
        hash(a.historicalRuns.slice(0, 18)) === CURRENT_R17.previousRunsDigest &&
        same(a.historicalRuns[18], CURRENT_R16_FAILED_RUN) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R17.previousRecordDigest),
      "R17_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor18) {
    const immutablePaths = new Set(record.immutableHistory.map((entry) => entry.path));
    need(
      a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)),
      "R18_IMMUTABLE_HISTORY_OVERLAY_FORBIDDEN",
    );
    need(
      record.id === CURRENT_R18.id &&
        record.frozenReferenceSha === CURRENT_R18.frozenReferenceSha &&
        a.preservationRevision === CURRENT_R18.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R18.protectedBaseAncestorSha &&
        same(record.ownerApproval, CURRENT_R18.ownerApproval) &&
        record.expiresAt === CURRENT_R18.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R18.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R18.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R18.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R18.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R18.immutableHistoryDigest &&
        a.historicalRuns.length === 20 &&
        hash(a.historicalRuns.slice(0, 19)) === CURRENT_R18.previousRunsDigest &&
        same(a.historicalRuns[19], CURRENT_R17_SUCCESSFUL_RUN) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R18.previousRecordDigest) &&
        Array.isArray(CURRENT_R18.repairedProductFiles) &&
        same(CURRENT_R18.repairedProductFiles.map((entry) => entry.path).sort(), [...CURRENT_R18.repairPaths].sort()) &&
        unique(CURRENT_R18.repairedProductFiles.map((entry) => entry.path)) &&
        CURRENT_R18.repairedProductFiles.every(
          (entry) =>
            safePath(entry.path) &&
            /^(?:src\/|tests\/e2e\/)/u.test(entry.path) &&
            (entry.oldMode === null ? entry.oldBlob === null : entry.oldMode === "100644" && sha(entry.oldBlob)) &&
            entry.newMode === "100644" &&
            sha(entry.newBlob),
        ),
      "R18_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor19) {
    const immutablePaths = new Set(record.immutableHistory.map((entry) => entry.path));
    need(
      a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)),
      "R19_IMMUTABLE_HISTORY_OVERLAY_FORBIDDEN",
    );
    need(
      record.id === CURRENT_R19.id &&
        record.frozenReferenceSha === CURRENT_R19.frozenReferenceSha &&
        a.preservationRevision === CURRENT_R19.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R19.protectedBaseAncestorSha &&
        same(record.ownerApproval, CURRENT_R19.ownerApproval) &&
        record.expiresAt === CURRENT_R19.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R19.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R19.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R19.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R19.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R19.immutableHistoryDigest &&
        a.historicalRuns.length === 21 &&
        hash(a.historicalRuns.slice(0, 20)) === CURRENT_R19.previousRunsDigest &&
        same(a.historicalRuns[20], CURRENT_R18_FAILED_RUN) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R19.previousRecordDigest) &&
        Array.isArray(CURRENT_R19.repairedProductFiles) &&
        same(CURRENT_R19.repairedProductFiles.map((entry) => entry.path).sort(), [...CURRENT_R19.repairPaths].sort()) &&
        unique(CURRENT_R19.repairedProductFiles.map((entry) => entry.path)) &&
        CURRENT_R19.repairedProductFiles.every(
          (entry) =>
            safePath(entry.path) &&
            /^(?:src\/|tests\/e2e\/)/u.test(entry.path) &&
            entry.oldMode === "100644" &&
            sha(entry.oldBlob) &&
            entry.newMode === "100644" &&
            sha(entry.newBlob),
        ),
      "R19_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor20) {
    validateR20ScopeRecord(record);
    const immutablePaths = new Set(record.immutableHistory.map((entry) => entry.path));
    need(
      now.getTime() >= Date.parse(CURRENT_R20.ownerApproval.approvedAtUtcMinute) &&
        a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)) &&
        a.preservationRevision === CURRENT_R20.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R20.protectedBaseAncestorSha &&
        record.expiresAt === CURRENT_R20.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R20.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R20.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R20.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R20.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R20.immutableHistoryDigest &&
        a.historicalRuns.length === 22 &&
        hash(a.historicalRuns.slice(0, 21)) === CURRENT_R20.previousRunsDigest &&
        same(a.historicalRuns[21], CURRENT_R19_SUCCESSFUL_RUN) &&
        same(a.adjudication, CURRENT_R20.adjudication) &&
        same(a.caps, { capture: 1, review: 1, ordinary: 1, technical: 1, replay: 1 }) &&
        record.contexts === 32 &&
        a.contextCount === 38 &&
        a.pairedBrowserContexts === 6 &&
        same([...record.contractIds].sort(), [...requiredContracts].sort()) &&
        same([...record.requiredTechnicalBrowserTests].sort(), [...requiredBrowsers].sort()) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R20.previousRecordDigest),
      "R20_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor21) {
    const immutablePaths = new Set([
      ...record.immutableHistory.map((entry) => entry.path),
      ...R21_PRESERVED_PROOFS.map((entry) => entry.path),
    ]);
    need(
      record.id === CURRENT_R21.id &&
        record.frozenReferenceSha === CURRENT_R21.frozenReferenceSha &&
        same(record.ownerApproval, CURRENT_R21.ownerApproval) &&
        now.getTime() >= Date.parse(CURRENT_R21.ownerApproval.approvedAtUtcMinute) &&
        a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)) &&
        a.preservationRevision === CURRENT_R21.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R21.protectedBaseAncestorSha &&
        record.expiresAt === CURRENT_R21.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R21.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R21.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R21.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R21.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R21.immutableHistoryDigest &&
        a.historicalRuns.length === 23 &&
        hash(a.historicalRuns.slice(0, 22)) === CURRENT_R21.previousRunsDigest &&
        same(a.historicalRuns[22], CURRENT_R20_SUCCESSFUL_RUN) &&
        record.contractDigest === R20_SCOPE.approvedContractDigest &&
        same(a.scopeAdjudication, R20_SCOPE) &&
        same(a.adjudication, CURRENT_R20.adjudication) &&
        same(a.acceptedBaseAdoption, R21_BASE_ADOPTION) &&
        same(a.preservedR20Proofs, R21_PRESERVED_PROOFS) &&
        same(a.reviewProtocol, CURRENT_R21.reviewProtocol) &&
        same(a.caps, { capture: 1, review: 1, ordinary: 1, technical: 1, replay: 1 }) &&
        record.contexts === 32 &&
        a.contextCount === 38 &&
        a.pairedBrowserContexts === 6 &&
        same([...record.contractIds].sort(), [...requiredContracts].sort()) &&
        same([...record.requiredTechnicalBrowserTests].sort(), [...requiredBrowsers].sort()) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R21.previousRecordDigest),
      "R21_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor22) {
    const immutablePaths = new Set([
      ...record.immutableHistory.map((entry) => entry.path),
      ...R21_PRESERVED_PROOFS.map((entry) => entry.path),
      ...R22_PRESERVED_PROOFS.map((entry) => entry.path),
    ]);
    need(
      record.id === CURRENT_R22.id &&
        record.frozenReferenceSha === CURRENT_R22.frozenReferenceSha &&
        same(record.ownerApproval, CURRENT_R22.ownerApproval) &&
        now.getTime() >= Date.parse(CURRENT_R22.ownerApproval.approvedAtUtcMinute) &&
        a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)) &&
        a.preservationRevision === CURRENT_R22.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R22.protectedBaseAncestorSha &&
        record.expiresAt === CURRENT_R22.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R22.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R22.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R22.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R22.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R22.immutableHistoryDigest &&
        a.historicalRuns.length === 24 &&
        hash(a.historicalRuns.slice(0, 23)) === CURRENT_R22.previousRunsDigest &&
        same(a.historicalRuns[23], CURRENT_R21_SUCCESSFUL_RUN) &&
        record.contractDigest === R20_SCOPE.approvedContractDigest &&
        same(a.scopeAdjudication, R20_SCOPE) &&
        same(a.adjudication, CURRENT_R20.adjudication) &&
        same(a.acceptedBaseAdoption, R21_BASE_ADOPTION) &&
        same(a.frozenInputAdoption, R22_BASE_ADOPTION) &&
        same(a.preservedR21Proofs, R22_PRESERVED_PROOFS) &&
        same(a.preservedR20Proofs, R21_PRESERVED_PROOFS) &&
        same(a.reviewProtocol, CURRENT_R22.reviewProtocol) &&
        same(a.caps, { capture: 1, review: 1, ordinary: 1, technical: 1, replay: 1 }) &&
        record.contexts === 32 &&
        a.contextCount === 38 &&
        a.pairedBrowserContexts === 6 &&
        same([...record.contractIds].sort(), [...requiredContracts].sort()) &&
        same([...record.requiredTechnicalBrowserTests].sort(), [...requiredBrowsers].sort()) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R22.previousRecordDigest),
      "R22_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  if (successor23) {
    const immutablePaths = new Set([
      ...record.immutableHistory.map((entry) => entry.path),
      ...R21_PRESERVED_PROOFS.map((entry) => entry.path),
      ...R22_PRESERVED_PROOFS.map((entry) => entry.path),
      ...R23_PRESERVED_PROOFS.map((entry) => entry.path),
    ]);
    need(
      record.id === CURRENT_R23.id &&
        record.frozenReferenceSha === CURRENT_R23.frozenReferenceSha &&
        same(record.ownerApproval, CURRENT_R23.ownerApproval) &&
        now.getTime() >= Date.parse(CURRENT_R23.ownerApproval.approvedAtUtc) &&
        a.protectedOverlay.every((entry) => !immutablePaths.has(entry.path)) &&
        a.preservationRevision === CURRENT_R23.preservationRevision &&
        a.protectedBaseAncestorSha === CURRENT_R23.protectedBaseAncestorSha &&
        record.expiresAt === CURRENT_R23.expiresAt &&
        same(a.cumulativeHistory, CURRENT_R23.cumulativeHistory) &&
        a.requiredReviewIterations === CURRENT_R23.requiredReviewIterations &&
        record.remainingIndependentReviewOrdinal === CURRENT_R23.remainingIndependentReviewOrdinal &&
        hash(a.legacyR14History) === CURRENT_R23.legacyR14HistoryDigest &&
        hash(record.immutableHistory) === CURRENT_R23.immutableHistoryDigest &&
        a.historicalRuns.length === 25 &&
        hash(a.historicalRuns.slice(0, 24)) === CURRENT_R23.previousRunsDigest &&
        same(a.historicalRuns[24], CURRENT_R22_FAILED_RUN) &&
        record.contractDigest === R20_SCOPE.approvedContractDigest &&
        same(a.scopeAdjudication, R20_SCOPE) &&
        same(a.adjudication, CURRENT_R20.adjudication) &&
        same(a.acceptedBaseAdoption, R21_BASE_ADOPTION) &&
        same(a.frozenInputAdoption, R23_BASE_ADOPTION) &&
        same(a.preservedR21Proofs, R22_PRESERVED_PROOFS) &&
        same(a.preservedR22Proofs, R23_PRESERVED_PROOFS) &&
        same(a.checkoutRecovery, R23_CHECKOUT_RECOVERY) &&
        same(a.preservedR20Proofs, R21_PRESERVED_PROOFS) &&
        same(a.reviewProtocol, CURRENT_R23.reviewProtocol) &&
        same(a.caps, { capture: 1, review: 1, ordinary: 1, technical: 1, replay: 1 }) &&
        record.contexts === 32 &&
        a.contextCount === 38 &&
        a.pairedBrowserContexts === 6 &&
        same([...record.contractIds].sort(), [...requiredContracts].sort()) &&
        same([...record.requiredTechnicalBrowserTests].sort(), [...requiredBrowsers].sort()) &&
        (legacyCurrentRecord === undefined || hash(legacyCurrentRecord) === CURRENT_R23.previousRecordDigest),
      "R23_SCOPE_OR_SPENT_HISTORY_CHANGED",
    );
  }
  return record;
}

export function validateCurrentAdmissionRegistry(registry, now, { requiredVersion } = {}) {
  if (
    requiredVersion === 23 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 23))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 23, "R23_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 22) };
    need(hash(prior) === CURRENT_R23.previousRegistryDigest, "R23_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 22 });
    const current = registry.exceptions[22];
    need(current?.version === 23 && isCurrentAdmissionRecord(current), "R23_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[21],
    });
    return current;
  }
  if (
    requiredVersion === 22 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 22))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 22, "R22_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 21) };
    need(hash(prior) === CURRENT_R22.previousRegistryDigest, "R22_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 21 });
    const current = registry.exceptions[21];
    need(current?.version === 22 && isCurrentAdmissionRecord(current), "R22_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[20],
    });
    return current;
  }
  if (
    requiredVersion === 21 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 21))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 21, "R21_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 20) };
    need(hash(prior) === CURRENT_R21.previousRegistryDigest, "R21_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 20 });
    const current = registry.exceptions[20];
    need(current?.version === 21 && isCurrentAdmissionRecord(current), "R21_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[19],
    });
    return current;
  }
  if (
    requiredVersion === 20 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 20))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 20, "R20_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 19) };
    need(hash(prior) === CURRENT_R20.previousRegistryDigest, "R20_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 19 });
    const current = registry.exceptions[19];
    need(current?.version === 20 && isCurrentAdmissionRecord(current), "R20_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[18],
    });
    return current;
  }
  if (
    requiredVersion === 19 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 19))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 19, "R19_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 18) };
    need(hash(prior) === CURRENT_R19.previousRegistryDigest, "R19_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 18 });
    const current = registry.exceptions[18];
    need(current?.version === 19 && isCurrentAdmissionRecord(current), "R19_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[17],
    });
    return current;
  }
  if (
    requiredVersion === 18 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 18))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 18, "R18_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 17) };
    need(hash(prior) === CURRENT_R18.previousRegistryDigest, "R18_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 17 });
    const current = registry.exceptions[17];
    need(current?.version === 18 && isCurrentAdmissionRecord(current), "R18_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[16],
    });
    return current;
  }
  if (
    requiredVersion === 17 ||
    (requiredVersion === undefined &&
      registry?.exceptions?.some((record) => isCurrentAdmissionRecord(record) && record.version === 17))
  ) {
    need(registry?.version === 1 && registry.exceptions.length === 17, "R17_REGISTRY_INVALID");
    const prior = { ...registry, exceptions: registry.exceptions.slice(0, 16) };
    need(hash(prior) === CURRENT_R17.previousRegistryDigest, "R17_PREDECESSOR_REGISTRY_CHANGED");
    validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 16 });
    const current = registry.exceptions[16];
    need(current?.version === 17 && isCurrentAdmissionRecord(current), "R17_REGISTRY_INVALID");
    validateCurrentAdmissionRecord(current, {
      now,
      legacyRecord: prior.exceptions.find((record) => record.id === CURRENT_LEGACY.id),
      legacyCurrentRecord: prior.exceptions[15],
    });
    return current;
  }
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
  let repairs =
    record.version === 18
      ? validateCurrentProductRepair({
          priorRepair: inventory(root, CURRENT_R18.repairReferenceSha),
          reference,
          candidate,
          actualRepairPaths: git(root, [
            "diff",
            "--name-only",
            "--no-renames",
            CURRENT_R18.repairReferenceSha,
            record.frozenReferenceSha,
          ])
            .trim()
            .split(/\r?\n/u)
            .filter(Boolean),
        })
      : new Map();
  if ([19, 20, 21, 22, 23].includes(record.version)) {
    const inherited = inventory(root, CURRENT_R18.frozenReferenceSha);
    validateCurrentProductRepair({
      priorRepair: inventory(root, CURRENT_R18.repairReferenceSha),
      reference: inherited,
      candidate: inherited,
      actualRepairPaths: git(root, [
        "diff",
        "--name-only",
        "--no-renames",
        CURRENT_R18.repairReferenceSha,
        CURRENT_R18.frozenReferenceSha,
      ])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean),
    });
    repairs = validateCurrentR19ProductRepair({
      priorRepair: inventory(root, CURRENT_R19.repairReferenceSha),
      reference: [20, 21, 22, 23].includes(record.version)
        ? inventory(root, CURRENT_R19.frozenReferenceSha)
        : reference,
      candidate,
      actualRepairPaths: git(root, [
        "diff",
        "--name-only",
        "--no-renames",
        CURRENT_R19.repairReferenceSha,
        CURRENT_R19.frozenReferenceSha,
      ])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean),
    });
  }
  if ([20, 21, 22, 23].includes(record.version)) {
    const contractReference = [21, 22, 23].includes(record.version)
      ? CURRENT_R20.frozenReferenceSha
      : record.frozenReferenceSha;
    git(root, ["merge-base", "--is-ancestor", R20_SCOPE.originalCandidateSha, contractReference]);
    validateR20ContractSource({
      before: inventory(root, R20_SCOPE.originalCandidateSha),
      after: [21, 22, 23].includes(record.version) ? inventory(root, contractReference) : reference,
      actualPaths: git(root, ["diff", "--name-only", "--no-renames", R20_SCOPE.originalCandidateSha, contractReference])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean),
      original: JSON.parse(git(root, ["show", `${R20_SCOPE.originalCandidateSha}:testing/contracts.json`])),
      amended: JSON.parse(git(root, ["show", `${contractReference}:testing/contracts.json`])),
    });
  }
  if ([21, 22, 23].includes(record.version)) {
    need(
      git(root, ["rev-parse", `${CURRENT_R21.frozenReferenceSha}^{tree}`]).trim() === CURRENT_R21.frozenReferenceTree,
      "R21_FROZEN_INPUT_TREE_CHANGED",
    );
    need(
      git(root, ["rev-list", "--parents", "-n", "1", CURRENT_R21.frozenReferenceSha]).trim() ===
        [CURRENT_R21.frozenReferenceSha, ...R21_BASE_ADOPTION.parents].join(" "),
      "R21_FROZEN_INPUT_HISTORY_CHANGED",
    );
    validateCurrentR21AcceptedBaseAdoption({
      original: inventory(root, R21_BASE_ADOPTION.originalCandidateSha),
      reference: inventory(root, CURRENT_R21.frozenReferenceSha),
      actualPaths: git(root, [
        "diff",
        "--name-only",
        "--no-renames",
        R21_BASE_ADOPTION.originalCandidateSha,
        CURRENT_R21.frozenReferenceSha,
      ])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean),
    });
  }
  if ([22, 23].includes(record.version)) {
    need(
      git(root, ["rev-parse", `${CURRENT_R22.frozenReferenceSha}^{tree}`]).trim() === CURRENT_R22.frozenReferenceTree &&
        git(root, ["rev-list", "--parents", "-n", "1", CURRENT_R22.frozenReferenceSha]).trim() ===
          [CURRENT_R22.frozenReferenceSha, ...R22_BASE_ADOPTION.parents].join(" "),
      "R22_FROZEN_INPUT_CHANGED",
    );
  }
  if (record.version === 23) {
    need(
      git(root, ["rev-parse", `${record.frozenReferenceSha}^{tree}`]).trim() === CURRENT_R23.frozenReferenceTree &&
        git(root, ["rev-list", "--parents", "-n", "1", record.frozenReferenceSha]).trim() ===
          [record.frozenReferenceSha, ...R23_BASE_ADOPTION.parents].join(" "),
      "R23_FROZEN_INPUT_CHANGED",
    );
  }
  for (const file of originalProductPaths)
    if (file !== "src/app/devices/pair/page.tsx" && !repairs.has(file))
      need(candidate.get(file) === productReference.get(file), "PRESERVED_CROSSDECK_PRODUCT_CHANGED");
  const contractsAt = (revision) => JSON.parse(git(root, ["show", `${revision}:testing/contracts.json`])).contracts;
  const originalContracts = contractsAt(CURRENT_PRODUCT_REFERENCE),
    currentContracts = contractsAt(candidateSha);
  for (const id of requiredContracts.filter((id) => id !== "reach.phase1.foundation")) {
    const actualContract = structuredClone(currentContracts.find((contract) => contract.id === id));
    const approved =
      [20, 21, 22, 23].includes(record.version) && R20_SCOPE.contractChanges.find((entry) => entry.contractId === id);
    if (approved) {
      need(actualContract?.experience?.designTarget === approved.newValue, "R20_CONTRACT_SCOPE_CHANGED");
      actualContract.experience.designTarget = approved.oldValue;
    }
    need(
      same(
        originalContracts.find((contract) => contract.id === id),
        actualContract,
      ),
      "PRESERVED_CROSSDECK_CONTRACT_CHANGED",
    );
  }
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
  if ([18, 19, 20, 21, 22, 23].includes(record.version))
    need(same(ledger.consumedR17, CURRENT_R17_BLOCKED_CAPTURE), "R18_BLOCKED_REVIEW_PROOF_CHANGED");
  if ([19, 20, 21, 22, 23].includes(record.version))
    need(same(ledger.consumedR18, CURRENT_R18_FAILED_PREPARATION), "R19_FAILED_PREPARATION_PROOF_CHANGED");
  if ([20, 21, 22, 23].includes(record.version)) {
    need(same(ledger.consumedR19, CURRENT_R19_BLOCKED_CAPTURE), "R20_BLOCKED_REVIEW_PROOF_CHANGED");
    const adjudication = JSON.parse(readProof(a.adjudication).toString());
    need(same(adjudication.scope, R20_SCOPE), "R20_ADJUDICATION_PROOF_CHANGED");
    validateR20TransferDocuments({
      registry: JSON.parse(readProof(R20_SCOPE.refit.registryProof).toString()),
      previousRegistry: JSON.parse(
        git(root, ["show", `${CURRENT_R20.protectedBaseAncestorSha}:${R20_SCOPE.refit.registryProof.path}`]),
      ),
      packet: readProof(R20_SCOPE.refit.packetProof).toString(),
      ledger: readProof(R20_SCOPE.refit.ledgerProof).toString(),
      previousLedger: git(root, [
        "show",
        `${CURRENT_R20.protectedBaseAncestorSha}:${R20_SCOPE.refit.ledgerProof.path}`,
      ]),
    });
  }
  if ([21, 22, 23].includes(record.version)) {
    need(
      same(ledger.consumedR20, CURRENT_R20_NONQUALIFYING_CAPTURE) &&
        same(ledger.acceptedBaseAdoption, R21_BASE_ADOPTION) &&
        same(
          ledger.reviewProtocol,
          [22, 23].includes(record.version) ? CURRENT_R22.reviewProtocol : CURRENT_R21.reviewProtocol,
        ),
      "R21_NONQUALIFYING_REVIEW_PROOF_CHANGED",
    );
    for (const proof of R21_PRESERVED_PROOFS) readProof(proof);
  }
  if ([22, 23].includes(record.version)) {
    need(
      same(ledger.consumedR21, CURRENT_R21_NONQUALIFYING_CAPTURE) &&
        same(ledger.frozenInputAdoption, record.version === 23 ? R23_BASE_ADOPTION : R22_BASE_ADOPTION) &&
        same(ledger.preservedR21Proofs, R22_PRESERVED_PROOFS),
      "R22_SPENT_FIRST_PASS_PROOF_CHANGED",
    );
    for (const proof of R22_PRESERVED_PROOFS) readProof(proof);
  }
  if (record.version === 23) {
    need(
      same(ledger.consumedR22, CURRENT_R22_FAILED_PREPARATION) &&
        same(ledger.ownerApproval, CURRENT_R23.ownerApproval) &&
        same(ledger.preservedR22Proofs, R23_PRESERVED_PROOFS) &&
        same(ledger.checkoutRecovery, R23_CHECKOUT_RECOVERY),
      "R23_CHECKOUT_FAILURE_PROOF_CHANGED",
    );
    for (const proof of R23_PRESERVED_PROOFS) readProof(proof);
  }
  readProof(a.disposition);
  return currentAdmissionBinding(record);
}

// Only the exact already-accepted PR777 inheritance may separate frozen C20
// from the owner's normal-history input. This grants no capture compatibility.
export function validateCurrentR21AcceptedBaseAdoption({ original, reference, actualPaths }) {
  const changes = new Map(R21_BASE_ADOPTION.paths.map((entry) => [entry.path, entry]));
  need(same([...actualPaths].sort(), [...changes.keys()].sort()), "R21_ACCEPTED_BASE_ADOPTION_CHANGED");
  const metadata = (entry, prefix) =>
    entry[`${prefix}Mode`] === null ? undefined : `${entry[`${prefix}Mode`]} blob ${entry[`${prefix}Blob`]}`;
  for (const path of new Set([...original.keys(), ...reference.keys()])) {
    const change = changes.get(path);
    need(
      change
        ? original.get(path) === metadata(change, "old") && reference.get(path) === metadata(change, "new")
        : original.get(path) === reference.get(path),
      "R21_ACCEPTED_BASE_ADOPTION_CHANGED",
    );
  }
  return true;
}

// Pure exact-file comparison. Production bindCurrentAdmission validates the fixed
// record first and supplies inventories read from its real Git revisions.
export function validateCurrentProductRepair({ priorRepair, reference, candidate, actualRepairPaths }) {
  need(
    Array.isArray(CURRENT_R18.repairedProductFiles) &&
      same([...actualRepairPaths].sort(), [...CURRENT_R18.repairPaths].sort()),
    "R18_REPAIR_SCOPE_CHANGED",
  );
  const repairs = new Map(CURRENT_R18.repairedProductFiles.map((entry) => [entry.path, entry]));
  for (const entry of repairs.values()) {
    const before = entry.oldMode === null ? undefined : `${entry.oldMode} blob ${entry.oldBlob}`;
    const after = `${entry.newMode} blob ${entry.newBlob}`;
    need(
      priorRepair.get(entry.path) === before &&
        reference.get(entry.path) === after &&
        candidate.get(entry.path) === after,
      "R18_REPAIR_SOURCE_CHANGED",
    );
  }
  return repairs;
}

// Preserve the prior six-file repair; only the new exact two-file delta may change.
export function validateCurrentR19ProductRepair({ priorRepair, reference, candidate, actualRepairPaths }) {
  need(same([...actualRepairPaths].sort(), [...CURRENT_R19.repairPaths].sort()), "R19_REPAIR_SCOPE_CHANGED");
  const repairs = new Map(CURRENT_R18.repairedProductFiles.map((entry) => [entry.path, entry]));
  for (const entry of repairs.values())
    need(priorRepair.get(entry.path) === `${entry.newMode} blob ${entry.newBlob}`, "R19_PRIOR_REPAIR_CHANGED");
  for (const entry of CURRENT_R19.repairedProductFiles) {
    need(priorRepair.get(entry.path) === `${entry.oldMode} blob ${entry.oldBlob}`, "R19_REPAIR_SOURCE_CHANGED");
    repairs.set(entry.path, entry);
  }
  for (const entry of repairs.values())
    need(
      reference.get(entry.path) === `${entry.newMode} blob ${entry.newBlob}` &&
        candidate.get(entry.path) === `${entry.newMode} blob ${entry.newBlob}`,
      "R19_REPAIR_SOURCE_CHANGED",
    );
  return repairs;
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
  if (plan.exception.version === 21) validateR21MediaFirstReview(plan, evidence);
  if (plan.exception.version === 22) validateR22MediaFirstReview(plan, evidence);
  if (plan.exception.version === 23) validateR23MediaFirstReview(plan, evidence);
  if ([18, 19, 20, 21, 22, 23].includes(plan.exception.version)) {
    for (const previous of CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings)
      for (const contractId of previous.contractIds) {
        const review = evidence.reviews.find((entry) => entry.contractId === contractId);
        const findings = review?.findings?.filter((entry) => entry.id === previous.id);
        if ([20, 21, 22, 23].includes(plan.exception.version) && previous.id === "R17-R8-B1") {
          need(findings?.length === 1, "R20_ADJUDICATED_FINDING_REQUIRED");
          validateScopedR20Finding({ plan, finding: findings[0], contractId, artifacts: evidence.artifacts });
          continue;
        }
        need(
          findings?.length === 1 &&
            findings[0].classification === previous.classification &&
            findings[0].contractId === contractId &&
            findings[0].disposition === "RESOLVED" &&
            typeof findings[0].resolution === "string" &&
            findings[0].resolution.trim().length >= 12 &&
            unique(findings[0].repairEvidenceIds) &&
            findings[0].repairEvidenceIds.every((id) =>
              evidence.artifacts.some((artifact) => artifact.id === id && artifact.contractId === contractId),
            ),
          "R18_BLOCKING_FINDING_NOT_RESOLVED",
        );
      }
  }
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
  need([16, 17, 18, 19, 20, 21, 22, 23].includes(record.version), "R16_RECORD_REQUIRED");
  const preparations = [18, 19, 20, 21, 22, 23].includes(record.version)
    ? [CURRENT_R15_FAILED_PREPARATION, CURRENT_R16_FAILED_PREPARATION]
    : record.version === 17
      ? [CURRENT_R15_FAILED_PREPARATION, record.predecessor]
      : [record.predecessor];
  for (const p of preparations) {
    const generation = p.id === CURRENT_R15_FAILED_PREPARATION.id ? "R15" : "R16";
    const spent = storeFor({
      id: p.id,
      custody: { namespace: `sounding-line-exceptions/${p.id}` },
    });
    const preparation = await spent.read("prepare");
    need(preparation?.commitSha === p.prepareCommit, `${generation}_SPENT_PREPARATION_CHANGED`);
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
      `${generation}_SPENT_PREPARATION_CHANGED`,
    );
    for (const slot of ["capture", "review-submit", "review8", "qualify", "qualified"])
      need(!(await spent.read(slot)), `${generation}_UNEXPECTED_SUCCESS_SLOT`);
    const candidate = await request(`git/commits/${p.candidateSha}`);
    need(candidate?.tree?.sha === p.candidateTree, `${generation}_CANDIDATE_TREE_CHANGED`);
  }
}
// A successful capture followed by an actual blocked independent review is not a failed capture.
export async function validateCurrentR18FailedPreparation({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need([19, 20, 21, 22, 23].includes(record.version), "R19_RECORD_REQUIRED");
  const p = CURRENT_R18_FAILED_PREPARATION;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R18_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 18 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.actor === "Kgray44" &&
      payload.run.workflowId === p.workflowId &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R18_FAILED_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW9_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 8 &&
      payload.reservedIndependentReviewOrdinal === 9,
    "R18_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R18_UNEXPECTED_SUCCESS_SLOT");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R18_CANDIDATE_TREE_CHANGED");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R18_FAILED_RUN), "R18_FAILED_CAPTURE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === p.runId &&
        artifact.workflow_run.head_sha === p.headSha,
      "R18_FAILED_CAPTURE_ARTIFACT_CHANGED",
    );
  }
  return prepare;
}

export async function validateCurrentBlockedReviewPredecessor({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need([18, 19, 20, 21, 22, 23].includes(record.version), "R18_RECORD_REQUIRED");
  const p = CURRENT_R17_BLOCKED_CAPTURE;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R17_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 17 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.actor === "Kgray44" &&
      payload.run.workflowId === p.workflowId &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R17_SUCCESSFUL_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 7 &&
      payload.reservedIndependentReviewOrdinal === 8,
    "R17_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R17_UNEXPECTED_SUCCESS_SLOT");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R17_SUCCESSFUL_RUN), "R17_SUCCESSFUL_CAPTURE_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R17_CANDIDATE_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === p.runId,
      "R17_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED",
    );
  }
  return { prepareCommit: p.prepareCommit, runId: p.runId, review: p.blockedReview };
}
export async function validateCurrentR19BlockedCapture({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need([20, 21, 22, 23].includes(record.version), "R20_RECORD_REQUIRED");
  const p = CURRENT_R19_BLOCKED_CAPTURE;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R19_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 19 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.actor === "Kgray44" &&
      payload.run.workflowId === p.workflowId &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R19_SUCCESSFUL_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW9_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 8 &&
      payload.reservedIndependentReviewOrdinal === 9,
    "R19_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R19_UNEXPECTED_SUCCESS_SLOT");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R19_SUCCESSFUL_RUN), "R19_SUCCESSFUL_CAPTURE_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R19_CANDIDATE_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === p.runId &&
        artifact.workflow_run.head_sha === p.headSha,
      "R19_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED",
    );
  }
  return prepare;
}

export async function validateCurrentR20NonqualifyingCapture({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need([21, 22, 23].includes(record.version), "R21_RECORD_REQUIRED");
  const p = CURRENT_R20_NONQUALIFYING_CAPTURE;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R20_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 20 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.actor === "Kgray44" &&
      payload.run.workflowId === p.workflowId &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R20_SUCCESSFUL_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW10_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 9 &&
      payload.reservedIndependentReviewOrdinal === 10,
    "R20_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R20_UNEXPECTED_SUCCESS_SLOT");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R20_SUCCESSFUL_RUN), "R20_SUCCESSFUL_CAPTURE_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R20_CANDIDATE_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === p.runId &&
        artifact.workflow_run.head_sha === p.headSha,
      "R20_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED",
    );
  }
  return prepare;
}

export async function validateCurrentR21NonqualifyingCapture({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need([22, 23].includes(record.version), "R22_RECORD_REQUIRED");
  const p = CURRENT_R21_NONQUALIFYING_CAPTURE;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R21_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 21 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.actor === "Kgray44" &&
      payload.run.workflowId === p.workflowId &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R21_SUCCESSFUL_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW11_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 10 &&
      payload.reservedIndependentReviewOrdinal === 11,
    "R21_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R21_UNEXPECTED_SUCCESS_SLOT");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R21_SUCCESSFUL_RUN), "R21_SUCCESSFUL_CAPTURE_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R21_CANDIDATE_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    need(
      artifact?.id === expected.id &&
        artifact.expired === false &&
        artifact.size_in_bytes === expected.bytes &&
        artifact.digest === `sha256:${expected.sha256}` &&
        artifact.workflow_run?.id === p.runId &&
        artifact.workflow_run.head_sha === p.headSha,
      "R21_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED",
    );
  }
  return prepare;
}

export async function validateCurrentR22FailedPreparation({ record, request, storeFor, observedRun }) {
  validateCurrentAdmissionRecord(record);
  need(record.version === 23, "R23_RECORD_REQUIRED");
  const p = CURRENT_R22_FAILED_PREPARATION;
  const spent = storeFor({ id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
  const prepare = await spent.read("prepare");
  need(prepare?.commitSha === p.prepareCommit, "R22_SPENT_PREPARATION_CHANGED");
  const { commitSha, ...payload } = prepare;
  need(
    commitSha === p.prepareCommit &&
      hash(payload) === p.preparePayloadDigest &&
      Buffer.byteLength(JSON.stringify(payload)) === p.preparePayloadBytes &&
      payload.version === 1 &&
      payload.exceptionId === p.id &&
      payload.binding?.exception?.id === p.id &&
      payload.binding.exception.version === 22 &&
      payload.binding.exception.recordDigest === p.recordDigest &&
      payload.binding.baseSha === p.baseSha &&
      payload.binding.sourceDigest === p.sourceDigest &&
      payload.binding.contractDigest === p.contractDigest &&
      payload.candidateSha === p.candidateSha &&
      payload.run?.runId === p.runId &&
      payload.run.runAttempt === 1 &&
      payload.run.workflowId === p.workflowId &&
      payload.run.actor === "Kgray44" &&
      payload.run.headSha === p.headSha &&
      payload.run.headBranch === p.headBranch &&
      payload.run.event === p.event &&
      payload.run.createdAt === p.createdAt &&
      payload.run.displayTitle === CURRENT_R22_FAILED_RUN.displayTitle &&
      payload.status === "PREPARE_AND_REVIEW12_RESERVED_VALIDATION_PENDING" &&
      payload.independentReviewsCompleted === 11 &&
      payload.reservedIndependentReviewOrdinal === 12,
    "R22_SPENT_PREPARATION_CHANGED",
  );
  for (const slot of p.absentSlots) need(!(await spent.read(slot)), "R22_UNEXPECTED_SUCCESS_SLOT");
  const run = observedRun ?? (await request(`actions/runs/${p.runId}`));
  need(same(currentRunIdentity(run), CURRENT_R22_FAILED_RUN), "R22_FAILED_CAPTURE_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  need(candidate?.tree?.sha === p.candidateTree, "R22_CANDIDATE_TREE_CHANGED");
  const jobs = await request(`actions/runs/${p.runId}/jobs?per_page=100`);
  need(
    jobs?.total_count === p.jobs.length &&
      Array.isArray(jobs.jobs) &&
      jobs.jobs.length === p.jobs.length &&
      same(
        jobs.jobs
          .map((job) => ({ id: job.id, name: job.name, conclusion: job.conclusion }))
          .sort((a, b) => a.id - b.id),
        [...p.jobs].sort((a, b) => a.id - b.id),
      ),
    "R22_CHECKOUT_BOUNDARY_CHANGED",
  );
  const preparation = jobs.jobs.find((job) => job.id === p.checkout.jobId);
  const checkout = preparation?.steps?.find((step) => step.number === p.checkout.stepNumber);
  need(
    checkout?.name === "Run actions/checkout@v4" &&
      checkout.status === "completed" &&
      checkout.conclusion === p.checkout.conclusion &&
      checkout.started_at === p.checkout.startedAt &&
      checkout.completed_at === p.checkout.completedAt &&
      preparation.steps.filter((step) => step.number >= 3 && step.number <= 13).length === 11 &&
      preparation.steps
        .filter((step) => step.number >= 3 && step.number <= 13)
        .every((step) => step.conclusion === "skipped"),
    "R22_CHECKOUT_BOUNDARY_CHANGED",
  );
  const artifacts = await request(`actions/runs/${p.runId}/artifacts?per_page=100`);
  need(
    artifacts?.total_count === 0 && Array.isArray(artifacts.artifacts) && artifacts.artifacts.length === 0,
    "R22_UNEXPECTED_ARTIFACT",
  );
  return prepare;
}

export async function validateCurrentAdmissionPredecessors({ record, request, storeFor }) {
  validateCurrentAdmissionRecord(record);
  const successor = [16, 17, 18, 19, 20, 21, 22, 23].includes(record.version);
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
  if ([18, 19, 20, 21, 22, 23].includes(record.version))
    await validateCurrentBlockedReviewPredecessor({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R17_BLOCKED_CAPTURE.runId),
    });
  if ([19, 20, 21, 22, 23].includes(record.version))
    await validateCurrentR18FailedPreparation({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R18_FAILED_PREPARATION.runId),
    });
  if ([20, 21, 22, 23].includes(record.version))
    await validateCurrentR19BlockedCapture({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R19_BLOCKED_CAPTURE.runId),
    });
  if ([21, 22, 23].includes(record.version))
    await validateCurrentR20NonqualifyingCapture({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R20_NONQUALIFYING_CAPTURE.runId),
    });
  if ([22, 23].includes(record.version))
    await validateCurrentR21NonqualifyingCapture({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R21_NONQUALIFYING_CAPTURE.runId),
    });
  if (record.version === 23)
    await validateCurrentR22FailedPreparation({
      record,
      request,
      storeFor,
      observedRun: observed.find((run) => run.id === CURRENT_R22_FAILED_PREPARATION.runId),
    });
  need(
    Array.isArray(legacyPredecessor.artifacts) && legacyPredecessor.artifacts.length > 0,
    "PREDECESSOR_ARTIFACT_REQUIRED",
  );
  for (const { expected, runId } of [
    ...legacyPredecessor.artifacts.map((expected) => ({
      expected,
      runId: CURRENT_LEGACY.runId,
    })),
    ...([19, 20, 21, 22, 23].includes(record.version)
      ? [CURRENT_R15_FAILED_PREPARATION, CURRENT_R16_FAILED_PREPARATION]
      : record.version === 18
        ? [CURRENT_R15_FAILED_PREPARATION, CURRENT_R16_FAILED_PREPARATION]
        : record.version === 17
          ? [CURRENT_R15_FAILED_PREPARATION, record.predecessor]
          : successor
            ? [record.predecessor]
            : []
    ).flatMap((preparation) => preparation.artifacts.map((expected) => ({ expected, runId: preparation.runId }))),
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

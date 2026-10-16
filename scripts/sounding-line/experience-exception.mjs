// A finite Crossdeck admission exception, not a second qualification authority.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCustodyRequest } from "./custody-transport.mjs";
import { observeVerificationFailure } from "./verification-diagnostics.mjs";
import {
  CROSSDECK_R3,
  validateR3Record,
  validateR3Contracts,
  r3LocalPlan,
  validateR3LocalReceipt,
  r3SourceFingerprint,
} from "./experience-r3.mjs";
export { CROSSDECK_R3 } from "./experience-r3.mjs";
import { CROSSDECK_R4, validateR4Record } from "./experience-r4.mjs";
export { CROSSDECK_R4 } from "./experience-r4.mjs";
import { CROSSDECK_R5, validateR5Record } from "./experience-r5.mjs";
export { CROSSDECK_R5 } from "./experience-r5.mjs";
import { CROSSDECK_R6, validateR6Record, r6LocalPlan } from "./experience-r6.mjs";
export { CROSSDECK_R6 } from "./experience-r6.mjs";
import { CROSSDECK_R7, validateR7Record, validateR7FormattingInputs, r7LocalPlan } from "./experience-r7.mjs";
export { CROSSDECK_R7 } from "./experience-r7.mjs";
import { CROSSDECK_R8, validateR8Record, validateR8FormattingInputs, r8LocalPlan } from "./experience-r8.mjs";
export { CROSSDECK_R8 } from "./experience-r8.mjs";
import {
  bindR8FormatReconciliation,
  pendingR8FormatReconciliation,
  r8FormatEvidencePlan,
  assertR8FormatMode,
  validateR8FormatCustody,
} from "./experience-r8-format.mjs";
import {
  CROSSDECK_R9,
  validateR9Record,
  assertR9Mode,
  bindR9Reconciliation,
  pendingR9Reconciliation,
  r9HistoricalEvidencePlan,
  validateR9HistoricalCustody,
  r9HistoryRunMatches,
  validateR9FinalDecision,
} from "./experience-r9.mjs";
export { CROSSDECK_R9 } from "./experience-r9.mjs";
import {
  CROSSDECK_R10,
  validateR10Record,
  assertR10Mode,
  bindR10Reconciliation,
  pendingR10Reconciliation,
  r10HistoricalEvidencePlan,
  validateR10HistoricalCustody,
  validateR10FinalDecision,
} from "./experience-r10.mjs";
export { CROSSDECK_R10 } from "./experience-r10.mjs";
import {
  CROSSDECK_R11,
  validateR11Record,
  assertR11Mode,
  bindR11Reconciliation,
  pendingR11Reconciliation,
  r11HistoricalEvidencePlan,
  validateR11HistoricalCustody,
  validateR11FinalDecision,
} from "./experience-r11.mjs";
export { CROSSDECK_R11 } from "./experience-r11.mjs";

// These finite successors share canonical execution/finalization. Dispatch only
// exact, separately bound records; historical records never become fallback grants.
function ordinaryOnly(id) {
  return id === CROSSDECK_R9.id || id === CROSSDECK_R10.id || id === CROSSDECK_R11.id;
}
function validateOrdinaryOnlyRecord(record) {
  if (record.id === CROSSDECK_R11.id) return validateR11Record(record);
  return (record.id === CROSSDECK_R10.id ? validateR10Record : validateR9Record)(record);
}
function bindOrdinaryOnlyReconciliation(options) {
  if (options.record.id === CROSSDECK_R11.id) return bindR11Reconciliation(options);
  return (options.record.id === CROSSDECK_R10.id ? bindR10Reconciliation : bindR9Reconciliation)(options);
}
function pendingOrdinaryOnlyReconciliation(options) {
  if (options.record.id === CROSSDECK_R11.id) return pendingR11Reconciliation(options);
  return (options.record.id === CROSSDECK_R10.id ? pendingR10Reconciliation : pendingR9Reconciliation)(options);
}
function ordinaryOnlyHistoricalPlan(plan) {
  if (plan.exception.id === CROSSDECK_R11.id) return r11HistoricalEvidencePlan(plan);
  return (plan.exception.id === CROSSDECK_R10.id ? r10HistoricalEvidencePlan : r9HistoricalEvidencePlan)(plan);
}
function assertOrdinaryOnlyMode(plan, mode) {
  assertR9Mode(plan, mode);
  assertR10Mode(plan, mode);
  assertR11Mode(plan, mode);
}

export const EXCEPTION_REGISTRY = "testing/product-experience-exceptions.json";
// Recognition survives retirement/removal of a grant. It never grants admission.
export const CROSSDECK_CAMPAIGN = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015",
  pullRequest: 721,
  frozenReferenceSha: "c9f7f90824bb6003f1ccbc2e93085a523d70fd3d",
  frozenTrees: { src: "0a455ccc3653b4fc672fa038b849f0392889b007" },
  immutableHistory: [
    { path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/repair-ledger.json" },
    {
      path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/correction-ledger-current.json",
    },
    {
      path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/terminal-capture-receipt.json",
    },
  ],
};
// This successor recognizes one exact consumed predecessor, never a class of
// failed runs or a fresh approval-date epoch.
export const CROSSDECK_R2 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2",
  approvalMessageId: "Sentinel_ae98f58b5fc88191b9132a017d43518c",
  approvalSourceThreadId: "01a0f4a3-e2a2-7591-a1c3-167849b860cf",
  approvedAtUtcMinute: "2026-10-15T16:49Z",
  reviewReusePolicy:
    "Read-only reuse of the original successful review seal; no second authenticated review submission",
  approvalQuestion:
    "May I proceed with R2: one new preparation, the remaining third review, and one ordinary qualification run, preserving all failed history and acceptance gates?",
  predecessor: {
    id: CROSSDECK_CAMPAIGN.id,
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015",
    recordDigest: "bf11c0852ca133e6446216d1268c091d2fb4a7c2535523a5921253883ec050b0",
    prepareCommit: "2706b52f12fc167434b03ff8e6fb7d3198db8d62",
    runId: 38760343298,
    runAttempt: 1,
    workflowId: 341545080,
    createdAt: "2026-10-15T15:26:30Z",
    conclusion: "failure",
    baseSha: "9983c900875ffa116e7945318823e93e6e94348b",
    candidateSha: "f000118d1cddeb5f0e6f79c59c9ef076862de93a",
    candidateTree: "c3523d02e5c6a62485cfc521dfae557535577ec5",
    sourceDigest: "9ec365cdf6b880982344d2ea513da82824c6d2c6d0743a17fb89c180afe67ce4",
    contractDigest: "8c8d5ddbc67e23f784e4465067973e2eb9d5f3d8d95bf44c646de4079cdb306d",
    campaignEpoch: "2026-10-15T13:54Z",
    artifacts: [
      {
        id: 11985629215,
        size: 1202922011,
        digest: "sha256:fd37ca0660cb16da4d08f42027b567e02444c051e1b90f485b3e74aef3e84516",
      },
      {
        id: 11986936084,
        size: 34994,
        digest: "sha256:a5389f04dca104282e52e08ab4ffdaa36d47a1244903432d6c42ae08cb148324",
      },
    ],
  },
  attemptHistory: {
    version: 2,
    priorRepairRecaptureAttempts: 11,
    failedVerificationPreparations: 1,
    totalPriorExecutedAttempts: 12,
    nextPreparationAttemptTotal: 13,
    completedIndependentReviews: 2,
    remainingIndependentReviewOrdinal: 3,
  },
};
const workflowPath = ".github/workflows/sounding-line-ordinary.yml";
const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_${code}`);
};
const git = (root, ...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
const json = (root, revision, file) => JSON.parse(git(root, "show", `${revision}:${file}`));
const present = (root, revision, file) => Boolean(git(root, "ls-tree", revision, "--", file));
const identity = (root, revision, file) => git(root, "rev-parse", `${revision}:${file}`);
const runtimePath = (file) =>
  /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
  /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc)$/u.test(file);
function entries(root, revision) {
  return new Map(
    git(root, "ls-tree", "-rz", revision)
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const [metadata, file] = entry.split("\t");
        return [file, metadata];
      }),
  );
}
function treePaths(inventory) {
  const paths = new Set(inventory.keys());
  // Recursive ls-tree lists leaves; retain directory markers as presence signals.
  for (const file of inventory.keys()) {
    const parts = file.split("/");
    for (let end = 1; end < parts.length; end++) paths.add(parts.slice(0, end).join("/"));
  }
  return paths;
}
const sharedCandidateReviewPath = "Development_Docs/Testing/Product_Experience/candidate-review.json";
function campaignHistoryMarker(record, inventory, paths = treePaths(inventory)) {
  return record.immutableHistory.some(
    ({ path: file, blob }) =>
      paths.has(file) &&
      // This shared publication path also holds unrelated product reviews. Its
      // exact frozen blob identifies this campaign; the path alone does not.
      (file !== sharedCandidateReviewPath || inventory.get(file)?.split(" ").at(-1) === blob),
  );
}
export function exceptionRecords(root, baseSha) {
  if (!present(root, baseSha, EXCEPTION_REGISTRY)) return [];
  const registry = json(root, baseSha, EXCEPTION_REGISTRY);
  if (registry.version !== 1 || !Array.isArray(registry.exceptions)) fail("REGISTRY_INVALID");
  return registry.exceptions;
}
function r3FamilyRelated(root, candidateSha) {
  try {
    return r3SourceFingerprint([...entries(root, candidateSha)]) === CROSSDECK_R3.maskedSrcDigest;
  } catch {
    return false;
  }
}
export function selectTrustedExceptions(records) {
  const r11 = records.filter((r) => r.id === CROSSDECK_R11.id);
  if (r11.length) {
    if (r11.length !== 1 || records.length !== 11) fail("R11_PREDECESSOR_REGISTRY_CHANGED");
    validateR11Record(r11[0]);
    const prior = records.filter((r) => r.id !== CROSSDECK_R11.id);
    selectTrustedExceptions(prior);
    if (digest(prior.find((r) => r.id === CROSSDECK_R10.id)) !== r11[0].predecessor.recordDigest)
      fail("R11_PREDECESSOR_REGISTRY_CHANGED");
    return r11.filter((r) => r.status === "ACTIVE");
  }
  const r10 = records.filter((r) => r.id === CROSSDECK_R10.id);
  if (r10.length) {
    if (r10.length !== 1 || records.length !== 10) fail("R10_PREDECESSOR_REGISTRY_CHANGED");
    validateR10Record(r10[0]);
    const prior = records.filter((r) => r.id !== CROSSDECK_R10.id);
    selectTrustedExceptions(prior);
    if (digest(prior.find((r) => r.id === CROSSDECK_R9.id)) !== r10[0].predecessor.recordDigest)
      fail("R10_PREDECESSOR_REGISTRY_CHANGED");
    return r10.filter((r) => r.status === "ACTIVE");
  }
  const r9 = records.filter((r) => r.id === CROSSDECK_R9.id);
  if (r9.length) {
    if (r9.length !== 1 || records.length !== 9) fail("R9_PREDECESSOR_REGISTRY_CHANGED");
    validateR9Record(r9[0]);
    const prior = records.filter((r) => r.id !== CROSSDECK_R9.id);
    selectTrustedExceptions(prior);
    if (digest(prior.find((r) => r.id === CROSSDECK_R8.id)) !== r9[0].predecessor.recordDigest)
      fail("R9_PREDECESSOR_REGISTRY_CHANGED");
    return r9.filter((r) => r.status === "ACTIVE");
  }
  const r8 = records.filter((r) => r.id === CROSSDECK_R8.id);
  if (r8.length) {
    if (
      r8.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R7.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R7.id)) !== CROSSDECK_R8.predecessorDigest
    )
      fail("R8_PREDECESSOR_REGISTRY_CHANGED");
    validateR8Record(r8[0]);
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R8.id));
    return records.filter(
      (r) =>
        r.status === "ACTIVE" &&
        ![
          CROSSDECK_CAMPAIGN.id,
          CROSSDECK_R2.id,
          CROSSDECK_R3.id,
          CROSSDECK_R4.id,
          CROSSDECK_R5.id,
          CROSSDECK_R6.id,
          CROSSDECK_R7.id,
        ].includes(r.id),
    );
  }
  const r7 = records.filter((r) => r.id === CROSSDECK_R7.id);
  if (r7.length) {
    if (
      r7.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R6.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R6.id)) !== CROSSDECK_R7.predecessorDigest
    )
      fail("R7_PREDECESSOR_REGISTRY_CHANGED");
    validateR7Record(r7[0]);
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R7.id));
    return records.filter(
      (r) =>
        r.status === "ACTIVE" &&
        ![
          CROSSDECK_CAMPAIGN.id,
          CROSSDECK_R2.id,
          CROSSDECK_R3.id,
          CROSSDECK_R4.id,
          CROSSDECK_R5.id,
          CROSSDECK_R6.id,
        ].includes(r.id),
    );
  }
  const r6 = records.filter((r) => r.id === CROSSDECK_R6.id);
  if (r6.length) {
    if (
      r6.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R5.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R5.id)) !== CROSSDECK_R6.predecessorDigest
    )
      fail("R6_PREDECESSOR_REGISTRY_CHANGED");
    validateR6Record(r6[0]);
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R6.id));
    return records.filter(
      (r) =>
        r.status === "ACTIVE" &&
        ![CROSSDECK_CAMPAIGN.id, CROSSDECK_R2.id, CROSSDECK_R3.id, CROSSDECK_R4.id, CROSSDECK_R5.id].includes(r.id),
    );
  }
  const r5 = records.filter((r) => r.id === CROSSDECK_R5.id);
  if (r5.length) {
    if (
      r5.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R4.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R4.id)) !== CROSSDECK_R5.predecessorDigest
    )
      fail("R5_PREDECESSOR_REGISTRY_CHANGED");
    validateR5Record(r5[0]);
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R5.id));
    return records.filter(
      (r) =>
        r.status === "ACTIVE" &&
        ![CROSSDECK_CAMPAIGN.id, CROSSDECK_R2.id, CROSSDECK_R3.id, CROSSDECK_R4.id].includes(r.id),
    );
  }
  const r4 = records.filter((r) => r.id === CROSSDECK_R4.id);
  if (r4.length) {
    if (
      r4.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R3.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R3.id)) !== CROSSDECK_R4.predecessorDigest
    )
      fail("R4_PREDECESSOR_REGISTRY_CHANGED");
    validateR4Record(r4[0]);
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R4.id));
    return records.filter(
      (r) => r.status === "ACTIVE" && ![CROSSDECK_CAMPAIGN.id, CROSSDECK_R2.id, CROSSDECK_R3.id].includes(r.id),
    );
  }
  const r3 = records.filter((r) => r.id === CROSSDECK_R3.id);
  if (r3.length) {
    if (
      r3.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R2.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R2.id)) !== CROSSDECK_R3.predecessorDigest
    )
      fail("R3_PREDECESSOR_REGISTRY_CHANGED");
    validateR3Record(r3[0]);
    // Validate the original/R2 relationship too; neither predecessor is edited.
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R3.id));
    return records.filter((r) => r.status === "ACTIVE" && ![CROSSDECK_CAMPAIGN.id, CROSSDECK_R2.id].includes(r.id));
  }
  const successors = records.filter(
    (record) => record.id === CROSSDECK_R2.id || record.predecessor?.id === CROSSDECK_CAMPAIGN.id,
  );
  if (successors.length) {
    const predecessors = records.filter((record) => record.id === CROSSDECK_CAMPAIGN.id);
    if (
      successors.length !== 1 ||
      successors[0].id !== CROSSDECK_R2.id ||
      digest(successors[0].predecessor) !== digest(CROSSDECK_R2.predecessor) ||
      predecessors.length !== 1 ||
      digest(predecessors[0]) !== CROSSDECK_R2.predecessor.recordDigest
    )
      fail("PREDECESSOR_REGISTRY_CHANGED");
    const scopeKeys = [
      "repository",
      "pullRequest",
      "expiresAt",
      "frozenReferenceSha",
      "frozenHistoricalBaseSha",
      "frozenTrees",
      "frozenBlobs",
      "allowedProtectedBasePackageScriptNames",
      "protectedBaseRuntimeOverrides",
      "immutableHistory",
      "contractIds",
      "contractDigest",
      "contexts",
      "priorRepairRecaptureAttempts",
      "independentProductReviewsCompleted",
      "remainingIndependentReviewOrdinal",
      "executionBudget",
      "requiredTechnicalBrowserTests",
      "affectedRoutes",
      "affectedJourneys",
      "custodyPermissionApproval",
      "ownerAcceptance",
    ];
    if (
      scopeKeys.some((key) => digest(successors[0][key]) !== digest(predecessors[0][key])) ||
      successors[0].custody.nonExecutingReviewReuse !== CROSSDECK_R2.reviewReusePolicy ||
      digest({
        ...successors[0].custody,
        namespace: predecessors[0].custody.namespace,
        nonExecutingReviewReuse: predecessors[0].custody.nonExecutingReviewReuse,
      }) !== digest(predecessors[0].custody)
    )
      fail("PREDECESSOR_SCOPE_CHANGED");
    // Retirement/expiry of R2 never reactivates the original consumed grant.
    return records.filter((record) => record.status === "ACTIVE" && record.id !== CROSSDECK_CAMPAIGN.id);
  }
  return records.filter((record) => record.status === "ACTIVE");
}
export const trustedExceptions = (root, baseSha) => selectTrustedExceptions(exceptionRecords(root, baseSha));
export function campaignRelated({ root, baseSha, candidateSha, record, prNumber }) {
  if (Number(prNumber) === record.pullRequest) return true;
  // Every remaining signal compares additions between two revisions. An exact
  // same-source checkout probe cannot add campaign history or product content.
  if (baseSha === candidateSha) return false;
  if (r3FamilyRelated(root, candidateSha) && !r3FamilyRelated(root, baseSha)) return true;
  if (
    record.frozenTrees?.src &&
    present(root, candidateSha, "src") &&
    identity(root, candidateSha, "src") === record.frozenTrees.src &&
    (!present(root, baseSha, "src") || identity(root, baseSha, "src") !== record.frozenTrees.src)
  )
    return true;
  const refitIds = ["crossdeck.refit.companion", "crossdeck.refit.published-lens"];
  const contractIds = (revision) =>
    present(root, revision, "testing/contracts.json")
      ? (json(root, revision, "testing/contracts.json").contracts ?? []).map((value) => value.id)
      : [];
  const proposed = contractIds(candidateSha),
    baseline = contractIds(baseSha);
  if (refitIds.some((id) => proposed.includes(id) && !baseline.includes(id))) return true;
  const ancestor = (revision) => {
    try {
      git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, revision);
      return true;
    } catch {
      return false;
    }
  };
  return (
    (ancestor(candidateSha) && !ancestor(baseSha)) ||
    record.immutableHistory.some(
      ({ path: file, blob }) =>
        present(root, candidateSha, file) &&
        (file === sharedCandidateReviewPath
          ? identity(root, candidateSha, file) === blob &&
            (!present(root, baseSha, file) || identity(root, baseSha, file) !== blob)
          : !present(root, baseSha, file)),
    )
  );
}
export function validateExceptionRecord(record, now = new Date()) {
  if (ordinaryOnly(record?.id)) {
    validateOrdinaryOnlyRecord(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R8.id) {
    validateR8Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R7.id) {
    validateR7Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R6.id) {
    validateR6Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R5.id) {
    validateR5Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R4.id) {
    validateR4Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  if (record?.id === CROSSDECK_R3.id) {
    validateR3Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  const successor = record?.id === CROSSDECK_R2.id;
  if (
    record.version !== (successor ? 2 : 1) ||
    record.id !== (successor ? CROSSDECK_R2.id : CROSSDECK_CAMPAIGN.id) ||
    record.pullRequest !== 721 ||
    record.repository !== "Kgray44/treasurehuntSoT" ||
    record.ownerApproval?.actor !== "Kgray44" ||
    record.ownerApproval?.humanMessageId !==
      (successor ? CROSSDECK_R2.approvalMessageId : "Sentinel_1f92fbd43b788191ba842d90f5fb6574") ||
    record.ownerApproval?.proofClass !== "COORDINATOR_VERIFIED_DIRECT_HUMAN_APPROVAL_RELAY" ||
    record.custodyPermissionApproval?.humanMessageId !== "Sentinel_bd12e5e945c48191bc7747030f326f62" ||
    record.priorRepairRecaptureAttempts !== 11 ||
    record.independentProductReviewsCompleted !== 2 ||
    record.remainingIndependentReviewOrdinal !== 3 ||
    record.contexts !== 32 ||
    record.contractIds?.length !== 7 ||
    record.affectedRoutes?.length !== 14 ||
    record.affectedJourneys?.length !== 9 ||
    record.expiresAt !== "2026-10-22T23:59:59Z" ||
    record.custody?.namespace !== `sounding-line-exceptions/${record.id}` ||
    (successor
      ? record.ownerApproval.approvedAtUtcMinute !== CROSSDECK_R2.approvedAtUtcMinute ||
        record.ownerApproval.sourceThreadId !== CROSSDECK_R2.approvalSourceThreadId ||
        record.ownerApproval.coordinatorThreadId !== "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1" ||
        record.ownerApproval.answer !== "YES" ||
        record.ownerApproval.question !== CROSSDECK_R2.approvalQuestion ||
        record.custody.nonExecutingReviewReuse !== CROSSDECK_R2.reviewReusePolicy ||
        digest(record.predecessor) !== digest(CROSSDECK_R2.predecessor) ||
        digest(record.attemptHistory) !== digest(CROSSDECK_R2.attemptHistory)
      : record.predecessor !== undefined) ||
    digest(record.executionBudget) !==
      digest({
        preparationPasses: 1,
        ordinaryInvocations: 1,
        ordinaryExperienceReplayPasses: 1,
        technicalE2EInvocations: 1,
        newIndependentReviews: 1,
        additionalLocalInvocations: 0,
        reruns: 0,
        productRepairs: 0,
      })
  )
    fail("RECORD_INVALID");
  if (!Number.isFinite(Date.parse(record.expiresAt)) || now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
}
export function bindExperienceException({ root, baseSha, candidateSha, plan, prNumber, now }) {
  if (
    [CROSSDECK_CAMPAIGN, ...exceptionRecords(root, baseSha)].some((record) =>
      campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
    ) &&
    !trustedExceptions(root, baseSha).some((record) =>
      campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
    )
  )
    fail("APPROVAL_MISSING_OR_INACTIVE");
  const records = trustedExceptions(root, baseSha).filter((record) =>
    campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
  );
  if (!records.length) return null;
  if (records.length !== 1) fail("AMBIGUOUS_CAMPAIGN");
  const record = records[0];
  validateExceptionRecord(record, now);
  const nonExecutingReconciliation = ordinaryOnly(record.id)
    ? bindOrdinaryOnlyReconciliation({ root, baseSha, candidateSha, plan, record })
    : bindR8FormatReconciliation({ root, baseSha, candidateSha, plan, record });
  const r3 = record.id === CROSSDECK_R3.id;
  for (const [file, tree] of Object.entries(record.frozenTrees))
    if (!(r3 && file === "src") && identity(root, candidateSha, file) !== tree) fail("FROZEN_PRODUCT_CHANGED");
  for (const [file, blob] of Object.entries(record.frozenBlobs)) {
    if (file === "package.json") continue;
    if (nonExecutingReconciliation && file === ".prettierignore") continue;
    if (identity(root, candidateSha, file) !== blob) fail("FROZEN_CONFIGURATION_CHANGED");
  }
  const frozenPackage = json(root, record.frozenReferenceSha, "package.json");
  const candidatePackage = json(root, candidateSha, "package.json");
  const basePackage = json(root, baseSha, "package.json");
  for (const name of record.allowedProtectedBasePackageScriptNames) {
    frozenPackage.scripts[name] = basePackage.scripts[name];
  }
  if (digest(frozenPackage) !== digest(candidatePackage)) fail("FROZEN_PACKAGE_CHANGED");
  const expected = entries(root, baseSha);
  const candidate = entries(root, candidateSha);
  const reference = entries(root, record.frozenReferenceSha);
  for (const [file, metadata] of reference) if (/^(?:src|public|prisma)\//u.test(file)) expected.set(file, metadata);
  for (const { path: file, mode, blob } of record.protectedBaseRuntimeOverrides)
    expected.set(file, `${mode} blob ${blob}`);
  if ([CROSSDECK_R8.id, CROSSDECK_R9.id, CROSSDECK_R10.id, CROSSDECK_R11.id].includes(record.id))
    validateR8FormattingInputs(expected, candidate);
  if (record.id === CROSSDECK_R7.id) validateR7FormattingInputs(expected, candidate);
  if (r3) {
    validateR3Contracts(
      json(root, record.frozenReferenceSha, "testing/contracts.json"),
      json(root, candidateSha, "testing/contracts.json"),
    );
    for (const file of [...CROSSDECK_R3.productPaths, ...CROSSDECK_R3.testPaths, "testing/contracts.json"]) {
      const metadata = candidate.get(file);
      if (!metadata?.startsWith("100644 blob ")) fail("R3_REPAIR_PATH_TYPE_CHANGED");
      expected.set(file, metadata);
    }
    if (!CROSSDECK_R3.productPaths.some((file) => candidate.get(file) !== reference.get(file)))
      fail("R3_PRODUCT_REPAIR_MISSING");
  }
  for (const file of new Set([...expected.keys(), ...candidate.keys()])) {
    if (!runtimePath(file) || file === "package.json") continue;
    if (candidate.get(file) !== expected.get(file)) fail("RUNTIME_BINDING_CHANGED");
  }
  for (const { path: file, blob } of record.immutableHistory) {
    const metadata = candidate.get(file);
    // Reuse the already read exact Git inventory instead of spawning twice per
    // preserved file. R8 additionally requires the preserved regular-file mode.
    if (
      ([CROSSDECK_R8.id, CROSSDECK_R9.id, CROSSDECK_R10.id, CROSSDECK_R11.id].includes(record.id) &&
        metadata !== `100644 blob ${blob}`) ||
      !metadata ||
      metadata.split(" ").at(-1) !== blob
    )
      fail("HISTORY_CHANGED");
  }
  const contexts = (plan.contracts ?? []).reduce(
    (total, contract) =>
      total +
      contract.experience.devices.length *
        contract.experience.journeys.reduce(
          (count, journey) => count + journey.roles.length * (contract.experience.motion ? 2 : 1),
          0,
        ),
    0,
  );
  if (
    !plan.applicable ||
    (!r3 && plan.contractDigest !== record.contractDigest) ||
    ([CROSSDECK_R6.id, CROSSDECK_R7.id, CROSSDECK_R8.id, CROSSDECK_R9.id, CROSSDECK_R10.id, CROSSDECK_R11.id].includes(
      record.id,
    )
      ? contexts !== 32 || plan.paired?.browserContexts !== 6 || plan.contextCount !== 38
      : contexts !== record.contexts) ||
    digest([...plan.contractIds].sort()) !== digest([...record.contractIds].sort())
  )
    fail("PLAN_SCOPE_CHANGED");
  return { ...recordBinding(record), ...(nonExecutingReconciliation ? { nonExecutingReconciliation } : {}) };
}
export function recordBinding(record) {
  return {
    id: record.id,
    recordDigest: digest(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    ...([
      CROSSDECK_R2.id,
      CROSSDECK_R3.id,
      CROSSDECK_R4.id,
      CROSSDECK_R5.id,
      CROSSDECK_R6.id,
      CROSSDECK_R7.id,
      CROSSDECK_R8.id,
      CROSSDECK_R9.id,
      CROSSDECK_R10.id,
      CROSSDECK_R11.id,
    ].includes(record.id)
      ? { version: record.version, predecessor: record.predecessor, attemptHistory: record.attemptHistory }
      : {}),
  };
}
export function validateExceptionEvidence(plan, evidence, automatedOnly = false) {
  if (!plan.exception) {
    if (evidence?.exception) fail("UNTRUSTED_EVIDENCE_CLAIM");
    return;
  }
  if (digest(evidence?.exception) !== digest(plan.exception)) fail("EVIDENCE_BINDING_MISSING");
  if (!automatedOnly && !Array.isArray(evidence.reviews)) fail("ONE_REVIEW3_SCOPE_REQUIRED");
  if (!automatedOnly)
    for (const review of evidence.reviews ?? []) {
      if (
        review.iterations !== 11 ||
        review.independentReviewOrdinal !==
          ([
            CROSSDECK_R6.id,
            CROSSDECK_R7.id,
            CROSSDECK_R8.id,
            CROSSDECK_R9.id,
            CROSSDECK_R10.id,
            CROSSDECK_R11.id,
          ].includes(plan.exception.id)
            ? 7
            : plan.exception.id === CROSSDECK_R5.id
              ? 6
              : plan.exception.id === CROSSDECK_R4.id
                ? 5
                : plan.exception.id === CROSSDECK_R3.id
                  ? 4
                  : 3)
      )
        fail("HISTORY_OR_REVIEW_ORDINAL_CHANGED");
      if (
        (review.findings ?? []).some(
          (finding) =>
            !["MINOR_POLISH", "SUBJECTIVE_DESIGN_OPPORTUNITY", "ACCEPTED_REFERENCE_QUALITY"].includes(
              finding.classification,
            ) && finding.disposition !== "UNCHANGED_BASELINE_DEBT",
        )
      )
        fail("NEW_BLOCKING_FINDING");
    }
  if (
    !automatedOnly &&
    (evidence.reviews.length !== plan.contractIds.length ||
      digest(evidence.reviews.map((review) => review.contractId).sort()) !== digest([...plan.contractIds].sort()) ||
      new Set(evidence.reviews.map((review) => review.reviewerContext)).size !== 1)
  )
    fail("ONE_REVIEW3_SCOPE_REQUIRED");
}
export function exceptionBinding(plan) {
  return {
    exception: plan.exception,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
  };
}
export function validateExceptionExecutionPlan(plan, actual) {
  const bound = (value) =>
    Object.fromEntries(
      [
        "baseSha",
        "candidateSha",
        "sourceDigest",
        "contractDigest",
        "contractIds",
        "contracts",
        "attestationPolicy",
        "evidencePath",
        "debt",
        "exception",
        "paired",
        "contextCount",
        "pairedOnly",
        "localProof",
        "localProofMotionMode",
      ].map((key) => [key, value[key]]),
    );
  if (digest(bound(plan)) !== digest(bound(actual)) || (plan.fixtureProfile && plan.fixtureProfile !== "generic"))
    fail("EXECUTION_PLAN_CHANGED");
}
export function sealedReviewIdentity(plan, evidence) {
  return {
    ...exceptionBinding(plan),
    captureArtifactId: evidence.captureArtifactId,
    reviewsDigest: digest(evidence.reviews),
    artifactsDigest: digest(evidence.artifacts),
    journeysDigest: digest(evidence.journeys),
    ...(plan.paired ? { pairedEvidenceDigest: digest(evidence.pairedEvidence) } : {}),
  };
}
export async function validateExceptionSubmissionEvidence({ root, plan, mode, candidateSha, evidenceRoot = root }) {
  if (!["ordinary", "review", "verify"].includes(mode)) fail("MODE_FORBIDDEN");
  const { revisionJson, validateExperienceEvidence } = await import("./product-experience.mjs");
  const ordinary = mode === "ordinary";
  const sourceRoot = ordinary ? root : evidenceRoot;
  const evidence = ordinary
    ? revisionJson(root, candidateSha, plan.evidencePath)
    : JSON.parse(readFileSync(path.join(sourceRoot, plan.evidencePath), "utf8"));
  validateExperienceEvidence({
    root: sourceRoot,
    baselineRoot: root,
    plan,
    evidence,
    revision: ordinary ? candidateSha : undefined,
  });
  return evidence;
}
export function githubRequest(repository, token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN) {
  return createCustodyRequest({ repository, token });
}
export function exceptionStore({ record, request }) {
  const ref = (slot) => `tags/${record.custody.namespace}/${slot}`;
  const custodyPath = ".sounding-line-exception-reservation.json";
  const normalized = (values) =>
    values
      .map(({ path: file, mode, type, sha }) => ({ path: file, mode, type, sha }))
      .sort((a, b) => a.path.localeCompare(b.path));
  async function read(slot) {
    const tag = await request(`git/ref/${ref(slot)}`);
    if (!tag) return null;
    if (tag.object?.type !== "commit") fail("CUSTODY_INVALID");
    const commit = await request(`git/commits/${tag.object.sha}`);
    const tree = await request(`git/trees/${commit.tree.sha}`);
    const item = tree.tree?.find((entry) => entry.path === custodyPath);
    if (!item || item.type !== "blob" || item.mode !== "100644") fail("CUSTODY_INVALID");
    const blob = await request(`git/blobs/${item.sha}`);
    const value = JSON.parse(Buffer.from(blob.content.replaceAll("\n", ""), "base64").toString());
    if (
      value.exceptionId !== record.id ||
      commit.parents?.length !== 1 ||
      commit.parents[0].sha !== value.binding.baseSha
    )
      fail("CUSTODY_INVALID");
    const base = await request(`git/commits/${value.binding.baseSha}`);
    const original = await request(`git/trees/${base.tree.sha}`);
    if (
      tree.truncated ||
      original.truncated ||
      original.tree.some((entry) => entry.path === custodyPath) ||
      digest(normalized(tree.tree.filter((entry) => entry.path !== custodyPath))) !== digest(normalized(original.tree))
    )
      fail("CUSTODY_BASE_TREE_CHANGED");
    return { ...value, commitSha: tag.object.sha };
  }
  async function create(slot, value) {
    if (await read(slot)) fail("SLOT_CONSUMED");
    const payload = { version: 1, exceptionId: record.id, ...value };
    const blob = await request("git/blobs", "POST", { content: JSON.stringify(payload), encoding: "utf-8" });
    const base = await request(`git/commits/${value.binding.baseSha}`);
    const tree = await request("git/trees", "POST", {
      base_tree: base.tree.sha,
      tree: [{ path: custodyPath, mode: "100644", type: "blob", sha: blob.sha }],
    });
    const commit = await request("git/commits", "POST", {
      message: `Sounding Line ${record.id} ${slot}`,
      tree: tree.sha,
      parents: [value.binding.baseSha],
    });
    // This is the sole permission-producing operation. Never update, delete or retry it.
    await request("git/refs", "POST", { ref: `refs/${ref(slot)}`, sha: commit.sha });
    return { ...payload, commitSha: commit.sha };
  }
  return { read, create };
}
// Explicit historical evidence view. It cannot read an old qualification slot
// or create any reservation, and is never a fallback for the current namespace.
export function historicalExceptionContext({ root, plan, request }) {
  if (!ordinaryOnly(plan.exception?.id)) {
    const record = trustedExceptions(root, plan.baseSha).find((value) => value.id === plan.exception?.id);
    return { record, plan, store: exceptionStore({ record, request }) };
  }
  const historical = ordinaryOnlyHistoricalPlan(plan);
  const record = exceptionRecords(root, plan.baseSha).find((value) => value.id === historical.exception.id);
  if (!record || digest(record) !== CROSSDECK_R8.recordDigest) fail("R9_HISTORICAL_RECORD_CHANGED");
  const original = exceptionStore({ record, request });
  return {
    record,
    plan: historical,
    store: {
      read(slot) {
        if (!["prepare", "capture", "review-submit", "review7"].includes(slot)) fail("R9_HISTORICAL_SLOT_FORBIDDEN");
        return original.read(slot);
      },
      create() {
        fail("R9_HISTORICAL_WRITE_FORBIDDEN");
      },
    },
  };
}
async function validateHistoricalExceptionCustody({ root, plan, request }) {
  if (!plan.exception?.nonExecutingReconciliation) return;
  if (ordinaryOnly(plan.exception?.id)) {
    const context = historicalExceptionContext({ root, plan, request });
    return (
      plan.exception.id === CROSSDECK_R11.id
        ? validateR11HistoricalCustody
        : plan.exception.id === CROSSDECK_R10.id
          ? validateR10HistoricalCustody
          : validateR9HistoricalCustody
    )({
      plan,
      store: context.store,
      request,
    });
  }
  const record = trustedExceptions(root, plan.baseSha).find((value) => value.id === plan.exception?.id);
  return validateR8FormatCustody({ plan, store: exceptionStore({ record, request }), request });
}
export async function validateLiveContext({
  record,
  plan,
  request,
  environment = process.env,
  requireHead = true,
  now,
}) {
  validateExceptionRecord(record, now);
  if (
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_REPOSITORY !== record.repository ||
    environment.GITHUB_REF !== "refs/heads/main" ||
    environment.GITHUB_SHA !== plan.baseSha ||
    environment.GITHUB_RUN_ATTEMPT !== "1" ||
    environment.GITHUB_ACTOR !== record.ownerApproval.actor ||
    (environment.GITHUB_TRIGGERING_ACTOR && environment.GITHUB_TRIGGERING_ACTOR !== record.ownerApproval.actor) ||
    environment.GITHUB_WORKFLOW_REF !== `${record.repository}/${workflowPath}@refs/heads/main`
  )
    fail("PROTECTED_EXECUTOR_REQUIRED");
  const main = await request("git/ref/heads/main");
  const pr = await request(`pulls/${record.pullRequest}`);
  const run = await request(`actions/runs/${environment.GITHUB_RUN_ID}`);
  const workflow = await request(`actions/workflows/${run?.workflow_id}`);
  const expectedHead = run?.event === "pull_request_target" ? plan.candidateSha : plan.baseSha;
  const expectedBranch = run?.event === "pull_request_target" ? pr?.head.ref : "main";
  if (
    main?.object.sha !== plan.baseSha ||
    pr?.state !== "open" ||
    pr.base.ref !== "main" ||
    pr.head.repo.full_name !== record.repository ||
    (requireHead && pr.head.sha !== plan.candidateSha) ||
    run?.id !== Number(environment.GITHUB_RUN_ID) ||
    run.run_attempt !== 1 ||
    run.head_sha !== expectedHead ||
    run.head_branch !== expectedBranch ||
    run.head_repository?.full_name !== record.repository ||
    !["workflow_dispatch", "pull_request_target"].includes(run.event) ||
    run.status !== "in_progress" ||
    run.actor?.login !== record.ownerApproval.actor ||
    run.triggering_actor?.login !== record.ownerApproval.actor ||
    workflow?.path !== workflowPath
  )
    fail("LIVE_SOURCE_OR_EXECUTOR_CHANGED");
  await validateSuccessorPredecessor({ record, request, now });
  return {
    runId: run.id,
    runAttempt: 1,
    actor: run.actor.login,
    workflowPath,
    event: run.event,
    headSha: run.head_sha,
    headBranch: run.head_branch,
    createdAt: run.created_at,
    workflowId: run.workflow_id,
    displayTitle: run.display_title,
  };
}
function isExactFailedPredecessor(run, p = CROSSDECK_R2.predecessor) {
  return (
    run?.id === p.runId &&
    run.run_attempt === p.runAttempt &&
    run.workflow_id === p.workflowId &&
    run.path === workflowPath &&
    run.head_repository?.full_name === "Kgray44/treasurehuntSoT" &&
    run.actor?.login === "Kgray44" &&
    run.triggering_actor?.login === "Kgray44" &&
    run.event === (p.event ?? "workflow_dispatch") &&
    run.head_branch === (p.headBranch ?? "main") &&
    run.head_sha === (p.headSha ?? p.baseSha) &&
    run.status === "completed" &&
    run.conclusion === p.conclusion &&
    run.created_at === p.createdAt &&
    run.display_title === `Sounding Line finite 1 ${p.mode ?? "capture"} 721 ${p.candidateSha} active`
  );
}
export async function validateSuccessorPredecessor({ record, request, now }) {
  if (
    ![
      CROSSDECK_R2.id,
      CROSSDECK_R3.id,
      CROSSDECK_R4.id,
      CROSSDECK_R5.id,
      CROSSDECK_R6.id,
      CROSSDECK_R7.id,
      CROSSDECK_R8.id,
      CROSSDECK_R9.id,
      CROSSDECK_R10.id,
      CROSSDECK_R11.id,
    ].includes(record.id)
  )
    return null;
  validateExceptionRecord(record, now);
  if (record.id === CROSSDECK_R11.id) return validateR11Predecessors(record, request);
  if (record.id === CROSSDECK_R10.id) return validateR10Predecessors(record, request);
  if (record.id === CROSSDECK_R9.id) return validateR9Predecessors(record, request);
  if (record.id === CROSSDECK_R8.id) return validateR8Predecessors(request);
  if (record.id === CROSSDECK_R7.id) return validateR7Predecessors(request);
  if (record.id === CROSSDECK_R6.id) return validateR6Predecessors(request);
  if (record.id === CROSSDECK_R5.id) return validateR5Predecessors(request);
  if (record.id === CROSSDECK_R4.id) return validateR4Predecessors(request);
  if (record.id === CROSSDECK_R3.id) {
    return validateR3Predecessors(request);
  }
  return validateHistoricalPreparation(record.predecessor, request);
}

async function validateR11Predecessors(record, request) {
  const p = record.predecessor;
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const qualifier = await store.read("qualify");
  if (!qualifier) fail("R11_CONSUMED_QUALIFICATION_CHANGED");
  const { commitSha, ...payload } = qualifier;
  if (
    commitSha !== p.qualifyCommit ||
    digest(payload) !== p.qualifyPayloadDigest ||
    (await store.read("qualified")) ||
    qualifier.binding?.exception?.id !== CROSSDECK_R10.id ||
    qualifier.binding.exception.recordDigest !== CROSSDECK_R10.recordDigest
  )
    fail("R11_CONSUMED_QUALIFICATION_CHANGED");
  r10HistoricalEvidencePlan(qualifier.binding);
  // The immutable, hash-pinned consumed R10 payload contains its exact R8
  // predecessor binding. Reuse that canonical predecessor walk and shared client.
  const prior = await validateR10Predecessors({ predecessor: qualifier.binding.exception.predecessor }, request);
  const failed = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(failed, p)) fail("R11_CONSUMED_RUN_CHANGED");
  const commit = await request(`git/commits/${p.candidateSha}`);
  if (commit?.tree?.sha !== p.candidateTree) fail("R11_CONSUMED_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    if (
      artifact?.id !== expected.id ||
      artifact.expired ||
      artifact.digest !== expected.digest ||
      artifact.size_in_bytes !== expected.size ||
      artifact.workflow_run?.id !== p.runId
    )
      fail("R11_FAILURE_ARTIFACT_CHANGED");
  }
  const publication = await request(`git/commits/${p.failurePublication}`);
  if (publication?.tree?.sha !== p.failurePublicationTree) fail("R11_FAILURE_PUBLICATION_CHANGED");
  const tree = await request(`git/trees/${publication.tree.sha}?recursive=1`);
  if (!tree || tree.truncated || !Array.isArray(tree.tree)) fail("R11_FAILURE_PUBLICATION_CHANGED");
  for (const [file, expected] of [
    [p.failureIndexPath, p.failureIndexSha256],
    [p.authorityPreservationIndexPath, p.authorityPreservationIndexSha256],
  ]) {
    const entry = tree.tree.find((value) => value.path === file);
    if (entry?.type !== "blob" || entry.mode !== "100644") fail("R11_PRESERVATION_INDEX_CHANGED");
    const blob = await request(`git/blobs/${entry.sha}`);
    const bytes = Buffer.from(blob.content.replaceAll("\n", ""), "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== expected) fail("R11_PRESERVATION_INDEX_CHANGED");
  }
  return [...prior, failed];
}

async function validateR10Predecessors(record, request) {
  const p = record.predecessor;
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const qualifier = await store.read("qualify");
  if (!qualifier) fail("R10_CONSUMED_QUALIFICATION_CHANGED");
  const { commitSha, ...payload } = qualifier;
  if (
    commitSha !== p.qualifyCommit ||
    digest(payload) !== p.qualifyPayloadDigest ||
    (await store.read("qualified")) ||
    qualifier.binding?.exception?.id !== CROSSDECK_R9.id ||
    qualifier.binding.exception.recordDigest !== CROSSDECK_R9.recordDigest
  )
    fail("R10_CONSUMED_QUALIFICATION_CHANGED");
  r9HistoricalEvidencePlan(qualifier.binding);
  // The immutable, hash-pinned consumed R9 payload contains its exact R8
  // predecessor binding. Reuse that canonical predecessor walk and shared client.
  const prior = await validateR9Predecessors({ predecessor: qualifier.binding.exception.predecessor }, request);
  const failed = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(failed, p)) fail("R10_CONSUMED_RUN_CHANGED");
  const commit = await request(`git/commits/${p.candidateSha}`);
  if (commit?.tree?.sha !== p.candidateTree) fail("R10_CONSUMED_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    if (
      artifact?.id !== expected.id ||
      artifact.expired ||
      artifact.digest !== expected.digest ||
      artifact.size_in_bytes !== expected.size ||
      artifact.workflow_run?.id !== p.runId
    )
      fail("R10_FAILURE_ARTIFACT_CHANGED");
  }
  const publication = await request(`git/commits/${p.failurePublication}`);
  if (publication?.tree?.sha !== p.failurePublicationTree) fail("R10_FAILURE_PUBLICATION_CHANGED");
  const tree = await request(`git/trees/${publication.tree.sha}?recursive=1`);
  if (!tree || tree.truncated || !Array.isArray(tree.tree)) fail("R10_FAILURE_PUBLICATION_CHANGED");
  for (const [file, expected] of [
    [p.failureIndexPath, p.failureIndexSha256],
    [p.authorityPreservationIndexPath, p.authorityPreservationIndexSha256],
  ]) {
    const entry = tree.tree.find((value) => value.path === file);
    if (entry?.type !== "blob" || entry.mode !== "100644") fail("R10_PRESERVATION_INDEX_CHANGED");
    const blob = await request(`git/blobs/${entry.sha}`);
    const bytes = Buffer.from(blob.content.replaceAll("\n", ""), "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== expected) fail("R10_PRESERVATION_INDEX_CHANGED");
  }
  return [...prior, failed];
}

async function validateR9Predecessors(record, request) {
  const prior = await validateR8Predecessors(request);
  const p = record.predecessor;
  const predecessorStore = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const qualifier = await predecessorStore.read("qualify");
  if (!qualifier) fail("R9_CONSUMED_QUALIFICATION_CHANGED");
  const { commitSha, ...payload } = qualifier;
  if (
    commitSha !== p.qualifyCommit ||
    digest(payload) !== p.qualifyPayloadDigest ||
    (await predecessorStore.read("qualified"))
  )
    fail("R9_CONSUMED_QUALIFICATION_CHANGED");
  const failed = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(failed, p)) fail("R9_CONSUMED_RUN_CHANGED");
  const commit = await request(`git/commits/${p.candidateSha}`);
  if (commit?.tree?.sha !== p.candidateTree) fail("R9_CONSUMED_TREE_CHANGED");
  for (const expected of p.artifacts) {
    const artifact = await request(`actions/artifacts/${expected.id}`);
    if (
      artifact?.id !== expected.id ||
      artifact.expired ||
      artifact.digest !== expected.digest ||
      artifact.size_in_bytes !== expected.size ||
      artifact.workflow_run?.id !== p.runId
    )
      fail("R9_FAILURE_ARTIFACT_CHANGED");
  }
  const publication = await request(`git/commits/${p.failurePublication}`);
  if (publication?.tree?.sha !== p.failurePublicationTree) fail("R9_FAILURE_PUBLICATION_CHANGED");
  const tree = await request(`git/trees/${publication.tree.sha}?recursive=1`);
  if (!tree || tree.truncated || !Array.isArray(tree.tree)) fail("R9_FAILURE_PUBLICATION_CHANGED");
  for (const [file, expected] of [
    [p.failureIndexPath, p.failureIndexSha256],
    [p.localProofIndexPath, p.localProofIndexSha256],
  ]) {
    const entry = tree.tree.find((value) => value.path === file);
    if (entry?.type !== "blob" || entry.mode !== "100644") fail("R9_PRESERVATION_INDEX_CHANGED");
    const blob = await request(`git/blobs/${entry.sha}`);
    const bytes = Buffer.from(blob.content.replaceAll("\n", ""), "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== expected) fail("R9_PRESERVATION_INDEX_CHANGED");
  }
  const readOnlyHistorical = {
    read(slot) {
      if (!["prepare", "capture", "review-submit", "review7"].includes(slot)) fail("R9_HISTORICAL_SLOT_FORBIDDEN");
      return predecessorStore.read(slot);
    },
  };
  const successful = await validateR9HistoricalCustody({ store: readOnlyHistorical, request });
  return [...prior, ...successful, failed];
}
async function validateR8Predecessors(request) {
  const prior = await validateR7Predecessors(request);
  const p = CROSSDECK_R8.predecessor;
  const last = await validateHistoricalPreparation(p, request);
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const { commitSha, ...payload } = await store.read("prepare");
  if (commitSha !== p.prepareCommit || digest(payload) !== p.preparePayloadDigest)
    fail("R8_PREDECESSOR_PREPARE_CHANGED");
  for (const slot of ["capture", "review-submit", "review7", "qualify", "qualified"])
    if (await store.read(slot)) fail("R8_PREDECESSOR_CONSUMPTION_CHANGED");
  const commit = await request(`git/commits/${p.failureCommit}`);
  const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
  for (const [file, expected] of [
    [p.failureIndexPath, p.failureIndexSha256],
    [p.localProofIndexPath, p.localProofIndexSha256],
  ]) {
    const entry = tree?.tree?.find((e) => e.path === file);
    if (tree?.truncated || entry?.type !== "blob" || entry?.mode !== "100644") fail("R8_PRESERVATION_INDEX_CHANGED");
    const blob = await request(`git/blobs/${entry.sha}`);
    const bytes = Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== expected) fail("R8_PRESERVATION_INDEX_CHANGED");
  }
  return [...prior, last];
}
async function validateR7Predecessors(request) {
  const prior = await validateR6Predecessors(request);
  const p = CROSSDECK_R7.predecessor;
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  for (const slot of ["prepare", "capture", "review-submit", "review7", "qualify", "qualified"])
    if (await store.read(slot)) fail("R7_PREDECESSOR_CONSUMPTION_CHANGED");
  const commit = await request(`git/commits/${p.failureCommit}`);
  const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
  const entry = tree?.tree?.find((e) => e.path === p.failureIndexPath);
  if (tree?.truncated || entry?.type !== "blob" || entry?.mode !== "100644") fail("R7_FAILURE_INDEX_CHANGED");
  const blob = await request(`git/blobs/${entry.sha}`);
  const bytes = Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== p.failureIndexSha256) fail("R7_FAILURE_INDEX_CHANGED");
  return prior; // R6's local failure is separate from the eight authenticated runs.
}
async function validateR6Predecessors(request) {
  const prior = await validateR5Predecessors(request);
  const p = CROSSDECK_R6.predecessor;
  const last = await validateHistoricalPreparation(p, request);
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const { commitSha, ...payload } = await store.read("prepare");
  if (commitSha !== p.prepareCommit || digest(payload) !== p.preparePayloadDigest || (await store.read("review6")))
    fail("R6_PREDECESSOR_CHANGED");
  const review = CROSSDECK_R6.blockedReview;
  const commit = await request(`git/commits/${review.commit}`);
  const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
  const entry = tree?.tree?.find((e) => e.path === review.path);
  if (tree?.truncated || entry?.type !== "blob" || entry?.mode !== "100644") fail("R6_BLOCKED_REVIEW_CHANGED");
  const blob = await request(`git/blobs/${entry.sha}`);
  if (
    createHash("sha256")
      .update(Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64"))
      .digest("hex") !== review.sha256
  )
    fail("R6_BLOCKED_REVIEW_CHANGED");
  return [...prior, last];
}
async function validateR5Predecessors(request) {
  const prior = await validateR4Predecessors(request);
  const p = CROSSDECK_R5.predecessor;
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  for (const seal of p.seals) {
    const observed = await store.read(seal.slot);
    if (!observed) fail("R5_PREDECESSOR_SEAL_CHANGED");
    const { commitSha, ...payload } = observed;
    if (commitSha !== seal.commitSha || digest(payload) !== seal.payloadDigest) fail("R5_PREDECESSOR_SEAL_CHANGED");
  }
  for (const slot of ["review3", "review4", "review6", "qualify", "qualified"])
    if (await store.read(slot)) fail("R5_PREDECESSOR_CONSUMPTION_CHANGED");
  for (const [sha, tree] of [
    [p.candidateSha, p.candidateTree],
    [p.consumerSha, p.consumerTree],
  ]) {
    if ((await request(`git/commits/${sha}`))?.tree?.sha !== tree) fail("R5_PREDECESSOR_SOURCE_CHANGED");
  }
  const historical = [];
  for (const expected of p.runs) {
    const observed = await request(`actions/runs/${expected.runId}`);
    if (!isExactFailedPredecessor(observed, expected)) fail("R5_PREDECESSOR_RUN_CHANGED");
    historical.push(observed);
    for (const artifact of expected.artifacts) {
      const value = await request(`actions/artifacts/${artifact.id}`);
      if (
        value?.id !== artifact.id ||
        value.digest !== artifact.digest ||
        value.size_in_bytes !== artifact.size ||
        value.workflow_run?.id !== expected.runId ||
        value.workflow_run?.head_sha !== expected.headSha
      )
        fail("R5_PREDECESSOR_ARTIFACT_CHANGED");
    }
  }
  const failed = p.failedOrdinary;
  const jobs = await request(`actions/runs/${failed.runId}/jobs?per_page=100`);
  const normalized = jobs?.jobs?.map((j) => ({
    id: j.id,
    name: j.name,
    conclusion: j.conclusion,
    completedAt: j.completed_at,
    steps: j.steps?.map((s) => ({ number: s.number, name: s.name, conclusion: s.conclusion })),
  }));
  const ordered = (values) => [...values].sort((a, b) => a.id - b.id);
  if (
    jobs?.total_count !== failed.jobs.length ||
    !normalized ||
    digest(ordered(normalized)) !== digest(ordered(failed.jobs))
  )
    fail("R5_ORDINARY_FAILURE_BOUNDARY_CHANGED");
  const artifacts = await request(`actions/runs/${failed.runId}/artifacts?per_page=100`);
  if (artifacts?.total_count !== 0 || artifacts.artifacts?.length !== 0) fail("R5_ORDINARY_FAILURE_BOUNDARY_CHANGED");
  return [...prior, ...historical];
}
async function validateR4Predecessors(request) {
  const prior = await validateR3Predecessors(request);
  const third = await validateHistoricalPreparation(CROSSDECK_R4.predecessor, request);
  const p = CROSSDECK_R4.cancelledReview;
  const cancelled = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(cancelled, p)) fail("R4_CANCELLED_REVIEW_CHANGED");
  const jobs = await request(`actions/runs/${p.runId}/jobs?per_page=100`);
  const guard = jobs?.jobs?.find((job) => job.id === p.jobId);
  if (
    jobs?.total_count !== jobs?.jobs?.length ||
    !guard ||
    guard.conclusion !== "cancelled" ||
    guard.completed_at !== p.completedAt ||
    guard.steps?.find((step) => step.number === 3)?.conclusion !== "cancelled" ||
    ![4, 5, 6].every((n) => guard.steps?.find((step) => step.number === n)?.conclusion === "skipped")
  )
    fail("R4_CANCELLATION_BOUNDARY_CHANGED");
  const artifacts = await request(`actions/runs/${p.runId}/artifacts?per_page=100`);
  if (artifacts?.total_count !== 0 || artifacts.artifacts?.length !== 0) fail("R4_CANCELLATION_BOUNDARY_CHANGED");
  const commit = await request(`git/commits/${CROSSDECK_R4.evidenceCommit}`);
  const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
  const file = tree?.tree?.find((entry) => entry.path === CROSSDECK_R4.evidencePath);
  if (tree?.truncated || file?.type !== "blob" || file?.mode !== "100644") fail("R4_ACCEPTED_REVIEW_CHANGED");
  const blob = await request(`git/blobs/${file.sha}`);
  const bytes = Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== CROSSDECK_R4.evidenceSha256)
    fail("R4_ACCEPTED_REVIEW_CHANGED");
  return [...prior, third, cancelled];
}
async function validateR3Predecessors(request) {
  const first = await validateHistoricalPreparation(CROSSDECK_R2.predecessor, request);
  const second = await validateHistoricalPreparation(CROSSDECK_R3.predecessor, request);
  const commit = await request(`git/commits/${CROSSDECK_R3.evidenceCommit}`);
  const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
  const file = tree?.tree?.find((entry) => entry.path === CROSSDECK_R3.reviewPath);
  if (tree?.truncated || file?.type !== "blob" || file?.mode !== "100644") fail("R3_BLOCKED_REVIEW_CHANGED");
  const blob = await request(`git/blobs/${file.sha}`);
  const bytes = Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== CROSSDECK_R3.reviewSha256) fail("R3_BLOCKED_REVIEW_CHANGED");
  return [first, second];
}
async function validateHistoricalPreparation(p, request) {
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const reservation = await store.read("prepare");
  if (
    !reservation ||
    reservation.commitSha !== p.prepareCommit ||
    reservation.candidateSha !== p.candidateSha ||
    reservation.binding?.baseSha !== p.baseSha ||
    reservation.binding?.sourceDigest !== p.sourceDigest ||
    reservation.binding?.contractDigest !== p.contractDigest ||
    reservation.binding?.exception?.id !== p.id ||
    reservation.binding?.exception?.recordDigest !== p.recordDigest ||
    reservation.run?.runId !== p.runId ||
    reservation.run?.runAttempt !== 1 ||
    reservation.run?.actor !== "Kgray44" ||
    reservation.run?.headSha !== p.baseSha ||
    reservation.run?.event !== "workflow_dispatch" ||
    reservation.run?.headBranch !== "main" ||
    reservation.independentReviewsCompleted !== (p.independentReviewsCompleted ?? 2) ||
    reservation.reservedIndependentReviewOrdinal !== (p.reservedIndependentReviewOrdinal ?? 3)
  )
    fail("PREDECESSOR_RESERVATION_CHANGED");
  if (
    (
      await Promise.all(
        ["capture", "review-submit", "review3", "review4", "review5", "qualify", "qualified"].map((slot) =>
          store.read(slot),
        ),
      )
    ).some(Boolean)
  )
    fail("PREDECESSOR_CONSUMPTION_CHANGED");
  const originalRun = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(originalRun, p)) fail("PREDECESSOR_RUN_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  if (candidate?.tree?.sha !== p.candidateTree) fail("PREDECESSOR_SOURCE_CHANGED");
  for (const artifact of p.artifacts) {
    const observed = await request(`actions/artifacts/${artifact.id}`);
    if (
      observed?.id !== artifact.id ||
      observed.digest !== artifact.digest ||
      observed.size_in_bytes !== artifact.size ||
      observed.workflow_run?.id !== p.runId ||
      observed.workflow_run?.head_sha !== p.baseSha
    )
      fail("PREDECESSOR_ARTIFACT_CHANGED");
  }
  return originalRun;
}
export async function requireFirstCampaignRun(options) {
  return campaignHistory({ ...options, preflight: false });
}
export async function inspectCampaignBeforeLocalProof({ root, record, plan, request, now = new Date() }) {
  return campaignHistory({
    root,
    record,
    plan,
    request,
    now,
    preflight: true,
    mode: "local-preflight",
    run: { createdAt: now.toISOString(), workflowId: CROSSDECK_R6.predecessor.workflowId },
  });
}
async function campaignHistory({ root, record, plan, mode, run, request, now, preflight }) {
  const expected = `Sounding Line finite 1 ${mode} ${record.pullRequest} ${plan.candidateSha} active`;
  if ((!preflight && run.displayTitle !== expected) || !Number.isFinite(Date.parse(run.createdAt)))
    fail("HISTORY_CURRENT_RUN_UNBOUND");
  const predecessor = await validateSuccessorPredecessor({ record, request, now });
  const predecessors = predecessor ? (Array.isArray(predecessor) ? predecessor : [predecessor]) : [];
  const since = new Date(
    predecessor ? record.predecessor.campaignEpoch : record.ownerApproval.approvedAtUtcMinute,
  ).toISOString();
  if (
    Date.parse(run.createdAt) <
    Date.parse(record.ownerApproval.executionNotBeforeUtc ?? record.ownerApproval.approvedAtUtcMinute)
  )
    fail("HISTORY_EPOCH_INVALID");
  const range = encodeURIComponent(`${since}..${run.createdAt}`),
    all = new Map();
  let total;
  for (let page = 1; page <= 10; page++) {
    const data = await request(`actions/workflows/${run.workflowId}/runs?per_page=100&page=${page}&created=${range}`);
    if (
      !data ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count > 1000 ||
      !Array.isArray(data.workflow_runs) ||
      (total !== undefined && total !== data.total_count)
    )
      fail("HISTORY_INCOMPLETE");
    total = data.total_count;
    for (const item of data.workflow_runs) {
      if (all.has(item.id)) fail("HISTORY_AMBIGUOUS");
      all.set(item.id, item);
    }
    if (all.size === total) break;
    if (data.workflow_runs.length !== 100 || page === 10) fail("HISTORY_INCOMPLETE");
  }
  if (all.size !== total || (!preflight && !all.has(run.runId))) fail("HISTORY_INCOMPLETE");
  if (predecessors.some((p) => !all.has(p.id))) fail("PREDECESSOR_HISTORY_MISSING");
  const recognizedCandidates = new Map();
  async function recognized(candidate) {
    if (!/^[a-f0-9]{40}$/u.test(candidate)) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
    if (recognizedCandidates.has(candidate)) return recognizedCandidates.get(candidate);
    const related = await inspectCandidate(candidate);
    recognizedCandidates.set(candidate, related);
    return related;
  }
  async function inspectCandidate(candidate) {
    try {
      git(root, "cat-file", "-e", `${candidate}^{commit}`);
      const inventory = entries(root, candidate);
      // One immutable tree read covers every historical path, including directory
      // markers, rather than spawning a Git process for each path/run pair.
      const paths = treePaths(inventory);
      if (r3SourceFingerprint([...inventory]) === CROSSDECK_R3.maskedSrcDigest) return true;
      if (campaignHistoryMarker(record, inventory, paths)) return true;
      if (record.frozenTrees?.src && paths.has("src") && identity(root, candidate, "src") === record.frozenTrees.src)
        return true;
      if (paths.has("testing/contracts.json")) {
        const ids = (json(root, candidate, "testing/contracts.json").contracts ?? []).map((value) => value.id);
        if (ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens")) return true;
      }
      try {
        git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, candidate);
        return true;
      } catch {
        return false;
      }
    } catch {
      const commit = await request(`git/commits/${candidate}`);
      if (!commit) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
      const tree = await request(`git/trees/${commit.tree.sha}?recursive=1`);
      if (!tree || tree.truncated || !Array.isArray(tree.tree)) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
      if (
        r3SourceFingerprint(
          tree.tree
            .filter((entry) => entry.type !== "tree")
            .map((entry) => [entry.path, `${entry.mode} ${entry.type} ${entry.sha}`]),
        ) === CROSSDECK_R3.maskedSrcDigest
      )
        return true;
      if (
        campaignHistoryMarker(
          record,
          new Map(tree.tree.map((entry) => [entry.path, `${entry.mode} ${entry.type} ${entry.sha}`])),
        )
      )
        return true;
      if (tree.tree.some((entry) => entry.path === "src" && entry.sha === record.frozenTrees.src)) return true;
      const contracts = tree.tree.find((entry) => entry.path === "testing/contracts.json");
      if (contracts) {
        const blob = await request(`git/blobs/${contracts.sha}`);
        const ids = (
          JSON.parse(Buffer.from(blob.content.replaceAll("\n", ""), "base64").toString()).contracts ?? []
        ).map((value) => value.id);
        if (ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens")) return true;
      }
      return false;
    }
  }
  for (const item of all.values()) {
    if (predecessors.some((p) => item.id === p.id)) {
      if (ordinaryOnly(record.id)) {
        if (
          !r9HistoryRunMatches(
            item,
            predecessors.find((value) => value.id === item.id),
          )
        )
          fail("PREDECESSOR_HISTORY_CHANGED");
        continue;
      }
      const expectedPredecessor = [
        CROSSDECK_R2.predecessor,
        CROSSDECK_R3.predecessor,
        CROSSDECK_R4.predecessor,
        CROSSDECK_R4.cancelledReview,
        ...CROSSDECK_R5.predecessor.runs,
        CROSSDECK_R6.predecessor,
        CROSSDECK_R8.predecessor,
      ].find((p) => p.runId === item.id);
      if (!isExactFailedPredecessor(item, expectedPredecessor)) fail("PREDECESSOR_HISTORY_CHANGED");
      continue;
    }
    const title = /^Sounding Line finite 1 (ordinary|capture|review|verify) (\S+) (\S+) (active|draft)$/u.exec(
      item.display_title ?? "",
    );
    if (!(item.display_title ?? "").startsWith("Sounding Line finite 1 ")) continue;
    if (!title) fail("HISTORY_NAME_UNVERIFIABLE");
    if (Number(title[2]) !== record.pullRequest && !(await recognized(title[3]))) continue;
    if (
      item.workflow_id !== run.workflowId ||
      item.path !== workflowPath ||
      item.head_repository?.full_name !== record.repository ||
      item.actor?.login !== record.ownerApproval.actor ||
      item.triggering_actor?.login !== record.ownerApproval.actor ||
      item.run_attempt !== 1 ||
      !["workflow_dispatch", "pull_request_target"].includes(item.event) ||
      (item.event === "workflow_dispatch" && item.head_branch !== "main") ||
      (item.event === "pull_request_target" && item.head_sha !== title[3]) ||
      !Number.isFinite(Date.parse(item.created_at))
    )
      fail("HISTORY_ATTEMPT_INVALID_OR_AMBIGUOUS");
    if (
      title[4] === "draft" &&
      item.event === "pull_request_target" &&
      item.status === "completed" &&
      item.conclusion === "skipped"
    ) {
      const jobs = await request(`actions/runs/${item.id}/jobs?per_page=100`);
      if (
        !jobs ||
        jobs.total_count !== jobs.jobs?.length ||
        jobs.jobs.length < 3 ||
        jobs.jobs.some((job) => job.status !== "completed" || job.conclusion !== "skipped")
      )
        fail("HISTORY_DRAFT_SKIP_UNVERIFIABLE");
      continue;
    }
    const earlier =
      Date.parse(item.created_at) < Date.parse(run.createdAt) ||
      (item.created_at === run.createdAt && item.id < run.runId);
    if (preflight) fail("LOCAL_HISTORY_EXECUTION_ALREADY_CONSUMED");
    // R11 has no preparatory execution allowance. Its exact authenticated
    // predecessors were handled above; any other active campaign run consumes
    // the finite boundary, including successful cross-mode work.
    if (record.id === CROSSDECK_R11.id && item.id !== run.runId) fail("R11_UNLISTED_CAMPAIGN_RUN");
    if (earlier) {
      if (title[1] === mode) fail("EARLIER_ATTEMPT_CONSUMED");
      if (item.status !== "completed" || item.conclusion !== "success") fail("EARLIER_CAMPAIGN_FAILURE");
      if (mode === "capture" || (mode === "review" && title[1] !== "capture")) fail("CAMPAIGN_STAGE_OUT_OF_ORDER");
    }
  }
  return {
    status: "PASS",
    observedRuns: all.size,
    preservedPredecessorRuns: predecessors.length,
    throughUtc: run.createdAt,
    custodyWrites: 0,
  };
}
export async function reserveExceptionStage({ root, record, plan, mode, run, store, request, now }) {
  if (ordinaryOnly(record?.id) || ordinaryOnly(plan.exception?.id)) {
    if (!ordinaryOnly(record?.id) || plan.exception?.id !== record.id) fail("R9_STAGE_RECORD_PLAN_CHANGED");
    validateOrdinaryOnlyRecord(record);
    if (record.status !== "ACTIVE") fail("R9_STAGE_RECORD_INACTIVE");
  }
  assertOrdinaryOnlyMode(plan, mode);
  assertR8FormatMode(plan, mode);
  if (await store.read("qualify")) fail("QUALIFICATION_ALREADY_CONSUMED");
  if (mode === "verify") return;
  if (
    [
      CROSSDECK_R2.id,
      CROSSDECK_R3.id,
      CROSSDECK_R4.id,
      CROSSDECK_R5.id,
      CROSSDECK_R6.id,
      CROSSDECK_R7.id,
      CROSSDECK_R8.id,
    ].includes(record.id) &&
    mode === "review" &&
    (await store.read("review-submit"))
  )
    fail("REVIEW_SUBMISSION_ALREADY_CONSUMED");
  const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
  const reviewSeal = mode === "review" ? await store.read(reviewSlot) : null;
  if (reviewSeal) await requireSuccessfulReservation({ store, slot: reviewSlot, plan, request });
  else await requireFirstCampaignRun({ root, record, plan, mode, run, request, now });
  const binding = exceptionBinding(plan),
    candidateSha = plan.candidateSha;
  if (mode === "capture") {
    if ([CROSSDECK_R6.id, CROSSDECK_R7.id, CROSSDECK_R8.id].includes(record.id)) {
      const { planProductExperience } = await import("./product-experience.mjs");
      const { validateR6Proof } = await import("./experience-r6.mjs");
      const { validateR7Proof } = await import("./experience-r7.mjs");
      const { validateR8Proof } = await import("./experience-r8.mjs");
      const full = planProductExperience({
        root,
        baseSha: plan.baseSha,
        candidateSha: plan.candidateSha,
        changedPaths: git(root, "diff", "--name-only", "--no-renames", plan.baseSha, plan.candidateSha).split(/\r?\n/u),
        prNumber: 721,
      });
      await (
        record.id === CROSSDECK_R8.id
          ? validateR8Proof
          : record.id === CROSSDECK_R7.id
            ? validateR7Proof
            : validateR6Proof
      )({
        root,
        plan: full,
        revision: plan.candidateSha,
      });
    }
    if (record.id === CROSSDECK_R3.id) {
      const receipt = json(root, plan.candidateSha, CROSSDECK_R3.localProofPath);
      validateR3LocalReceipt(receipt, {
        ...plan,
        contracts: json(root, plan.candidateSha, "testing/contracts.json").contracts,
      });
      for (const artifact of receipt.artifacts) {
        if (
          !artifact.path.startsWith("Development_Docs/Projects/Project_Crossdeck/evidence/r3-verification-20261015/") ||
          artifact.path.split("/").includes("..")
        )
          fail("R3_LOCAL_PROOF_PATH_INVALID");
        const bytes = execFileSync("git", ["show", `${plan.candidateSha}:${artifact.path}`], {
          cwd: root,
          maxBuffer: 64 * 1024 * 1024,
        });
        if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) fail("R3_LOCAL_PROOF_MEDIA_CHANGED");
      }
    }
    await store.create("prepare", {
      binding,
      run,
      candidateSha,
      status: `PREPARE_AND_REVIEW${record.remainingIndependentReviewOrdinal}_RESERVED_VALIDATION_PENDING`,
      independentReviewsCompleted: record.independentProductReviewsCompleted,
      reservedIndependentReviewOrdinal: record.remainingIndependentReviewOrdinal,
      ...([
        CROSSDECK_R2.id,
        CROSSDECK_R3.id,
        CROSSDECK_R4.id,
        CROSSDECK_R5.id,
        CROSSDECK_R6.id,
        CROSSDECK_R7.id,
        CROSSDECK_R8.id,
      ].includes(record.id)
        ? { attemptHistory: { ...record.attemptHistory, status: "NEXT_PREPARATION_RESERVED_NOT_EXECUTED" } }
        : {}),
    });
  }
  if (mode === "ordinary") {
    await store.create("qualify", {
      binding,
      run,
      candidateSha,
      candidateTree: git(root, "rev-parse", candidateSha + "^{tree}"),
      status: "ONE_ORDINARY_INVOCATION_RESERVED_VALIDATION_PENDING",
    });
    await validateHistoricalExceptionCustody({ root, plan, request });
  }
  if (mode === "review") {
    await requireSuccessfulReservation({ store, slot: "prepare", plan, request });
    const submitted = await store.read("review-submit");
    if (submitted) await requireSuccessfulReservation({ store, slot: "review-submit", plan, request });
    else
      await store.create("review-submit", {
        binding,
        run,
        candidateSha,
        status: `RESERVED_REVIEW${record.remainingIndependentReviewOrdinal}_AUTHENTICATED_SUBMISSION_VALIDATION_PENDING`,
      });
  }
}
export async function requireSuccessfulReservation({ store, slot, plan, request }) {
  if (["prepare", "capture", "review7", "review-submit"].includes(slot)) plan = r8FormatEvidencePlan(plan);
  const reservation = await store.read(slot);
  if (!reservation || digest(reservation.binding) !== digest(exceptionBinding(plan)))
    fail("RESERVATION_BINDING_MISSING");
  const run = await request(`actions/runs/${reservation.run.runId}`);
  if (
    !run ||
    run.run_attempt !== 1 ||
    run.conclusion !== "success" ||
    run.head_sha !== reservation.run.headSha ||
    run.head_branch !== reservation.run.headBranch ||
    run.event !== reservation.run.event ||
    run.actor?.login !== reservation.run.actor ||
    run.triggering_actor?.login !== reservation.run.actor
  )
    fail("RESERVED_RUN_NOT_SUCCESSFUL");
  return reservation;
}
export async function verifyExceptionAttestation({
  root,
  plan,
  evidence,
  capture,
  review,
  request,
  now,
  createRequest = githubRequest,
}) {
  if (!plan.exception) return null;
  const actualPlan = plan;
  const currentRecord = trustedExceptions(root, plan.baseSha).find((value) => value.id === plan.exception.id);
  const api = request ?? createRequest(currentRecord.repository);
  const context = historicalExceptionContext({ root, plan, request: api });
  if (plan.exception.nonExecutingReconciliation) {
    await validateHistoricalExceptionCustody({ root, plan, request: api });
    plan = r8FormatEvidencePlan(plan);
  }
  const record = context.record;
  validateExceptionRecord(record, now);
  const store = context.store;
  const prepare = await requireSuccessfulReservation({ store, slot: "prepare", plan, request: api });
  const captureSeal = await store.read("capture");
  const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
  const sealed = await store.read(reviewSlot);
  if (
    !captureSeal ||
    digest(captureSeal.provenance) !== digest(capture.trustedArtifact) ||
    capture.trustedArtifact.runId !== prepare.run.runId ||
    !sealed ||
    digest(sealed.reviewIdentity) !== digest(sealedReviewIdentity(plan, evidence)) ||
    digest(capture.exception) !== digest(plan.exception) ||
    digest(review.exception) !== digest(plan.exception) ||
    capture.exceptionPreparationReservation !== prepare.commitSha ||
    review.exceptionPreparationReservation !== prepare.commitSha ||
    review.exceptionReviewSeal !== sealed.commitSha
  )
    fail("SEALED_EVIDENCE_MISMATCH");
  await requireSuccessfulReservation({ store, slot: reviewSlot, plan, request: api });
  return {
    prepareReservation: prepare.commitSha,
    reviewSeal: sealed.commitSha,
    ...(actualPlan.exception.nonExecutingReconciliation
      ? { nonExecutingReconciliation: actualPlan.exception.nonExecutingReconciliation }
      : {}),
  };
}
function phasePath(root, phase) {
  return path.join(root, "artifacts/sounding-line", `exception-${phase}.json`);
}
export function claimExceptionPhase({
  root,
  phase,
  plan,
  runId,
  lease = randomUUID(),
  preparationReservation,
  executionHistory,
}) {
  try {
    mkdirSync(path.dirname(phasePath(root, phase)), { recursive: true });
  } catch (error) {
    throw observeVerificationFailure("PHASE_DIRECTORY", error, { phase });
  }
  const value = {
    binding: exceptionBinding(plan),
    phase,
    runId,
    ownerPid: process.pid,
    lease,
    preparationReservation,
    ...(executionHistory ? { executionHistory } : {}),
  };
  try {
    writeFileSync(phasePath(root, phase), JSON.stringify(value), { flag: "wx" });
  } catch (cause) {
    throw observeVerificationFailure(
      "PHASE_CREATE",
      new Error("PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PHASE_ALREADY_CONSUMED"),
      { cause, phase },
    );
  }
  return value;
}
export function requireExceptionPhase({ root, phase, plan, environment = process.env }) {
  if (!existsSync(phasePath(root, phase))) fail("EXECUTION_PHASE_NOT_RESERVED");
  const value = JSON.parse(readFileSync(phasePath(root, phase), "utf8"));
  if (
    digest(value.binding) !== digest(exceptionBinding(plan)) ||
    value.runId !== Number(environment.GITHUB_RUN_ID) ||
    value.lease !== environment.SOUNDING_LINE_EXCEPTION_LEASE
  )
    fail("EXECUTION_PHASE_BINDING_MISMATCH");
  try {
    process.kill(value.ownerPid, 0);
  } catch {
    fail("EXECUTION_PHASE_OWNER_EXITED");
  }
  return value;
}
export function recognizeExceptionExecution({ root, baseSha, candidateSha, environment = process.env }) {
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const installedHead = git(installed, "rev-parse", "HEAD");
  const records = [
    CROSSDECK_CAMPAIGN,
    ...exceptionRecords(installed, installedHead),
    ...exceptionRecords(root, candidateSha),
    ...(baseSha ? exceptionRecords(root, baseSha) : []),
  ];
  let protectedBase;
  try {
    protectedBase = git(root, "rev-parse", "origin/main");
  } catch {
    protectedBase = null;
  }
  // Installed and retired records are all denial signals. Inventory this exact
  // candidate once rather than asking Git about each absent historical marker.
  const candidateInventory = entries(root, candidateSha);
  const candidatePaths = treePaths(candidateInventory);
  let r3Family = false;
  try {
    r3Family = r3SourceFingerprint([...candidateInventory]) === CROSSDECK_R3.maskedSrcDigest;
  } catch {}
  return records.some((record) => {
    const marker = campaignHistoryMarker(record, candidateInventory, candidatePaths);
    const ids = present(root, candidateSha, "testing/contracts.json")
      ? (json(root, candidateSha, "testing/contracts.json").contracts ?? []).map((value) => value.id)
      : [];
    const refit = ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens");
    const frozen =
      record.frozenTrees?.src &&
      present(root, candidateSha, "src") &&
      identity(root, candidateSha, "src") === record.frozenTrees.src;
    let descends = false;
    try {
      git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, candidateSha);
      descends = true;
    } catch {}
    const referenceBase = protectedBase ?? record.frozenHistoricalBaseSha;
    return (
      Number(environment.SOUNDING_LINE_PR_NUMBER) === record.pullRequest ||
      ((marker || descends || refit || frozen || r3Family) &&
        (!referenceBase ||
          baseSha !== referenceBase ||
          baseSha === candidateSha ||
          campaignRelated({ root, baseSha: referenceBase, candidateSha, record })))
    );
  });
}
export async function assertExceptionExecution({
  root,
  plan,
  kind,
  environment = process.env,
  claim = false,
  request,
}) {
  // Rebuild from immutable source. A supplied plan or environment can never create permission.
  if (!existsSync(path.join(root, ".git")) && !plan.exception) return null;
  if (
    !recognizeExceptionExecution({
      root,
      baseSha: plan.baseSha,
      candidateSha: git(root, "rev-parse", "HEAD"),
      environment,
    })
  ) {
    if (plan.exception) fail("UNTRUSTED_EXECUTION_CLAIM");
    return null;
  }
  if (!plan.baseSha || !plan.candidateSha) {
    fail("EXECUTION_PLAN_CHANGED");
  }
  const records = trustedExceptions(root, plan.baseSha);
  const related = records.some((record) =>
    campaignRelated({
      root,
      baseSha: plan.baseSha,
      candidateSha: plan.candidateSha,
      record,
      prNumber: environment.SOUNDING_LINE_PR_NUMBER,
    }),
  );
  if (!related) {
    fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  }
  const { planProductExperience } = await import("./product-experience.mjs");
  const candidateSha = git(root, "rev-parse", "HEAD");
  if (candidateSha !== plan.candidateSha) fail("EXECUTION_HEAD_CHANGED");
  const changedPaths = git(root, "diff", "--name-only", "--no-renames", plan.baseSha, candidateSha).split(/\r?\n/u);
  const actual = planProductExperience({
    root,
    baseSha: plan.baseSha,
    candidateSha,
    changedPaths,
    prNumber: environment.SOUNDING_LINE_PR_NUMBER,
  });
  if (!actual.exception) fail("APPROVAL_MISSING_OR_INACTIVE");
  if (
    actual.exception.nonExecutingReconciliation &&
    (environment.SOUNDING_LINE_EXCEPTION_PHASE !== "qualify" ||
      plan.localProof ||
      Object.keys(environment).some(
        (key) => /^SOUNDING_LINE_R(?:[3-9]|10|11)_LOCAL_LEASE$/u.test(key) && environment[key],
      ))
  )
    fail("R8_FORMAT_EXECUTION_FORBIDDEN");
  if (environment.SOUNDING_LINE_R8_LOCAL_LEASE) {
    if (kind !== "experience" || environment.GITHUB_ACTIONS === "true" || actual.exception.id !== CROSSDECK_R8.id)
      fail("R8_LOCAL_PROOF_SCOPE_CHANGED");
    const marker = JSON.parse(readFileSync(r8LocalMarkerPath(root), "utf8"));
    if (
      marker.status !== "STARTED" ||
      marker.lease !== environment.SOUNDING_LINE_R8_LOCAL_LEASE ||
      marker.candidateSha !== candidateSha ||
      digest(marker.binding) !== digest(exceptionBinding(actual))
    )
      fail("R8_LOCAL_PROOF_CONSUMED_OR_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("R8_LOCAL_PROOF_OWNER_EXITED");
    }
    if (plan.localProof !== CROSSDECK_R8.id || plan.pairedOnly !== true) fail("R8_LOCAL_PROOF_SCOPE_CHANGED");
    validateExceptionExecutionPlan(r8LocalPlan(actual), plan);
    if (claim) claimExceptionPhase({ root, phase: "r8-local-launch", plan, runId: 0 });
    return { ...marker, preparationReservation: "LOCAL_PROOF_NOT_PROTECTED_PREPARATION" };
  }
  if (environment.SOUNDING_LINE_R7_LOCAL_LEASE) {
    if (kind !== "experience" || environment.GITHUB_ACTIONS === "true" || actual.exception.id !== CROSSDECK_R7.id)
      fail("R7_LOCAL_PROOF_SCOPE_CHANGED");
    const marker = JSON.parse(readFileSync(r7LocalMarkerPath(root), "utf8"));
    if (
      marker.status !== "STARTED" ||
      marker.lease !== environment.SOUNDING_LINE_R7_LOCAL_LEASE ||
      marker.candidateSha !== candidateSha ||
      digest(marker.binding) !== digest(exceptionBinding(actual))
    )
      fail("R7_LOCAL_PROOF_CONSUMED_OR_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("R7_LOCAL_PROOF_OWNER_EXITED");
    }
    if (plan.localProof !== CROSSDECK_R7.id || plan.pairedOnly !== true) fail("R7_LOCAL_PROOF_SCOPE_CHANGED");
    validateExceptionExecutionPlan(r7LocalPlan(actual), plan);
    if (claim) claimExceptionPhase({ root, phase: "r7-local-launch", plan, runId: 0 });
    return { ...marker, preparationReservation: "LOCAL_PROOF_NOT_PROTECTED_PREPARATION" };
  }
  if (environment.SOUNDING_LINE_R6_LOCAL_LEASE) {
    if (kind !== "experience" || environment.GITHUB_ACTIONS === "true" || actual.exception.id !== CROSSDECK_R6.id)
      fail("R6_LOCAL_PROOF_SCOPE_CHANGED");
    const marker = JSON.parse(readFileSync(r6LocalMarkerPath(root), "utf8"));
    if (
      marker.status !== "STARTED" ||
      marker.lease !== environment.SOUNDING_LINE_R6_LOCAL_LEASE ||
      marker.candidateSha !== candidateSha ||
      digest(marker.binding) !== digest(exceptionBinding(actual))
    )
      fail("R6_LOCAL_PROOF_CONSUMED_OR_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("R6_LOCAL_PROOF_OWNER_EXITED");
    }
    if (plan.localProof !== CROSSDECK_R6.id || plan.pairedOnly !== true) fail("R6_LOCAL_PROOF_SCOPE_CHANGED");
    validateExceptionExecutionPlan(r6LocalPlan(actual), plan);
    if (claim) claimExceptionPhase({ root, phase: "r6-local-launch", plan, runId: 0 });
    return { ...marker, preparationReservation: "LOCAL_PROOF_NOT_PROTECTED_PREPARATION" };
  }
  if (environment.SOUNDING_LINE_R3_LOCAL_LEASE) {
    if (kind !== "experience" || environment.GITHUB_ACTIONS === "true" || actual.exception.id !== CROSSDECK_R3.id)
      fail("R3_LOCAL_PROOF_SCOPE_CHANGED");
    const marker = JSON.parse(readFileSync(r3LocalMarkerPath(root), "utf8"));
    if (
      marker.status !== "STARTED" ||
      marker.lease !== environment.SOUNDING_LINE_R3_LOCAL_LEASE ||
      digest(marker.binding) !== digest(exceptionBinding(actual))
    )
      fail("R3_LOCAL_PROOF_CONSUMED_OR_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("R3_LOCAL_PROOF_OWNER_EXITED");
    }
    if (plan.localProof !== CROSSDECK_R3.id || !["NORMAL", "REDUCED"].includes(plan.localProofMotionMode))
      fail("R3_LOCAL_PROOF_SCOPE_CHANGED");
    validateExceptionExecutionPlan(r3LocalPlan(actual, plan.localProofMotionMode), plan);
    if (claim) claimExceptionPhase({ root, phase: `r3-local-launch-${plan.localProofMotionMode}`, plan, runId: 0 });
    return { ...marker, preparationReservation: "LOCAL_PROOF_NOT_PROTECTED_PREPARATION" };
  }
  validateExceptionExecutionPlan(plan, actual);
  const record = trustedExceptions(root, plan.baseSha).find((value) => value.id === actual.exception.id);
  const phase = environment.SOUNDING_LINE_EXCEPTION_PHASE;
  if (
    !["prepare", "qualify"].includes(phase) ||
    (kind !== "experience" && phase !== "qualify") ||
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_RUN_ATTEMPT !== "1" ||
    environment.GITHUB_JOB !== (phase === "prepare" ? "experience-preparation" : "final-check")
  )
    fail("EXECUTION_PHASE_FORBIDDEN");
  const phaseName = kind === "ordinary" ? "ordinary" : kind === "technical" ? "technical" : "experience";
  if (!claim) return requireExceptionPhase({ root, phase: phaseName, plan, environment });
  if (kind === "technical")
    requireExceptionPhase({
      root,
      phase: "ordinary",
      plan,
      environment: {
        ...environment,
        SOUNDING_LINE_EXCEPTION_LEASE: environment.SOUNDING_LINE_EXCEPTION_ORDINARY_LEASE,
      },
    });
  const api = request ?? githubRequest(record.repository);
  await validateLiveContext({ record, plan, request: api, environment });
  await validateHistoricalExceptionCustody({ root, plan, request: api });
  const reservation = await exceptionStore({ record, request: api }).read(phase);
  if (
    !reservation ||
    digest(reservation.binding) !== digest(exceptionBinding(plan)) ||
    reservation.run.runId !== Number(environment.GITHUB_RUN_ID) ||
    (phase === "qualify" && reservation.candidateSha !== candidateSha)
  )
    fail("EXECUTION_RESERVATION_MISSING");
  if (kind === "experience" && phase === "qualify" && !existsSync(phasePath(root, "technical-complete")))
    fail("TECHNICAL_VERIFICATION_NOT_COMPLETE");
  const prepare =
    phase === "prepare"
      ? reservation
      : await historicalExceptionContext({ root, plan, request: api }).store.read("prepare");
  return claimExceptionPhase({
    root,
    phase: phaseName,
    plan,
    runId: Number(environment.GITHUB_RUN_ID),
    preparationReservation: prepare.commitSha,
    ...([
      CROSSDECK_R2.id,
      CROSSDECK_R3.id,
      CROSSDECK_R4.id,
      CROSSDECK_R5.id,
      CROSSDECK_R6.id,
      CROSSDECK_R7.id,
      CROSSDECK_R8.id,
      CROSSDECK_R9.id,
      CROSSDECK_R10.id,
      CROSSDECK_R11.id,
    ].includes(record.id)
      ? {
          executionHistory: {
            ...record.attemptHistory,
            stage: phase,
            ...(phase === "prepare"
              ? { executedAttemptsIncludingThisPreparation: record.attemptHistory.nextPreparationAttemptTotal }
              : {}),
          },
        }
      : {}),
  });
}
export function r3LocalMarkerPath(root) {
  return path.join(
    git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "sounding-line",
    `${CROSSDECK_R3.id}-local-proof.json`,
  );
}
export function r6LocalMarkerPath(root) {
  return path.join(
    git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "sounding-line",
    `${CROSSDECK_R6.id}-local-proof.json`,
  );
}
export function r7LocalMarkerPath(root) {
  return path.join(
    git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "sounding-line",
    `${CROSSDECK_R7.id}-local-proof.json`,
  );
}
export function r8LocalMarkerPath(root) {
  return path.join(
    git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "sounding-line",
    `${CROSSDECK_R8.id}-local-proof.json`,
  );
}
export async function exceptionSuitePlan({ root, candidateSha, environment = process.env }) {
  if (!existsSync(path.join(root, ".git"))) return null;
  const baseSha = environment.SOUNDING_LINE_BASE_SHA ?? git(root, "merge-base", candidateSha, "origin/main");
  if (!recognizeExceptionExecution({ root, baseSha, candidateSha, environment })) return null;
  const { planProductExperience } = await import("./product-experience.mjs");
  const plan = planProductExperience({
    root,
    baseSha,
    candidateSha,
    changedPaths: git(root, "diff", "--name-only", "--no-renames", baseSha, candidateSha).split(/\r?\n/u),
    prNumber: environment.SOUNDING_LINE_PR_NUMBER,
  });
  if (!plan.exception) fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  return plan;
}
export function markExceptionTechnicalComplete(root, plan) {
  if (plan.exception)
    claimExceptionPhase({ root, phase: "technical-complete", plan, runId: Number(process.env.GITHUB_RUN_ID) });
}

export async function sealExceptionQualification({ root, record, plan, ordinary, run, store, decision }) {
  if (record?.id !== plan.exception?.id) fail("QUALIFICATION_RECORD_CHANGED");
  if (ordinaryOnly(record.id)) {
    validateOrdinaryOnlyRecord(record);
    if (record.status !== "ACTIVE") fail("R9_STAGE_RECORD_INACTIVE");
  }
  const qualification = await store.read("qualify");
  if (
    !qualification ||
    digest(qualification.binding) !== digest(exceptionBinding(plan)) ||
    digest(qualification.run) !== digest(run) ||
    qualification.candidateSha !== plan.candidateSha ||
    decision.decision !== "PASS" ||
    decision.baseSha !== plan.baseSha ||
    decision.candidateSha !== plan.candidateSha ||
    decision.candidateTree !== git(root, "rev-parse", `${plan.candidateSha}^{tree}`) ||
    decision.candidateTree !== qualification.candidateTree ||
    decision.productExperienceDecision?.status !== "PASS" ||
    decision.productExperienceReplay?.status !== "PASS" ||
    decision.productExperienceReplay?.sourceDigest !== plan.sourceDigest ||
    decision.productExperience?.trustedAttestation?.status !== "PASS" ||
    digest(decision.productExperience?.exception) !== digest(plan.exception)
  )
    fail("FINAL_DECISION_MISMATCH");
  if (ordinaryOnly(record.id)) {
    const { verificationObligationGroups } = await import("./ordinary.mjs");
    (record.id === CROSSDECK_R11.id
      ? validateR11FinalDecision
      : record.id === CROSSDECK_R10.id
        ? validateR10FinalDecision
        : validateR9FinalDecision)({
      plan,
      ordinary,
      record,
      decision,
      groups: verificationObligationGroups(ordinary),
    });
  }
  return store.create("qualified", {
    binding: exceptionBinding(plan),
    run,
    candidateSha: plan.candidateSha,
    candidateTree: decision.candidateTree,
    decisionDigest: digest(decision),
    status: "QUALIFIED_JOB_PASS_AWAITING_WHOLE_WORKFLOW_CONCLUSION",
  });
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace ?? process.cwd());
  if (!["reserve", "seal"].includes(options.operation)) fail("OPERATION_FORBIDDEN");
  const baseSha = options.base,
    candidateSha = options.candidate;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const prNumber = event.pull_request?.number ?? event.inputs?.pr_number;
  const installedBase = process.env.GITHUB_SHA;
  const record = trustedExceptions(root, installedBase).find((value) =>
    campaignRelated({ root, baseSha: installedBase, candidateSha, record: value, prNumber }),
  );
  const output = (value) => {
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, value, { flag: "a" });
  };
  if (!record) {
    output("campaign=false\n");
    return;
  }
  if (baseSha !== installedBase) fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  const { buildPlan } = await import("./ordinary.mjs");
  const { productSourceDigest, sourceSnapshot, mergeExperienceContracts } = await import("./product-experience.mjs");
  const { loadTrustedExperienceArtifact, verifyTrustedExperienceAttestation } = await import(
    "./experience-attestation.mjs"
  );
  if (Number(prNumber) !== record.pullRequest || String(event.inputs?.experience_diagnostic) === "true")
    fail("TARGET_OR_SELECTED_SCOPE_CHANGED");
  const request = githubRequest(record.repository);
  const mode = event.inputs?.experience_mode ?? "ordinary";
  if (!["ordinary", "capture", "review", "verify"].includes(mode)) fail("MODE_FORBIDDEN");
  assertOrdinaryOnlyMode({ exception: { id: record.id } }, mode);
  // Reserve before validation/downloads/setup can fail or be cancelled. The raw
  // source identity is an observation; it grants no admission until the complete
  // protected plan and all normal evidence gates subsequently validate it.
  const pendingPlan = {
    baseSha,
    candidateSha,
    sourceDigest: productSourceDigest(sourceSnapshot(root, candidateSha)),
    contractDigest:
      record.id === CROSSDECK_R3.id
        ? digest(
            mergeExperienceContracts(
              json(root, baseSha, "testing/contracts.json").contracts.filter((c) => c.experience),
              json(root, candidateSha, "testing/contracts.json").contracts,
            ).filter((c) => record.contractIds.includes(c.id)),
          )
        : record.contractDigest,
    exception: recordBinding(record),
  };
  const reconciliation = ordinaryOnly(record.id)
    ? pendingOrdinaryOnlyReconciliation({ root, baseSha, plan: pendingPlan, record })
    : pendingR8FormatReconciliation({ root, baseSha, plan: pendingPlan, record });
  if (reconciliation) pendingPlan.exception.nonExecutingReconciliation = reconciliation;
  assertR8FormatMode(pendingPlan, mode);
  const run = await validateLiveContext({
    record,
    plan: pendingPlan,
    request,
    requireHead: !["review", "verify"].includes(mode),
  });
  const store = exceptionStore({ record, request });
  const binding = exceptionBinding(pendingPlan);
  if (options.operation !== "seal")
    await reserveExceptionStage({ root, record, plan: pendingPlan, mode, run, store, request });
  const ordinary = await buildPlan({ root, baseSha, candidateSha, experienceEvidenceRequired: false, prNumber });
  const plan = ordinary.productExperience;
  if (
    digest(exceptionBinding(plan)) !== digest(binding) ||
    digest(ordinary.selected.browserTests) !== digest(record.requiredTechnicalBrowserTests)
  )
    fail("TARGET_OR_SELECTED_SCOPE_CHANGED");
  if (options.operation === "seal") {
    const decision = JSON.parse(readFileSync(options.decision, "utf8"));
    await sealExceptionQualification({ root, record, plan, ordinary, run, store, decision });
  } else if (mode === "capture") {
    // The reservation is already durable; a failed remainder is never refunded.
  } else {
    const historicalContext = historicalExceptionContext({ root, plan, request });
    const prepare = await requireSuccessfulReservation({
      store: historicalContext.store,
      slot: "prepare",
      plan: historicalContext.plan,
      request,
    });
    const evidenceRoot = path.resolve(options.evidence ?? root);
    const evidence = await validateExceptionSubmissionEvidence({ root, plan, mode, candidateSha, evidenceRoot });
    if (mode === "review") {
      const capture = await loadTrustedExperienceArtifact({
        root,
        plan,
        artifactId: evidence.captureArtifactId,
        kind: "capture",
        policy: plan.attestationPolicy,
      });
      if (
        capture.exceptionPreparationReservation !== prepare.commitSha ||
        digest(capture.exception) !== digest(plan.exception) ||
        capture.trustedArtifact.runId !== prepare.run.runId ||
        digest(capture.artifacts) !== digest(evidence.artifacts) ||
        digest(capture.journeys) !== digest(evidence.journeys) ||
        digest(capture.pairedEvidence) !== digest(evidence.pairedEvidence)
      )
        fail("CAPTURE_REVIEW_MISMATCH");
      const captureSeal = await store.read("capture");
      if (captureSeal) {
        if (digest(captureSeal.provenance) !== digest(capture.trustedArtifact)) fail("CAPTURE_ALREADY_SEALED");
      } else
        await store.create("capture", {
          binding,
          run: prepare.run,
          provenance: capture.trustedArtifact,
          status: "SUCCESSFUL_ORIGINAL_CAPTURE_SEALED",
        });
      const reviewIdentity = sealedReviewIdentity(plan, evidence);
      const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
      const previous = await store.read(reviewSlot);
      if (previous) {
        if (digest(previous.reviewIdentity) !== digest(reviewIdentity)) fail("REVIEW3_ALREADY_SEALED");
        const original = await request(`actions/runs/${previous.run.runId}`);
        if (original?.conclusion !== "success" || original.run_attempt !== 1)
          fail("ORIGINAL_REVIEW_SUBMISSION_NOT_SUCCESSFUL");
      } else
        await store.create(reviewSlot, {
          binding,
          run,
          reviewIdentity,
          prepareReservation: prepare.commitSha,
          status: `EXACT_REVIEW${record.remainingIndependentReviewOrdinal}_SEALED_PENDING_SUCCESSFUL_AUTHENTICATED_SUBMISSION`,
        });
    } else if (["ordinary", "verify"].includes(mode)) {
      await verifyTrustedExperienceAttestation({ root, plan, evidence, custodyRequest: request });
    } else fail("MODE_FORBIDDEN");
  }
  output(`campaign=true\nphase=${mode === "capture" ? "prepare" : "qualify"}\n`);
}
// Avoid a top-level-await cycle: ordinary imports this module and the trusted CLI
// loads ordinary only after deciding whether the finite campaign applies.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

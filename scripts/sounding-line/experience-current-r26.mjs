import { createHash } from "node:crypto";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { sourceSnapshot, productSourceDigest } from "./product-experience.mjs";
import {
  CURRENT_R25,
  validateR25Record,
  validateR25Registry,
  bindR25,
  r25HistoricalPlan,
  validateR25ReviewedIdentity,
  r25Adoption,
} from "./experience-current-r25.mjs";
import {
  currentAdmissionBinding,
  validateCurrentAdmissionOverlay,
  validateCurrentAdmissionPredecessors,
  currentRunIdentity,
} from "./experience-current-admission.mjs";
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CURRENT_R26 = freeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261021-R26",
  version: 26,
  protectedBaseAncestorSha: "185f5fd368ec16a77cb5fe92e7813d7ca4ac6418",
  frozenReferenceSha: "8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94",
  frozenReferenceTree: "047cbffac8ca0edff667b97033a79c42a845443f",
  previousRegistryRawSha256: "6e1884e179832900b1962d8f05bd6311b847e6ab836004e775b4f879f332f7c0",
  previousRegistryDigest: "61483d5b624c57b89ab2eeaea5402351ae42eb88e2729568c41edc2c901a6245",
  previousRecordDigest: "129cf06c315638aa028068bf79abdddc53692bfc2529fba2eb615ce467d46d5d",
  previousExceptionDigest: "82fee59002ca11188685dc319b2b689d95c40cd15986a400ec75a6d1e275faab",
  previousRunsDigest: "bbd496427de3682cbb56eee4a16bd398c49e4e7bb7a0c3d96f17fc01b713da65",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtc: null,
    approvedAtUtcMinute: null,
    humanMessageId: "01a15f7b-798a-7921-b7f6-89f7b4a3ed13",
    relayThreadId: "01a15eae-a6a5-71c2-9713-dfbac9002ebb",
    basis: "DIRECT_OWNER_NATIVE_QUESTION_REPLY_TIMESTAMP_UNAVAILABLE",
    questionCallId: "call_4e54a51caf2d4b1a9ed4ae4fddf4706c",
    questionItem: 0,
    selectedAnswer: "Authorize one R26 attempt (Recommended)",
    directiveSha256: "e662fbfa020c0eafded4e9b04d6ad51b89445357cd5dab2d57a5438582a028bd",
    authorizationObservedAtUtc: "2026-10-21T17:24:50Z",
    executionNotBeforeUtc: "2026-10-21T17:24:50Z",
    executionDeadlineUtc: "2026-10-22T03:59:59Z",
  },
  cumulativeHistory: {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 27,
    currentPreparationOrdinal: 28,
    completedIndependentReviews: 12,
  },
  retained: {
    kind: "EXACT_R23_REVIEW_MAINTENANCE_ADOPTION_1",
    id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R23",
    version: 23,
    recordDigest: "02391f9e6ee41b656e228a1b38ff3ee7e29065f4ae8e2a585f5eb23aabda751d",
    baseSha: "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
    sourceDigest: "e6cf2d544efc36fce2ccfee7f16334296a1f82e783726e7dfd067a67d3a7debf",
    contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
    executedCandidateSha: "f5e0cddde5c626648bc264f93819836a49c04d33",
    publishedCandidateSha: "80e350d8c59f6b132b573cc2b8158c5f7ae11a82",
    captureRunId: 39520615298,
    captureArtifactId: 12311867110,
    reviewRunId: 39551039268,
    reviewArtifactId: 12324561775,
    independentReviewOrdinal: 12,
    requiredReviewIterations: 16,
  },
  observationId: "SL-CROSSDECK-R26-20261021-REPLAY-PATH-RECOVERY",
  observationKeyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
  addedRun: {
    id: 39622005087,
    runAttempt: 1,
    workflowId: 341545080,
    event: "pull_request_target",
    headSha: "8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94",
    headBranch: "codex/crossdeck-experience-refit",
    actor: "Kgray44",
    triggeringActor: "Kgray44",
    repository: "Kgray44/treasurehuntSoT",
    status: "completed",
    conclusion: "failure",
    createdAt: "2026-10-21T15:01:17Z",
    displayTitle: "Sounding Line finite 1 ordinary 721 8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94 active",
    checkSuiteId: 107376075410,
  },
  failedOrdinary: {
    kind: "CONSUMED_R25_ORDINARY_REPLAY_VALIDATION_FAILURE_1",
    campaignEpoch: "2026-10-15T13:54Z",
    id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261021-R25",
    recordDigest: "129cf06c315638aa028068bf79abdddc53692bfc2529fba2eb615ce467d46d5d",
    runId: 39622005087,
    runAttempt: 1,
    conclusion: "failure",
    candidateSha: "8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94",
    candidateTree: "047cbffac8ca0edff667b97033a79c42a845443f",
    baseSha: "185f5fd368ec16a77cb5fe92e7813d7ca4ac6418",
    sourceDigest: "1ac6e3973470befddd4fb21e7c826798146e2f3ba4505731643d915f449e30fa",
    contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
    qualifyCommit: "ab55b3704e07c49e44ed148cadd6dae93350e3d9",
    qualifyPayloadDigest: "8ac4d6dc390dc04789fa9f61ca6d8810389a9cb4d3e133643297843008af4469",
    qualifyPayloadRawSha256: "8ac4d6dc390dc04789fa9f61ca6d8810389a9cb4d3e133643297843008af4469",
    qualifiedAbsent: true,
    jobs: [
      {
        id: 119297649609,
        name: "Sounding Line / Finite campaign custody",
        conclusion: "success",
      },
      {
        id: 119303680037,
        name: "Sounding Line / Focused verification",
        conclusion: "failure",
      },
      {
        id: 119303683469,
        name: "Sounding Line / Experience preparation (no mainline decision)",
        conclusion: "skipped",
      },
      {
        id: 119336396037,
        name: "Sounding Line / Mainline Decision",
        conclusion: "failure",
      },
    ],
    artifact: {
      id: 12360960157,
      name: "sounding-line-completed-evidence-39622005087-1",
      bytes: 3212033,
      sha256: "464e76c4b8b8fe3584ec806f2c55f2d8682444c50094482208cb94d5cf0937b2",
      runId: 39622005087,
    },
    artifacts: [
      {
        id: 12359767656,
        name: "sounding-line-ordinary-8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94",
        bytes: 890481,
        sha256: "08313e94bd38b48c0a7582fc6ec0674a19832ab08c85c6799c906fe90f588057",
        runId: 39622005087,
      },
      {
        id: 12359962411,
        name: "sounding-line-current-admission-observation-8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94",
        bytes: 7316,
        sha256: "faec80ee082795bcc065dd9bccfb5fe1e370f0d9a3ad49df7313841a721ec5fb",
        runId: 39622005087,
      },
      {
        id: 12360960157,
        name: "sounding-line-completed-evidence-39622005087-1",
        bytes: 3212033,
        sha256: "464e76c4b8b8fe3584ec806f2c55f2d8682444c50094482208cb94d5cf0937b2",
        runId: 39622005087,
      },
    ],
    completedWholeObligations: 8,
    requiredWholeObligations: 8,
    technicalBrowser: {
      passed: 50,
      planned: 50,
      wholeObligationPassed: true,
      wholeRunAccepted: false,
    },
    wholeRunAccepted: false,
    providerJobLimitMinutes: 90,
  },
  precommandRecovery: {
    kind: "CROSSDECK_ONLY_FINAL_CHECK_JOB_CEILING_90_1",
    scope: "PR_721_AUTHORIZED_FINITE_ORDINARY_ONLY",
    priorJobLimitMinutes: 45,
    jobLimitMinutes: 90,
    otherPullRequestsJobLimitMinutes: 45,
    jobLimitChanged: true,
    semanticGraphEngineChanged: false,
    completedEvidenceReaderChanged: false,
    liveAdmission: "FRESH_UNCHANGED",
    completedEvidence: "NORMAL_EXACT_FINGERPRINT_AND_AUTHENTICATED_PRODUCER_ONLY",
    partialBrowserCredit: false,
  },
  replayPathRecovery: {
    kind: "ACCEPTED_AUTOMATED_REPLAY_ROOT_SPLIT_1",
    pullRequest: 784,
    reviewedHead: "0e6a2e1241512bba5f4b2060a2c77288677ead68",
    acceptedMain: "d699de9568ea355a363223dd88f747536b450688",
    tree: "a5c36fe4bf1e92ca6c979f4d91c564ff4ebf3bff",
    qualificationRunId: 39637715096,
    providerBudgetChanged: false,
    technicalReuse: "NORMAL_COMPLETE_FINGERPRINT_AND_AUTHENTICATED_PRODUCER_ONLY",
    newCaptureOrReview: false,
  },
  proofDirectory: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-replay-path-successor-20261021-r26",
  allowedOverlay: [
    ".agents/README.md",
    ".agents/replay-artifact-root-repair.md",
    ".agents/crossdeck-r26-replay-path-successor.md",
    "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    "Development_Docs/Programs/Sounding_Line/evidence/replay-artifact-root-20261021/causal-disposition.md",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-replay-path-successor-20261021-r26/causal-disposition.md",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-replay-path-successor-20261021-r26/historical-ledger.json",
    "Development_Docs/document-index.json",
    "scripts/sounding-line/experience-current-admission.mjs",
    "scripts/sounding-line/experience-checkout-roots.mjs",
    "scripts/sounding-line/experience-current-r26.mjs",
    "scripts/sounding-line/experience-exception.mjs",
    "scripts/sounding-line/experience-reviewed-adoption.mjs",
    "tests/sounding-line/experience-current-admission.test.mjs",
    "tests/sounding-line/experience-capture-publication.test.mjs",
    "tests/sounding-line/experience-r26.test.mjs",
    "tests/sounding-line/experience-exception.test.mjs",
  ],
  previousRecordsDigest: "52e851a3f82fa1a18db54f9c7150cfdba836d4c827fda07d1e067d9550f968d8",
});
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const need = (condition, code) => {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R26_${code}`);
};
const sha = (value, length = 64) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const git = (root, args) =>
  sourceDiagnosticGit("EXPERIENCE_EXCEPTION", args, { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const [metadata, file] = row.split("\t");
        return [file, metadata];
      }),
  );
export const isR26 = (plan) => plan?.exception?.id === CURRENT_R26.id && plan.exception.version === 26;
export function r26PreviousPlan(plan) {
  if (!isR26(plan)) return plan;
  const prior = plan.exception.currentSourceAdmission.retainedAdmission;
  need(
    prior?.recordDigest === CURRENT_R26.previousRecordDigest &&
      hash(prior.exception) === CURRENT_R26.previousExceptionDigest,
    "PREVIOUS_ADMISSION_CHANGED",
  );
  return {
    ...plan,
    baseSha: CURRENT_R26.protectedBaseAncestorSha,
    candidateSha: CURRENT_R26.frozenReferenceSha,
    sourceDigest: CURRENT_R26.failedOrdinary.sourceDigest,
    contractDigest: CURRENT_R26.failedOrdinary.contractDigest,
    exception: prior.exception,
  };
}
export function r26HistoricalPlan(plan) {
  return isR26(plan) ? r25HistoricalPlan(r26PreviousPlan(plan)) : plan;
}
export function validateR26ReviewedIdentity(plan, evidence) {
  if (isR26(plan)) validateR25ReviewedIdentity(r26PreviousPlan(plan), evidence);
}
export function r26Adoption(plan) {
  if (!isR26(plan)) return {};
  const prior = r25Adoption(r26PreviousPlan(plan)).reviewedEvidenceAdoption;
  return {
    reviewedEvidenceAdoption: {
      ...prior,
      kind: "EXACT_R23_REVIEW_R25_REPLAY_PATH_RECOVERY_ADOPTION_1",
      maintenancePredecessor: {
        id: CURRENT_R25.id,
        recordDigest: CURRENT_R26.previousRecordDigest,
        candidateSha: CURRENT_R26.frozenReferenceSha,
        sourceDigest: CURRENT_R26.failedOrdinary.sourceDigest,
        ordinaryRunId: CURRENT_R26.failedOrdinary.runId,
        qualifyCommit: CURRENT_R26.failedOrdinary.qualifyCommit,
      },
      currentBaseSha: plan.baseSha,
      currentCandidateSha: plan.candidateSha,
      currentSourceDigest: plan.sourceDigest,
      currentRecordDigest: plan.exception.recordDigest,
    },
  };
}
export function r26OriginalRecord(record) {
  const prior = record?.currentSourceAdmission?.retainedAdmission;
  need(prior && hash(prior.exception) === CURRENT_R26.previousExceptionDigest, "PREVIOUS_ADMISSION_CHANGED");
  const historical = prior.exception;
  const original = {
    ...record,
    version: 25,
    id: CURRENT_R25.id,
    ownerApproval: CURRENT_R25.ownerApproval,
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R25.id}` },
    predecessor: historical.predecessor,
    frozenReferenceSha: historical.frozenReferenceSha,
    currentSourceAdmission: historical.currentSourceAdmission,
  };
  need(hash(original) === CURRENT_R26.previousRecordDigest, "PREVIOUS_RECORD_CHANGED");
  return original;
}
export function validateR26Record(record, { now = new Date(), legacyCurrentRecord } = {}) {
  const r = CURRENT_R26,
    a = record?.currentSourceAdmission;
  const original = r26OriginalRecord(record);
  validateR25Record(original, { now });
  need(
    record.version === 26 &&
      record.id === r.id &&
      record.status === "ACTIVE" &&
      record.expiresAt === original.expiresAt &&
      now <= new Date(record.expiresAt) &&
      Number.isFinite(Date.parse(record.ownerApproval?.executionNotBeforeUtc)) &&
      now >= new Date(record.ownerApproval.executionNotBeforeUtc) &&
      now <= new Date(r.ownerApproval.executionDeadlineUtc),
    "RECORD_OR_EXPIRY_CHANGED",
  );
  need(
    same(record.ownerApproval, r.ownerApproval) &&
      same(record.custody, { namespace: `sounding-line-exceptions/${r.id}` }) &&
      same(record.predecessor, r.failedOrdinary) &&
      record.frozenReferenceSha === r.frozenReferenceSha,
    "OWNER_OR_SPENT_PREDECESSOR_CHANGED",
  );
  need(
    sha(a?.sourceDigest) &&
      a.sourceDigest !== r.failedOrdinary.sourceDigest &&
      a.sourceDigest !== r.retained.sourceDigest,
    "CURRENT_SOURCE_REQUIRED",
  );
  need(
    same(a.caps, { capture: 0, review: 0, ordinary: 1, technical: 1, replay: 1 }) &&
      same(a.cumulativeHistory, r.cumulativeHistory),
    "FINITE_CAPS_OR_HISTORY_CHANGED",
  );
  const expectedAdmission = {
    ...original.currentSourceAdmission,
    protectedBaseAncestorSha: r.protectedBaseAncestorSha,
    sourceDigest: a.sourceDigest,
    historicalRuns: [...original.currentSourceAdmission.historicalRuns, r.addedRun],
    protectedOverlay: a.protectedOverlay,
    requiredObligationIds: a.requiredObligationIds,
    historyLedger: a.historyLedger,
    disposition: a.disposition,
    observation: { ...original.currentSourceAdmission.observation, id: r.observationId },
    retainedAdmission: {
      kind: "EXACT_SPENT_R25_ADMISSION_1",
      id: CURRENT_R25.id,
      recordDigest: r.previousRecordDigest,
      baseSha: r.protectedBaseAncestorSha,
      candidateSha: r.frozenReferenceSha,
      sourceDigest: r.failedOrdinary.sourceDigest,
      exception: a.retainedAdmission.exception,
    },
    precommandRecovery: r.precommandRecovery,
    replayPathRecovery: r.replayPathRecovery,
  };
  need(same(a, expectedAdmission), "ADMISSION_SCOPE_CHANGED");
  need(
    a.historicalRuns.length === 30 && hash(a.historicalRuns.slice(0, 29)) === r.previousRunsDigest,
    "SPENT_RUNS_CHANGED",
  );
  need(
    Array.isArray(a.requiredObligationIds) &&
      a.requiredObligationIds.length === 8 &&
      new Set(a.requiredObligationIds).size === 8,
    "OBLIGATIONS_CHANGED",
  );
  need(
    Array.isArray(a.protectedOverlay) &&
      a.protectedOverlay.length > 0 &&
      new Set(a.protectedOverlay.map((entry) => entry.path)).size === a.protectedOverlay.length &&
      a.protectedOverlay.every(
        (entry) =>
          r.allowedOverlay.includes(entry.path) &&
          ["old", "new", "candidate"].every((key) =>
            entry[key + "Mode"] === null
              ? entry[key + "Blob"] === null
              : entry[key + "Mode"] === "100644" && sha(entry[key + "Blob"], 40),
          ),
      ),
    "OVERLAY_SCOPE_CHANGED",
  );
  for (const [key, file] of [
    ["historyLedger", "historical-ledger.json"],
    ["disposition", "causal-disposition.md"],
  ])
    need(a[key]?.path === `${r.proofDirectory}/${file}` && sha(a[key].sha256), "PROOF_BINDING_CHANGED");
  if (legacyCurrentRecord) need(hash(legacyCurrentRecord) === r.previousRecordDigest, "PREVIOUS_RECORD_CHANGED");
  return record;
}
export function validateR26Registry(registry, now) {
  need(registry?.version === 1 && registry.exceptions?.length === 26, "REGISTRY_INVALID");
  const prior = { ...registry, exceptions: registry.exceptions.slice(0, 25) };
  need(hash(prior) === CURRENT_R26.previousRegistryDigest, "REGISTRY_PREFIX_CHANGED");
  validateR25Registry(prior, now);
  return validateR26Record(registry.exceptions[25], { now, legacyCurrentRecord: prior.exceptions[24] });
}
export function bindR26({ root, record, plan, baseSha, candidateSha }) {
  validateR26Record(record);
  const r = CURRENT_R26,
    a = record.currentSourceAdmission,
    original = r26OriginalRecord(record);
  for (const [ancestor, descendant] of [
    [r.protectedBaseAncestorSha, baseSha],
    [r.replayPathRecovery.acceptedMain, baseSha],
    [baseSha, candidateSha],
    [r.frozenReferenceSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  need(
    git(root, ["rev-parse", `${r.frozenReferenceSha}^{tree}`]).trim() === r.frozenReferenceTree,
    "FROZEN_TREE_CHANGED",
  );
  const oldRegistryBytes = git(root, [
    "show",
    `${r.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`,
  ]);
  need(bytesHash(oldRegistryBytes) === r.previousRegistryRawSha256, "PREVIOUS_RAW_REGISTRY_CHANGED");
  need(same(validateR25Registry(JSON.parse(oldRegistryBytes)), original), "PREVIOUS_RECORD_CHANGED");
  const priorPlan = r26PreviousPlan({ ...plan, exception: currentAdmissionBinding(record) });
  bindR25({
    root,
    record: original,
    plan: priorPlan,
    baseSha: r.protectedBaseAncestorSha,
    candidateSha: r.frozenReferenceSha,
  });
  need(
    plan.applicable &&
      plan.sourceDigest === a.sourceDigest &&
      plan.contractDigest === record.contractDigest &&
      same(plan.contractIds, record.contractIds) &&
      plan.contextCount === 38 &&
      plan.paired?.browserContexts === 6,
    "CURRENT_PLAN_CHANGED",
  );
  const reference = inventory(root, r.frozenReferenceSha),
    candidate = inventory(root, candidateSha),
    base = inventory(root, baseSha),
    ancestor = inventory(root, r.protectedBaseAncestorSha);
  validateCurrentAdmissionOverlay({ record, reference, candidate, base, protectedAncestor: ancestor });
  for (const file of a.publicationFiles)
    need(reference.get(file) === candidate.get(file), "PUBLISHED_EVIDENCE_CHANGED");
  const paths = new Set(a.protectedOverlay.map((entry) => entry.path));
  for (const file of new Set([...reference.keys(), ...candidate.keys()]))
    if (file !== "testing/product-experience-exceptions.json" && !paths.has(file))
      need(reference.get(file) === candidate.get(file), "FROZEN_CONTENT_CHANGED");
  const installed = JSON.parse(git(root, ["show", `${baseSha}:testing/product-experience-exceptions.json`]));
  need(same(validateR26Registry(installed), record), "INSTALLED_RECORD_CHANGED");
  const snapshot = sourceSnapshot(root, candidateSha),
    old = sourceSnapshot(root, r.frozenReferenceSha),
    entries = new Map(snapshot.entries.map((entry) => [entry.path, entry])),
    oldEntries = new Map(old.entries.map((entry) => [entry.path, entry])),
    contents = new Map(snapshot.contents);
  need(
    productSourceDigest(snapshot) === a.sourceDigest && productSourceDigest(old) === r.failedOrdinary.sourceDigest,
    "SOURCE_DIGEST_CHANGED",
  );
  for (const file of paths) {
    if (oldEntries.has(file)) entries.set(file, oldEntries.get(file));
    else entries.delete(file);
    if (old.contents.has(file)) contents.set(file, old.contents.get(file));
    else contents.delete(file);
  }
  need(
    productSourceDigest({ entries: [...entries.values()], contents }) === r.failedOrdinary.sourceDigest,
    "MAINTENANCE_EQUIVALENCE_FAILED",
  );
  for (const proof of [a.historyLedger, a.disposition])
    need(bytesHash(git(root, ["show", `${baseSha}:${proof.path}`])) === proof.sha256, "PROOF_CHANGED");
  const ledger = JSON.parse(git(root, ["show", `${baseSha}:${a.historyLedger.path}`]));
  need(
    same(ledger.ownerApproval, r.ownerApproval) &&
      same(ledger.caps, a.caps) &&
      same(ledger.failedOrdinary, r.failedOrdinary) &&
      same(ledger.precommandRecovery, r.precommandRecovery) &&
      same(ledger.replayPathRecovery, r.replayPathRecovery) &&
      same(ledger.historicalRuns, a.historicalRuns) &&
      same(ledger.cumulativeHistory, r.cumulativeHistory) &&
      ledger.expiry === record.expiresAt &&
      ledger.requiredReviewIterations === 16 &&
      ledger.retainedReviewOrdinal === 12,
    "LEDGER_CHANGED",
  );
  return currentAdmissionBinding(record);
}
export async function validateR26Predecessors({ record, request, storeFor }) {
  validateR26Record(record);
  const original = r26OriginalRecord(record);
  const observed = await validateCurrentAdmissionPredecessors({ record: original, request, storeFor });
  observed.push(await validateR26SpentOrdinary({ record, request, store: storeFor(original) }));
  return observed;
}
export async function validateR26SpentOrdinary({ record, request, store }) {
  validateR26Record(record);
  const r = CURRENT_R26;
  const run = await request(`actions/runs/${r.addedRun.id}`);
  need(same(currentRunIdentity(run), r.addedRun), "SPENT_RUN_CHANGED");
  const qualifier = await store.read("qualify");
  need(qualifier?.commitSha === r.failedOrdinary.qualifyCommit, "SPENT_RESERVATION_CHANGED");
  const { commitSha, ...payload } = qualifier;
  need(
    commitSha === r.failedOrdinary.qualifyCommit &&
      hash(payload) === r.failedOrdinary.qualifyPayloadDigest &&
      qualifier.binding?.exception?.recordDigest === r.previousRecordDigest &&
      qualifier.run?.runId === r.failedOrdinary.runId &&
      qualifier.candidateSha === r.frozenReferenceSha,
    "SPENT_PAYLOAD_CHANGED",
  );
  for (const slot of ["prepare", "capture", "review-submit", "review12", "qualified"])
    need(!(await store.read(slot)), "UNEXPECTED_OLD_SLOT");
  const jobs = await request(`actions/runs/${run.id}/attempts/1/jobs?per_page=100`),
    artifacts = await request(`actions/runs/${run.id}/artifacts?per_page=100`);
  need(
    jobs.total_count === 4 &&
      jobs.jobs?.length === 4 &&
      same(
        jobs.jobs.map(({ id, name, conclusion }) => ({ id, name, conclusion })).sort((a, b) => a.id - b.id),
        r.failedOrdinary.jobs,
      ),
    "SPENT_JOBS_CHANGED",
  );
  const pins = r.failedOrdinary.artifacts;
  need(
    artifacts.total_count === pins.length &&
      artifacts.artifacts?.length === pins.length &&
      same(
        artifacts.artifacts.map(({ id }) => id).sort((a, b) => a - b),
        pins.map(({ id }) => id).sort((a, b) => a - b),
      ),
    "RETAINED_ARTIFACT_INVENTORY_CHANGED",
  );
  for (const pin of pins) {
    const artifact = await request(`actions/artifacts/${pin.id}`);
    need(
      artifact?.id === pin.id &&
        artifact.name === pin.name &&
        artifact.expired === false &&
        artifact.size_in_bytes === pin.bytes &&
        artifact.digest === `sha256:${pin.sha256}` &&
        artifact.workflow_run?.id === run.id,
      "RETAINED_CHECKPOINT_CHANGED",
    );
  }
  return run;
}
export function assertR26Mode(plan, mode) {
  if (isR26(plan)) need(mode === "ordinary", "ORDINARY_ONLY");
}

import { createHash } from "node:crypto";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { sourceSnapshot, productSourceDigest } from "./product-experience.mjs";
import {
  CURRENT_R24,
  validateR24Record,
  validateR24Registry,
  bindR24,
  r24HistoricalPlan,
  validateR24ReviewedIdentity,
  r24Adoption,
} from "./experience-current-r24.mjs";
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
export const CURRENT_R25 = freeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261021-R25",
  version: 25,
  protectedBaseAncestorSha: "e1a86f98e56d68e8e87e3704d17439489ff1a170",
  frozenReferenceSha: "245e5128afa00e6c888818a698ebd37717d81a3d",
  frozenReferenceTree: "7043d6c7c8e92227c157843843b61eabead1ab7e",
  previousRegistryRawSha256: "23f487151dcaa075ef74e62a1aa04039ebebed37923e529a9c2c1388fe2527e5",
  previousRegistryDigest: "38f1167165a5493f45bf5d80f058c25291937466d21398f1e3b06e90d83325a5",
  previousRecordDigest: "8fca6e99f20e08ae05a50a916b74d70a77ff7805b723194651344aa2ecb08e66",
  previousExceptionDigest: "5daefd0aa15d498bfc60d84b9d6f50cca28d832e0c263b279dc87b6277b8b888",
  previousRunsDigest: "e830518b914f6624208f3713b65b07e51e84cd3294653d2fdd1c325f3aecb49d",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtc: "2026-10-21T13:37:52Z",
    approvedAtUtcMinute: "2026-10-21T13:37Z",
    humanMessageId: "01a15eae-bf8c-7e22-b519-bffbd9f6cb50",
    relayThreadId: "01a15eae-a6a5-71c2-9713-dfbac9002ebb",
    basis: "DIRECT_OWNER_FILE_BOUND_TO_NATIVE_USER_REFERENCE_TIME_IS_TURN_START",
    directiveSha256: "cf078e0c476d2eca96201dc8035f818845a69fcb50baa23311cf956057c360a4",
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
  observationId: "SL-CROSSDECK-R25-20261021-PRECOMMAND-RECOVERY",
  observationKeyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
  addedRun: {
    id: 39580199268,
    runAttempt: 1,
    workflowId: 341545080,
    event: "pull_request_target",
    headSha: "245e5128afa00e6c888818a698ebd37717d81a3d",
    headBranch: "codex/crossdeck-experience-refit",
    actor: "Kgray44",
    triggeringActor: "Kgray44",
    repository: "Kgray44/treasurehuntSoT",
    status: "completed",
    conclusion: "cancelled",
    createdAt: "2026-10-21T09:51:34Z",
    displayTitle: "Sounding Line finite 1 ordinary 721 245e5128afa00e6c888818a698ebd37717d81a3d active",
    checkSuiteId: 107259298520,
  },
  failedOrdinary: {
    kind: "CONSUMED_R24_ORDINARY_JOB_LIMIT_1",
    campaignEpoch: "2026-10-15T13:54Z",
    id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261021-R24",
    recordDigest: "8fca6e99f20e08ae05a50a916b74d70a77ff7805b723194651344aa2ecb08e66",
    runId: 39580199268,
    runAttempt: 1,
    conclusion: "cancelled",
    candidateSha: "245e5128afa00e6c888818a698ebd37717d81a3d",
    candidateTree: "7043d6c7c8e92227c157843843b61eabead1ab7e",
    baseSha: "e1a86f98e56d68e8e87e3704d17439489ff1a170",
    sourceDigest: "87abe4d47921c2674681cf8035725367b16e5e6d2077b2866d83f0706bc1a800",
    contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
    qualifyCommit: "55d8b2c505e30a5736df6c326ee2ab313e32d4a2",
    qualifyPayloadDigest: "515c2ac17a84fd1e5c02e03e34968e0f5f99fc2c5124c8d9d7e208fe94cd3d96",
    qualifyPayloadRawSha256: "515c2ac17a84fd1e5c02e03e34968e0f5f99fc2c5124c8d9d7e208fe94cd3d96",
    qualifiedAbsent: true,
    jobs: [
      {
        id: 119155633915,
        name: "Sounding Line / Finite campaign custody",
        conclusion: "success",
      },
      {
        id: 119159833531,
        name: "Sounding Line / Focused verification",
        conclusion: "cancelled",
      },
      {
        id: 119159836154,
        name: "Sounding Line / Experience preparation (no mainline decision)",
        conclusion: "skipped",
      },
      {
        id: 119178516869,
        name: "Sounding Line / Mainline Decision",
        conclusion: "failure",
      },
    ],
    artifact: {
      id: 12340581016,
      name: "sounding-line-completed-evidence-39580199268-1",
      bytes: 1975900,
      sha256: "61d03f8a7338005fe603b242086c8fb97d31b7b1e41caad3036270eb4675b2e8",
      runId: 39580199268,
    },
    completedWholeObligations: 6,
    requiredWholeObligations: 8,
    partialBrowser: {
      passed: 48,
      planned: 50,
      wholeObligationPassed: false,
    },
    verifierStepSeconds: 2511,
    preCommandUnallocatedSeconds: 1250.919587,
    preCommandDominantHostedCause: "UNKNOWN",
    providerJobLimitMinutes: 45,
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
  proofDirectory: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-precommand-recovery-20261021-r25",
  allowedOverlay: [
    ".github/workflows/sounding-line-ordinary.yml",
    ".agents/README.md",
    ".agents/crossdeck-r25-precommand-recovery.md",
    "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-precommand-recovery-20261021-r25/causal-disposition.md",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-precommand-recovery-20261021-r25/historical-ledger.json",
    "Development_Docs/README.md",
    "Development_Docs/document-index.json",
    "scripts/sounding-line/experience-attestation.mjs",
    "scripts/sounding-line/experience-checkout-roots.mjs",
    "scripts/sounding-line/experience-current-admission.mjs",
    "scripts/sounding-line/experience-current-r25.mjs",
    "scripts/sounding-line/experience-exception.mjs",
    "scripts/sounding-line/experience-reviewed-adoption.mjs",
    "scripts/sounding-line/product-experience.mjs",
    "tests/sounding-line/experience-current-admission.test.mjs",
    "tests/sounding-line/experience-exception.test.mjs",
    "tests/sounding-line/experience-r25.test.mjs",
  ],
  previousRecordsDigest: "5e339dc47d8fa6a159ceff7b1bbe4e4869305a3fa1d333ec84ed5f226f2e4487",
});
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const need = (condition, code) => {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R25_${code}`);
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
export const isR25 = (plan) => plan?.exception?.id === CURRENT_R25.id && plan.exception.version === 25;
export function r25PreviousPlan(plan) {
  if (!isR25(plan)) return plan;
  const prior = plan.exception.currentSourceAdmission.retainedAdmission;
  need(
    prior?.recordDigest === CURRENT_R25.previousRecordDigest &&
      hash(prior.exception) === CURRENT_R25.previousExceptionDigest,
    "PREVIOUS_ADMISSION_CHANGED",
  );
  return {
    ...plan,
    baseSha: CURRENT_R25.protectedBaseAncestorSha,
    candidateSha: CURRENT_R25.frozenReferenceSha,
    sourceDigest: CURRENT_R25.failedOrdinary.sourceDigest,
    contractDigest: CURRENT_R25.failedOrdinary.contractDigest,
    exception: prior.exception,
  };
}
export function r25HistoricalPlan(plan) {
  return isR25(plan) ? r24HistoricalPlan(r25PreviousPlan(plan)) : plan;
}
export function validateR25ReviewedIdentity(plan, evidence) {
  if (isR25(plan)) validateR24ReviewedIdentity(r25PreviousPlan(plan), evidence);
}
export function r25Adoption(plan) {
  if (!isR25(plan)) return {};
  const prior = r24Adoption(r25PreviousPlan(plan)).reviewedEvidenceAdoption;
  return {
    reviewedEvidenceAdoption: {
      ...prior,
      kind: "EXACT_R23_REVIEW_R24_RUNTIME_RECOVERY_ADOPTION_1",
      maintenancePredecessor: {
        id: CURRENT_R24.id,
        recordDigest: CURRENT_R25.previousRecordDigest,
        candidateSha: CURRENT_R25.frozenReferenceSha,
        sourceDigest: CURRENT_R25.failedOrdinary.sourceDigest,
        ordinaryRunId: CURRENT_R25.failedOrdinary.runId,
        qualifyCommit: CURRENT_R25.failedOrdinary.qualifyCommit,
      },
      currentBaseSha: plan.baseSha,
      currentCandidateSha: plan.candidateSha,
      currentSourceDigest: plan.sourceDigest,
      currentRecordDigest: plan.exception.recordDigest,
    },
  };
}
export function r25OriginalRecord(record) {
  const prior = record?.currentSourceAdmission?.retainedAdmission;
  need(prior && hash(prior.exception) === CURRENT_R25.previousExceptionDigest, "PREVIOUS_ADMISSION_CHANGED");
  const historical = prior.exception;
  const original = {
    ...record,
    version: 24,
    id: CURRENT_R24.id,
    ownerApproval: CURRENT_R24.ownerApproval,
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R24.id}` },
    predecessor: historical.predecessor,
    frozenReferenceSha: historical.frozenReferenceSha,
    currentSourceAdmission: historical.currentSourceAdmission,
  };
  need(hash(original) === CURRENT_R25.previousRecordDigest, "PREVIOUS_RECORD_CHANGED");
  return original;
}
export function validateR25Record(record, { now = new Date(), legacyCurrentRecord } = {}) {
  const r = CURRENT_R25,
    a = record?.currentSourceAdmission;
  const original = r25OriginalRecord(record);
  validateR24Record(original, { now });
  need(
    record.version === 25 &&
      record.id === r.id &&
      record.status === "ACTIVE" &&
      record.expiresAt === original.expiresAt &&
      now <= new Date(record.expiresAt),
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
      kind: "EXACT_SPENT_R24_ADMISSION_1",
      id: CURRENT_R24.id,
      recordDigest: r.previousRecordDigest,
      baseSha: r.protectedBaseAncestorSha,
      candidateSha: r.frozenReferenceSha,
      sourceDigest: r.failedOrdinary.sourceDigest,
      exception: a.retainedAdmission.exception,
    },
    precommandRecovery: r.precommandRecovery,
  };
  need(same(a, expectedAdmission), "ADMISSION_SCOPE_CHANGED");
  need(
    a.historicalRuns.length === 29 && hash(a.historicalRuns.slice(0, 28)) === r.previousRunsDigest,
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
export function validateR25Registry(registry, now) {
  need(registry?.version === 1 && registry.exceptions?.length === 25, "REGISTRY_INVALID");
  const prior = { ...registry, exceptions: registry.exceptions.slice(0, 24) };
  need(hash(prior) === CURRENT_R25.previousRegistryDigest, "REGISTRY_PREFIX_CHANGED");
  validateR24Registry(prior, now);
  return validateR25Record(registry.exceptions[24], { now, legacyCurrentRecord: prior.exceptions[23] });
}
export function bindR25({ root, record, plan, baseSha, candidateSha }) {
  validateR25Record(record);
  const r = CURRENT_R25,
    a = record.currentSourceAdmission,
    original = r25OriginalRecord(record);
  for (const [ancestor, descendant] of [
    [r.protectedBaseAncestorSha, baseSha],
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
  need(same(validateR24Registry(JSON.parse(oldRegistryBytes)), original), "PREVIOUS_RECORD_CHANGED");
  const priorPlan = r25PreviousPlan({ ...plan, exception: currentAdmissionBinding(record) });
  bindR24({
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
  need(same(validateR25Registry(installed), record), "INSTALLED_RECORD_CHANGED");
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
      same(ledger.historicalRuns, a.historicalRuns) &&
      same(ledger.cumulativeHistory, r.cumulativeHistory) &&
      ledger.expiry === record.expiresAt &&
      ledger.requiredReviewIterations === 16 &&
      ledger.retainedReviewOrdinal === 12,
    "LEDGER_CHANGED",
  );
  return currentAdmissionBinding(record);
}
export async function validateR25Predecessors({ record, request, storeFor }) {
  validateR25Record(record);
  const original = r25OriginalRecord(record);
  const observed = await validateCurrentAdmissionPredecessors({ record: original, request, storeFor });
  observed.push(await validateR25SpentOrdinary({ record, request, store: storeFor(original) }));
  return observed;
}
export async function validateR25SpentOrdinary({ record, request, store }) {
  validateR25Record(record);
  const r = CURRENT_R25;
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
  const pin = r.failedOrdinary.artifact,
    artifact = await request(`actions/artifacts/${pin.id}`);
  need(
    artifacts.total_count === 1 &&
      artifacts.artifacts?.length === 1 &&
      artifacts.artifacts[0].id === pin.id &&
      artifact.id === pin.id &&
      artifact.name === pin.name &&
      artifact.expired === false &&
      artifact.size_in_bytes === pin.bytes &&
      artifact.digest === `sha256:${pin.sha256}` &&
      artifact.workflow_run?.id === run.id,
    "RETAINED_CHECKPOINT_CHANGED",
  );
  return run;
}
export function assertR25Mode(plan, mode) {
  if (isR25(plan)) need(mode === "ordinary", "ORDINARY_ONLY");
}

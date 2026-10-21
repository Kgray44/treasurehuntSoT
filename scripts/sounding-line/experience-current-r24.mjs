import { CURRENT_R23 } from "./experience-current-r23.mjs";
// Explicit retained-R23-evidence adoption. This creates no capture/review right.
import { createHash } from "node:crypto";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { sourceSnapshot, productSourceDigest } from "./product-experience.mjs";
import {
  validateCurrentAdmissionRecord,
  validateCurrentAdmissionRegistry,
  bindCurrentAdmission,
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
export const CURRENT_R24 = freeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261021-R24",
  version: 24,
  protectedBaseAncestorSha: "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
  frozenReferenceSha: "80e350d8c59f6b132b573cc2b8158c5f7ae11a82",
  frozenReferenceTree: "cf9e9c2491f57875733151304b3c22f75c72f159",
  previousRegistryRawSha256: "c88aa871cfdb5c5eaa44e4767ae78f55f6a082dfbcf62057cb1b73c1a81602f4",
  previousRegistryDigest: "8357b5350eb348113afe945478a918b3439333d4fe6d3860a43c75c4e684b272",
  previousRecordsDigest: "ec6a2e7b9256346271dd4fbe919c583bfed3f9630c81a7b6ab044e5957b99fa7",
  previousRecordDigest: "02391f9e6ee41b656e228a1b38ff3ee7e29065f4ae8e2a585f5eb23aabda751d",
  previousRunsDigest: "6d92c463319d04d2194f542397f9964cbb7e29c9134daf655ccff9f0d8dfab53",
  inheritanceDigest: "083e6089738318ce7a0cd3a7b931ed551a8851587f49dd73a1f173238e2291ea",
  historicalExceptionDigest: "4f95992aaf5570adbf457fc6e8b3383327c1ddb9897c9627bd7522bca0baa971",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtc: "2026-10-21T04:49:39Z",
    approvedAtUtcMinute: "2026-10-21T04:49Z",
    humanMessageId: "Sentinel_b7d389c6666481918954113259643d10",
    relayThreadId: "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1",
    basis: "PARENT_VERIFIED_DIRECT_HUMAN_RELAY_NATIVE_BODY_NOT_REREAD",
  },
  cumulativeHistory: {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 27,
    currentPreparationOrdinal: 28,
    completedIndependentReviews: 12,
  },
  observationId: "SL-CROSSDECK-R24-20261021-ORDINARY-RECOVERY",
  observationKeyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
  addedRuns: [
    {
      id: 39520615298,
      runAttempt: 1,
      workflowId: 341545080,
      event: "workflow_dispatch",
      headSha: "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
      headBranch: "main",
      actor: "Kgray44",
      triggeringActor: "Kgray44",
      repository: "Kgray44/treasurehuntSoT",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-10-21T00:19:27Z",
      displayTitle: "Sounding Line finite 1 capture 721 f5e0cddde5c626648bc264f93819836a49c04d33 active",
      checkSuiteId: 107099925850,
    },
    {
      id: 39551039268,
      runAttempt: 1,
      workflowId: 341545080,
      event: "workflow_dispatch",
      headSha: "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
      headBranch: "main",
      actor: "Kgray44",
      triggeringActor: "Kgray44",
      repository: "Kgray44/treasurehuntSoT",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-10-21T05:42:06Z",
      displayTitle: "Sounding Line finite 1 review 721 f5e0cddde5c626648bc264f93819836a49c04d33 active",
      checkSuiteId: 107180468650,
    },
    {
      id: 39553886766,
      runAttempt: 1,
      workflowId: 341545080,
      event: "pull_request_target",
      headSha: "80e350d8c59f6b132b573cc2b8158c5f7ae11a82",
      headBranch: "codex/crossdeck-experience-refit",
      actor: "Kgray44",
      triggeringActor: "Kgray44",
      repository: "Kgray44/treasurehuntSoT",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-10-21T06:11:18Z",
      displayTitle: "Sounding Line finite 1 ordinary 721 80e350d8c59f6b132b573cc2b8158c5f7ae11a82 active",
      checkSuiteId: 107188087861,
    },
  ],
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
  custody: [
    {
      slot: "prepare",
      commit: "c355ad7ea4765b1c057b8676bd051bda4a88ea78",
      payloadDigest: "92d4bced86f111391f362354de605391c6250868c332378e322d38daddd4b42d",
    },
    {
      slot: "capture",
      commit: "bece6a2296cf1624f2d9df1acc78055d8d8b9e6f",
      payloadDigest: "508fc531a48c596512fce03ab0e094085abfeff148ad63b31889bba99eb3b877",
    },
    {
      slot: "review-submit",
      commit: "de8730254d8a9be2059ab41a5ab01c02ad97db2e",
      payloadDigest: "9779a97a8f221464ca566da17aab33c63226b85c30a1380108199d0533e64bea",
    },
    {
      slot: "review12",
      commit: "39b313d1e02d134fce6ef7cfce98cfdc1ed5e889",
      payloadDigest: "97b320606062d2940e135db39354154778d9b517bdf787af4a5c76827d1ab499",
    },
  ],
  failedOrdinary: {
    kind: "CONSUMED_R23_ORDINARY_CHECKOUT_CANCELLED_1",
    id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R23",
    recordDigest: "02391f9e6ee41b656e228a1b38ff3ee7e29065f4ae8e2a585f5eb23aabda751d",
    campaignEpoch: "2026-10-15T13:54Z",
    runId: 39553886766,
    runAttempt: 1,
    conclusion: "cancelled",
    candidateSha: "80e350d8c59f6b132b573cc2b8158c5f7ae11a82",
    candidateTree: "cf9e9c2491f57875733151304b3c22f75c72f159",
    baseSha: "e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab",
    sourceDigest: "e6cf2d544efc36fce2ccfee7f16334296a1f82e783726e7dfd067a67d3a7debf",
    contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
    jobs: [
      {
        id: 119069027757,
        name: "Sounding Line / Finite campaign custody",
        conclusion: "cancelled",
      },
      {
        id: 119072683694,
        name: "Sounding Line / Mainline Decision",
        conclusion: "failure",
      },
      {
        id: 119072685523,
        name: "Sounding Line / Focused verification",
        conclusion: "cancelled",
      },
      {
        id: 119072685580,
        name: "Sounding Line / Experience preparation (no mainline decision)",
        conclusion: "cancelled",
      },
    ],
    artifacts: [],
    absentSlots: ["qualify", "qualified"],
    checkout: {
      jobId: 119069027757,
      stepNumber: 3,
      startedAt: "2026-10-21T06:11:57Z",
      cancelRequestedAt: "2026-10-21T06:21:58.134Z",
      cutoff: "OWNER_ENFORCED_TEN_MINUTES",
      configuredStepTimeout: false,
      logBytes: 24149,
      logSha256: "bec19ad63194bb65a66210ec2b96b68defdd98851752014f6105df0371d96d4d",
      transferCause: "UNKNOWN",
    },
  },
  artifacts: [
    {
      id: 12311867110,
      bytes: 1683014402,
      sha256: "ddbf581a505ac103d44955f98486c06dea5d3724b874a59f65ee86b7ca2303d3",
      runId: 39520615298,
    },
    {
      id: 12312127054,
      bytes: 151884297,
      sha256: "87a16eeb82bfffbcec1055aff09b6836cc742ce1053aa22ace559ff93fa723b9",
      runId: 39520615298,
    },
    {
      id: 12312362102,
      bytes: 71392,
      sha256: "4816a4b0e8041c1f978924ffa2858615107a5037a8e38a4a4e31052b6040b42a",
      runId: 39520615298,
    },
    {
      id: 12324561775,
      bytes: 25223,
      sha256: "73886447056b077ef8a6bbfcfad660370432aa81bc270fd29bba580cbe21a0c7",
      runId: 39551039268,
    },
  ],
  checkoutRecovery: {
    kind: "EXPLICIT_REQUIRED_READER_HYDRATION_CHECKOUT_1",
    totalDeadlineMs: 1200000,
    noForwardProgressDeadlineMs: 600000,
    cutoffSemantics: "TEN_MINUTE_STALL_PLUS_TWENTY_MINUTE_ABSOLUTE",
    jobBoundsMinutes: {
      custody: { previous: 15, current: 35 },
      mainline: { previous: 15, current: 35 },
      preparation: 40,
      finalCheck: 45,
      selectedCheckoutStep: 21,
    },
    fetchTags: false,
    fullCommitAndTreeAncestry: true,
    blobStore: "FULL_BASE_CANDIDATE_AND_EXPLICIT_READER_CLOSURE",
    graphTransferFilter: "blob:none",
    implicitLazyFetching: false,
    laterGitTransport: "DISABLED",
    wildcardFallback: false,
    automaticRetry: false,
    consumerReplacementCaptures: 0,
    historicalReferencePins: 1360,
    currentPinsUnchanged: 1359,
    historicalManifestPinsRetained: 1,
  },
  proofDirectory: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-ordinary-recovery-20261021-r24",
  allowedOverlay: [
    ".agents/README.md",
    ".agents/crossdeck-r24-ordinary-recovery.md",
    ".github/workflows/sounding-line-ordinary.yml",
    "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-ordinary-recovery-20261021-r24/causal-disposition.md",
    "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-ordinary-recovery-20261021-r24/historical-ledger.json",
    "Development_Docs/README.md",
    "Development_Docs/document-index.json",
    "scripts/sounding-line/experience-attestation.mjs",
    "scripts/sounding-line/experience-checkout-hydration.mjs",
    "scripts/sounding-line/experience-checkout-roots.mjs",
    "scripts/sounding-line/experience-current-admission.mjs",
    "scripts/sounding-line/experience-current-r24.mjs",
    "scripts/sounding-line/experience-exception.mjs",
    "scripts/sounding-line/experience-selected-checkout.mjs",
    "scripts/sounding-line/product-experience.mjs",
    "tests/sounding-line/experience-checkout-recovery.test.mjs",
    "tests/sounding-line/experience-current-admission.test.mjs",
    "tests/sounding-line/experience-exception.test.mjs",
    "tests/sounding-line/experience-r24.test.mjs",
    "tests/sounding-line/experience-selected-checkout.test.mjs",
  ],
});
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const same = (a, b) => hash(a) === hash(b);
const need = (value, code) => {
  if (!value) throw new Error(`PRODUCT_EXPERIENCE_R24_${code}`);
};
const sha = (value, n = 64) => new RegExp(`^[a-f0-9]{${n}}$`, "u").test(value ?? "");
const git = (root, args) =>
  sourceDiagnosticGit("PRODUCT_EXPERIENCE", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const inventory = (root, ref) =>
  new Map(
    git(root, ["ls-tree", "-rz", ref])
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const [m, p] = row.split("\t");
        return [p, m];
      }),
  );
const recordMutable = ["version", "id", "ownerApproval", "custody", "predecessor", "frozenReferenceSha"];
const admissionMutable = [
  "protectedBaseAncestorSha",
  "sourceDigest",
  "requiredObligationIds",
  "cumulativeHistory",
  "historyLedger",
  "disposition",
  "protectedOverlay",
  "historicalRuns",
  "caps",
  "observation",
  "checkoutRecovery",
  "retainedEvidence",
];
export function r24Inheritance(record) {
  const copy = structuredClone(record);
  for (const key of recordMutable) delete copy[key];
  for (const key of admissionMutable) delete copy.currentSourceAdmission[key];
  return copy;
}
export const isR24 = (plan) => plan?.exception?.id === CURRENT_R24.id && plan.exception.version === 24;
export function assertR24Mode(plan, mode) {
  if (isR24(plan)) need(mode === "ordinary", "ORDINARY_ONLY");
}
export function validateR24Record(record, { now = new Date(), legacyCurrentRecord } = {}) {
  const a = record?.currentSourceAdmission,
    r = CURRENT_R24;
  need(
    record?.version === 24 && record.id === r.id && a && hash(r24Inheritance(record)) === r.inheritanceDigest,
    "INHERITED_POLICY_CHANGED",
  );
  need(
    same(record.ownerApproval, r.ownerApproval) &&
      now.getTime() >= Date.parse(r.ownerApproval.approvedAtUtc) &&
      now.getTime() < Date.parse(record.expiresAt),
    "AUTHORIZATION_OR_EXPIRY",
  );
  need(
    record.custody?.namespace === `sounding-line-exceptions/${r.id}` &&
      record.frozenReferenceSha === r.frozenReferenceSha &&
      same(record.predecessor, r.failedOrdinary),
    "FROZEN_OR_PREDECESSOR_CHANGED",
  );
  need(
    a.protectedBaseAncestorSha === r.protectedBaseAncestorSha &&
      sha(a.sourceDigest) &&
      a.sourceDigest !== r.retained.sourceDigest,
    "CURRENT_SOURCE_REQUIRED",
  );
  need(
    same(a.caps, { capture: 0, review: 0, ordinary: 1, technical: 1, replay: 1 }) &&
      same(a.cumulativeHistory, r.cumulativeHistory),
    "FINITE_CAPS_OR_HISTORY_CHANGED",
  );
  need(
    a.observation?.id === r.observationId &&
      a.observation?.keyId === r.observationKeyId &&
      same(a.checkoutRecovery, r.checkoutRecovery),
    "CHECKOUT_OR_OBSERVATION_CHANGED",
  );
  need(
    a.historicalRuns?.length === 28 &&
      hash(a.historicalRuns.slice(0, 25)) === r.previousRunsDigest &&
      same(a.historicalRuns.slice(25), r.addedRuns),
    "SPENT_RUNS_CHANGED",
  );
  need(
    same({ ...a.retainedEvidence, historicalException: undefined }, r.retained) &&
      hash(a.retainedEvidence.historicalException) === r.historicalExceptionDigest,
    "RETAINED_IDENTITY_CHANGED",
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
      new Set(a.protectedOverlay.map((x) => x.path)).size === a.protectedOverlay.length &&
      a.protectedOverlay.every(
        (x) =>
          r.allowedOverlay.includes(x.path) &&
          ["old", "new", "candidate"].every((k) =>
            x[k + "Mode"] === null ? x[k + "Blob"] === null : x[k + "Mode"] === "100644" && sha(x[k + "Blob"], 40),
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
}
export function validateR24Registry(registry, now) {
  need(registry?.version === 1 && registry.exceptions?.length === 24, "REGISTRY_INVALID");
  const prior = { ...registry, exceptions: registry.exceptions.slice(0, 23) };
  need(hash(prior) === CURRENT_R24.previousRegistryDigest, "REGISTRY_PREFIX_CHANGED");
  validateCurrentAdmissionRegistry(prior, now, { requiredVersion: 23 });
  const record = registry.exceptions[23];
  validateR24Record(record, { now, legacyCurrentRecord: prior.exceptions[22] });
  return record;
}
export function r24HistoricalPlan(plan) {
  if (!isR24(plan)) return plan;
  const a = plan.exception.currentSourceAdmission,
    r = CURRENT_R24;
  need(
    same({ ...a.retainedEvidence, historicalException: undefined }, r.retained) &&
      hash(a.retainedEvidence.historicalException) === r.historicalExceptionDigest,
    "RETAINED_IDENTITY_CHANGED",
  );
  return {
    ...plan,
    baseSha: r.retained.baseSha,
    candidateSha: r.frozenReferenceSha,
    sourceDigest: r.retained.sourceDigest,
    contractDigest: r.retained.contractDigest,
    exception: a.retainedEvidence.historicalException,
  };
}
export function validateR24ReviewedIdentity(plan, evidence) {
  if (!isR24(plan)) return;
  const original = r24HistoricalPlan(plan),
    r = CURRENT_R24;
  need(
    evidence?.baseSha === original.baseSha &&
      evidence.sourceDigest === original.sourceDigest &&
      evidence.contractDigest === original.contractDigest &&
      same(evidence.exception, original.exception) &&
      evidence.captureArtifactId === r.retained.captureArtifactId &&
      evidence.reviewArtifactId === r.retained.reviewArtifactId,
    "ORIGINAL_EVIDENCE_CHANGED",
  );
}
export function r24Adoption(plan) {
  if (!isR24(plan)) return {};
  return {
    reviewedEvidenceAdoption: {
      kind: "EXACT_R23_REVIEW_MAINTENANCE_ADOPTION_1",
      ...CURRENT_R24.retained,
      currentBaseSha: plan.baseSha,
      currentCandidateSha: plan.candidateSha,
      currentSourceDigest: plan.sourceDigest,
      currentRecordDigest: plan.exception.recordDigest,
    },
  };
}
export function bindR24({ root, record, plan, baseSha, candidateSha }) {
  validateR24Record(record);
  const r = CURRENT_R24,
    a = record.currentSourceAdmission;
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
  const historicalRegistry = JSON.parse(
    git(root, ["show", `${r.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`]),
  );
  const originalRecord = validateCurrentAdmissionRegistry(historicalRegistry, undefined, { requiredVersion: 23 });
  need(hash(originalRecord) === r.previousRecordDigest, "ORIGINAL_RECORD_CHANGED");
  const originalPlan = { ...plan, ...r24HistoricalPlan({ ...plan, exception: currentAdmissionBinding(record) }) };
  bindCurrentAdmission({
    root,
    record: originalRecord,
    plan: originalPlan,
    baseSha: r.retained.baseSha,
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
  // No new evidence/media path is exempt: every path outside the reviewed
  // protected overlay and appended registry must remain exactly frozen.
  const paths = new Set(a.protectedOverlay.map((x) => x.path));
  for (const file of new Set([...reference.keys(), ...candidate.keys()]))
    if (file !== "testing/product-experience-exceptions.json" && !paths.has(file))
      need(reference.get(file) === candidate.get(file), "FROZEN_CONTENT_CHANGED");
  const currentRegistry = JSON.parse(git(root, ["show", `${baseSha}:testing/product-experience-exceptions.json`]));
  need(same(validateR24Registry(currentRegistry), record), "INSTALLED_RECORD_CHANGED");
  const snapshot = sourceSnapshot(root, candidateSha),
    old = sourceSnapshot(root, r.frozenReferenceSha),
    entries = new Map(snapshot.entries.map((x) => [x.path, x])),
    oldEntries = new Map(old.entries.map((x) => [x.path, x]));
  need(
    productSourceDigest(snapshot) === a.sourceDigest && productSourceDigest(old) === r.retained.sourceDigest,
    "SOURCE_DIGEST_CHANGED",
  );
  const contents = new Map(snapshot.contents);
  for (const file of paths) {
    if (oldEntries.has(file)) entries.set(file, oldEntries.get(file));
    else entries.delete(file);
    if (old.contents.has(file)) contents.set(file, old.contents.get(file));
    else contents.delete(file);
  }
  need(
    productSourceDigest({ entries: [...entries.values()], contents }) === r.retained.sourceDigest,
    "MAINTENANCE_EQUIVALENCE_FAILED",
  );
  for (const proof of [a.historyLedger, a.disposition])
    need(bytesHash(git(root, ["show", `${baseSha}:${proof.path}`])) === proof.sha256, "PROOF_CHANGED");
  const ledger = JSON.parse(git(root, ["show", `${baseSha}:${a.historyLedger.path}`]));
  need(
    same(ledger.ownerApproval, r.ownerApproval) &&
      same(ledger.caps, a.caps) &&
      same(ledger.checkoutRecovery, a.checkoutRecovery) &&
      ledger.expiry === record.expiresAt &&
      ledger.requiredReviewIterations === 16 &&
      ledger.retainedReviewOrdinal === 12 &&
      same(ledger.historicalRuns, a.historicalRuns) &&
      same(ledger.cumulativeHistory, a.cumulativeHistory) &&
      same(ledger.retainedEvidence, r.retained) &&
      same(ledger.failedOrdinary, r.failedOrdinary),
    "LEDGER_CHANGED",
  );
  return currentAdmissionBinding(record);
}
export async function validateR24Custody({ record, store }) {
  const r = CURRENT_R24;
  need(hash(record) === r.previousRecordDigest, "ORIGINAL_RECORD_CHANGED");
  const result = {};
  for (const pin of r.custody) {
    const value = await store.read(pin.slot);
    need(value?.commitSha === pin.commit, "CUSTODY_COMMIT_CHANGED");
    const { commitSha, ...payload } = value;
    need(hash(payload) === pin.payloadDigest, "CUSTODY_PAYLOAD_CHANGED");
    result[pin.slot] = value;
  }
  return result;
}
export function r24OriginalRecord(record) {
  const historical = record.currentSourceAdmission.retainedEvidence.historicalException;
  const original = {
    ...record,
    version: 23,
    id: CURRENT_R23.id,
    ownerApproval: CURRENT_R23.ownerApproval,
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R23.id}` },
    predecessor: historical.predecessor,
    frozenReferenceSha: historical.frozenReferenceSha,
    currentSourceAdmission: historical.currentSourceAdmission,
  };
  need(hash(original) === CURRENT_R24.previousRecordDigest, "ORIGINAL_RECORD_CHANGED");
  return original;
}
export async function validateR24Predecessors({ record, request, storeFor }) {
  validateR24Record(record);
  const r = CURRENT_R24;
  const old = r24OriginalRecord(record);
  const observed = await validateCurrentAdmissionPredecessors({ record: old, request, storeFor });
  for (const expected of r.addedRuns) {
    const actual = await request(`actions/runs/${expected.id}`);
    need(same(currentRunIdentity(actual), expected), "RUN_CHANGED");
    observed.push(actual);
  }
  const store = storeFor(old);
  await validateR24Custody({ record: old, store });
  need(!(await store.read("qualify")) && !(await store.read("qualified")), "OLD_QUALIFICATION_EXISTS");
  const jobs = await request(`actions/runs/${r.failedOrdinary.runId}/attempts/1/jobs?per_page=100`),
    artifacts = await request(`actions/runs/${r.failedOrdinary.runId}/artifacts?per_page=100`);
  need(
    jobs.total_count === 4 &&
      jobs.jobs?.length === 4 &&
      same(
        jobs.jobs.map((x) => ({ id: x.id, name: x.name, conclusion: x.conclusion })).sort((a, b) => a.id - b.id),
        r.failedOrdinary.jobs,
      ) &&
      artifacts.total_count === 0 &&
      artifacts.artifacts?.length === 0,
    "CANCELLED_ORDINARY_CHANGED",
  );
  for (const artifact of r.artifacts) {
    const actual = await request(`actions/artifacts/${artifact.id}`);
    need(
      actual.id === artifact.id &&
        actual.expired === false &&
        actual.size_in_bytes === artifact.bytes &&
        actual.digest === `sha256:${artifact.sha256}` &&
        actual.workflow_run?.id === artifact.runId,
      "ARTIFACT_CHANGED",
    );
  }
  return observed;
}

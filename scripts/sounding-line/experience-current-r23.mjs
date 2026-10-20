// Exact finite checkout recovery; all prior evidence remains spent and immutable.
import { R22_MEDIA_PROTOCOL } from "./experience-media-first-r22-policy.mjs";
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CURRENT_R23 = freeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R23",
  version: 23,
  contractIds: [
    "crossdeck.phase2.continuity",
    "crossdeck.refit.companion",
    "crossdeck.refit.published-lens",
    "homeport.shell.crossdeck-access-recovery",
    "homeport.shell.crossdeck-companion",
    "homeport.shell.crossdeck-companion-mobile",
    "reach.phase1.foundation",
  ],
  previousId: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R22",
  previousRecordDigest: "509a500878112bf2072e3d76529faad7d24261c8e8c1d60e3b0a6991a75503af",
  previousRegistryRawSha256: "ad003f65dd36b43bbf8aa88c80c0eb62ec46e8d13aec1e98da939d3cde77aeec",
  previousRegistryDigest: "85baca73036eec95fb2565bfed1a362fe937dedb90b81dd4913595db9a882091",
  previousRecordsDigest: "1ff590389ad3fa55f70e04f1138d11df6f71a96fbc6f7d88ebea5da4edafdd8e",
  previousRunsDigest: "f84cbbb30da47cb9c974d30e4f20fd46304a1a07638756ab268e158c37e8898a",
  legacyR14HistoryDigest: "310336de7699488a7b01d04c023d2ce96663d080cfd94e8f785f8b219eb40ab3",
  immutableHistoryDigest: "5d7f56af659c01d071de47d4f527535bf76e79e7b6505e82335895318e63c1d7",
  frozenReferenceSha: "4b2ba61983faf29a3b6f41e24509f2aae023be6f",
  frozenReferenceTree: "9c61e98c14ed12b0d9f1266448ffe7fdcbcf82d1",
  frozenRepairSourceDigest: "8be62a7c13a370991d695d859a01d58270dc7dea18c7db60a2115608199dc78f",
  preservationRevision: "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f",
  protectedBaseAncestorSha: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtc: "2026-10-20T23:15:33Z",
    approvedAtUtcMinute: "2026-10-20T23:15Z",
    humanMessageId: "Sentinel_77807bdc0154819198f5df631517ab14",
    relayThreadId: "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1",
    basis: "PARENT_VERIFIED_DIRECT_HUMAN_RELAY_NATIVE_BODY_NOT_REREAD",
  },
  expiresAt: "2026-10-22T23:59:59Z",
  cumulativeHistory: {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 26,
    currentPreparationOrdinal: 27,
    completedIndependentReviews: 11,
  },
  requiredReviewIterations: 16,
  remainingIndependentReviewOrdinal: 12,
  reviewProtocol: R22_MEDIA_PROTOCOL,
  adjudication: {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-acceptance-boundary-20261019-r20/adjudication.json",
    sha256: "b1811ba111b2c80a1e1ebe225576061144881f40aa1a144a943db8b282afd002",
  },
});
export const R23_BASE_ADOPTION = freeze({
  kind: "EXACT_ACCEPTED_R22_BASE_ADOPTION_1",
  priorFrozenReferenceSha: "58436ab51dcf8696609fe4a172b8aed2eca33efc",
  acceptedBaseSha: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  frozenReferenceSha: "4b2ba61983faf29a3b6f41e24509f2aae023be6f",
  frozenReferenceTree: "9c61e98c14ed12b0d9f1266448ffe7fdcbcf82d1",
  parents: ["58436ab51dcf8696609fe4a172b8aed2eca33efc", "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5"],
});
export const R23_PRESERVED_PROOFS = freeze([
  {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-pre-source-byte-gate-20261020-r22/historical-ledger.json",
    sha256: "c0c1be9a18e66691265eb0f5998a02cfb131d3a87460af6eec862e2b6a623d2c",
  },
  {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-pre-source-byte-gate-20261020-r22/causal-disposition.md",
    sha256: "53d04286f0e2b4ed17cf58a3a41781fa68f3fabdc91343665bb417cb696f8c36",
  },
  {
    path: "scripts/sounding-line/experience-current-r22.mjs",
    sha256: "472484eda2ff833b60d5a5efaf96efe111b0d75e2e5f005811413f7e0e9a4673",
  },
  {
    path: ".agents/crossdeck-r22-pre-source-byte-gate.md",
    sha256: "fbab0733dbc91e026141fc5d7d64f13da550b1b123f331910544e6e6c00ee721",
  },
]);
export const CURRENT_R22_FAILED_PREPARATION = freeze({
  kind: "CONSUMED_CURRENT_CAPTURE_AUTHORITY_CHECKOUT_TIMEOUT_1",
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R22",
  recordDigest: "509a500878112bf2072e3d76529faad7d24261c8e8c1d60e3b0a6991a75503af",
  prepareCommit: "788863ffb87643f3f095700161c2e2eadc2983f0",
  preparePayloadDigest: "c639549d679a99d7ee64336c08608037d72133448acf1e5c11d647d8a039f14b",
  preparePayloadBytes: 42297,
  campaignEpoch: "2026-10-15T13:54Z",
  runId: 39489881363,
  runAttempt: 1,
  workflowId: 341545080,
  checkSuiteId: 107016875225,
  createdAt: "2026-10-20T20:11:40Z",
  conclusion: "cancelled",
  mode: "capture",
  event: "workflow_dispatch",
  headSha: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  headBranch: "main",
  baseSha: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  candidateSha: "4b2ba61983faf29a3b6f41e24509f2aae023be6f",
  candidateTree: "9c61e98c14ed12b0d9f1266448ffe7fdcbcf82d1",
  sourceDigest: "8be62a7c13a370991d695d859a01d58270dc7dea18c7db60a2115608199dc78f",
  contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
  artifacts: [],
  jobs: [
    {
      id: 118859922789,
      name: "Sounding Line / Finite campaign custody",
      conclusion: "success",
    },
    {
      id: 118863370961,
      name: "Sounding Line / Focused verification",
      conclusion: "skipped",
    },
    {
      id: 118863377085,
      name: "Sounding Line / Experience preparation (no mainline decision)",
      conclusion: "cancelled",
    },
    {
      id: 118863403035,
      name: "Sounding Line / Mainline Decision",
      conclusion: "skipped",
    },
  ],
  checkout: {
    jobId: 118863377085,
    stepNumber: 2,
    startedAt: "2026-10-20T20:18:44Z",
    completedAt: "2026-10-20T20:58:45Z",
    conclusion: "cancelled",
    authorityRef: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
    fetchDepth: 0,
    lastProgressAt: "2026-10-20T20:18:44Z",
    logBytes: 9539,
    logSha256: "a7064d7291e4e782fd789ac6e3c74370bbf011e343dadd0a3e8e74dfc8489240",
    transferCause: "UNKNOWN",
  },
  preparationConsumed: 26,
  independentReviewsCompleted: 11,
  reservedIndependentReviewOrdinal: 12,
  independentReviewPerformed: false,
  absentSlots: ["capture", "review-submit", "review12", "qualify", "qualified"],
});
export const CURRENT_R22_FAILED_RUN = freeze({
  id: 39489881363,
  runAttempt: 1,
  workflowId: 341545080,
  event: "workflow_dispatch",
  headSha: "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5",
  headBranch: "main",
  actor: "Kgray44",
  triggeringActor: "Kgray44",
  repository: "Kgray44/treasurehuntSoT",
  status: "completed",
  conclusion: "cancelled",
  createdAt: "2026-10-20T20:11:40Z",
  displayTitle: "Sounding Line finite 1 capture 721 4b2ba61983faf29a3b6f41e24509f2aae023be6f active",
  checkSuiteId: 107016875225,
});
export const R23_CHECKOUT_RECOVERY = freeze({
  kind: "EXACT_AUTHORITY_CHECKOUT_RECOVERY_1",
  authorityRef: "${{ inputs.base_sha }}",
  authorityFetchDepth: 1,
  authorityFetchTags: false,
  candidateFetchDepth: 0,
  checkoutStepTimeoutMinutes: 10,
  showProgress: true,
  preparationJobTimeoutMinutes: 40,
  monitorIntervalSeconds: 60,
  additionalRetryWrapper: false,
  automaticWorkflowRerun: false,
  consumerReplacementCaptures: 1,
});

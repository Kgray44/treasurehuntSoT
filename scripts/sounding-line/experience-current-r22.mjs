// Fixed recovery successor; original R21 bytes and spent attempts remain immutable.
import { R22_MEDIA_PROTOCOL } from "./experience-media-first-r22-policy.mjs";
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
export const CURRENT_R22 = deepFreeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R22",
  version: 22,
  contractIds: [
    "crossdeck.phase2.continuity",
    "crossdeck.refit.companion",
    "crossdeck.refit.published-lens",
    "homeport.shell.crossdeck-access-recovery",
    "homeport.shell.crossdeck-companion",
    "homeport.shell.crossdeck-companion-mobile",
    "reach.phase1.foundation",
  ],
  previousId: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R21",
  previousRecordDigest: "717a3a70ac9df872b0be69e42d19a0c2d9b132afaacd036ac3bf4cc319eb10e6",
  previousRegistryRawSha256: "e57919960fe9c86fd6eb6106c620441e59a3cba5e24772ba4629417037ca897d",
  previousRegistryDigest: "4791e7f1a9e2482c785320cb4b6c7f1ae10e0dd60be2edacc20fb8aa7226d93f",
  previousRecordsDigest: "7403542fac6861f63ae76c3c2a9e5f6d420b7f37c413db94e1960cdeea472539",
  previousRunsDigest: "e0b0f90ff859329c696f7604f7ac107a3b0716d644f2168d48ed619fdf36fc6a",
  legacyR14HistoryDigest: "310336de7699488a7b01d04c023d2ce96663d080cfd94e8f785f8b219eb40ab3",
  immutableHistoryDigest: "5d7f56af659c01d071de47d4f527535bf76e79e7b6505e82335895318e63c1d7",
  frozenReferenceSha: "58436ab51dcf8696609fe4a172b8aed2eca33efc",
  frozenReferenceTree: "de835afc749264b49d7b995008f6c6f3074f40b1",
  frozenRepairSourceDigest: "1b8fccd170072032369a70ebe17b622678f1c7b3f81a818fc02d853afeb03f96",
  preservationRevision: "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f",
  protectedBaseAncestorSha: "974f78267186ae038736d0addac6359cff5298ea",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtcMinute: "2026-10-20T18:18Z",
    humanMessageId: "Sentinel_8393f9239fa88191a49dc59392dca0e2",
    questionMessageId: "Sentinel_0642abdcffe48191b336f7a277f38cb2",
    relayThreadId: "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1",
    basis: "PARENT_VERIFIED_DIRECT_HUMAN_RELAY_NATIVE_BODY_NOT_REREAD",
  },
  expiresAt: "2026-10-22T23:59:59Z",
  cumulativeHistory: {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 25,
    currentPreparationOrdinal: 26,
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
export const R22_BASE_ADOPTION = deepFreeze({
  kind: "EXACT_ACCEPTED_R21_BASE_ADOPTION_1",
  priorFrozenReferenceSha: "5dab333a4699d0feb95b07118d0986fcd34f527f",
  acceptedBaseSha: "974f78267186ae038736d0addac6359cff5298ea",
  frozenReferenceSha: "58436ab51dcf8696609fe4a172b8aed2eca33efc",
  frozenReferenceTree: "de835afc749264b49d7b995008f6c6f3074f40b1",
  parents: ["5dab333a4699d0feb95b07118d0986fcd34f527f", "974f78267186ae038736d0addac6359cff5298ea"],
});
export const R22_PRESERVED_PROOFS = deepFreeze([
  {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-media-first-successor-20261020-r21/historical-ledger.json",
    sha256: "3a662151a563450b441f475a964602ffe0945a9400b47058dd43d75aa3ff457c",
  },
  {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-media-first-successor-20261020-r21/causal-disposition.md",
    sha256: "882ab06803d4208461fb8027eab0ab875225a594d41ed3a54c00f6dc9b3c4462",
  },
  {
    path: "scripts/sounding-line/experience-current-r21.mjs",
    sha256: "e790f87c41c9d8a6b116ce00cecd81a2da0f5a7301dac47ee42c2cdbf3f3ae7c",
  },
  {
    path: ".agents/crossdeck-r21-media-first-successor.md",
    sha256: "9b5cdc9cb6cb57d0e0c0d10d9d9ccf0a1d1b39d872415b65772b60679935c817",
  },
]);
export const CURRENT_R21_NONQUALIFYING_CAPTURE = deepFreeze({
  kind: "SUCCESSFUL_CURRENT_CAPTURE_NONQUALIFYING_AUXILIARY_REVIEW_1",
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R21",
  recordDigest: "717a3a70ac9df872b0be69e42d19a0c2d9b132afaacd036ac3bf4cc319eb10e6",
  prepareCommit: "005bbd181872629bb2b5a941fac6ddd43dfa16b7",
  preparePayloadDigest: "209071bb30fe800cb7cf2fdb6e34415a47e9d7b438402a6e06311e3c639cd519",
  campaignEpoch: "2026-10-15T13:54Z",
  runId: 39453809903,
  runAttempt: 1,
  workflowId: 341545080,
  checkSuiteId: 106914631074,
  createdAt: "2026-10-20T16:01:54Z",
  conclusion: "success",
  mode: "capture",
  event: "workflow_dispatch",
  headSha: "974f78267186ae038736d0addac6359cff5298ea",
  headBranch: "main",
  baseSha: "974f78267186ae038736d0addac6359cff5298ea",
  candidateSha: "58436ab51dcf8696609fe4a172b8aed2eca33efc",
  candidateTree: "de835afc749264b49d7b995008f6c6f3074f40b1",
  sourceDigest: "1b8fccd170072032369a70ebe17b622678f1c7b3f81a818fc02d853afeb03f96",
  contractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
  artifacts: [
    {
      id: 12281169039,
      bytes: 1641260112,
      sha256: "bf5f29b065a642974ce3c625c97d1960e6166f039f0152d6f13d2e7fa00a572e",
    },
    {
      id: 12282445057,
      bytes: 143421578,
      sha256: "55dd7b724ba6e8e6f7b23f4425a3fb72418bc9637c6f6bd6678f69d964479047",
    },
    {
      id: 12282295250,
      bytes: 70310,
      sha256: "dc309c59e66cc1b2b7ce5ede4ea763566def9a1979a17da3a02af11f984ba3f2",
    },
  ],
  auxiliaryReview: {
    kind: "COMPLETED_NONQUALIFYING_FIRST_PASS_SCHEMA_FAILURE_1",
    rawBytes: 100173,
    rawSha256: "09072285f1bbb1ae09f69860b8127a5670daf2de09107321194f4daf5539d7a3",
    failureReportBytes: 2627,
    failureReportSha256: "f522f0a180b4f2b5ce0da5a8e47c3cc3c5fdb791b1ab34077be0983f0bdc0d77",
    iteration: 15,
    ordinal: 11,
    criticContext: "01a159fe-37c1-7469-9441-37a5e5c3c0d1",
    criticTaskPath: "/root/r21_media_first_critic",
    criticCreatedAtUtc: "2026-10-20T15:46:35Z",
    frozenAtUtc: "2026-10-20T17:17:46.234556Z",
    sourceInspectionStartedAtUtc: "2026-10-20T17:24:02.440899Z",
    sourcePhaseBeforeMedia: false,
    distinctCriticFromPreviousReview: true,
    preSourceSchemaAdmitted: false,
    sourceDisclosed: true,
    secondPassProduced: false,
    sevenExplicitCanonicalAcceptedJudgments: false,
    authenticatedSubmission: false,
    qualifying: false,
  },
  independentReviewsCompleted: 11,
  reservedIndependentReviewOrdinal: 11,
  absentSlots: ["capture", "review-submit", "review11", "qualify", "qualified"],
});
export const CURRENT_R21_SUCCESSFUL_RUN = deepFreeze({
  id: 39453809903,
  runAttempt: 1,
  workflowId: 341545080,
  event: "workflow_dispatch",
  headSha: "974f78267186ae038736d0addac6359cff5298ea",
  headBranch: "main",
  actor: "Kgray44",
  triggeringActor: "Kgray44",
  repository: "Kgray44/treasurehuntSoT",
  status: "completed",
  conclusion: "success",
  createdAt: "2026-10-20T16:01:54Z",
  displayTitle: "Sounding Line finite 1 capture 721 58436ab51dcf8696609fe4a172b8aed2eca33efc active",
  checkSuiteId: 106914631074,
});

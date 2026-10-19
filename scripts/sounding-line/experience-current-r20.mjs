// Fixed, owner-approved fresh-capture successor. No historical capture compatibility route.
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
export const CURRENT_R20 = deepFreeze({
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261019-R20",
  version: 20,
  contractIds: [
    "crossdeck.phase2.continuity",
    "crossdeck.refit.companion",
    "crossdeck.refit.published-lens",
    "homeport.shell.crossdeck-access-recovery",
    "homeport.shell.crossdeck-companion",
    "homeport.shell.crossdeck-companion-mobile",
    "reach.phase1.foundation",
  ],
  previousId: "PE-X-CROSSDECK-CURRENT-VERIFY-20261019-R19",
  previousRecordDigest: "b7e78299dc6eadce6081802656b4d584eed9837df5b35a18c0dc0dbe8c789a5b",
  previousRegistryRawSha256: "841f23a1e0b37a4bce93e88319d9b53cb0336555fa3b977b0c1415481395af06",
  previousRegistryDigest: "99c3e10fcfaec4febc7814087223a13e6bf88ecbcc71e4dd8eb8bdaf97481792",
  previousRecordsDigest: "ffedbe2caf2883a9911cce18ee792ddabb284c4590158064b6a1c2ea4e11d94c",
  previousRunsDigest: "e27afa7e273ea33ba222a90abce3e2d774284f8f58b2de11d72678046cc2b5dd",
  legacyR14HistoryDigest: "310336de7699488a7b01d04c023d2ce96663d080cfd94e8f785f8b219eb40ab3",
  immutableHistoryDigest: "5d7f56af659c01d071de47d4f527535bf76e79e7b6505e82335895318e63c1d7",
  frozenReferenceSha: "554ff4fbbab23d67fc54ef951b921130f8305df2",
  frozenRepairSourceDigest: "e80f81b754f7ccf4c5b0cf4799fd64d587ce698f969fb1a5020e5ca3b36dcd1f",
  preservationRevision: "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f",
  protectedBaseAncestorSha: "f6af0b0e151f15f1a23808413ccee531b9827ca7",
  ownerApproval: {
    actor: "Kgray44",
    approvedAtUtcMinute: "2026-10-19T19:06Z",
    humanMessageId: "Sentinel_6dd5d7e3d8288191bb9a543c9db63739",
    sourceThreadId: "01a0f4a3-e2a2-7591-a1c3-167849b860cf",
    basis: "DIRECT_OWNER_APPROVAL_RELAY_NATIVE_BODY_UNAVAILABLE",
  },
  expiresAt: "2026-10-22T23:59:59Z",
  cumulativeHistory: {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 23,
    currentPreparationOrdinal: 24,
    completedIndependentReviews: 9,
  },
  requiredReviewIterations: 14,
  remainingIndependentReviewOrdinal: 10,
  adjudication: {
    path: "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-acceptance-boundary-20261019-r20/adjudication.json",
    sha256: "b1811ba111b2c80a1e1ebe225576061144881f40aa1a144a943db8b282afd002",
  },
});
export const R20_SCOPE = deepFreeze({
  kind: "CROSSDECK_ACCEPTANCE_BOUNDARY_ADJUDICATION_1",
  id: "SL-CD-R20-EDITORIAL-TO-REFIT-20261019",
  approval: {
    actor: "Kgray44",
    approvedAtUtcMinute: "2026-10-19T19:06Z",
    humanMessageId: "Sentinel_6dd5d7e3d8288191bb9a543c9db63739",
    sourceThreadId: "01a0f4a3-e2a2-7591-a1c3-167849b860cf",
    basis: "DIRECT_OWNER_APPROVAL_RELAY_NATIVE_BODY_UNAVAILABLE",
  },
  route: "FRESH_CAPTURE_ONLY",
  originalCandidateSha: "b55f5a32b7a6c42ba309db756f944e50145de123",
  originalContractBlob: "998d1af878a1b967d933bbbcdeb13987466105ba",
  approvedCandidateSha: "554ff4fbbab23d67fc54ef951b921130f8305df2",
  approvedContractBlob: "ddf7a990800adf9febe328b8eaf1204fb3fb62f1",
  approvedContractSha256: "955e02225884bacf3cd5ac44df71d6da80dfbe747058a1b87970cb7db0039d24",
  approvedContractDigest: "38acd7ca5fe745298cd50f83ae7ecdb9a9a2c0aaefccfd6889a818f7285ee2a7",
  contractChanges: [
    {
      contractId: "crossdeck.phase2.continuity",
      oldValue:
        "Keep the book and its primary reading task dominant; use one quiet contextual connection control, a focused phone dialog with scan-first guidance and a direct return.",
      newValue:
        "Keep the current passage legible and reachable, with operable contextual connection controls, focused QR/code guidance and direct return to the same Chronicle. Preserve an unobscured current heading and the existing substantive first-viewport reading-area and hit-test requirements. Editorial first-viewport dominance, utility grouping and appearance refinement are assigned to Project Refit; obstruction, unreadability and inaccessible controls remain Crossdeck blockers.",
    },
    {
      contractId: "crossdeck.refit.companion",
      oldValue:
        "Give each purpose its own full readable workspace beneath one Chronicle identity and connection status; make purpose change secondary and the return persistent, with camera-free meaningful Lens and actual map objectives.",
      newValue:
        "Give each purpose its full readable workspace beneath one Chronicle identity and connection status, with discoverable, operable purpose selection and persistent unobscured return, camera-free meaningful Lens and actual map objectives. Editorial ranking and grouping of purpose/connection utilities and appearance refinement are assigned to Project Refit after all functional reading, purpose and return criteria pass.",
    },
    {
      contractId: "homeport.shell.crossdeck-companion-mobile",
      oldValue:
        "Keep the companion immersive, preserve compact account/context controls, and make the safe library exit and re-entry readable on desktop and phone.",
      newValue:
        "Keep account/context controls and safe library exit and same-Voyage re-entry readable, discoverable and operable on desktop and phone in both motion modes. Relative passage/chrome composition after return and editorial appearance refinement are assigned to Project Refit; no functional, accessibility or continuity defect is deferred.",
    },
  ],
  originalFindingId: "R17-R8-B1",
  originalClassification: "MAJOR_EXPERIENCE_DEFECT",
  disposition: "FUNCTIONAL_RESOLVED_EDITORIAL_DEFERRED",
  originalReview9Sha256: "dfd7e727231eae86990f0129ce5ccbc92c695cd8e61f33298428452a4f999e69",
  originalClosureSha256: "2a94d11bca9535653a3a3bbf55d9a1eb505e0851211f15068c62790aabcf857d",
  transfers: [
    {
      contractId: "crossdeck.phase2.continuity",
      ledgerEntryId: "HP-NC-CD-B1-01",
    },
    {
      contractId: "crossdeck.refit.companion",
      ledgerEntryId: "HP-NC-CD-B1-02",
    },
    {
      contractId: "homeport.shell.crossdeck-companion-mobile",
      ledgerEntryId: "HP-NC-CD-B1-03",
    },
  ],
  refit: {
    areaId: "player-journal-crossdeck",
    designPacket: "Development_Docs/Projects/Voyagewright_Refit_V1/player-journal-crossdeck/design-packet.md",
    registryProof: {
      path: "Development_Docs/Projects/Voyagewright_Refit_V1/refit-registry.json",
      sha256: "a1173226269fa04e3ff908eae6fd1fbbcf9944b4625d32675679dc482087987c",
    },
    packetProof: {
      path: "Development_Docs/Projects/Voyagewright_Refit_V1/player-journal-crossdeck/design-packet.md",
      sha256: "b3e8b33601de57821cb93e8339d791323f9b2679c4d1f95483d96c954f993cda",
    },
    ledgerProof: {
      path: "Development_Docs/Projects/Project_Homeport/Homeport_Nonconformity_Ledger.csv",
      sha256: "0ad5741b8a2a568bf4add9bc582090a555bc83e8814a6bfde7777ae239df925f",
    },
  },
  requiredFunctionalScope:
    "Essential readability and unchanged280x211 heading/hit-test/overflow, operable accessible controls, same-Voyage identity/edition/progression/return, actual purposes/Lens/maps/released content, privacy/security and truthful fallback; B2 and all other blockers remain fully resolvable requirements",
  wholeReviewScope: {
    contracts: 7,
    genericContexts: 32,
    pairedCases: 3,
    pairedContexts: 6,
    contexts: 38,
    dimensionsPerContract: 17,
  },
  historicalCaptureReuse: false,
});
export const CURRENT_R19_BLOCKED_CAPTURE = deepFreeze({
  kind: "SUCCESSFUL_CURRENT_CAPTURE_BLOCKED_RAW_REVIEW_1",
  id: "PE-X-CROSSDECK-CURRENT-VERIFY-20261019-R19",
  recordDigest: "b7e78299dc6eadce6081802656b4d584eed9837df5b35a18c0dc0dbe8c789a5b",
  prepareCommit: "8690f8b49cedb41b6351830a7d34f9bb2ded93c8",
  preparePayloadDigest: "dd800539d6ed767629cfc4a4fa9daf56168258e4b896121a6e9e55f65b93220c",
  campaignEpoch: "2026-10-15T13:54Z",
  runId: 39288538561,
  runAttempt: 1,
  workflowId: 341545080,
  checkSuiteId: 106464813521,
  createdAt: "2026-10-19T16:48:02Z",
  conclusion: "success",
  mode: "capture",
  event: "workflow_dispatch",
  headSha: "f6af0b0e151f15f1a23808413ccee531b9827ca7",
  headBranch: "main",
  baseSha: "f6af0b0e151f15f1a23808413ccee531b9827ca7",
  candidateSha: "b55f5a32b7a6c42ba309db756f944e50145de123",
  candidateTree: "fd8f252e7830ac1628011e7c5eb2ec75864cebe8",
  sourceDigest: "35a5852d762587cd3b9dd6f08142621e3e8bb81e1483287f452504dd896ddba9",
  contractDigest: "befbdf5fa900b58f2a706c94a80861bb1819fbb045c17bb00756fa83b9b4af3d",
  artifacts: [
    {
      id: 12207090441,
      bytes: 1682782035,
      sha256: "571637c78dacc8c5c9ff21029ffaf60a07e5053dcddbdca7f7b749990a7463a0",
    },
    {
      id: 12204479969,
      bytes: 152965933,
      sha256: "dcb6103d9ecce7c1f939546635484c15b8459cca1300d4bf59b47f68e4476f47",
    },
    {
      id: 12206955873,
      bytes: 65193,
      sha256: "1db8b6420a99d96faf7a008caee1c6c4011587a8efbcea1ba03bd9cd33ce2842",
    },
  ],
  blockedReview: {
    kind: "BLOCKED_RAW_INDEPENDENT_PRODUCT_REVIEW_WITH_HISTORICAL_CLOSURE_1",
    rawBytes: 102785,
    rawSha256: "dfd7e727231eae86990f0129ce5ccbc92c695cd8e61f33298428452a4f999e69",
    closureBytes: 35503,
    closureSha256: "2a94d11bca9535653a3a3bbf55d9a1eb505e0851211f15068c62790aabcf857d",
    iteration: 13,
    ordinal: 9,
    verdict: "REWORK_REQUIRED",
    reviewedAt: "2026-10-19T17:58:34.886040+00:00",
    historicalClosureAt: "2026-10-19T18:02:28.381368+00:00",
    sourceBlind: true,
    experienceBeforeSource: true,
    authenticatedSubmission: false,
    blockingFindingId: "R17-R8-B1",
    blockingClassification: "MAJOR_EXPERIENCE_DEFECT",
    unresolvedContractIds: [
      "crossdeck.phase2.continuity",
      "crossdeck.refit.companion",
      "homeport.shell.crossdeck-companion-mobile",
    ],
    resolvedB2ContractIds: ["crossdeck.phase2.continuity", "crossdeck.refit.companion"],
    originalWebmDirectlyDecoded: false,
  },
  independentReviewsCompleted: 9,
  reservedIndependentReviewOrdinal: 9,
  absentSlots: ["capture", "review-submit", "review9", "qualify", "qualified"],
});
export const CURRENT_R19_SUCCESSFUL_RUN = deepFreeze({
  id: 39288538561,
  runAttempt: 1,
  workflowId: 341545080,
  event: "workflow_dispatch",
  headSha: "f6af0b0e151f15f1a23808413ccee531b9827ca7",
  headBranch: "main",
  actor: "Kgray44",
  triggeringActor: "Kgray44",
  repository: "Kgray44/treasurehuntSoT",
  status: "completed",
  conclusion: "success",
  createdAt: "2026-10-19T16:48:02Z",
  displayTitle: "Sounding Line finite 1 capture 721 b55f5a32b7a6c42ba309db756f944e50145de123 active",
  checkSuiteId: 106464813521,
});

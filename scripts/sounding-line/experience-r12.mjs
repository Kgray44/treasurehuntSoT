// Frozen R12 adapter. Its spent invocation and historical proof contract remain unchanged.
import { createDiagnosedContinuation } from "./experience-diagnosed-continuation.mjs";
import { R11_OVERLAY_PATHS, validateR11Registry } from "./experience-r11.mjs";

export const CROSSDECK_R12 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R12",
  recordDigest: "9d140072d1cd31a363bf667380b1298eb1b8a9ef0489eb0be564922f85f5239c",
  frozenReferenceSha: "675208e7eee81d23abb71bc189afc1289d02409a",
  requiredTechnicalCorrectionCandidateSha: "6c9bd4c2ef694cdf0c8de5e8fd4e1719068d537e",
  requiredDiagnosticRepairCandidateSha: "2cf9c1dd10378e6bba08978a9cc4f97543c09979",
  oldRegistryDigest: "0d3ca795fe4d3679202359834094eb02ccf791de13d26335acf466ddee134f2c",
  historicalExceptionDigest: "4d2f73505425dc68b4a14b9e6b030e46a15cc0cc60b53acd4e74c3b382b86c82",
  bridgeId: "PE-R12-ORDINARY-ONLY-BRIDGE-20261017",
  predecessor: {
    runId: 38986106986,
    qualifyCommit: "59eee4ede94f91a116cc4e0cfcc98c795a62567e",
    qualifyPayloadDigest: "9bc236444cf2e5df9173fc182580f94600ec96f88a06571a2e5d507ee6f79131",
  },
});
export const R12_REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R12_MERGED = [
  ".agents/README.md",
  "Development_Docs/INDEX.md",
  "Development_Docs/Testing/Product_Experience/README.md",
];
export const R12_TEST_CORRECTION = Object.freeze({
  path: "tests/e2e/crossdeck-phase2.spec.ts",
  mode: "100644",
  oldBlob: "ba77b2faf27e6e44af8db2fbd577bd3b4f9c589a",
  newBlob: "68d861d7e4c819f3855cbcd3cbd8636afb1a034a",
  workingSha256: "d61b51d135b0a91d83b42ee6f01e6f455682aeb257e9d6ba1745fce39aed5e76",
});
export const R12_CORRECTION_EVIDENCE = Object.freeze({
  candidateSha: "6c9bd4c2ef694cdf0c8de5e8fd4e1719068d537e",
  candidateTree: "05eff39924a773335442bdbdc664dba06f38d755",
  patchPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/ordinary5-reverse-receive-repair-20261017/candidate-correction.patch",
  patchSha256: "7b0c1f5f6fdc922ac1ab4f953036a8ab60343b88551adf6eec7db120ac989feb",
  reviewPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/ordinary5-reverse-receive-repair-20261017/source-review.json",
  reviewSha256: "db3553ffc17218b35f61ee52d37190afb6b7dd2f99009e85beca255fa51331bf",
});
export const R12_FOCUSED = Object.freeze({
  directory: "Development_Docs/Projects/Project_Crossdeck/evidence/r12-verification-20261017/focused-technical",
  spec: R12_TEST_CORRECTION.path,
  title: "crossdeck.surface-handoff",
  original: Object.freeze({
    candidateSha: "53601e9e386bb4f1062719befc77b7778b9e4430",
    candidateTree: "85e9accc1d273d0f649119380d775df41e6dcf0a",
    baseSha: "a16c5807657786d614ef4c5b8942daa740b2dfdf",
    sourceDigest: "3e69c2306442758edca417fdb478f1a61e009f1cbc82d584bcad6e760257df0f",
  }),
});
export const R12_OVERLAY_PATHS = [
  ...R11_OVERLAY_PATHS,
  ".agents/crossdeck-r12-ordinary-only.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R12_Diagnosed_Continuation_20261017.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r12-ordinary-only-20261017/r11-consumed-frozen-publication.derived.json",
  "scripts/sounding-line/experience-r12.mjs",
  "scripts/sounding-line/experience-r12-technical-proof.mjs",
  "scripts/sounding-line/run-browser-suite.mjs",
  "tests/sounding-line/experience-r12.test.mjs",
  "tests/sounding-line/experience-r12-technical-proof.test.mjs",
].sort();

export const {
  validateR12Record,
  assertR12Mode,
  validateR12Bridge,
  validateR12Registry,
  pendingR12Reconciliation,
  r12HistoricalEvidencePlan,
  validateR12Overlay,
  validateR12FailureOriginals,
  bindR12Reconciliation,
  admitR12FocusedTechnical,
  validateR12PublishedTechnicalProof,
  validateR12HistoricalCustody,
  validateR12FinalDecision,
} = createDiagnosedContinuation(
  Object.freeze({
    version: "R12",
    constant: CROSSDECK_R12,
    regenerated: R12_REGENERATED,
    merged: R12_MERGED,
    correction: R12_TEST_CORRECTION,
    correctionEvidence: R12_CORRECTION_EVIDENCE,
    focused: R12_FOCUSED,
    overlayPaths: R12_OVERLAY_PATHS,
    recordCount: 12,
    bridgeCount: 5,
    failureFileCount: 9,
    validatePriorRegistry: validateR11Registry,
    runnerModule: "./experience-r12-technical-proof.mjs",
    receiptValidator: "validateR12FocusedReceipt",
  }),
);

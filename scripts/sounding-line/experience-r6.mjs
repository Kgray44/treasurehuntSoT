// A diagnosed, exact finite successor. Standing owner permission never grants
// runtime retries: another failure requires another reviewed protected amendment.
import { createHash } from "node:crypto";
import { PAIRED_CASES, planPairedEvidence, validatePairedEvidence } from "./experience-paired.mjs";

export const CROSSDECK_R6 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R6",
  recordDigest: "11b5fef74f3944ea6cb95b6afdb29c8ec125deda1e3a8a1ebbdc83014b70e787",
  predecessorDigest: "f7cc69e66e577c06cdd2f87ba10f99c98841c6172b08ca837e6a6a0da3cd3bd4",
  frozenReferenceSha: "a9232900658a583785b33abbf081fffea98fd392",
  localProofPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r6-verification-20261016/paired-local-proof.json",
  localOutputDirectory:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r6-verification-20261016/paired-local-execution",
  predecessor: {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R5",
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R5",
    recordDigest: "f7cc69e66e577c06cdd2f87ba10f99c98841c6172b08ca837e6a6a0da3cd3bd4",
    prepareCommit: "1aa1ade9330b83b9d789a3b15b1e1d4ac7a15446",
    preparePayloadDigest: "a729078230d094d8f209f0303cabae52a83f03dcab506a78a3572ceecabd11a1",
    campaignEpoch: "2026-10-15T13:54Z",
    runId: 38840988544,
    runAttempt: 1,
    workflowId: 341545080,
    mode: "capture",
    createdAt: "2026-10-16T02:32:52Z",
    conclusion: "success",
    baseSha: "f935ab3efd6eb5943cdea8a08f65c9cf55c45d95",
    candidateSha: "6dcabd5401b22e606e13a2b92202d15f8e3176e1",
    candidateTree: "45ad546f23e0070c842589a95edd6c940532dbe5",
    sourceDigest: "36990c15e7d48386b4b213b103f91dc8e608e8b3638c50e878e002d50451ff4e",
    contractDigest: "4ee636786ea5b2fedd375c3567441f151caa668d98934b01e98161c4c88c44ec",
    independentReviewsCompleted: 5,
    reservedIndependentReviewOrdinal: 6,
    artifacts: [
      {
        id: 12021717536,
        size: 46115,
        digest: "sha256:1c163c73eb1484e8fba3d97f6a8f5451b610166ed9981725f0f1b63e42c89979",
      },
      {
        id: 12021599252,
        size: 1318788222,
        digest: "sha256:53ec81bd7ddc6a3264bb4066681e4ee3d12bea8684a43bdadfafd512fa79c762",
      },
    ],
  },
  blockedReview: {
    commit: "a9232900658a583785b33abbf081fffea98fd392",
    path: "Development_Docs/Projects/Project_Crossdeck/evidence/r5-verification-20261015/independent-review6/reviews.original.raw.txt",
    sha256: "5df4089fc8bfa13bf33b8f4935ab329b0b602b3bcbc25398033df9926b41473d",
  },
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R6_${code}`);
};
export function validateR6Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R6.recordDigest
  )
    fail("RECORD_CHANGED");
}
export function r6LocalPlan(full) {
  if (planPairedEvidence(full.contracts)?.browserContexts !== 6 || full.contextCount !== 38) fail("PLAN_SCOPE_CHANGED");
  return { ...full, localProof: CROSSDECK_R6.id, pairedOnly: true, outputDirectory: CROSSDECK_R6.localOutputDirectory };
}
export function validateR6LocalReceipt(receipt, plan) {
  if (
    receipt?.version !== 1 ||
    receipt.classification !== "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY" ||
    receipt.status !== "PASS" ||
    receipt.exceptionId !== CROSSDECK_R6.id ||
    receipt.localProofInvocations !== 1 ||
    receipt.childReplayInvocations !== 1 ||
    receipt.pairedCaseExecutions !== 3 ||
    receipt.participatingBrowserContexts !== 6 ||
    receipt.fullPreparations !== 0 ||
    receipt.independentReviews !== 0 ||
    hash(receipt.caseIds) !== hash(PAIRED_CASES.map((c) => c.id)) ||
    receipt.baseSha !== plan.baseSha ||
    receipt.sourceDigest !== plan.sourceDigest ||
    receipt.contractDigest !== plan.contractDigest ||
    receipt.recordDigest !== plan.exception?.recordDigest ||
    receipt.evidence?.pairedEvidence?.binding?.candidateSha !== receipt.candidateSha ||
    receipt.evidence?.pairedEvidence?.binding?.candidateTree !== receipt.candidateTree
  )
    fail("LOCAL_PROOF_MISSING_OR_CHANGED");
}
export async function validateR6Proof({ root, plan, revision, receipt }) {
  const { artifactBytes, validateExperienceArtifacts } = await import("./product-experience.mjs");
  receipt ??= JSON.parse(artifactBytes({ root, revision, file: CROSSDECK_R6.localProofPath }));
  validateR6LocalReceipt(receipt, plan);
  validateExperienceArtifacts({ root, plan, revision, evidence: receipt.evidence });
  validatePairedEvidence({
    root,
    plan,
    evidence: receipt.evidence,
    read: (file) => artifactBytes({ root, revision, file }),
  });
  return receipt;
}

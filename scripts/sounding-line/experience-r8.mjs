// Fresh finite proof after consumed R7 local PASS and failed preparation17.
import { createHash } from "node:crypto";
import { PAIRED_CASES, planPairedEvidence, validatePairedEvidence } from "./experience-paired.mjs";

export const CROSSDECK_R8 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8",
  recordDigest: "ecbd09233751b59bd4d5b5d29ec505789944f8a87f4627feaf559461dfde7e37",
  predecessorDigest: "5073e5c04e60985cfd1f0fcce1f3f9a11fdffe5bb2d29cf269aa3a6356e6e851",
  frozenReferenceSha: "d2ce2f29f3c86dd62e673000befc90fc39835d50",
  localProofPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r8-verification-20261016/paired-local-proof.json",
  localOutputDirectory:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r8-verification-20261016/paired-local-execution",
  predecessor: {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R7",
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R7",
    recordDigest: "5073e5c04e60985cfd1f0fcce1f3f9a11fdffe5bb2d29cf269aa3a6356e6e851",
    campaignEpoch: "2026-10-15T13:54Z",
    prepareCommit: "dd8c3856c097b5c1154e29396f0c959e38c2a076",
    preparePayloadDigest: "50f4243825efbe174d4edc69a73c9c771109b092bdc5cf5e280f60279e78dadf",
    runId: 38880737676,
    runAttempt: 1,
    workflowId: 341545080,
    createdAt: "2026-10-16T09:28:52Z",
    conclusion: "failure",
    baseSha: "ce862a4a349b92faa11beaef50555abcb1a35be8",
    candidateSha: "0dd0847458dedaab3b5b1d0f5b4b73fe78aaa087",
    candidateTree: "bb030c5a449081d51cf2e5d7cfe692c7288b541e",
    sourceDigest: "91769eb493df857300b454939e1e2004338e10b12991b8651a18dedc14ba3be0",
    contractDigest: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
    independentReviewsCompleted: 6,
    reservedIndependentReviewOrdinal: 7,
    artifacts: [
      {
        id: 12038770189,
        size: 49279,
        digest: "sha256:7dbd634e95d42b7f6d5257cbc02a4346464e6de0027438de58d5d37488a3b8b7",
      },
      {
        id: 12037519792,
        size: 1388686658,
        digest: "sha256:2647f25006cea85efd5f127d31dec7e96968a259436c6c15ff6daa12ff4a88ee",
      },
    ],
    failureCommit: "18529e44b28d8b64eb190fbf8b8a23476ba5707a",
    failureIndexPath:
      "Development_Docs/Projects/Project_Crossdeck/evidence/r7-failed-preparation17-20261016/failed-preparation-index.json",
    failureIndexSha256: "d9db9f58a492d3a78f2ff98b3b0083461a178ef6fcad31ea09a78da7225b1029",
    localProofIndexPath:
      "Development_Docs/Projects/Project_Crossdeck/evidence/r7-verification-20261016/paired-local-proof-index.json",
    localProofIndexSha256: "b5b164a5643a95abe77bf6b8c521c8b711c1b027b1504dee41147892334d4eaa",
    originalMarkerSha256: "0e1cbde32958b1c867159f4f65947a82204f108d12f5f2452c967d1d70b942b4",
    localStatus: "PASS",
    localProofInvocations: 1,
    childReplayInvocations: 1,
    pairedCaseExecutions: 3,
    participatingBrowserContexts: 6,
    preparationStatus: "FAIL",
    preparationInvocations: 1,
    preparationPairedPassed: 2,
    preparationPairedFailed: 1,
    preparationPairedSkipped: 0,
    completeCaptureManifestIssued: false,
    reviewStarted: false,
    authenticatedSubmissionStarted: false,
    ordinaryStarted: false,
  },
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R8_${code}`);
};
export function validateR8Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R8.recordDigest
  )
    fail("RECORD_CHANGED");
}

// Installed Prettier 3.6.2 search inputs. A candidate must not add a closer
// config, broaden .gitignore or change modes while the exact raw paths are exempt.
const formatterConfig =
  /^(?:package\.(?:json|yaml)|\.prettierrc(?:\.(?:json|yaml|yml|json5|js|ts|mjs|mts|cjs|cts|toml))?|prettier\.config\.(?:js|ts|mjs|mts|cjs|cts)|\.editorconfig)$/iu;
export function validateR8FormattingInputs(expected, candidate) {
  for (const file of new Set([...expected.keys(), ...candidate.keys()])) {
    if (file === "package.json") continue; // Existing frozen-package normalization remains mandatory.
    if (
      (formatterConfig.test(file.split("/").at(-1)) || /^\.(?:gitignore|prettierignore)$/iu.test(file)) &&
      candidate.get(file) !== expected.get(file)
    )
      fail("FORMATTING_INPUT_CHANGED");
  }
}

export function r8LocalPlan(full) {
  if (planPairedEvidence(full.contracts)?.browserContexts !== 6 || full.contextCount !== 38) fail("PLAN_SCOPE_CHANGED");
  return { ...full, localProof: CROSSDECK_R8.id, pairedOnly: true, outputDirectory: CROSSDECK_R8.localOutputDirectory };
}
export function validateR8LocalReceipt(receipt, plan) {
  if (
    receipt?.version !== 1 ||
    receipt.classification !== "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY" ||
    receipt.status !== "PASS" ||
    receipt.exceptionId !== CROSSDECK_R8.id ||
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
export async function validateR8Proof({ root, plan, revision, receipt }) {
  const { artifactBytes, validateExperienceArtifacts } = await import("./product-experience.mjs");
  receipt ??= JSON.parse(artifactBytes({ root, revision, file: CROSSDECK_R8.localProofPath }));
  validateR8LocalReceipt(receipt, plan);
  validateExperienceArtifacts({ root, plan, revision, evidence: receipt.evidence });
  validatePairedEvidence({
    root,
    plan,
    evidence: receipt.evidence,
    read: (file) => artifactBytes({ root, revision, file }),
  });
  return receipt;
}

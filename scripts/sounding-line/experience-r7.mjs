// A separately reviewed finite successor; the consumed R6 attempt stays failed.
import { createHash } from "node:crypto";
import { PAIRED_CASES, planPairedEvidence, validatePairedEvidence } from "./experience-paired.mjs";

export const CROSSDECK_R7 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R7",
  recordDigest: "5073e5c04e60985cfd1f0fcce1f3f9a11fdffe5bb2d29cf269aa3a6356e6e851",
  predecessorDigest: "11b5fef74f3944ea6cb95b6afdb29c8ec125deda1e3a8a1ebbdc83014b70e787",
  frozenReferenceSha: "0152b8c8824d06d57dab458c83c76751a8fd9b08",
  localProofPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r7-verification-20261016/paired-local-proof.json",
  localOutputDirectory:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r7-verification-20261016/paired-local-execution",
  predecessor: {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R6",
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R6",
    recordDigest: "11b5fef74f3944ea6cb95b6afdb29c8ec125deda1e3a8a1ebbdc83014b70e787",
    campaignEpoch: "2026-10-15T13:54Z",
    baseSha: "ed96ead50e31553b1779c08284b022047d5edd8d",
    candidateSha: "e46f0b7532daf14d6905aa4f143d2fbf8b583741",
    candidateTree: "159a7c163324e40e46bfb988c4dd317d1aae76ae",
    sourceDigest: "bd42aacf62c5dc90d0ebfdd7a446705dab77a3bc2b5784272fe3f7c5ece6ff46",
    contractDigest: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
    failureCommit: "9c2184b08a3aca8993d0c224f2110eed32aae607",
    failureIndexPath:
      "Development_Docs/Projects/Project_Crossdeck/evidence/r6-verification-20261016/failed-local-preflight-index.json",
    failureIndexSha256: "1b8c293b6b80e4775977b9ab6bd5b7d15c111b1758512b519c78b3eee1b00394",
    originalMarkerSha256: "9a2e0afb99fd9f20c69e73a79ab1f5669ebb1327ea801fcc07296cc3386e81d6",
    status: "FAIL",
    localProofInvocations: 1,
    childReplayInvocations: 1,
    executedCases: 2,
    pairedCaseExecutions: null,
    participatingBrowserContexts: null,
    preparationStarted: false,
    reviewStarted: false,
    ordinaryStarted: false,
  },
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R7_${code}`);
};
export function validateR7Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R7.recordDigest
  )
    fail("RECORD_CHANGED");
}

// Installed Prettier 3.6.2 search inputs. A candidate must not add a closer
// config, broaden .gitignore or change modes while the exact raw paths are exempt.
const formatterConfig =
  /^(?:package\.(?:json|yaml)|\.prettierrc(?:\.(?:json|yaml|yml|json5|js|ts|mjs|mts|cjs|cts|toml))?|prettier\.config\.(?:js|ts|mjs|mts|cjs|cts)|\.editorconfig)$/iu;
export function validateR7FormattingInputs(expected, candidate) {
  for (const file of new Set([...expected.keys(), ...candidate.keys()])) {
    if (file === "package.json") continue; // Existing frozen-package normalization remains mandatory.
    if (
      (formatterConfig.test(file.split("/").at(-1)) || /^\.(?:gitignore|prettierignore)$/iu.test(file)) &&
      candidate.get(file) !== expected.get(file)
    )
      fail("FORMATTING_INPUT_CHANGED");
  }
}

export function r7LocalPlan(full) {
  if (planPairedEvidence(full.contracts)?.browserContexts !== 6 || full.contextCount !== 38) fail("PLAN_SCOPE_CHANGED");
  return { ...full, localProof: CROSSDECK_R7.id, pairedOnly: true, outputDirectory: CROSSDECK_R7.localOutputDirectory };
}
export function validateR7LocalReceipt(receipt, plan) {
  if (
    receipt?.version !== 1 ||
    receipt.classification !== "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY" ||
    receipt.status !== "PASS" ||
    receipt.exceptionId !== CROSSDECK_R7.id ||
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
export async function validateR7Proof({ root, plan, revision, receipt }) {
  const { artifactBytes, validateExperienceArtifacts } = await import("./product-experience.mjs");
  receipt ??= JSON.parse(artifactBytes({ root, revision, file: CROSSDECK_R7.localProofPath }));
  validateR7LocalReceipt(receipt, plan);
  validateExperienceArtifacts({ root, plan, revision, evidence: receipt.evidence });
  validatePairedEvidence({
    root,
    plan,
    evidence: receipt.evidence,
    read: (file) => artifactBytes({ root, revision, file }),
  });
  return receipt;
}

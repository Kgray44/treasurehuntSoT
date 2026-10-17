// Preserve the completed R13 proofs in their original context; this grants no new case.
import { createHash } from "node:crypto";
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";

export const R14_HISTORICAL_FOCUSED = Object.freeze({
  exceptionId: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R13",
  recordDigest: "a6689ebab490ed81f313cf4bc5e2e597181c012ad43645120698b2faef097359",
  registryBlob: "5f32ad400adb401b59f89d6450705abf52b81c79",
  baseSha: "24fb189a90435ccb6021b63fd6953603ae090bc0",
  candidateSha: "7681d297f281ab03f30b4224b8288b7c942024c6",
  candidateTree: "471d8540d803344d1c7d7794fb641d47c3d01817",
  sourceDigest: "a63073cbf3850900c91a25979467bb68f3930812e23af3f6daab00b21ab5d17a",
  contractDigest: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
  qualifyCommit: "f45b983b4f17648cf9f0f982d81006c1883b3137",
  qualifyPayloadDigest: "1624e8f0f7b49993a8706d9a4dbfb392620674c18dc0ba5426a4d194f3bedfc9",
  bindingDigest: "39d3d204237e88884ba22bc77eeae191b1cbd2347b42025fc314edcbc848cea3",
  exceptionBindingDigest: "abc84f2df987890fba71f8510b61656d1f39dee61d5141b1d754c1b5807a53fa",
  evidenceDirectory: "Development_Docs/Projects/Project_Crossdeck/evidence/r13-verification-20261017",
  evidenceTree: "646600f6055967b3b680d4ae5cd21e286875a0ad",
  focusedTree: "dd33ee3fb893e604008cd8859e803b40514b2aa2",
  originalReceiptSha256: "7340f930b835c57cc0788decb04bba35b2288c28ed476af291b29e9d1107746a",
  correctedReceiptSha256: "49f0b6f0540de8fc5ee5d7fcde6dc58c027f67b95ca2d8d8d0aa2e683bcd4022",
});

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw Error(`PRODUCT_EXPERIENCE_EXCEPTION_R14_HISTORICAL_FOCUSED_${code}`);
};
const git = (root, args) =>
  sourceDiagnosticGit("DIAGNOSED_CONTINUATION", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

export async function validateR14HistoricalFocusedTechnicalProof({ root, candidateSha }) {
  const original = R14_HISTORICAL_FOCUSED;
  if (!/^[a-f0-9]{40}$/u.test(candidateSha ?? "")) fail("CANDIDATE_INVALID");
  git(root, ["merge-base", "--is-ancestor", original.candidateSha, candidateSha]);
  if (
    git(root, ["rev-parse", `${original.candidateSha}^{tree}`]) !== original.candidateTree ||
    git(root, ["rev-parse", `${original.baseSha}:testing/product-experience-exceptions.json`]) !== original.registryBlob
  )
    fail("ORIGINAL_SOURCE_CHANGED");
  for (const [directory, tree] of [
    [original.evidenceDirectory, original.evidenceTree],
    [`${original.evidenceDirectory}/focused-technical`, original.focusedTree],
  ])
    for (const revision of [original.candidateSha, candidateSha])
      if (git(root, ["rev-parse", `${revision}:${directory}`]) !== tree) fail("PRESERVED_EVIDENCE_CHANGED");

  // Import after the current plan/adapter modules have initialized. Rebuild the
  // original B3/E plan, never a current R14 plan with historical labels replaced.
  const { planProductExperience } = await import("./product-experience.mjs");
  const { validateR13Registry, validateR13PublishedTechnicalProof } = await import("./experience-r13.mjs");
  const registry = JSON.parse(git(root, ["show", `${original.baseSha}:testing/product-experience-exceptions.json`]));
  const record = validateR13Registry(registry);
  if (record.id !== original.exceptionId || digest(record) !== original.recordDigest) fail("ORIGINAL_RECORD_CHANGED");
  const oldPlan = planProductExperience({
    root,
    baseSha: original.baseSha,
    candidateSha: original.candidateSha,
    changedPaths: git(root, ["diff", "--name-only", "--no-renames", original.baseSha, original.candidateSha])
      .split(/\r?\n/u)
      .filter(Boolean),
    prNumber: 721,
  });
  const binding = {
    exception: oldPlan.exception,
    baseSha: oldPlan.baseSha,
    sourceDigest: oldPlan.sourceDigest,
    contractDigest: oldPlan.contractDigest,
  };
  if (
    oldPlan.baseSha !== original.baseSha ||
    oldPlan.candidateSha !== original.candidateSha ||
    oldPlan.candidateTree !== original.candidateTree ||
    oldPlan.sourceDigest !== original.sourceDigest ||
    oldPlan.contractDigest !== original.contractDigest ||
    digest(binding) !== original.bindingDigest ||
    digest(oldPlan.exception) !== original.exceptionBindingDigest
  )
    fail("ORIGINAL_PLAN_CHANGED");
  const support = await validateR13PublishedTechnicalProof({
    root,
    candidateSha: original.candidateSha,
    plan: oldPlan,
    record,
  });
  if (
    support?.status !== "PASS" ||
    support.classification !== "SUPPORTING_TECHNICAL_PROOF_NOT_QUALIFICATION" ||
    !Array.isArray(support.receipts) ||
    support.receipts.length !== 2 ||
    support.receipts[0].stage !== "original" ||
    support.receipts[1].stage !== "corrected"
  )
    fail("ORIGINAL_PROOFS_INVALID");
  return {
    status: "PASS",
    classification: "HISTORICAL_R13_SUPPORT_NOT_CURRENT_READINESS_OR_QUALIFICATION",
    originalContext: original,
    preservedAtCandidateSha: candidateSha,
    receipts: support.receipts,
    newFocusedExecutions: 0,
    currentReadiness: false,
    qualification: false,
    grantsConsumerTrial: false,
  };
}

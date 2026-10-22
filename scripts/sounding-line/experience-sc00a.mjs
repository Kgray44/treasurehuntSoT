// Narrow SC-00A preparation. An unbound installation cannot grant execution.
import { createHash } from "node:crypto";
import { SC00A_HISTORY } from "./experience-sc00a-history.mjs";
import { isCurrentAdmissionPlan } from "./experience-current-admission.mjs";
export { SC00A_HISTORY } from "./experience-sc00a-history.mjs";

export const SC00A = Object.freeze({
  id: "PE-X-SC00A-LANDMARKS-20261015",
  pullRequest: 726,
  contractId: "chronicle.creation",
  journeyId: "creation-and-inline-details",
  findingId: "SC-00A-REVIEW-A11Y-01",
  frozenReferenceSha: "d35140129eadae99f8ec0a8eb3f9ff525b50fc59",
  expiresAt: "2026-10-23T03:59:59Z",
  patchSha256: "d92ff80369604adec514ec9a1bac4393b9a3a2a80d01d42cc78529b190c57e76",
  productPath: "src/components/studio/TaleEditor.tsx",
  approvalMessageId: "01a1423c-7e0c-75e0-aea6-fedd6db3bc08",
  approvalThreadId: "01a13d74-a0fb-7421-9d2a-b7ace0f857a7",
  sourceTurnStartedAt: "2026-10-16T01:03:42Z",
  // Denial-only witnesses recognize copied SC source without depending on a
  // candidate's contracts, history, ancestry or claimed PR number.
  sourceWitnesses: [
    { path: "src/components/studio/NewTaleForm.tsx", blob: "9dc137f0f0309fa154deb36f46ac3c262557c21a" },
    { path: "src/components/studio/StudioStatusHeader.tsx", blob: "4d45e66141ddc1d8bf967c764ff2cbdbad4ed749" },
  ],
  immutableHistory: [
    { path: "Development_Docs/Projects/Chronicle_Creator/evidence/independent-review-blocked-iteration3.json" },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/sc-00a-review4-exception-20261015/exception.proposed.json",
    },
    { path: "Development_Docs/Projects/Chronicle_Creator/evidence/proposed-landmark-labels.patch" },
  ],
});

// Populated only in the later independently reviewed, protected installation.
// The actual accepted #721/#776 successor base including #781 and reconciled unpatched SC source do not
// exist yet. No environment variable, candidate record or test can fill this in.
export const SC00A_INSTALLATION = null;

export const SC00A_BUDGET = Object.freeze({
  productRepairs: 1,
  preparationPasses: 1,
  newIndependentReviews: 1,
  authenticatedReviewSubmissions: 1,
  ordinaryInvocations: 1,
  ordinaryExperienceReplayPasses: 1,
  technicalE2EInvocations: 1,
  additionalLocalInvocations: 0,
  reruns: 0,
});
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_SC00A_${code}`);
};
const sha = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
const digest = (value) => /^[a-f0-9]{64}$/u.test(value ?? "");
const states = ["EDITOR_READY", "DETAILS_SAVED"];
const names = ["Passage library", "Passage inspector"];
const nonblocking = ["MINOR_POLISH", "SUBJECTIVE_DESIGN_OPPORTUNITY", "ACCEPTED_REFERENCE_QUALITY"];

// Pure schema validation supports nonconsumer fixtures. It is not admission.
export function validateSC00ARecordShape(record) {
  if (
    record?.version !== 1 ||
    record.id !== SC00A.id ||
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    record.pullRequest !== 726 ||
    record.repository !== "Kgray44/treasurehuntSoT" ||
    record.expiresAt !== SC00A.expiresAt ||
    record.ownerApproval?.actor !== "Kgray44" ||
    record.ownerApproval.humanMessageId !== SC00A.approvalMessageId ||
    record.ownerApproval.sourceThreadId !== SC00A.approvalThreadId ||
    record.ownerApproval.sourceTurnStartedAt !== SC00A.sourceTurnStartedAt ||
    record.ownerApproval.proofClass !== "NATIVE_DIRECT_HUMAN_MESSAGE_VERIFIED" ||
    !Number.isFinite(Date.parse(record.ownerApproval.executionNotBeforeUtc)) ||
    Date.parse(record.ownerApproval.executionNotBeforeUtc) < Date.parse(SC00A.sourceTurnStartedAt) ||
    record.priorReviewIterations !== 3 ||
    record.independentProductReviewsCompleted !== 3 ||
    record.remainingIndependentReviewOrdinal !== 4 ||
    record.contexts !== 4 ||
    hash(record.contractIds) !== hash([SC00A.contractId]) ||
    hash(record.executionBudget) !== hash(SC00A_BUDGET) ||
    record.custody?.namespace !== `sounding-line-exceptions/${SC00A.id}` ||
    record.predecessor !== undefined ||
    !sha(record.reconciledBaseSha) ||
    !sha(record.frozenReferenceSha) ||
    record.frozenReferenceSha === SC00A.frozenReferenceSha ||
    !digest(record.contractDigest) ||
    !sha(record.frozenTrees?.src) ||
    !sha(record.frozenTrees?.public) ||
    !sha(record.frozenTrees?.prisma) ||
    record.repair?.patchSha256 !== SC00A.patchSha256 ||
    record.repair.path !== SC00A.productPath ||
    !sha(record.repair.beforeBlob) ||
    !sha(record.repair.afterBlob) ||
    record.repair.beforeBlob === record.repair.afterBlob ||
    !Array.isArray(record.immutableHistory) ||
    record.immutableHistory.length < 40 ||
    record.immutableHistory.some(
      (entry) => !sha(entry.blob) || !entry.path?.startsWith("Development_Docs/Projects/Chronicle_Creator/"),
    ) ||
    SC00A.immutableHistory.some((entry) => !record.immutableHistory.some((bound) => bound.path === entry.path)) ||
    !Array.isArray(record.protectedBaseRuntimeOverrides) ||
    record.protectedBaseRuntimeOverrides.some((entry) => entry.mode !== "100644" || !sha(entry.blob) || !entry.path) ||
    !record.protectedBaseRuntimeOverrides.some(
      (entry) => entry.path === SC00A.productPath && entry.blob === record.repair.afterBlob,
    ) ||
    !Array.isArray(record.allowedProtectedBasePackageScriptNames) ||
    !record.frozenBlobs ||
    hash(record.integrationPrerequisites?.map((entry) => entry.pullRequest)) !== hash([721, 776]) ||
    record.integrationPrerequisites.some((entry) => !sha(entry.mergeSha) || entry.landedVerification !== "PASS") ||
    record.governancePrerequisite?.pullRequest !== 781 ||
    !sha(record.governancePrerequisite.mergeSha) ||
    record.governancePrerequisite.landedVerification !== "PASS" ||
    hash(record.registryPredecessor) !== hash(SC00A_HISTORY.predecessorRegistry) ||
    record.historicalReview2?.sourceRevision !== SC00A_HISTORY.historicalReview2.sourceRevision ||
    record.historicalReview2.blob !== SC00A_HISTORY.historicalReview2.blob ||
    record.historicalReview2.sha256 !== SC00A_HISTORY.historicalReview2.sha256 ||
    !record.historicalReview2.path?.startsWith("Development_Docs/Projects/Chronicle_Creator/evidence/") ||
    !exactSC00AHistory(record)
  )
    fail("RECORD_INVALID");
}

function exactSC00AHistory(record) {
  const required = [
    ...SC00A_HISTORY.archive,
    ...SC00A_HISTORY.stableWitnesses,
    SC00A_HISTORY.preservationManifest,
    record.historicalReview2,
  ];
  return (
    Array.isArray(record.immutableHistory) &&
    record.immutableHistory.length === required.length &&
    new Set(record.immutableHistory.map((entry) => entry.path)).size === required.length &&
    required.every((expected) =>
      record.immutableHistory.some(
        (entry) => entry.path === expected.path && entry.blob === expected.blob && entry.sha256 === expected.sha256,
      ),
    )
  );
}

// Pure held-record constructor: no Git, API, files, registry or compiled-installation writes.
// Exact actual prerequisite/reconciled source identities must be supplied later.
export function prepareSC00ARecord(bindings) {
  const {
    executionNotBeforeUtc,
    reconciledBaseSha,
    frozenReferenceSha,
    contractDigest,
    frozenTrees,
    frozenBlobs,
    beforeBlob,
    afterBlob,
    integrationPrerequisites,
    governancePrerequisite,
    historicalReview2ArchivePath,
    protectedBaseRuntimeOverrides = [],
    allowedProtectedBasePackageScriptNames = [],
  } = bindings;
  const historicalReview2 = { path: historicalReview2ArchivePath, ...SC00A_HISTORY.historicalReview2 };
  const record = {
    version: 1,
    id: SC00A.id,
    status: "ACTIVE",
    pullRequest: 726,
    repository: "Kgray44/treasurehuntSoT",
    expiresAt: SC00A.expiresAt,
    ownerApproval: {
      actor: "Kgray44",
      humanMessageId: SC00A.approvalMessageId,
      sourceThreadId: SC00A.approvalThreadId,
      sourceTurnStartedAt: SC00A.sourceTurnStartedAt,
      proofClass: "NATIVE_DIRECT_HUMAN_MESSAGE_VERIFIED",
      executionNotBeforeUtc,
    },
    priorReviewIterations: 3,
    independentProductReviewsCompleted: 3,
    remainingIndependentReviewOrdinal: 4,
    contexts: 4,
    contractIds: [SC00A.contractId],
    executionBudget: { ...SC00A_BUDGET },
    custody: { namespace: `sounding-line-exceptions/${SC00A.id}` },
    reconciledBaseSha,
    frozenReferenceSha,
    contractDigest,
    frozenTrees,
    frozenBlobs,
    repair: { patchSha256: SC00A.patchSha256, path: SC00A.productPath, beforeBlob, afterBlob },
    immutableHistory: [
      ...SC00A_HISTORY.archive,
      ...SC00A_HISTORY.stableWitnesses,
      SC00A_HISTORY.preservationManifest,
      historicalReview2,
    ].map((entry) => ({ ...entry })),
    registryPredecessor: { ...SC00A_HISTORY.predecessorRegistry },
    historicalReview2,
    integrationPrerequisites,
    governancePrerequisite,
    protectedBaseRuntimeOverrides: [
      ...protectedBaseRuntimeOverrides,
      { path: SC00A.productPath, mode: "100644", blob: afterBlob },
    ],
    allowedProtectedBasePackageScriptNames,
  };
  validateSC00ARecordShape(record);
  return structuredClone(record);
}

export function validateSC00ARecord(record, now = new Date()) {
  if (!SC00A_INSTALLATION) fail("INSTALLATION_UNBOUND");
  validateSC00ARecordShape(record);
  if (hash({ ...record, status: "ACTIVE" }) !== SC00A_INSTALLATION.recordDigest) fail("RECORD_CHANGED");
  if (!Number.isFinite(now.getTime())) fail("INVALID_CLOCK");
  if (now.getTime() < Date.parse(record.ownerApproval.executionNotBeforeUtc)) fail("BEFORE_APPROVAL");
  if (now.getTime() >= Date.parse(SC00A.expiresAt)) fail("EXPIRED");
}

export function sc00aRecordBinding(record) {
  return {
    id: record.id,
    version: record.version,
    recordDigest: hash(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorReviewIterations: 3,
    independentReviewOrdinal: 4,
  };
}

export function validateSC00APlan(plan, record) {
  const contract = plan.contracts?.[0];
  const experience = contract?.experience;
  if (
    !plan.applicable ||
    plan.paired ||
    plan.pairedOnly ||
    plan.localProof ||
    hash(plan.contractIds) !== hash([SC00A.contractId]) ||
    plan.contracts?.length !== 1 ||
    contract.id !== SC00A.contractId ||
    !experience ||
    plan.contractDigest !== record.contractDigest ||
    hash([...experience.devices].sort()) !== hash(["DESKTOP", "MOBILE"]) ||
    !experience.motion ||
    experience.journeys?.length !== 1 ||
    experience.journeys[0].id !== SC00A.journeyId ||
    hash(experience.journeys[0].roles) !== hash(["CREATOR"]) ||
    states.some((state) => !experience.journeys[0].steps.some((step) => step.state === state))
  )
    fail("PLAN_SCOPE_CHANGED");
}

// Validate the raw rule outcome, including whether axe actually ran the rule.
export function validateSC00ALandmarkObservation(proof) {
  if (
    proof?.version !== 1 ||
    hash(proof.landmarks?.map((entry) => entry.name)) !== hash(names) ||
    proof.landmarks.some((entry) => entry.role !== "complementary" || entry.count !== 1 || entry.visible !== true) ||
    proof.audit?.testEngine?.name !== "axe-core" ||
    !proof.audit.testEngine.version ||
    !Array.isArray(proof.audit.passes) ||
    proof.audit.passes.filter((entry) => entry.id === "landmark-unique").length !== 1 ||
    names.some(
      (name) =>
        !proof.audit.passes
          .find((entry) => entry.id === "landmark-unique")
          ?.nodes?.some((node) => node.html?.includes(`aria-label="${name}"`)),
    ) ||
    ["violations", "incomplete", "inapplicable"].some(
      (key) => !Array.isArray(proof.audit[key]) || proof.audit[key].some((entry) => entry.id === "landmark-unique"),
    )
  )
    fail("LANDMARK_PROOF_INVALID");
}

export async function observeSC00ALandmarks({ plan, contractId, device, state, page, AxeBuilder }) {
  if (
    plan.exception?.id !== SC00A.id ||
    contractId !== SC00A.contractId ||
    device !== "DESKTOP" ||
    !states.includes(state)
  )
    return null;
  const landmarks = [];
  for (const name of names) {
    const target = page.getByRole("complementary", { name, exact: true });
    const count = await target.count();
    landmarks.push({ role: "complementary", name, count, visible: count === 1 && (await target.isVisible()) });
  }
  const proof = {
    version: 1,
    landmarks,
    audit: await new AxeBuilder({ page }).withRules(["landmark-unique"]).analyze(),
  };
  validateSC00ALandmarkObservation(proof);
  return proof;
}

// Existing journey attestation and capture/review seals cover every byte here.
export function sc00aReviewProof(plan, evidence, contractId) {
  if (plan.exception?.id !== SC00A.id || contractId !== SC00A.contractId) return {};
  return {
    landmarkJourneys: evidence.journeys.filter(
      (entry) => entry.contractId === contractId && entry.device === "DESKTOP",
    ),
  };
}

export function validateSC00AEvidence(plan, evidence, automatedOnly = false) {
  if (
    plan.exception?.id !== SC00A.id ||
    plan.exception.priorReviewIterations !== 3 ||
    plan.exception.independentReviewOrdinal !== 4 ||
    hash(plan.contractIds) !== hash([SC00A.contractId])
  )
    fail("HISTORY_OR_SCOPE_CHANGED");
  const requiredEvidence = [];
  for (const motionMode of ["NORMAL", "REDUCED"]) {
    const journeys = evidence.journeys?.filter(
      (entry) =>
        entry.contractId === SC00A.contractId &&
        entry.id === SC00A.journeyId &&
        entry.device === "DESKTOP" &&
        entry.role === "CREATOR" &&
        entry.motionMode === motionMode,
    );
    if (journeys?.length !== 1) fail("LANDMARK_CONTEXT_MISSING");
    for (const state of states) {
      const observations = journeys[0].accessibility?.states?.filter((entry) => entry.state === state);
      if (observations?.length !== 1) fail("LANDMARK_STATE_MISSING");
      validateSC00ALandmarkObservation(observations[0].sc00aLandmarks);
      const artifacts = evidence.artifacts?.filter(
        (entry) =>
          entry.contractId === SC00A.contractId &&
          entry.type === "screenshot" &&
          entry.state === state &&
          entry.device === "DESKTOP" &&
          entry.role === "CREATOR" &&
          entry.motionMode === motionMode &&
          entry.origin === "ACTUAL_APPLICATION",
      );
      if (artifacts?.length !== 1) fail("LANDMARK_ARTIFACT_MISSING");
      requiredEvidence.push(artifacts[0].id);
    }
  }
  if (automatedOnly) return;
  if (evidence.reviews?.length !== 1) fail("ONE_REVIEW4_SCOPE_REQUIRED");
  const review = evidence.reviews[0];
  if (review.contractId !== SC00A.contractId || review.iterations !== 4 || review.independentReviewOrdinal !== 4)
    fail("HISTORY_OR_REVIEW_ORDINAL_CHANGED");
  const original = review.findings?.filter((entry) => entry.id === SC00A.findingId);
  if (
    original?.length !== 1 ||
    original[0].classification !== "ACCESSIBILITY_DEFECT" ||
    original[0].disposition !== "RESOLVED" ||
    requiredEvidence.some((id) => !original[0].repairEvidenceIds?.includes(id))
  )
    fail("ORIGINAL_FINDING_NOT_RESOLVED");
  if (
    review.findings.some(
      (entry) =>
        !nonblocking.includes(entry.classification) &&
        (entry.id !== SC00A.findingId || entry.disposition !== "RESOLVED"),
    )
  )
    fail("NEW_BLOCKING_FINDING");
}

// Authenticated unpaginated compare response; GitHub returns the actual head last
// even when the intervening list is capped. No tree-only absence proves ancestry.
export function validateSC00AAncestryComparison(candidate, comparison) {
  const c = comparison,
    base = SC00A.frozenReferenceSha,
    merge = c?.merge_base_commit?.sha;
  if (
    !sha(candidate) ||
    c?.base_commit?.sha !== base ||
    !sha(merge) ||
    !Number.isSafeInteger(c.ahead_by) ||
    c.ahead_by < 0 ||
    !Number.isSafeInteger(c.behind_by) ||
    c.behind_by < 0 ||
    !Array.isArray(c.commits) ||
    c.commits.length > 250
  )
    fail("HISTORY_CANDIDATE_UNVERIFIABLE");
  const head = c.commits.at(-1)?.sha;
  if (
    c.status === "identical" &&
    candidate === base &&
    merge === base &&
    c.ahead_by === 0 &&
    c.behind_by === 0 &&
    c.commits.length === 0
  )
    return true;
  if (
    c.status === "ahead" &&
    merge === base &&
    candidate !== base &&
    c.ahead_by > 0 &&
    c.behind_by === 0 &&
    head === candidate
  )
    return true;
  if (
    c.status === "behind" &&
    merge === candidate &&
    candidate !== base &&
    c.ahead_by === 0 &&
    c.behind_by > 0 &&
    c.commits.length === 0
  )
    return false;
  if (
    c.status === "diverged" &&
    merge !== base &&
    merge !== candidate &&
    c.ahead_by > 0 &&
    c.behind_by > 0 &&
    head === candidate
  )
    return false;
  fail("HISTORY_CANDIDATE_UNVERIFIABLE");
}

export function reviewIterationsAllowed(plan, iterations) {
  if (!Number.isInteger(iterations)) return false;
  if (!plan.exception) return iterations >= 1 && iterations <= 3;
  if (plan.exception.id === SC00A.id)
    return (
      plan.contractIds?.length === 1 &&
      plan.contractIds[0] === SC00A.contractId &&
      plan.exception.independentReviewOrdinal === 4 &&
      plan.exception.priorReviewIterations === 3 &&
      iterations === 4
    );
  // The canonical exception validator separately admits only the known grants.
  if (isCurrentAdmissionPlan(plan))
    return iterations === plan.exception.currentSourceAdmission.requiredReviewIterations;
  return (
    /^PE-X-CROSSDECK-FINAL-VERIFY-20261015(?:-R(?:[2-9]|1[0-4]))?$/u.test(plan.exception.id ?? "") && iterations === 11
  );
}

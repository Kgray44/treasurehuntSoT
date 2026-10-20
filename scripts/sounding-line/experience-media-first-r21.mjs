// A finite review11 provenance guard. Existing canonical review and media gates
// still run; context/timing fields record provenance, not cryptographic identity.
import { createHash } from "node:crypto";
import { PAIRED_CASES } from "./experience-paired.mjs";
import { CURRENT_R20, R20_SCOPE } from "./experience-current-r20.mjs";
import { validateMediaFirstObservationBytes } from "./experience-media-first-shared.mjs";

export const R21_ID = "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R21";
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const R21_MEDIA_PROTOCOL = freeze({
  kind: "CROSSDECK_REVIEW11_MEDIA_FIRST_1",
  consumerOwnerContext: "01a14744-5390-77a1-8532-5c32db6980eb",
  approvedAtUtcMinute: "2026-10-20T13:26Z",
  reviewOrdinal: 11,
  requiredJudgments: 7,
  dimensionsPerContract: 17,
  genericContexts: 32,
  pairedContexts: 6,
  contexts: 38,
  pairedCaseIds: PAIRED_CASES.map((entry) => entry.id),
  excludedReviewerContexts: [
    "01a15541-acdd-7222-b4cf-419be67320ee",
    "01a13d1d-9489-73f3-94df-1122ba234d14",
    "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1",
    "01a14744-5390-77a1-8532-5c32db6980eb",
  ],
  excludedReviewerTaskPaths: ["/root/r19_blind_critic", "/root/lifecycle_review", "/root"],
  criticSelection: {
    freshContext: true,
    distinctFromAllPreviousCritics: true,
    inheritedSourceOrBuilderContext: false,
  },
  forbiddenHistoricalObservationDigests: [
    "6754094adefbbf21cb5762bd08ad6ecf652a5dc859dc258078646ce2b4aa4fa4",
    "1295e3b7fbf1f0952de3e20dce6969d36d611a9174c3c484457a391656aabcb6",
    "dfd7e727231eae86990f0129ce5ccbc92c695cd8e61f33298428452a4f999e69",
    "2a94d11bca9535653a3a3bbf55d9a1eb505e0851211f15068c62790aabcf857d",
  ],
  forbiddenHistoricalCaptureIds: [12220506702, 12207090441],
  firstPassKind: "CROSSDECK_MEDIA_FIRST_OBSERVATIONS_1",
  firstPassEncoding: "utf8-original-json",
  maximumFirstPassBytes: 1048576,
  exposureBeforeFreeze: {
    source: false,
    contracts: false,
    fixtures: false,
    historicalReports: false,
    blockerHistory: false,
  },
  historicalCaptureReuse: false,
});
const sha = (value) => createHash("sha256").update(value).digest("hex");
const ordered = (value) =>
  Array.isArray(value)
    ? value.map(ordered)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, ordered(value[key])]),
        )
      : (value ?? null);
const same = (left, right) => sha(JSON.stringify(ordered(left))) === sha(JSON.stringify(ordered(right)));
const need = (condition, code) => {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_R21_MEDIA_FIRST_${code}`);
};
const unique = (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length;
const time = (value) => (typeof value === "string" ? Date.parse(value) : NaN);

export function r21ReviewProvenanceBinding(plan, evidence) {
  if (plan.exception?.id !== R21_ID) return {};
  need(evidence?.mediaFirstReview && typeof evidence.mediaFirstReview === "object", "ORIGINAL_FIRST_PASS_REQUIRED");
  // Sort envelope keys, retaining the exact original observation text inside it.
  // A different valid first pass or chronology must require a different seal.
  return { mediaFirstReviewDigest: sha(JSON.stringify(ordered(evidence.mediaFirstReview))) };
}

export function validatePinnedMediaFirstPlan(plan, { id, version, ordinal, policy }) {
  need(
    plan?.exception?.id === id &&
      plan.exception.version === version &&
      /^[a-f0-9]{64}$/u.test(plan.exception.recordDigest ?? "") &&
      plan.exception.independentReviewOrdinal === ordinal &&
      plan.exception.currentSourceAdmission?.kind === "CROSSDECK_CURRENT_SOURCE_ADMISSION_1" &&
      same(plan.exception.currentSourceAdmission.reviewProtocol, policy) &&
      same(plan.exception.currentSourceAdmission.scopeAdjudication, R20_SCOPE) &&
      plan.sourceDigest === plan.exception.currentSourceAdmission.sourceDigest &&
      plan.contractDigest === R20_SCOPE.approvedContractDigest &&
      Array.isArray(plan.contractIds) &&
      same([...plan.contractIds].sort(), [...CURRENT_R20.contractIds].sort()) &&
      plan.contextCount === 38 &&
      plan.paired?.browserContexts === 6,
    "TRUSTED_PROTOCOL_REQUIRED",
  );
  return plan;
}
export function validatePinnedMediaFirstReview(plan, evidence, now, selection) {
  validatePinnedMediaFirstPlan(plan, selection);
  const policy = selection.policy;
  const protocol = evidence?.mediaFirstReview,
    proof = protocol?.frozenFirstPass;
  need(
    proof?.encoding === policy.firstPassEncoding && typeof proof.content === "string",
    "ORIGINAL_FIRST_PASS_REQUIRED",
  );
  const phase = validateMediaFirstObservationBytes({
    plan,
    protocol,
    policy,
    originalBytes: Buffer.from(proof.content, "utf8"),
    expectedBytes: proof.bytes,
    expectedSha256: proof.sha256,
    captureArtifactId: evidence.captureArtifactId,
    artifacts: evidence.artifacts,
    now,
  });
  const frozen = time(phase.first.observationsFrozenAt),
    source = time(protocol.sourceInspectionStartedAt),
    completed = time(protocol.canonicalJudgmentsCompletedAt);
  need(
    [source, completed].every(Number.isFinite) && frozen < source && source <= completed && completed <= now.getTime(),
    "MEDIA_BEFORE_SOURCE_CHRONOLOGY_REQUIRED",
  );
  need(
    Array.isArray(evidence.reviews) &&
      evidence.reviews.length === 7 &&
      unique(evidence.reviews.map((entry) => entry.contractId)) &&
      same(evidence.reviews.map((entry) => entry.contractId).sort(), [...plan.contractIds].sort()) &&
      evidence.reviews.every(
        (review) =>
          review.status === "ACCEPTED" &&
          review.reviewerContext === protocol.reviewerContext &&
          review.builderContext === protocol.builderContext &&
          review.independence === "SEPARATE_CONTEXT" &&
          review.sourceInspectionOrder === "EXPERIENCE_BEFORE_SOURCE",
      ),
    "SEVEN_EXPLICIT_JUDGMENTS_AND_CONTEXTS_REQUIRED",
  );
  return { reviewerContext: phase.reviewerContext, frozenFirstPassSha256: phase.frozenFirstPassSha256 };
}

export function validateR21MediaFirstReview(plan, evidence, now = new Date()) {
  return validatePinnedMediaFirstReview(plan, evidence, now, {
    id: R21_ID,
    version: 21,
    ordinal: 11,
    policy: R21_MEDIA_PROTOCOL,
  });
}

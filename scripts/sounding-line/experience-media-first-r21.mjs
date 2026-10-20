// A finite review11 provenance guard. Existing canonical review and media gates
// still run; context/timing fields record provenance, not cryptographic identity.
import { createHash } from "node:crypto";
import { PAIRED_CASES, PAIRED_CONTRACTS } from "./experience-paired.mjs";
import { CURRENT_R20, R20_SCOPE } from "./experience-current-r20.mjs";

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
const meaningful = (value) => typeof value === "string" && value.trim().length >= 12;
const unique = (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length;
const time = (value) => (typeof value === "string" ? Date.parse(value) : NaN);
const uuid = (value) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value ?? "");

export function validateR21MediaFirstReview(plan, evidence, now = new Date()) {
  need(
    plan?.exception?.id === R21_ID &&
      plan.exception.version === 21 &&
      /^[a-f0-9]{64}$/u.test(plan.exception.recordDigest ?? "") &&
      plan.exception.independentReviewOrdinal === 11 &&
      plan.exception.currentSourceAdmission?.kind === "CROSSDECK_CURRENT_SOURCE_ADMISSION_1" &&
      same(plan.exception.currentSourceAdmission.reviewProtocol, R21_MEDIA_PROTOCOL) &&
      same(plan.exception.currentSourceAdmission.scopeAdjudication, R20_SCOPE) &&
      plan.sourceDigest === plan.exception.currentSourceAdmission.sourceDigest &&
      plan.contractDigest === R20_SCOPE.approvedContractDigest &&
      Array.isArray(plan.contractIds) &&
      same([...plan.contractIds].sort(), [...CURRENT_R20.contractIds].sort()) &&
      plan.contextCount === 38 &&
      plan.paired?.browserContexts === 6,
    "TRUSTED_PROTOCOL_REQUIRED",
  );
  const protocol = evidence?.mediaFirstReview;
  need(
    protocol?.kind === R21_MEDIA_PROTOCOL.kind &&
      uuid(protocol.reviewerContext) &&
      !R21_MEDIA_PROTOCOL.excludedReviewerContexts.includes(protocol.reviewerContext) &&
      typeof protocol.reviewerTaskPath === "string" &&
      protocol.reviewerTaskPath.startsWith("/root/") &&
      !R21_MEDIA_PROTOCOL.excludedReviewerTaskPaths.includes(protocol.reviewerTaskPath) &&
      protocol.builderContext === R21_MEDIA_PROTOCOL.consumerOwnerContext &&
      protocol.criticCreation?.reviewerContext === protocol.reviewerContext &&
      protocol.criticCreation.initialHistory === "NONE" &&
      protocol.criticCreation.selectionVerifiedByContext === protocol.builderContext &&
      time(protocol.criticCreation.createdAtUtc) >= time(R21_MEDIA_PROTOCOL.approvedAtUtcMinute),
    "DISTINCT_UNEXPOSED_CRITIC_REQUIRED",
  );
  const proof = protocol.frozenFirstPass;
  need(
    proof?.encoding === R21_MEDIA_PROTOCOL.firstPassEncoding &&
      typeof proof.content === "string" &&
      proof.content.length <= R21_MEDIA_PROTOCOL.maximumFirstPassBytes &&
      Number.isSafeInteger(proof.bytes) &&
      proof.bytes > 0 &&
      proof.bytes <= R21_MEDIA_PROTOCOL.maximumFirstPassBytes &&
      /^[a-f0-9]{64}$/u.test(proof.sha256 ?? "") &&
      !R21_MEDIA_PROTOCOL.forbiddenHistoricalObservationDigests.includes(proof.sha256),
    "ORIGINAL_FIRST_PASS_REQUIRED",
  );
  const bytes = Buffer.from(proof.content, "utf8");
  need(
    bytes.toString("utf8") === proof.content && bytes.length === proof.bytes && sha(bytes) === proof.sha256,
    "FROZEN_BYTES_CHANGED",
  );
  let first;
  try {
    first = JSON.parse(bytes.toString("utf8"));
  } catch {
    need(false, "FIRST_PASS_JSON_INVALID");
  }
  need(
    first?.kind === R21_MEDIA_PROTOCOL.firstPassKind &&
      first.reviewerContext === protocol.reviewerContext &&
      first.reviewerTaskPath === protocol.reviewerTaskPath &&
      first.builderContext === protocol.builderContext &&
      same(first.criticCreation, protocol.criticCreation) &&
      first.sourceDigest === plan.sourceDigest &&
      first.contractDigest === plan.contractDigest &&
      Number.isSafeInteger(evidence.captureArtifactId) &&
      evidence.captureArtifactId > 0 &&
      !R21_MEDIA_PROTOCOL.forbiddenHistoricalCaptureIds.includes(evidence.captureArtifactId) &&
      first.captureArtifactId === evidence.captureArtifactId &&
      same(first.exposureBeforeFreeze, R21_MEDIA_PROTOCOL.exposureBeforeFreeze) &&
      same(first.criticSelection, R21_MEDIA_PROTOCOL.criticSelection) &&
      first.genericContexts === 32 &&
      first.pairedContexts === 6 &&
      first.contexts === 38,
    "FIRST_PASS_IDENTITY_OR_EXPOSURE_CHANGED",
  );
  const started = time(first.mediaInspectionStartedAt),
    frozen = time(first.observationsFrozenAt),
    source = time(protocol.sourceInspectionStartedAt),
    completed = time(protocol.canonicalJudgmentsCompletedAt);
  need(
    [started, frozen, source, completed].every(Number.isFinite) &&
      started >= time(protocol.criticCreation.createdAtUtc) &&
      started <= frozen &&
      frozen < source &&
      source <= completed &&
      completed <= now.getTime(),
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
  need(
    Array.isArray(first.contractObservations) &&
      first.contractObservations.length === 7 &&
      unique(first.contractObservations.map((entry) => entry.contractId)) &&
      same(first.contractObservations.map((entry) => entry.contractId).sort(), [...plan.contractIds].sort()),
    "FIRST_PASS_CONTRACT_SCOPE_CHANGED",
  );
  need(Array.isArray(evidence.artifacts), "CURRENT_MEDIA_OBSERVATIONS_REQUIRED");
  const artifacts = new Map(evidence.artifacts.map((artifact) => [artifact.id, artifact]));
  const checkObservation = (observation, accepts) => {
    need(
      meaningful(observation?.observation) &&
        unique(observation.evidenceIds) &&
        observation.evidenceIds.every((id) => artifacts.has(id) && accepts(artifacts.get(id))),
      "CURRENT_MEDIA_OBSERVATIONS_REQUIRED",
    );
  };
  const observedMedia = (ids) => {
    const types = new Set(ids.map((id) => artifacts.get(id).type));
    need(types.has("screenshot") && (types.has("recording") || types.has("trace")), "TRANSITION_MEDIA_REQUIRED");
  };
  for (const observation of first.contractObservations) {
    const review = evidence.reviews.find((entry) => entry.contractId === observation.contractId);
    const dimensions = Object.keys(review.dimensions ?? {});
    need(
      dimensions.length === 17 && same(Object.keys(observation.dimensions ?? {}).sort(), dimensions.sort()),
      "FIRST_PASS_DIMENSIONS_REQUIRED",
    );
    for (const dimension of dimensions)
      checkObservation(observation.dimensions[dimension], (artifact) => artifact.contractId === observation.contractId);
    observedMedia(Object.values(observation.dimensions).flatMap((dimension) => dimension.evidenceIds));
  }
  need(
    Array.isArray(first.pairedObservations) &&
      first.pairedObservations.length === 3 &&
      unique(first.pairedObservations.map((entry) => entry.caseId)) &&
      same(first.pairedObservations.map((entry) => entry.caseId).sort(), [...R21_MEDIA_PROTOCOL.pairedCaseIds].sort()),
    "FIRST_PASS_PAIRED_SCOPE_CHANGED",
  );
  for (const paired of first.pairedObservations) {
    need(same(Object.keys(paired.contexts ?? {}).sort(), ["DESKTOP", "MOBILE"]), "PAIRED_CONTEXTS_REQUIRED");
    for (const device of ["DESKTOP", "MOBILE"]) {
      checkObservation(
        paired.contexts[device],
        (artifact) =>
          PAIRED_CONTRACTS.includes(artifact.contractId) &&
          artifact.device === device &&
          artifact.state === `PAIRED_${paired.caseId}`,
      );
      observedMedia(paired.contexts[device].evidenceIds);
    }
  }
  return { reviewerContext: protocol.reviewerContext, frozenFirstPassSha256: proof.sha256 };
}

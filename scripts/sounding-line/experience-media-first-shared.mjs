// First-pass admission has no dependency on later source inspection or judgments.
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { PAIRED_CASES, PAIRED_CONTRACTS } from "./experience-paired.mjs";
import { REVIEW_DIMENSIONS } from "./experience-review-dimensions.mjs";

export const mediaFirstSha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
export const mediaFirstDigest = (value) => mediaFirstSha256(JSON.stringify(ordered(value)));
const same = (left, right) => mediaFirstDigest(left) === mediaFirstDigest(right);
const unique = (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length;
const meaningful = (value) => typeof value === "string" && value.trim().length >= 12;
const time = (value) => (typeof value === "string" ? Date.parse(value) : NaN);
const uuid = (value) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value ?? "");
export function mediaFirstNeed(condition, code) {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_R21_MEDIA_FIRST_${code}`);
}

export function validateMediaFirstObservationBytes({
  plan,
  protocol,
  policy,
  originalBytes,
  expectedBytes,
  expectedSha256,
  captureArtifactId,
  artifacts,
  now = new Date(),
}) {
  const need = mediaFirstNeed;
  need(
    protocol?.kind === policy.kind &&
      uuid(protocol.reviewerContext) &&
      !policy.excludedReviewerContexts.includes(protocol.reviewerContext) &&
      typeof protocol.reviewerTaskPath === "string" &&
      protocol.reviewerTaskPath.startsWith("/root/") &&
      !policy.excludedReviewerTaskPaths.includes(protocol.reviewerTaskPath) &&
      protocol.builderContext === policy.consumerOwnerContext &&
      protocol.criticCreation?.reviewerContext === protocol.reviewerContext &&
      protocol.criticCreation.initialHistory === "NONE" &&
      protocol.criticCreation.selectionVerifiedByContext === protocol.builderContext &&
      time(protocol.criticCreation.createdAtUtc) >= time(policy.approvedAtUtcMinute),
    "DISTINCT_UNEXPOSED_CRITIC_REQUIRED",
  );
  need(
    Buffer.isBuffer(originalBytes) &&
      Number.isSafeInteger(expectedBytes) &&
      expectedBytes > 0 &&
      expectedBytes <= policy.maximumFirstPassBytes &&
      /^[a-f0-9]{64}$/u.test(expectedSha256 ?? "") &&
      !policy.forbiddenHistoricalObservationDigests.includes(expectedSha256),
    "ORIGINAL_FIRST_PASS_REQUIRED",
  );
  need(
    originalBytes.length === expectedBytes && mediaFirstSha256(originalBytes) === expectedSha256,
    "FROZEN_BYTES_CHANGED",
  );
  let text, first;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(originalBytes);
  } catch {
    need(false, "FIRST_PASS_UTF8_INVALID");
  }
  need(Buffer.from(text, "utf8").equals(originalBytes), "FROZEN_BYTES_CHANGED");
  try {
    first = JSON.parse(text);
  } catch {
    need(false, "FIRST_PASS_JSON_INVALID");
  }
  need(
    first?.kind === policy.firstPassKind &&
      first.reviewerContext === protocol.reviewerContext &&
      first.reviewerTaskPath === protocol.reviewerTaskPath &&
      first.builderContext === protocol.builderContext &&
      same(first.criticCreation, protocol.criticCreation) &&
      first.sourceDigest === plan.sourceDigest &&
      first.contractDigest === plan.contractDigest &&
      Number.isSafeInteger(captureArtifactId) &&
      captureArtifactId > 0 &&
      !policy.forbiddenHistoricalCaptureIds.includes(captureArtifactId) &&
      first.captureArtifactId === captureArtifactId &&
      same(first.exposureBeforeFreeze, policy.exposureBeforeFreeze) &&
      same(first.criticSelection, policy.criticSelection) &&
      first.genericContexts === 32 &&
      first.pairedContexts === 6 &&
      first.contexts === 38,
    "FIRST_PASS_IDENTITY_OR_EXPOSURE_CHANGED",
  );
  const started = time(first.mediaInspectionStartedAt),
    frozen = time(first.observationsFrozenAt);
  need(
    [started, frozen].every(Number.isFinite) &&
      started >= time(protocol.criticCreation.createdAtUtc) &&
      started <= frozen &&
      frozen <= now.getTime(),
    "MEDIA_BEFORE_SOURCE_CHRONOLOGY_REQUIRED",
  );
  need(
    Array.isArray(first.contractObservations) &&
      first.contractObservations.length === 7 &&
      unique(first.contractObservations.map((entry) => entry.contractId)) &&
      same(first.contractObservations.map((entry) => entry.contractId).sort(), [...plan.contractIds].sort()),
    "FIRST_PASS_CONTRACT_SCOPE_CHANGED",
  );
  need(
    Array.isArray(artifacts) && artifacts.length > 0 && unique(artifacts.map((entry) => entry.id)),
    "CURRENT_MEDIA_OBSERVATIONS_REQUIRED",
  );
  const media = new Map(artifacts.map((entry) => [entry.id, entry]));
  const observation = (value, accepts) =>
    need(
      meaningful(value?.observation) &&
        unique(value.evidenceIds) &&
        value.evidenceIds.every((id) => typeof id === "string" && media.has(id) && accepts(media.get(id))),
      "CURRENT_MEDIA_OBSERVATIONS_REQUIRED",
    );
  const transitions = (ids) => {
    const types = new Set(ids.map((id) => media.get(id).type));
    need(types.has("screenshot") && (types.has("recording") || types.has("trace")), "TRANSITION_MEDIA_REQUIRED");
  };
  for (const contract of first.contractObservations) {
    need(
      same(Object.keys(contract.dimensions ?? {}).sort(), [...REVIEW_DIMENSIONS].sort()),
      "FIRST_PASS_DIMENSIONS_REQUIRED",
    );
    for (const dimension of REVIEW_DIMENSIONS)
      observation(contract.dimensions[dimension], (item) => item.contractId === contract.contractId);
    transitions(REVIEW_DIMENSIONS.flatMap((dimension) => contract.dimensions[dimension].evidenceIds));
  }
  need(
    Array.isArray(first.pairedObservations) &&
      first.pairedObservations.length === 3 &&
      unique(first.pairedObservations.map((entry) => entry.caseId)) &&
      same(first.pairedObservations.map((entry) => entry.caseId).sort(), PAIRED_CASES.map((entry) => entry.id).sort()),
    "FIRST_PASS_PAIRED_SCOPE_CHANGED",
  );
  for (const paired of first.pairedObservations) {
    need(same(Object.keys(paired.contexts ?? {}).sort(), ["DESKTOP", "MOBILE"]), "PAIRED_CONTEXTS_REQUIRED");
    for (const device of ["DESKTOP", "MOBILE"]) {
      observation(
        paired.contexts[device],
        (item) =>
          PAIRED_CONTRACTS.includes(item.contractId) &&
          item.device === device &&
          item.state === `PAIRED_${paired.caseId}`,
      );
      transitions(paired.contexts[device].evidenceIds);
    }
  }
  return { first, reviewerContext: protocol.reviewerContext, frozenFirstPassSha256: expectedSha256 };
}

import {
  calibrationLayout,
  isCurrentCalibration,
  isCurrentReachBinding,
  isRelativeImageFeatureVector,
  REACH_RELATIVE_MAPPING,
  sampleEvidencePolicy,
  validateCalibration,
  type Calibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "@/reach/calibration";
import { sampleWindowCapacity } from "@/reach/sample-window";

/** Research input provenance supplied by the canonical evidence owner, not an identity certificate. */
export type CalibrationEpochDomain = {
  epochKey: string;
  binding: CalibrationBinding;
  frameWidth: number;
  frameHeight: number;
};
export type EpochCheckEvidence = {
  capture: number;
  pixelOrigin: number;
  collectedAt: number;
  sequence: number;
};
/** References to accepted canonical SampleWindow groups. This module never collects samples. */
export type EpochCheckGroup = CalibrationEpochDomain & {
  samples: readonly CalibrationSample[];
  evidence: readonly EpochCheckEvidence[];
};
export type RelativeEpochCompatibilityRequest = {
  calibration: Calibration;
  previousEpoch: CalibrationEpochDomain;
  previousEvidenceThroughCapture: number;
  /** Every check capture must be strictly newer than this closed-epoch cutoff. */
  epoch: CalibrationEpochDomain & { notBeforeCapture: number };
  groups: readonly EpochCheckGroup[];
  now: number;
};
type Reason =
  | "INVALID_REQUEST"
  | "RELATIVE_MAPPING_REQUIRED"
  | "FIT_EXPIRED_OR_INVALID"
  | "EPOCH_DOMAIN_MISMATCH"
  | "CHECKS_INCOMPLETE"
  | "CHECK_PROVENANCE_MISMATCH"
  | "CHECK_CLOCKS_OR_FRESHNESS_INVALID"
  | "CHECK_OUTSIDE_OLD_BOUNDS"
  | "RAW_ERROR_LIMIT_EXCEEDED"
  | "RAW_CHECKS_WITHIN_LIMIT";
export type RelativeEpochCompatibilityProposal = {
  kind: "RESEARCH_NUMERICAL_PROPOSAL";
  reason: Reason;
  rawP95DiagonalFraction: number | null;
  checkedTargetCount: number;
  checkedSampleCount: number;
};
const sourceKeys = [
  "featureProfile",
  "associationBasis",
  "providerId",
  "providerVersion",
  "inferenceBackend",
  "modelDigest",
  "providerGeneration",
  "cameraLeaseId",
  "cameraFrameVersion",
  "viewportEpoch",
  "viewportWidth",
  "viewportHeight",
  "mirror",
  "orientation",
  "trackId",
  "trackGeneration",
  "evidenceTier",
] as const;
const domainKeys = ["epochKey", "binding", "frameWidth", "frameHeight"];
const nonempty = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 512;
const finite = Number.isFinite;
const onlyKeys = (v: unknown, keys: readonly string[]) =>
  v !== null && typeof v === "object" && Object.keys(v).every((key) => keys.includes(key));
function sameBinding(a: CalibrationBinding, b: CalibrationBinding, ignoreTrack = false) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) =>
    ignoreTrack && (key === "trackId" || key === "trackGeneration")
      ? true
      : Object.hasOwn(a, key) === Object.hasOwn(b, key) &&
        a[key as keyof CalibrationBinding] === b[key as keyof CalibrationBinding],
  );
}
function validDomain(d: CalibrationEpochDomain) {
  return (
    !!d &&
    nonempty(d.epochKey) &&
    [d.frameWidth, d.frameHeight].every((n) => Number.isSafeInteger(n) && n > 1) &&
    isCurrentReachBinding(d.binding, "RELATIVE") &&
    onlyKeys(d.binding, sourceKeys) &&
    [d.binding.providerId, d.binding.modelDigest, d.binding.cameraLeaseId, d.binding.trackId].every(nonempty) &&
    [d.binding.providerGeneration, d.binding.cameraFrameVersion, d.binding.trackGeneration].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) &&
    Number.isSafeInteger(d.binding.viewportEpoch) &&
    d.binding.viewportEpoch >= 0 &&
    [d.binding.viewportWidth, d.binding.viewportHeight].every((n) => finite(n) && n > 0) &&
    typeof d.binding.mirror === "boolean" &&
    finite(d.binding.orientation)
  );
}
const proposal = (
  reason: Reason,
  checkedTargetCount = 0,
  checkedSampleCount = 0,
  rawP95DiagonalFraction: number | null = null,
): RelativeEpochCompatibilityProposal => ({
  kind: "RESEARCH_NUMERICAL_PROPOSAL",
  reason,
  rawP95DiagonalFraction,
  checkedTargetCount,
  checkedSampleCount,
});

/**
 * Tests the frozen old relative function on wholly new, source-bound raw checks.
 * Returns no Calibration, rebound binding, validation status, adoption token or interaction permission.
 * Provenance/freshness are checked claims from the canonical owner; this pure function cannot authenticate a producer.
 */
export function evaluateRelativeEpochCompatibility(
  request: RelativeEpochCompatibilityRequest,
): RelativeEpochCompatibilityProposal {
  if (!onlyKeys(request, ["calibration", "previousEpoch", "previousEvidenceThroughCapture", "epoch", "groups", "now"]))
    return proposal("INVALID_REQUEST");
  const { calibration: c, previousEpoch: old, epoch, groups, now } = request;
  if (!c || c.mapping !== REACH_RELATIVE_MAPPING || !isCurrentCalibration(c))
    return proposal("RELATIVE_MAPPING_REQUIRED");
  if (
    !finite(now) ||
    !finite(c.createdAt) ||
    !finite(c.expiresAt) ||
    c.createdAt < 0 ||
    c.expiresAt <= c.createdAt ||
    now < c.createdAt ||
    now >= c.expiresAt ||
    !Array.isArray(c.coefficients) ||
    c.coefficients.length !== 2 ||
    c.coefficients.some((row) => !Array.isArray(row) || row.length !== 5 || !row.every(finite)) ||
    c.coefficients[0][1] === 0 ||
    c.coefficients[1][2] === 0 ||
    c.coefficients[0].slice(2).some((n) => n !== 0) ||
    [c.coefficients[1][1], ...c.coefficients[1].slice(3)].some((n) => n !== 0) ||
    !Array.isArray(c.featureBounds) ||
    c.featureBounds.length !== 5 ||
    c.featureBounds.some((b) => !b || !finite(b.min) || !finite(b.max) || b.min > b.max)
  )
    return proposal("FIT_EXPIRED_OR_INVALID");
  if (
    !onlyKeys(old, domainKeys) ||
    !onlyKeys(epoch, [...domainKeys, "notBeforeCapture"]) ||
    !validDomain(old) ||
    !validDomain(epoch) ||
    old.epochKey === epoch.epochKey ||
    !sameBinding(c.binding, old.binding) ||
    !sameBinding(old.binding, epoch.binding, true) ||
    old.frameWidth !== epoch.frameWidth ||
    old.frameHeight !== epoch.frameHeight ||
    (old.binding.trackId === epoch.binding.trackId && old.binding.trackGeneration === epoch.binding.trackGeneration)
  )
    return proposal("EPOCH_DOMAIN_MISMATCH");
  if (
    !finite(request.previousEvidenceThroughCapture) ||
    request.previousEvidenceThroughCapture < 0 ||
    !finite(epoch.notBeforeCapture) ||
    epoch.notBeforeCapture < Math.max(c.createdAt, request.previousEvidenceThroughCapture) ||
    epoch.notBeforeCapture > now
  )
    return proposal("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
  if (!Array.isArray(groups) || groups.length !== calibrationLayout.validation.length)
    return proposal("CHECKS_INCOMPLETE");
  let lastCapture = epoch.notBeforeCapture,
    lastOrigin = epoch.notBeforeCapture;
  let lastCollection = epoch.notBeforeCapture,
    lastSequence = 0,
    sampleCount = 0;
  for (const group of groups) {
    if (
      !onlyKeys(group, [...domainKeys, "samples", "evidence"]) ||
      !validDomain(group) ||
      group.epochKey !== epoch.epochKey ||
      !sameBinding(group.binding, epoch.binding) ||
      group.frameWidth !== epoch.frameWidth ||
      group.frameHeight !== epoch.frameHeight
    )
      return proposal("CHECK_PROVENANCE_MISMATCH");
    if (
      !Array.isArray(group.samples) ||
      !Array.isArray(group.evidence) ||
      group.samples.length < sampleEvidencePolicy.minimumSamples ||
      group.samples.length > sampleWindowCapacity.retainedSamples ||
      group.evidence.length !== group.samples.length
    )
      return proposal("CHECKS_INCOMPLETE");
    for (let i = 0; i < group.samples.length; i++) {
      const sample = group.samples[i],
        e = group.evidence[i];
      if (!onlyKeys(sample, ["target", "features", "at", "continuitySegment"]) || !onlyKeys(sample.target, ["x", "y"]))
        return proposal("CHECKS_INCOMPLETE");
      if (
        !onlyKeys(e, ["capture", "pixelOrigin", "collectedAt", "sequence"]) ||
        ![e.capture, e.pixelOrigin, e.collectedAt, sample.at].every(finite) ||
        e.capture !== sample.at ||
        e.capture <= lastCapture ||
        e.pixelOrigin <= lastOrigin ||
        e.pixelOrigin > e.capture ||
        e.collectedAt < e.capture ||
        e.collectedAt <= lastCollection ||
        e.collectedAt > now ||
        e.collectedAt - e.pixelOrigin > 150 ||
        !Number.isSafeInteger(e.sequence) ||
        e.sequence <= lastSequence
      )
        return proposal("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
      if (!Array.isArray(sample.features) || !isRelativeImageFeatureVector(sample.features))
        return proposal("CHECKS_INCOMPLETE");
      // Strictly inside the old recorded feature bounds; no expanded bounds or new alignment is learned.
      if (
        sample.features.some(
          (value: number, j: number) => value < c.featureBounds[j].min || value > c.featureBounds[j].max,
        )
      )
        return proposal("CHECK_OUTSIDE_OLD_BOUNDS");
      lastCapture = e.capture;
      lastOrigin = e.pixelOrigin;
      lastCollection = e.collectedAt;
      lastSequence = e.sequence;
      ++sampleCount;
    }
  }
  try {
    // Canonical checker owns target uniqueness, sample stability/evidence duration and the unchanged raw3% gate.
    const checked = validateCalibration(
      c,
      groups.map((g) =>
        g.samples.map((s: CalibrationSample) => ({
          ...s,
          target: { ...s.target },
          features: [...s.features],
        })),
      ),
    );
    return proposal(
      checked.status === "VALIDATED" ? "RAW_CHECKS_WITHIN_LIMIT" : "RAW_ERROR_LIMIT_EXCEEDED",
      groups.length,
      sampleCount,
      checked.validationP95,
    );
  } catch {
    return proposal("CHECKS_INCOMPLETE");
  }
}

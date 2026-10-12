import type { Calibration } from "./calibration";
import { percentile } from "./calibration";
export function aggregateCalibrationExport(c: Calibration | null, consent: boolean) {
  if (!consent) throw new Error("REACH_EXPORT_CONSENT_REQUIRED");
  return c
    ? {
        mapping: c.mapping,
        status: c.status,
        evidenceTier: c.binding.evidenceTier,
        trainingCount: c.trainingResiduals.length,
        trainingResidualP95DiagonalFraction: percentile(c.trainingResiduals, 0.95),
        validationCount: c.validationErrors.length,
        rawValidationP95DiagonalFraction: c.validationP95,
        rawValidationJitterP95DiagonalFraction: c.validationJitterP95,
        edgeValidationP95DiagonalFraction: percentile(c.validationEdgeErrors, 0.95),
        trainingResidualMedianDiagonalFraction: percentile(c.trainingResiduals, 0.5),
        rawValidationMedianDiagonalFraction: percentile(c.validationErrors, 0.5),
        physicalQualification: "PENDING",
      }
    : null;
}

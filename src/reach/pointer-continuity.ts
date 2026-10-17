import { isRelativeCalibrationMapping, type Calibration } from "./calibration";
import type { Point } from "./coordinates";

export type LastSeenPointer = { point: Point; capturedAt: number };
/** Display memory only. Never an observation, sample, prediction or action. */
export class PointerContinuity {
  private last: (LastSeenPointer & { context: string }) | null = null;
  reset() {
    this.last = null;
  }
  observe(point: Point, capturedAt: number, context: string) {
    if (
      ![point.x, point.y, capturedAt].every(Number.isFinite) ||
      point.x < 0 ||
      point.x > 1 ||
      point.y < 0 ||
      point.y > 1
    ) {
      this.reset();
      return;
    }
    this.last = { point: { ...point }, capturedAt, context };
  }
  hold(now: number, context: string): LastSeenPointer | null {
    const last = this.last;
    if (
      !last ||
      !Number.isFinite(now) ||
      context !== last.context ||
      now < last.capturedAt ||
      now - last.capturedAt > 450
    ) {
      this.reset();
      return null;
    }
    return { point: { ...last.point }, capturedAt: last.capturedAt };
  }
}
/** Explain abstention without expanding the accepted mapping or feature bounds. */
export function outsideCalibratedRange(c: Calibration, features: number[]): boolean {
  if (features.length !== 5 || features.some((value) => !Number.isFinite(value))) return false;
  if (
    features.some(
      (value, i) =>
        (!isRelativeCalibrationMapping(c.mapping) || i < 3) &&
        (value < c.featureBounds[i].min - 0.02 || value > c.featureBounds[i].max + 0.02),
    )
  )
    return true;
  const point = c.coefficients.map((row) => row.reduce((sum, value, i) => sum + value * features[i], 0));
  return point.some((value) => value < c.supportedRegion.min || value > c.supportedRegion.max);
}

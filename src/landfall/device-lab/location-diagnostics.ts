import { z } from "zod";
import { nativeFixSchema } from "@/landfall/native-location";
import type { DeviceLabAction } from "@/landfall/device-lab/scenario";

const count = z.number().int().min(0).max(100000);
export const deviceLabLocationDiagnosticSchema = z.strictObject({
  received: count,
  invalid: count,
  stale: count,
  future: count,
  outOfBounds: count,
  insufficientAccuracy: count,
  withinRequestedBounds: count,
  canonicalObservations: count,
});

/** Categorical test diagnostics only: never serialize a native fix or its timestamp. */
export class DeviceLabLocationDiagnostics {
  private counts = {
    received: 0,
    invalid: 0,
    stale: 0,
    future: 0,
    outOfBounds: 0,
    insufficientAccuracy: 0,
    withinRequestedBounds: 0,
  };
  constructor(
    private readonly action: Extract<DeviceLabAction, { type: "LOCATION" }>,
    private readonly now = Date.now,
  ) {}
  observe(input: unknown) {
    if (this.counts.received >= 100000) return;
    this.counts.received++;
    const parsed = nativeFixSchema.safeParse(input);
    if (!parsed.success) {
      this.counts.invalid++;
      return;
    }
    const fix = parsed.data;
    const age = this.now() - fix.timestamp;
    if (age > 30000) {
      this.counts.stale++;
      return;
    }
    if (age < -1000) {
      this.counts.future++;
      return;
    }
    const coordinate = this.action.coordinate;
    if (
      coordinate.type !== "WGS84" ||
      Math.abs(fix.latitude - coordinate.latitude) >= 0.00001 ||
      Math.abs(fix.longitude - coordinate.longitude) >= 0.00001
    ) {
      this.counts.outOfBounds++;
      return;
    }
    if (fix.accuracyMeters > this.action.accuracy) {
      this.counts.insufficientAccuracy++;
      return;
    }
    this.counts.withinRequestedBounds++;
  }
  snapshot(canonicalObservations: number) {
    return deviceLabLocationDiagnosticSchema.parse({ ...this.counts, canonicalObservations });
  }
}

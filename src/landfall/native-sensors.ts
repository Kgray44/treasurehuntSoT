import { z } from "zod";
import type { ContextualEvidence } from "@/landfall/contextual";
import { landfallId } from "@/landfall/schema";

const sensorFrameSchema = z.strictObject({
  id: landfallId,
  observedAt: z.number().int().nonnegative(),
  kind: z.enum(["HEADING", "MOTION", "PRESSURE", "ORIENTATION", "ACCELEROMETER", "STEPS"]),
  values: z.array(z.number().finite().min(-100000).max(100000)).min(1).max(4),
  accuracy: z.number().finite().nonnegative().max(100000),
});
export type NativeSensorFrame = z.infer<typeof sensorFrameSchema>;

/** Bounded ephemeral context. Relative pressure height is a hint, never a calibrated floor or independent position. */
export class NativeLandfallSensorFusion {
  private readonly times = new Map<NativeSensorFrame["kind"], number>();
  private pressureReference: { value: number; at: number } | null = null;
  private steps: number | null = null;
  private lastHeading: number | null = null;
  private headingConflictUntil = 0;
  constructor(
    private readonly identity: { sessionId: string; publishedVersionId: string; worldspaceId: string },
    private readonly physical: boolean,
  ) {}
  ingest(
    input: unknown,
    now: number,
    active: boolean,
  ): {
    state: "READY" | "STALE" | "UNAVAILABLE" | "CONFLICT" | "INVALID";
    evidence: ContextualEvidence | null;
    driftBoundMeters?: number;
    floorConfirmed: false;
  } {
    const result = (
      state: "READY" | "STALE" | "UNAVAILABLE" | "CONFLICT" | "INVALID",
      evidence: ContextualEvidence | null = null,
    ) => ({ state, evidence, floorConfirmed: false as const });
    if (!this.physical || !active) {
      this.reset();
      return result("UNAVAILABLE");
    }
    const parsed = sensorFrameSchema.safeParse(input);
    if (!parsed.success || !Number.isFinite(now)) return result("INVALID");
    const frame = parsed.data;
    const previous = this.times.get(frame.kind);
    if (
      frame.observedAt > now + 1000 ||
      now - frame.observedAt > 5000 ||
      (previous !== undefined && frame.observedAt - previous < 250)
    )
      return result("STALE");
    this.times.set(frame.kind, frame.observedAt);
    const base = { id: frame.id, ...this.identity, observedAt: new Date(frame.observedAt).toISOString() };
    if (frame.kind === "HEADING" || frame.kind === "ORIENTATION") {
      const degrees = frame.values[0];
      if (degrees < 0 || degrees > 360 || frame.accuracy > 180) return result("INVALID");
      const gap = this.lastHeading === null ? 0 : Math.abs(((degrees - this.lastHeading + 540) % 360) - 180);
      this.lastHeading = degrees;
      if (gap > 120 && previous !== undefined && frame.observedAt - previous < 1000)
        this.headingConflictUntil = now + 5000;
      if (this.headingConflictUntil > now) return result("CONFLICT");
      return result("READY", { ...base, kind: "HEADING", degrees, accuracyDegrees: frame.accuracy });
    }
    if (frame.kind === "PRESSURE") {
      const pressure = frame.values[0];
      if (pressure < 300 || pressure > 1100) return result("INVALID");
      this.pressureReference ??= { value: pressure, at: frame.observedAt };
      const elapsed = (frame.observedAt - this.pressureReference.at) / 1000;
      if (elapsed > 900) {
        this.pressureReference = null;
        return result("STALE");
      }
      const relativeMeters = 44330 * (1 - (pressure / this.pressureReference.value) ** 0.190294);
      const driftBoundMeters = 5 + elapsed / 30 + frame.accuracy * 8;
      return {
        ...result("READY", { ...base, kind: "ELEVATION", meters: relativeMeters, accuracyMeters: driftBoundMeters }),
        driftBoundMeters,
      };
    }
    const moving =
      frame.kind === "STEPS"
        ? this.steps !== null && frame.values[0] > this.steps
        : frame.kind === "ACCELEROMETER"
          ? Math.abs(Math.hypot(...frame.values.slice(0, 3)) - 9.80665) > 1.5
          : frame.values[0] > 0;
    if (frame.kind === "STEPS") this.steps = frame.values[0];
    return result("READY", { ...base, kind: "MOTION", moving });
  }
  reset() {
    this.times.clear();
    this.pressureReference = null;
    this.steps = null;
    this.lastHeading = null;
    this.headingConflictUntil = 0;
  }
}

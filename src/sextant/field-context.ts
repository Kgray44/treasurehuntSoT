import { z } from "zod";
import { observationSchema, type Observation } from "./contracts";

const finite = z.number().finite();
export const magneticContextSchema = z.strictObject({
  magnitudeMicrotesla: finite.nonnegative().max(2000),
  deltaMicrotesla: finite.nonnegative().max(2000).nullable(),
  baselineAgeMs: finite.nonnegative().nullable(),
  trend: z.enum(["UNKNOWN", "STABLE", "APPROACHING", "RECEDING"]),
  state: z.enum(["CALIBRATING", "READY", "UNUSABLE"]),
});
export const elevationContextSchema = z.strictObject({
  deltaMeters: finite.min(-200).max(200).nullable(),
  pressureHpa: finite.min(300).max(1100),
  baselineAgeMs: finite.nonnegative().nullable(),
  state: z.enum(["CALIBRATING", "READY", "REVALIDATE"]),
  environmentalWarning: z.enum(["UNKNOWN", "WEATHER_OR_BUILDING_DRIFT", "NONE_OBSERVED"]),
});
export const stepEvidenceSchema = z
  .strictObject({
    stepDelta: z.number().int().min(0).max(10000),
    cadenceClass: z.enum(["UNKNOWN", "SLOW", "MODERATE", "FAST"]),
    method: z.enum(["OS_PEDOMETER", "ACCESSORY_PEDOMETER"]),
    approximateDistanceMeters: finite.nonnegative().max(10000).optional(),
    distanceUncertaintyMeters: finite.nonnegative().max(10000).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.approximateDistanceMeters === undefined) !== (v.distanceUncertaintyMeters === undefined))
      ctx.addIssue({ code: "custom", message: "SEXTANT_DISTANCE_UNCERTAINTY_REQUIRED" });
  });
type Identity = Pick<Observation, "provenanceRoot" | "providerIdDiagnostic" | "referenceFrame">;
/** No baseline survives stale input, provider generation, gap or quality loss. */
class FieldContinuity {
  private previous: (Identity & { at: number; sequence: number }) | null = null;
  inspect(o: Observation, id: string, now: number, frame: string) {
    observationSchema.parse(o);
    const age = now - o.timestampMonotonic;
    const good =
      o.capabilityId === id &&
      o.units === (id.includes("pressure") ? "hPa" : "microtesla") &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 1000 &&
      ["MEDIUM", "HIGH"].includes(o.qualityClass) &&
      o.calibrationState === "GOOD" &&
      o.referenceFrame === frame &&
      o.lifecycleState !== "SUSPENDED";
    const p = this.previous;
    const reset =
      !good ||
      o.discontinuity ||
      !p ||
      p.provenanceRoot !== o.provenanceRoot ||
      p.providerIdDiagnostic !== o.providerIdDiagnostic ||
      p.referenceFrame !== o.referenceFrame ||
      o.sequence <= p.sequence ||
      o.timestampMonotonic <= p.at ||
      o.timestampMonotonic - p.at > 1500;
    this.previous = good ? { ...o, at: o.timestampMonotonic } : null;
    return { good, reset };
  }
  reset() {
    this.previous = null;
  }
}
export const magneticSafetyCopy =
  "Use a known weak, enclosed prop at a conservative distance. Never place strong magnets against cameras or sensitive hardware. Stop on interference and use the screen alternative. This measures local field changes; it does not identify metal or a particular object.";

/** Version 1 local magnitude baseline/trend. These thresholds are a reference recipe, not physical certification. */
export class MagneticFieldContext {
  private continuity = new FieldContinuity();
  private samples: number[] = [];
  private started = 0;
  private baseline: number | null = null;
  private previousDeltas: number[] = [];
  reset() {
    this.continuity.reset();
    this.clear();
  }
  private clear() {
    this.samples = [];
    this.baseline = null;
    this.previousDeltas = [];
    this.started = 0;
  }
  accept(o: Observation, now: number): z.infer<typeof magneticContextSchema> {
    const vector = z
      .strictObject({ x: finite.min(-2000).max(2000), y: finite.min(-2000).max(2000), z: finite.min(-2000).max(2000) })
      .parse(o.value);
    const magnitude = Math.hypot(vector.x, vector.y, vector.z);
    const continuity = this.continuity.inspect(o, "sextant.magnetic.field", now, "DEVICE");
    if (continuity.reset) this.clear();
    if (!continuity.good || magnitude > 200 || magnitude < 5) {
      this.reset();
      return {
        magnitudeMicrotesla: Math.min(2000, magnitude),
        deltaMicrotesla: null,
        baselineAgeMs: null,
        trend: "UNKNOWN" as const,
        state: "UNUSABLE" as const,
      };
    }
    if (!this.samples.length) this.started = o.timestampMonotonic;
    if (now - this.started > 60000) {
      this.reset();
      return this.accept({ ...o, discontinuity: true }, now);
    }
    if (this.baseline === null) {
      this.samples.push(magnitude);
      if (this.samples.length > 20) this.samples.shift();
      if (this.samples.length >= 5 && o.timestampMonotonic - this.started >= 800) {
        if (Math.max(...this.samples) - Math.min(...this.samples) > 5) this.clear();
        else this.baseline = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      }
    }
    const delta = this.baseline === null ? null : Math.abs(magnitude - this.baseline);
    if (delta !== null) {
      this.previousDeltas.push(delta);
      if (this.previousDeltas.length > 5) this.previousDeltas.shift();
    }
    const ds = this.previousDeltas;
    const trend =
      ds.length < 3
        ? "UNKNOWN"
        : ds.at(-1)! - ds[0] > 3
          ? "APPROACHING"
          : ds.at(-1)! - ds[0] < -3
            ? "RECEDING"
            : "STABLE";
    return magneticContextSchema.parse({
      magnitudeMicrotesla: magnitude,
      deltaMicrotesla: delta,
      baselineAgeMs: this.baseline === null ? null : now - this.started,
      trend,
      state: this.baseline === null ? "CALIBRATING" : "READY",
    });
  }
}
export class RelativeElevationContext {
  private continuity = new FieldContinuity();
  private samples: number[] = [];
  private started = 0;
  private baseline: number | null = null;
  reset() {
    this.continuity.reset();
    this.samples = [];
    this.baseline = null;
    this.started = 0;
  }
  accept(o: Observation, now: number) {
    const pressure = finite.min(300).max(1100).parse(o.value);
    const c = this.continuity.inspect(o, "sextant.pressure.observation", now, "NONE");
    if (c.reset) {
      this.samples = [];
      this.baseline = null;
      this.started = o.timestampMonotonic;
    }
    const age = now - this.started;
    if (!c.good || age > 120000) {
      this.reset();
      return elevationContextSchema.parse({
        deltaMeters: null,
        pressureHpa: pressure,
        baselineAgeMs: null,
        state: "REVALIDATE",
        environmentalWarning: "WEATHER_OR_BUILDING_DRIFT",
      });
    }
    if (this.baseline === null) {
      this.samples.push(pressure);
      if (this.samples.length > 10) this.samples.shift();
      if (this.samples.length >= 5 && age >= 800) {
        if (Math.max(...this.samples) - Math.min(...this.samples) > 0.2) {
          this.samples = [];
          this.started = o.timestampMonotonic;
        } else this.baseline = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      }
    }
    const delta = this.baseline === null ? null : 44330 * (1 - Math.pow(pressure / this.baseline, 0.1903));
    if (delta !== null && Math.abs(delta) > 200) {
      this.reset();
      return elevationContextSchema.parse({
        deltaMeters: null,
        pressureHpa: pressure,
        baselineAgeMs: null,
        state: "REVALIDATE",
        environmentalWarning: "WEATHER_OR_BUILDING_DRIFT",
      });
    }
    return elevationContextSchema.parse({
      deltaMeters: delta === null ? null : Math.round(delta * 10) / 10,
      pressureHpa: pressure,
      baselineAgeMs: this.baseline === null ? null : age,
      state: this.baseline === null ? "CALIBRATING" : "READY",
      environmentalWarning: "UNKNOWN",
    });
  }
}
/** OS/accessory counter seam, never invented from noisy browser acceleration. Pause resets origin. */
export class PedometerContext {
  private previous: { count: number; at: number; generation: string } | null = null;
  reset() {
    this.previous = null;
  }
  accept(
    input: {
      count: number;
      at: number;
      generation: string;
      method: "OS_PEDOMETER" | "ACCESSORY_PEDOMETER";
      stride?: { meters: number; uncertaintyMeters: number };
    },
    now: number,
  ) {
    const v = z
      .strictObject({
        count: z.number().int().min(0).max(10000000),
        at: finite.nonnegative(),
        generation: z.string().min(1).max(100),
        method: z.enum(["OS_PEDOMETER", "ACCESSORY_PEDOMETER"]),
        stride: z
          .strictObject({ meters: finite.min(0.1).max(3), uncertaintyMeters: finite.min(0.1).max(3) })
          .optional(),
      })
      .parse(input);
    if (now < v.at || now - v.at > 1000) {
      this.reset();
      return null;
    }
    const p = this.previous;
    if (p && v.generation === p.generation && v.at <= p.at) return null;
    const continuous = p && p.generation === v.generation && v.at - p.at <= 10000 && v.count >= p.count;
    const delta = continuous ? v.count - p.count : 0;
    this.previous = v;
    if (delta > 10000 || (continuous && delta / ((v.at - p.at) / 1000) > 5)) {
      this.reset();
      return null;
    }
    const cadence = continuous ? delta / ((v.at - p.at) / 60000) : null;
    return stepEvidenceSchema.parse({
      stepDelta: delta,
      cadenceClass: cadence === null ? "UNKNOWN" : cadence < 60 ? "SLOW" : cadence < 130 ? "MODERATE" : "FAST",
      method: v.method,
      ...(v.stride
        ? {
            approximateDistanceMeters: Math.round(delta * v.stride.meters),
            distanceUncertaintyMeters: Math.ceil(delta * v.stride.uncertaintyMeters),
          }
        : {}),
    });
  }
}
export const magneticHuntSchema = z.strictObject({
  version: z.literal(1),
  thresholdMicrotesla: finite.min(5).max(100),
  dwellMs: z.number().int().min(800).max(5000),
  timeoutMs: z.number().int().min(1000).max(30000),
  fallback: z.string().trim().min(1).max(500),
  safeProp: z.literal("WEAK_ENCLOSED_DISTANT"),
  safetyAcknowledged: z.literal(true),
});
/** Local reference mechanic emits only guidance; the consumer/One Voyage owns completion. */
export class MagneticHunt {
  private context = new MagneticFieldContext();
  private start: number | null = null;
  private dwell: number | null = null;
  private completed = false;
  readonly config: z.infer<typeof magneticHuntSchema>;
  constructor(input: unknown) {
    this.config = magneticHuntSchema.parse(input);
  }
  reset() {
    this.context.reset();
    this.start = null;
    this.dwell = null;
    this.completed = false;
  }
  accept(o: Observation, now: number) {
    this.start ??= now;
    const field = this.context.accept(o, now);
    if (o.discontinuity || field.state !== "READY") this.completed = false;
    if (now - this.start >= this.config.timeoutMs)
      return { state: "FALLBACK" as const, fallback: this.config.fallback };
    if (
      field.state !== "READY" ||
      field.deltaMicrotesla === null ||
      field.deltaMicrotesla < this.config.thresholdMicrotesla ||
      field.trend === "RECEDING"
    )
      this.dwell = null;
    else this.dwell ??= now;
    if (this.dwell !== null && now - this.dwell >= this.config.dwellMs) this.completed = true;
    return {
      state: this.completed
        ? ("REFERENCE_REACHED" as const)
        : field.state === "UNUSABLE"
          ? ("FALLBACK" as const)
          : ("SEARCHING" as const),
      fallback: this.config.fallback,
      field,
    };
  }
}

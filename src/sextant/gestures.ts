import { z } from "zod";
import { deltaDegrees, degrees, inverseQuaternion, rotateVector, type Quaternion, type Vector3 } from "./attitude";
export type Stability = "STABLE" | "MOVING" | "UNKNOWN";
/** Hysteresis plus dwell. Missing channels, stale samples or a discontinuity never prove stillness. */
export class MotionClassifier {
  private since: number | null = null;
  private last = -Infinity;
  private state: Stability = "UNKNOWN";
  reset() {
    this.since = null;
    this.last = -Infinity;
    this.state = "UNKNOWN";
  }
  update(at: number, linear: Vector3 | null, angular: Vector3 | null): Stability {
    if (!Number.isFinite(at) || at <= this.last) {
      this.reset();
      return "UNKNOWN";
    }
    if (at - this.last > 500) {
      this.since = null;
      this.state = "UNKNOWN";
    }
    this.last = at;
    if (!linear || !angular) {
      this.since = null;
      return (this.state = "UNKNOWN");
    }
    const a = Math.hypot(linear.x, linear.y, linear.z),
      w = Math.hypot(angular.x, angular.y, angular.z);
    if (a > 0.8 || w > 0.3) {
      this.since = null;
      return (this.state = "MOVING");
    }
    if (a <= 0.35 && w <= 0.12) {
      this.since ??= at;
      if (at - this.since >= 600) this.state = "STABLE";
    } else {
      this.since = null;
      if (this.state !== "STABLE") this.state = "UNKNOWN";
    }
    return this.state;
  }
}
const common = {
  fallback: z.string().trim().min(1),
  timeoutMs: z.number().finite().min(100).max(60000),
  dwellMs: z.number().finite().min(100).max(10000),
};
export const gestureConfigSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...common, kind: z.literal("HOLD_STEADY") }),
  z.strictObject({
    ...common,
    kind: z.literal("RELATIVE_TURN"),
    angleDegrees: z.number().finite().min(-180).max(180),
    toleranceDegrees: z.number().finite().min(1).max(30),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("TURN_TO_BEARING"),
    targetDegrees: z.number().finite().min(0).lt(360),
    toleranceDegrees: z.number().finite().min(1).max(30),
    northReference: z.enum(["MAGNETIC", "TRUE"]),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("ROTATION_COUNT"),
    count: z.number().int().min(1).max(5),
    direction: z.enum(["CLOCKWISE", "COUNTERCLOCKWISE"]),
    reversalToleranceDegrees: z.number().finite().min(0).max(30),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("TILT_BAND"),
    axis: z.enum(["X", "Y"]),
    minimumDegrees: z.number().finite().min(-90).max(90),
    maximumDegrees: z.number().finite().min(-90).max(90),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("SLOW_SWEEP"),
    coverageDegrees: z.number().finite().min(15).max(180),
    maxSpeedDegreesPerSecond: z.number().finite().min(5).max(90),
  }),
]);
export type GestureConfig = z.infer<typeof gestureConfigSchema>;
export type GestureInput = {
  at: number;
  attitude?: Quaternion;
  gravity?: Vector3;
  linear?: Vector3;
  angular?: Vector3;
  heading?: { degrees: number; northReference: "MAGNETIC" | "TRUE" | "UNKNOWN" };
  stability?: Stability;
  discontinuity?: boolean;
  qualified: boolean;
};
export type GestureResult = {
  state: "TRACKING" | "COMPLETED" | "UNAVAILABLE" | "RESET" | "TIMED_OUT";
  count: number;
  coverageDegrees: number;
  fallback: string;
};
/** Local ephemeral recognizer. Completion is device intent only, never an authoritative Chronicle action. */
export class DeviceGestureRecognizer {
  readonly config: GestureConfig;
  private started: number | null = null;
  private last = -Infinity;
  private dwell: number | null = null;
  private accumulated = 0;
  private reversal = 0;
  private previousRate: number | null = null;
  private minimum = 0;
  private maximum = 0;
  private completed = false;
  constructor(config: GestureConfig) {
    this.config = gestureConfigSchema.parse(config);
    if (this.config.kind === "TILT_BAND" && this.config.minimumDegrees > this.config.maximumDegrees)
      throw new Error("SEXTANT_TILT_BAND_INVALID");
  }
  reset() {
    this.started = null;
    this.last = -Infinity;
    this.dwell = null;
    this.accumulated = 0;
    this.reversal = 0;
    this.previousRate = null;
    this.minimum = 0;
    this.maximum = 0;
    this.completed = false;
  }
  private result(state: GestureResult["state"]): GestureResult {
    return {
      state,
      count: Math.floor(Math.max(0, this.accumulated) / 360),
      coverageDegrees: this.maximum - this.minimum,
      fallback: this.config.fallback,
    };
  }
  update(input: GestureInput): GestureResult {
    if (!input.qualified || !Number.isFinite(input.at)) {
      this.reset();
      return this.result("UNAVAILABLE");
    }
    if (input.discontinuity || input.at <= this.last || (this.last !== -Infinity && input.at - this.last > 500)) {
      this.reset();
      return this.result("RESET");
    }
    if (this.completed) return this.result("COMPLETED");
    this.started ??= input.at;
    if (input.at - this.started > this.config.timeoutMs) {
      this.reset();
      return this.result("TIMED_OUT");
    }
    const dt = this.last === -Infinity ? 0 : (input.at - this.last) / 1000;
    this.last = input.at;
    const c = this.config;
    let matches = false;
    if (c.kind === "HOLD_STEADY") matches = input.stability === "STABLE";
    else if (c.kind === "TURN_TO_BEARING") {
      if (!input.heading || input.heading.northReference !== c.northReference) {
        this.reset();
        return this.result("UNAVAILABLE");
      }
      matches =
        Math.abs(deltaDegrees(input.heading.degrees, c.targetDegrees)) <= c.toleranceDegrees &&
        input.stability === "STABLE";
    } else if (c.kind === "TILT_BAND") {
      if (!input.attitude) {
        this.reset();
        return this.result("UNAVAILABLE");
      }
      const vertical = rotateVector(inverseQuaternion(input.attitude), { x: 0, y: 0, z: 1 });
      const tilt = degrees(Math.asin(Math.max(-1, Math.min(1, c.axis === "X" ? vertical.y : -vertical.x))));
      matches = tilt >= c.minimumDegrees && tilt <= c.maximumDegrees && input.stability === "STABLE";
    } else {
      // Gravity-aligned gyro projection, rather than wrapped endpoint Euler differences.
      if (!input.gravity || !input.angular || !input.linear) {
        this.reset();
        return this.result("UNAVAILABLE");
      }
      const g = Math.hypot(input.gravity.x, input.gravity.y, input.gravity.z);
      const a = Math.hypot(input.linear.x, input.linear.y, input.linear.z);
      if (g < 5 || g > 15 || a > 0.8) {
        this.reset();
        return this.result("RESET");
      }
      const rate = -degrees(
        (input.angular.x * input.gravity.x + input.angular.y * input.gravity.y + input.angular.z * input.gravity.z) / g,
      );
      if (Math.abs(rate) > 240) {
        this.reset();
        return this.result("RESET");
      }
      const increment = this.previousRate === null ? 0 : ((rate + this.previousRate) / 2) * dt;
      this.previousRate = rate;
      if (c.kind === "ROTATION_COUNT") {
        const directed = increment * (c.direction === "CLOCKWISE" ? 1 : -1);
        if (directed < 0) this.reversal -= directed;
        else this.reversal = Math.max(0, this.reversal - directed);
        if (this.reversal > c.reversalToleranceDegrees) {
          this.reset();
          return this.result("RESET");
        }
        this.accumulated = Math.max(0, this.accumulated + directed);
        matches = this.accumulated >= c.count * 360;
      } else {
        this.accumulated += increment;
        if (c.kind === "RELATIVE_TURN")
          matches = Math.abs(this.accumulated - c.angleDegrees) <= c.toleranceDegrees && input.stability === "STABLE";
        else {
          if (Math.abs(rate) > c.maxSpeedDegreesPerSecond) {
            this.reset();
            return this.result("RESET");
          }
          this.minimum = Math.min(this.minimum, this.accumulated);
          this.maximum = Math.max(this.maximum, this.accumulated);
          matches = this.maximum - this.minimum >= c.coverageDegrees;
        }
      }
    }
    if (matches) {
      this.dwell ??= input.at;
      if (input.at - this.dwell >= c.dwellMs) this.completed = true;
    } else this.dwell = null;
    return this.result(this.completed ? "COMPLETED" : "TRACKING");
  }
}

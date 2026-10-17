import type { HandObservation } from "./observation";
import type { GeometryFrame } from "@/watchglass/hand-geometry";
import { indexGeometry } from "@/watchglass/index-geometry";
export const REACH_FEATURE_PROFILE = "INDEX_TIP_AXIS_V1" as const;
export const REACH_ASSOCIATION_BASIS = "INDEX_CHAIN_V1" as const;
export const REACH_RELATIVE_FEATURE_PROFILE = "INDEX_TIP_IMAGE_V1" as const;
export const REACH_RELATIVE_ASSOCIATION_BASIS = "INDEX_IMAGE_TRACK_V1" as const;
export type Point = { x: number; y: number };
export type Viewport = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  epoch: number;
};
export function imageToViewport(point: Point, viewport: Viewport, mirror: boolean): Point {
  if (
    ![point.x, point.y, ...Object.values(viewport)].every(Number.isFinite) ||
    point.x < 0 ||
    point.x > 1 ||
    point.y < 0 ||
    point.y > 1 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    viewport.scale <= 0
  )
    throw new Error("COORDINATE_INVALID");
  return {
    x: viewport.offsetX + (mirror ? 1 - point.x : point.x) * viewport.width,
    y: viewport.offsetY + point.y * viewport.height,
  };
}
/**
 * Empirical index-only camera features: observed tip plus the unit 3D index
 * chord. No palm landmark or inferred off-image joint can supply these values.
 * Relative z is monocular inference, never metric depth or a screen ray.
 * This profile requires fresh independent calibration; legacy fits are invalid.
 */
export function pointingFeatures(hand: HandObservation["hands"][number], frame?: GeometryFrame): number[] {
  const index = indexGeometry(hand, frame);
  if (!index.complete || !index.geometry || !index.tip || index.reach <= 1e-5) throw new Error("POINT_AXIS_DEGENERATE");
  return [1, index.tip.x, index.tip.y, index.axis.x / index.reach, index.axis.y / index.reach / index.aspect];
}
/** A fresh image track supplies only observed 2D position, never an invented axis. */
export function relativeIndexFeatures(point: Point): number[] {
  if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)
    throw new Error("INDEX_IMAGE_POINT_INVALID");
  return [1, point.x, point.y, 0, 0];
}
export class PointFilter {
  private point: Point | null = null;
  private raw: Point | null = null;
  private rawTime = 0;
  private time = -Infinity;
  private velocity: Point = { x: 0, y: 0 };
  private candidate: { point: Point; at: number } | null = null;
  get acceptedCaptureTime(): number | null {
    return this.raw ? this.rawTime : null;
  }
  reset() {
    this.point = null;
    this.raw = null;
    this.rawTime = 0;
    this.time = -Infinity;
    this.velocity = { x: 0, y: 0 };
    this.candidate = null;
  }
  private alpha(cutoff: number, dt: number) {
    return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  }
  private confirmsMotion(point: Point, at: number) {
    const candidate = this.candidate;
    if (!candidate || !this.raw || at - candidate.at > 150) return false;
    const first = { x: candidate.point.x - this.raw.x, y: candidate.point.y - this.raw.y };
    const next = { x: point.x - this.raw.x, y: point.y - this.raw.y };
    const firstDistance = Math.hypot(first.x, first.y),
      nextDistance = Math.hypot(next.x, next.y),
      step = Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y);
    // A repeat confirms a new hold; a coherent continuation confirms a sweep.
    // An isolated spike followed by a return never reaches this branch.
    return (
      step <= 0.025 ||
      ((first.x * next.x + first.y * next.y) / Math.max(1e-9, firstDistance * nextDistance) >= 0.85 &&
        nextDistance >= firstDistance * 0.75 &&
        nextDistance <= firstDistance * 2.5 + 0.025 &&
        step <= firstDistance * 1.5 + 0.025)
    );
  }
  /**
   * Display-only 1 Euro-style adaptive smoothing: low-pass signed velocity before
   * increasing responsiveness. https://gery.casiez.net/1euro/
   * Calibration and held-out error always use the separate raw feature stream.
   */
  update(point: Point, at: number): Point | null {
    if (![point.x, point.y, at].every(Number.isFinite) || at <= this.time) return null;
    if (!this.point || !this.raw || at - this.time > 150) {
      this.point = { ...point };
      this.raw = { ...point };
      this.rawTime = at;
      this.time = at;
      this.velocity = { x: 0, y: 0 };
      this.candidate = null;
      return { ...this.point };
    }
    const dt = (at - this.rawTime) / 1000;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    const prediction = { x: this.raw.x + this.velocity.x * dt, y: this.raw.y + this.velocity.y * dt };
    const innovation = Math.hypot(point.x - prediction.x, point.y - prediction.y);
    const unexpected = innovation > 0.05 + Math.min(0.06, speed * dt * 0.5);
    if (unexpected && !this.confirmsMotion(point, at)) {
      // Never turn a single uncertain frame into a large visual jump or a
      // velocity spike. Keep a visible point while the next frame can confirm.
      this.candidate = { point: { ...point }, at };
      this.time = at;
      return at - this.rawTime <= 150 ? { ...this.point } : null;
    }
    this.candidate = null;
    const velocityAlpha = this.alpha(1, dt);
    this.velocity = {
      x: this.velocity.x + velocityAlpha * ((point.x - this.raw.x) / dt - this.velocity.x),
      y: this.velocity.y + velocityAlpha * ((point.y - this.raw.y) / dt - this.velocity.y),
    };
    const cutoff = Math.min(12, 1.5 + 3 * Math.hypot(this.velocity.x, this.velocity.y));
    const alpha = this.alpha(cutoff, dt);
    this.point = {
      x: this.point.x + alpha * (point.x - this.point.x),
      y: this.point.y + alpha * (point.y - this.point.y),
    };
    this.raw = { ...point };
    this.rawTime = at;
    this.time = at;
    return { ...this.point };
  }
}

import type { HandObservation } from "./observation";
import { handGeometry, type GeometryFrame } from "@/watchglass/hand-geometry";
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
 * V2 empirical camera-relative index features. The complete joint chord and
 * inferred 3D palm width avoid a short 2D distal segment masquerading as curl.
 * Relative z bounds depth-facing slopes; it is never metric depth or a screen
 * intersection. Independent per-context held-out validation remains required.
 */
export function pointingFeatures(hand: HandObservation["hands"][number], frame?: GeometryFrame): number[] {
  const shape = handGeometry(hand, frame);
  const index = shape.finger(5);
  if (
    !index ||
    !hand.landmarks[17].valid ||
    shape.scale < 0.035 ||
    index.reach < shape.scale * 0.2 ||
    index.chain > shape.scale * 3.5
  )
    throw new Error("POINT_AXIS_DEGENERATE");
  const denominator = shape.scale + Math.abs(index.axis.z);
  const base = hand.landmarks[5];
  return [
    1,
    base.x,
    base.y,
    ((2 / 3) * index.axis.x) / denominator,
    ((2 / 3) * index.axis.y) / denominator / shape.aspect,
  ];
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

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
  private time = 0;
  reset() {
    this.point = null;
    this.time = 0;
  }
  update(point: Point, at: number): Point | null {
    if (![point.x, point.y, at].every(Number.isFinite) || at <= this.time) return null;
    if (!this.point || at - this.time > 150) {
      this.point = point;
      this.time = at;
      return point;
    }
    const dt = (at - this.time) / 1000;
    const distance = Math.hypot(point.x - this.point.x, point.y - this.point.y);
    if (distance > 0.35) {
      this.reset();
      return null;
    }
    const cutoff = 2 + 12 * Math.min(distance / dt, 3);
    const alpha = 1 - Math.exp(-2 * Math.PI * cutoff * dt);
    this.point = {
      x: this.point.x + alpha * (point.x - this.point.x),
      y: this.point.y + alpha * (point.y - this.point.y),
    };
    this.time = at;
    return this.point;
  }
}

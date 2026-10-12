import type { HandObservation } from "./observation";
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
/** Empirical index axis features; source remains unmirrored, z is hand-relative, never metric depth. */
export function pointingFeatures(hand: HandObservation["hands"][number]): number[] {
  const base = hand.landmarks[5],
    tip = hand.landmarks[8],
    pip = hand.landmarks[6],
    palm = hand.landmarks[17];
  const scale = Math.hypot(base.x - palm.x, base.y - palm.y);
  if (scale < 0.035 || [base, tip, pip, palm].some((p) => !p.valid)) throw new Error("POINT_AXIS_DEGENERATE");
  return [1, base.x, base.y, (tip.x - pip.x) / scale, (tip.y - pip.y) / scale];
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

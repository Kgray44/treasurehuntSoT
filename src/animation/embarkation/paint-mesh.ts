import type { ConstrainedSheet, SheetFrame } from "./cloth";
import type { PaintInsets } from "./paint-raster";

/** Add a presentation-only gutter for native shadows/soft edges. Interior
 * vertices are the solver's vertices exactly; gutter vertices extrapolate the
 * nearest boundary cell. Padding never changes the material's rest lengths,
 * dimensions, support coordinates, or integration. UVs include the captured
 * paint's transparent gutter, with the single top-down to GL conversion here. */
export class PaintMesh {
  readonly uv: Float32Array;
  readonly indices: Uint16Array;
  readonly positions: Float32Array;
  private samples: Array<{ ids: number[]; weights: number[] }> = [];
  constructor(
    readonly sheet: ConstrainedSheet,
    readonly paddingWorld: number,
    textureInsets: PaintInsets = { left: paddingWorld, right: paddingWorld, top: paddingWorld, bottom: paddingWorld },
  ) {
    const us = Array.from({ length: sheet.columns }, (_, x) => sheet.uv[x * 2]);
    const vs = Array.from({ length: sheet.rows }, (_, y) => sheet.uv[y * sheet.columns * 2 + 1]);
    const px = paddingWorld / sheet.width,
      py = paddingWorld / sheet.height;
    const xs = paddingWorld > 0 ? [-px, ...us, 1 + px] : us;
    const ys = paddingWorld > 0 ? [-py, ...vs, 1 + py] : vs;
    this.uv = new Float32Array(xs.length * ys.length * 2);
    this.positions = new Float32Array(xs.length * ys.length * 3);
    const cell = (lines: number[], value: number) => {
      const upper = lines.findIndex((v) => v > value);
      return upper < 0 ? lines.length - 2 : Math.max(0, upper - 1);
    };
    const indices: number[] = [];
    for (let y = 0; y < ys.length; y++)
      for (let x = 0; x < xs.length; x++) {
        const u = xs[x],
          v = ys[y],
          i = y * xs.length + x,
          cx = cell(us, u),
          cy = cell(vs, v);
        const a = (u - us[cx]) / (us[cx + 1] - us[cx]),
          b = (v - vs[cy]) / (vs[cy + 1] - vs[cy]);
        const base = cy * sheet.columns + cx;
        this.samples.push({
          ids: [base, base + 1, base + sheet.columns, base + sheet.columns + 1],
          weights: [(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b],
        });
        this.uv.set(
          [
            (u * sheet.width + textureInsets.left) / (sheet.width + textureInsets.left + textureInsets.right),
            1 - (v * sheet.height + textureInsets.top) / (sheet.height + textureInsets.top + textureInsets.bottom),
          ],
          i * 2,
        );
        if (x + 1 < xs.length && y + 1 < ys.length)
          indices.push(i, i + 1, i + xs.length, i + xs.length, i + 1, i + xs.length + 1);
      }
    this.indices = new Uint16Array(indices);
  }
  update(frame: SheetFrame) {
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      for (let axis = 0; axis < 3; axis++) {
        let value = 0;
        for (let j = 0; j < 4; j++) value += frame.positions[s.ids[j] * 3 + axis] * s.weights[j];
        this.positions[i * 3 + axis] = axis === 1 ? -value : value;
      }
    }
    return this.positions;
  }
}

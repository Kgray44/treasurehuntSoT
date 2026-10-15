/** Original deterministic surface artwork. Raw pixels are shared; GPU textures remain scene-owned. */
export type SurfaceFamily = "wood" | "leather" | "fabric" | "paper" | "rug" | "porcelain";
const cache = new Map<SurfaceFamily, { color: Uint8Array; normal: Uint8Array; size: number }>();
const noise = (x: number, y: number) => {
  let s = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
  s = Math.imul(s ^ (s >>> 13), 1274126177);
  return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
};
export function surfacePixels(family: SurfaceFamily) {
  const cached = cache.get(family);
  if (cached) return cached;
  const size = family === "porcelain" ? 512 : 256,
    color = new Uint8Array(size * size * 4),
    normal = new Uint8Array(size * size * 4),
    heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        n = noise(x, y);
      let value = 0.9,
        h = 0.5,
        r = 1,
        g = 1,
        b = 1;
      if (family === "wood") {
        const bend = Math.sin(v * 12) * 1.8 + Math.sin(v * 31) * 0.45;
        const grain = Math.sin(u * 230 + bend + Math.sin(u * 35 + v * 2) * 2),
          fine = Math.sin(u * 740 + bend * 3);
        value = 0.78 + 0.12 * grain + 0.035 * fine + 0.045 * n;
        h = 0.5 + grain * 0.09 + fine * 0.02;
        r = 1;
        g = 0.94;
        b = 0.86;
      } else if (family === "fabric") {
        const warp = Math.sin((x * Math.PI) / 2),
          weft = Math.sin((y * Math.PI) / 2);
        value = 0.8 + (warp + weft) * 0.045 + n * 0.07;
        h = 0.5 + (warp + weft) * 0.13;
      } else if (family === "leather") {
        const pores = Math.pow(n, 10);
        value = 0.86 + 0.08 * noise(x >> 2, y >> 2) - pores * 0.18;
        h = 0.5 + noise(x >> 1, y >> 1) * 0.15 - pores * 0.2;
      } else if (family === "paper") {
        value = 0.87 + 0.08 * n + 0.03 * Math.sin(y * 0.9 + x * 0.03);
        h = 0.5 + n * 0.06;
        r = 1;
        g = 0.98;
        b = 0.91;
      } else if (family === "porcelain") {
        const aa = 1.5 / size;
        const coverage = (distance: number, halfWidth: number) =>
          Math.max(0, Math.min(1, (halfWidth + aa - distance) / (2 * aa)));
        const fx = (((u + 1 / 12) % (1 / 6)) - 1 / 12) * 2.5,
          fy = (v - 0.5) * 1.25,
          radius = Math.hypot(fx, fy),
          angle = Math.atan2(fy, fx);
        const blossom = coverage(radius, 0.065 + 0.022 * Math.cos(angle * 5));
        const center = coverage(radius, 0.016);
        const stem = v > 0.28 && v < 0.46 ? coverage(Math.abs(fx - 0.012 * Math.sin(v * 30)), 0.004) : 0;
        const leafA = coverage(Math.hypot((fx + 0.024) * 1.4, (v - 0.34) * 2), 0.028);
        const leafB = coverage(Math.hypot((fx - 0.025) * 1.4, (v - 0.4) * 2), 0.028);
        const bands = Math.max(
          coverage(Math.abs(v - 0.16), 0.012),
          coverage(Math.abs(v - 0.74), 0.01),
          coverage(Math.abs(v - 0.13), 0.002),
          coverage(Math.abs(v - 0.77), 0.002),
        );
        const painted = Math.max(bands, blossom * (1 - center), stem, leafA, leafB);
        value = 0.92 + n * 0.02;
        r = 1 - painted * 0.87;
        g = 1 - painted * 0.7;
        b = 1 - painted * 0.35;
        h = 0.5;
      } else {
        const edge = Math.min(u, 1 - u, v, 1 - v),
          a = u - 0.5,
          c = (v - 0.5) * 1.4;
        const diamond = Math.abs(a) + Math.abs(c),
          angle = Math.atan2(c, a),
          radius = Math.hypot(a, c);
        const border = edge < 0.045 || (edge > 0.07 && edge < 0.105);
        const ornament =
          edge > 0.115 && ((Math.sin(angle * 12 + radius * 55) > 0.72 && radius < 0.39) || diamond < 0.2);
        const small = Math.sin(u * 110) * Math.sin(v * 110) > 0.65;
        r = border ? 0.74 : ornament ? 0.84 : 0.22;
        g = border ? 0.59 : ornament ? 0.66 : 0.31;
        b = border ? 0.34 : ornament ? 0.38 : 0.32;
        if (edge > 0.045 && edge < 0.07 && small) {
          r = 0.25;
          g = 0.35;
          b = 0.36;
        }
        value = 0.82 + n * 0.12 + (Math.sin((x * Math.PI) / 2) + Math.sin((y * Math.PI) / 2)) * 0.025;
        h = 0.5 + (Math.sin((x * Math.PI) / 2) + Math.sin((y * Math.PI) / 2)) * 0.1;
      }
      const i = (y * size + x) * 4;
      color.set([Math.round(r * value * 255), Math.round(g * value * 255), Math.round(b * value * 255), 255], i);
      heights[y * size + x] = h;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = heights[y * size + ((x + 1) % size)] - heights[y * size + ((x + size - 1) % size)],
        dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
      const len = Math.hypot(dx, dy, 1);
      normal.set(
        [
          Math.round(((-dx / len) * 0.5 + 0.5) * 255),
          Math.round(((-dy / len) * 0.5 + 0.5) * 255),
          Math.round(((1 / len) * 0.5 + 0.5) * 255),
          255,
        ],
        (y * size + x) * 4,
      );
    }
  const result = { color, normal, size };
  cache.set(family, result);
  return result;
}

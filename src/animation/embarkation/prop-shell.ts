export type ContourSegment = readonly [number, number, number, number];
/** Marching squares in texture coordinates, with a transparent guard outside
 * the image. Alpha is bottom-up, just like the uploaded flipped ImageBitmap.
 * Holes are retained as contours, not filled by a convex silhouette. */
export function alphaContours(alpha: ArrayLike<number>, width: number, height: number, threshold = 0.5) {
  const result: ContourSegment[] = [];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : alpha[y * width + x]);
  for (let y = -1; y < height; y++)
    for (let x = -1; x < width; x++) {
      const a = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)];
      const mask = a.reduce((m, v, i) => m | (v >= threshold ? 1 << i : 0), 0);
      if (mask === 0 || mask === 15) continue;
      const points = [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ];
      const hit = (edge: number) => {
        const next = (edge + 1) % 4,
          t = (threshold - a[edge]) / (a[next] - a[edge]);
        return [
          (points[edge][0] + (points[next][0] - points[edge][0]) * t + 0.5) / width,
          (points[edge][1] + (points[next][1] - points[edge][1]) * t + 0.5) / height,
        ];
      };
      const edges = [0, 1, 2, 3].filter((e) => a[e] >= threshold !== a[(e + 1) % 4] >= threshold);
      const pairs =
        edges.length === 2
          ? [edges]
          : // Resolve saddle cells consistently; a shared endpoint remains exact
            // between adjacent cells, so the extruded wall has no open cracks.
            (mask === 5) === a.reduce((s, v) => s + v, 0) / 4 >= threshold
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [3, 0],
                [1, 2],
              ];
      for (const [one, two] of pairs) result.push([...hit(one), ...hit(two)] as unknown as ContourSegment);
    }
  return result;
}
/** Interleaved UV, signed half-thickness, edge flag. Both faces use the same
 * positive winding; the shader rejects their inward-facing fragments. */
export function propShellVertices(contours: readonly ContourSegment[], divisions: number) {
  const data: number[] = [];
  const vertex = (u: number, v: number, depth: number, edge: number) => data.push(u, v, depth, edge);
  for (const side of [-0.5, 0.5])
    for (let y = 0; y < divisions; y++)
      for (let x = 0; x < divisions; x++)
        for (const [u, v] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x, y + 1],
          [x + 1, y],
          [x + 1, y + 1],
        ])
          vertex(u / divisions, v / divisions, side, 0);
  for (const [u, v, x, y] of contours) {
    vertex(u, v, -0.5, 1);
    vertex(x, y, -0.5, 1);
    vertex(u, v, 0.5, 1);
    vertex(u, v, 0.5, 1);
    vertex(x, y, -0.5, 1);
    vertex(x, y, 0.5, 1);
  }
  return new Float32Array(data);
}
/** Preparation only: no per-frame alpha readback or geometry allocation. */
export function propShellFromBitmap(bitmap: ImageBitmap, divisions: number) {
  const ratio = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio),
    height = Math.round(bitmap.height * ratio);
  const canvas = new OffscreenCanvas(width, height),
    ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3] / 255;
  return propShellVertices(alphaContours(alpha, width, height), divisions);
}

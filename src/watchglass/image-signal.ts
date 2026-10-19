import { z } from "zod";

export const imageSignalPolicySchema = z
  .strictObject({
    version: z.literal(1),
    maximumSamples: z.number().int().min(1).max(4096),
    minimumSamples: z.number().int().min(1).max(4096),
    lowClipValue: z.number().int().min(0).max(254),
    highClipValue: z.number().int().min(1).max(255),
  })
  .refine((p) => p.minimumSamples <= p.maximumSamples && p.lowClipValue < p.highClipValue);
export type ImageSignalPolicy = z.infer<typeof imageSignalPolicySchema>;
export const defaultImageSignalPolicy: Readonly<ImageSignalPolicy> = Object.freeze({
  version: 1,
  maximumSamples: 256,
  minimumSamples: 16,
  lowClipValue: 8,
  highClipValue: 247,
});

export type ImageSignalScope =
  | { kind: "WHOLE_FRAME" }
  | { kind: "ROI"; x: number; y: number; width: number; height: number };
export type ImageLumaPlane = { data: Uint8Array; width: number; height: number; rowStrideBytes: number };
const dimension = z.number().int().min(1).max(16384);
const planeGeometry = z.strictObject({
  width: dimension,
  height: dimension,
  rowStrideBytes: z.number().int().positive(),
});
const scopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("WHOLE_FRAME") }),
  z.strictObject({
    kind: z.literal("ROI"),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: dimension,
    height: dimension,
  }),
]);

/** Pixel statistics, not hand presence, model confidence, lighting cause, or a cross-resolution blur judgment. */
export function sampleImageSignal(
  plane: ImageLumaPlane,
  scope: ImageSignalScope,
  policy: ImageSignalPolicy = defaultImageSignalPolicy,
) {
  const p = imageSignalPolicySchema.safeParse(policy);
  const geometry = planeGeometry.safeParse({
    width: plane.width,
    height: plane.height,
    rowStrideBytes: plane.rowStrideBytes,
  });
  const s = scopeSchema.safeParse(scope);
  if (!p.success || !geometry.success || !s.success || !(plane.data instanceof Uint8Array))
    return { version: 1 as const, status: "INVALID_INPUT" as const };
  const { width, height, rowStrideBytes } = geometry.data;
  if (
    rowStrideBytes < width ||
    !Number.isSafeInteger(rowStrideBytes * height) ||
    plane.data.byteLength < rowStrideBytes * height
  )
    return { version: 1 as const, status: "INVALID_INPUT" as const };
  const region = s.data.kind === "WHOLE_FRAME" ? { x: 0, y: 0, width, height } : s.data;
  if (region.x + region.width > width || region.y + region.height > height)
    return { version: 1 as const, status: "INVALID_INPUT" as const };
  const budget = p.data.maximumSamples;
  const columns = Math.min(
    region.width,
    budget,
    Math.max(1, Math.floor(Math.sqrt((budget * region.width) / region.height))),
  );
  const rows = Math.min(region.height, Math.max(1, Math.floor(budget / columns)));
  let count = 0,
    mean = 0,
    m2 = 0,
    low = 0,
    high = 0,
    gradients = 0,
    gradientEnergy = 0,
    laplacianMean = 0,
    laplacianM2 = 0,
    laplacianAbsolute = 0;
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < columns; gx++) {
      const startX = Math.floor((gx * region.width) / columns),
        endX = Math.floor(((gx + 1) * region.width) / columns);
      const startY = Math.floor((gy * region.height) / rows),
        endY = Math.floor(((gy + 1) * region.height) / rows);
      // Deterministic per-cell jitter avoids one fixed sampling phase without randomness, retention or extra reads.
      const hx = (Math.imul(gx + 1, 73856093) ^ Math.imul(gy + 1, 19349663)) >>> 0;
      const hy = (Math.imul(gx + 1, 83492791) ^ Math.imul(gy + 1, 2654435761)) >>> 0;
      const x = region.x + startX + (hx % (endX - startX)),
        y = region.y + startY + (hy % (endY - startY));
      const at = y * rowStrideBytes + x,
        value = plane.data[at];
      count++;
      const delta = value - mean;
      mean += delta / count;
      m2 += delta * (value - mean);
      if (value <= p.data.lowClipValue) low++;
      if (value >= p.data.highClipValue) high++;
      // Only neighbors inside the requested scope contribute; scene edges cannot substitute for ROI texture.
      if (x > region.x && x < region.x + region.width - 1 && y > region.y && y < region.y + region.height - 1) {
        const left = plane.data[at - 1],
          right = plane.data[at + 1],
          up = plane.data[at - rowStrideBytes],
          down = plane.data[at + rowStrideBytes];
        gradients++;
        gradientEnergy += ((right - left) ** 2 + (down - up) ** 2) / 4;
        const laplacian = left + right + up + down - 4 * value,
          d = laplacian - laplacianMean;
        laplacianAbsolute += Math.abs(laplacian);
        laplacianMean += d / gradients;
        laplacianM2 += d * (laplacian - laplacianMean);
      }
    }
  return {
    version: 1 as const,
    status: count >= p.data.minimumSamples ? ("MEASURED" as const) : ("INSUFFICIENT_SAMPLES" as const),
    scope: s.data.kind,
    regionWidth: region.width,
    regionHeight: region.height,
    sampleCount: count,
    derivativeSampleCount: gradients,
    maximumSamples: budget,
    sampling: "STRATIFIED_FIXED_JITTER_V1" as const,
    meanLuma: mean,
    contrastStandardDeviation: Math.sqrt(Math.max(0, m2 / count)),
    lowClippedFraction: low / count,
    highClippedFraction: high / count,
    meanGradientEnergy: gradients ? gradientEnergy / gradients : null,
    laplacianVariance: gradients ? Math.max(0, laplacianM2 / gradients) : null,
    meanAbsoluteLaplacian: gradients ? laplacianAbsolute / gradients : null,
  };
}
export type ImageSignalMeasurement = ReturnType<typeof sampleImageSignal>;

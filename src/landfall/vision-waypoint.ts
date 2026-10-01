import sharp from "sharp";
import { createHash } from "node:crypto";
import type { LandmarkResult } from "@/landfall/landmark-contract";

type Descriptor = { pixels: Uint8Array; contrast: number };
/** Existing Vision Waypoint provider contract; confidence categories stay inspectable. */
export function visionWaypointProviderOutcome(result: LandmarkResult): "match" | "notMatch" | "uncertain" {
  return result === "confirmed" ? "match" : result === "insufficient" ? "notMatch" : "uncertain";
}
async function descriptor(buffer: Buffer): Promise<Descriptor> {
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new Error("LANDFALL_REFERENCE_TOO_LARGE");
  const image = sharp(buffer, { limitInputPixels: 4_000_000, failOn: "error" });
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1 ||
    !["png", "jpeg", "webp", "heif"].includes(metadata.format ?? "")
  )
    throw new Error("LANDFALL_REFERENCE_INVALID");
  const pixels = await image
    .rotate()
    .resize(24, 24, { fit: "fill" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
  const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  const contrast = Math.sqrt(pixels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pixels.length);
  return { pixels, contrast };
}
function difference(a: Descriptor, b: Descriptor): number {
  let sum = 0;
  for (let i = 0; i < a.pixels.length; i++) sum += Math.abs(a.pixels[i] - b.pixels[i]);
  return sum / a.pixels.length;
}

/** Conservative same-view reference comparison, not general object identification.
 * The Player aligns with an authored view. Ambiguous, changed-angle, dark, or
 * negative-reference views cannot confirm. No calibrated probability is claimed.
 * Images exist only during this bounded call; callers must not persist them.
 */
export async function compareVisionWaypoint(input: {
  frames: readonly Buffer[];
  references: readonly Buffer[];
  negatives: readonly Buffer[];
  minimumFrames: number;
}): Promise<{ result: LandmarkResult; frameCount: number }> {
  if (!input.references.length || input.references.length > 8 || input.negatives.length > 8)
    return { result: "unavailable", frameCount: 0 };
  if (input.frames.length < input.minimumFrames || input.frames.length > 5)
    return { result: "insufficient", frameCount: input.frames.length };
  const references = await Promise.all(input.references.map(descriptor));
  const negatives = await Promise.all(input.negatives.map(descriptor));
  let strong = 0,
    possible = 0,
    contradicted = false;
  const uniqueViews = new Set<string>();
  for (const frame of input.frames) {
    const view = await descriptor(frame);
    const fingerprint = createHash("sha256").update(view.pixels).digest("hex");
    if (uniqueViews.has(fingerprint)) continue;
    uniqueViews.add(fingerprint);
    if (view.contrast < 18) continue;
    const best = Math.min(...references.filter((ref) => ref.contrast >= 18).map((ref) => difference(view, ref)));
    const negative = Math.min(...negatives.map((ref) => difference(view, ref)));
    if (negative <= best + 8) {
      contradicted = true;
      continue;
    }
    if (best <= 8) strong++;
    else if (best <= 20) possible++;
  }
  if (contradicted || uniqueViews.size < input.minimumFrames)
    return { result: "insufficient", frameCount: uniqueViews.size };
  const result: LandmarkResult =
    strong >= input.minimumFrames ? "confirmed" : strong ? "likely" : possible ? "possible" : "insufficient";
  return { result, frameCount: uniqueViews.size };
}

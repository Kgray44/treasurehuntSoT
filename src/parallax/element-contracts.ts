import { z } from "zod";
import { modelIds } from "./asset-catalog";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const common = {
  enabled: z.boolean(),
  playback: z
    .strictObject({
      startMs: finite(0, 60000),
      durationMs: finite(1, 60000),
      fadeInMs: finite(0, 10000),
      fadeOutMs: finite(0, 10000),
      loop: z.boolean(),
    })
    .optional(),
};
export const spatialElementSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("PHYSICAL_ASSET"),
    modelId: z.enum(modelIds),
    packageVersion: z.literal("1.0.0"),
    articulation: finite(0, 1),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("LIGHT"),
    type: z.enum(["POINT", "SPOT", "AMBIENT"]),
    color,
    intensity: finite(0, 100),
    range: finite(0.1, 20),
    decay: finite(0, 2),
    angle: finite(0.05, Math.PI / 2),
    penumbra: finite(0, 1),
    pulseHz: finite(0, 2),
  }),
  z.strictObject({ ...common, kind: z.literal("ATMOSPHERE"), color, density: finite(0, 0.08), radius: finite(0.1, 5) }),
  z.strictObject({
    ...common,
    kind: z.literal("PARTICLES"),
    style: z.enum(["MAGIC", "EMBERS", "DUST"]),
    color,
    count: z.number().int().min(1).max(512),
    radius: finite(0.05, 3),
    speed: finite(0, 2),
    size: finite(0.005, 0.1),
    seed: z.number().int().min(1).max(65535),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("PROJECTED_EFFECT"),
    pattern: z.enum(["SYMBOL", "FOOTPRINTS", "WRITING"]),
    color,
    opacity: finite(0, 1),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("SPATIAL_AUDIO"),
    sound: z.enum(["ETHER", "WIND", "HUM"]),
    gain: finite(0, 0.3),
    refDistance: finite(0.1, 5),
    maxDistance: finite(1, 20),
    rolloff: finite(0, 4),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("SPATIAL_PHENOMENON"),
    style: z.enum(["PORTAL", "REVEAL"]),
    color,
    speed: finite(0, 2),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("INTERACTION_VOLUME"),
    shape: z.enum(["BOX", "SPHERE"]),
    radius: finite(0.05, 3),
  }),
]);
export type SpatialElement = z.infer<typeof spatialElementSchema>;

/** Timeline-derived presentation only. Stopping/seeking/reloading has no hidden wall-clock state. */
export function elementEnvelope(element: SpatialElement, timeMs: number, editor = false) {
  if (!element.enabled) return 0;
  const p = element.playback;
  if (!p || editor) return 1;
  const elapsed = timeMs - p.startMs;
  if (elapsed < 0 || (!p.loop && elapsed >= p.durationMs)) return 0;
  const local = elapsed % p.durationMs;
  return Math.min(1, p.fadeInMs ? local / p.fadeInMs : 1, p.fadeOutMs ? (p.durationMs - local) / p.fadeOutMs : 1);
}

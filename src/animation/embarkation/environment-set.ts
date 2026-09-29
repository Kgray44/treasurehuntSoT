/** A cover is UI content, not a matte set. All layers below share one calibrated
 * source space. Registration is a trusted application/art-direction input, not
 * an end-user single-image conversion or an inferred Chronicle-title match. */
export type LandscapeSet = {
  id: string;
  geometry: "registered-harbor-planes-v2";
  textures: Record<"stage-distant" | "stage-islands" | "stage-middle" | "stage-near" | "stage-rocks", string>;
  calibration: {
    width: number;
    height: number;
    referenceCameraZ: number;
    depths: [number, number, number, number];
    moonUV: [number, number];
    water: { shoreUV: number; eyeHeight: number };
    backingBounds: [number, number, number, number];
  };
};
const prefix = "/images/embarkation/derived/";
// Source-pixel waterline anchors, not guessed layer spacing. Near scenery
// retains its authored 1.22 overscan, included in the shoreline calibration.
const shoreUV = 1 - 585 / 941,
  waterHeight = 1000;
const waterSlope = ((shoreUV - 0.5) * 1100) / 1150 + waterHeight / (1150 - 3100 + 16000);
const shoreDepth = (row: number, overscan = 1) =>
  -1950 - waterHeight / (waterSlope - (((0.5 - row / 941) * 1100) / 1150) * overscan);
export const HARBOR_ENVIRONMENT: LandscapeSet = {
  id: "voyagewright-night-harbor-v2",
  geometry: "registered-harbor-planes-v2",
  textures: {
    "stage-distant": prefix + "stage-b-spatial-backing.png",
    "stage-islands": prefix + "stage-islands.png",
    "stage-middle": prefix + "stage-middle.png",
    "stage-near": prefix + "stage-near.png",
    "stage-rocks": prefix + "stage-rocks.png",
  },
  calibration: {
    width: 1672,
    height: 941,
    referenceCameraZ: -3100,
    depths: [-16000, shoreDepth(590), shoreDepth(619), shoreDepth(723, 1.22)],
    moonUV: [0.294, 0.42],
    water: { shoreUV, eyeHeight: waterHeight },
    backingBounds: [-588 / 1672, -304 / 941, 1 + 588 / 1672, 1 + 48 / 941],
  },
};
export function validateLandscapeSet(value: unknown): value is LandscapeSet {
  if (!value || typeof value !== "object") return false;
  const v = value as LandscapeSet,
    c = v.calibration;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    v.geometry === "registered-harbor-planes-v2" &&
    Boolean(v.textures) &&
    Object.keys(HARBOR_ENVIRONMENT.textures).every(
      (k) =>
        typeof v.textures[k as keyof LandscapeSet["textures"]] === "string" &&
        /^\/(?!\/)/.test(v.textures[k as keyof LandscapeSet["textures"]]),
    ) &&
    Boolean(c) &&
    Number.isFinite(c.width) &&
    c.width > 0 &&
    Number.isFinite(c.height) &&
    c.height > 0 &&
    Number.isFinite(c.referenceCameraZ) &&
    Array.isArray(c.depths) &&
    c.depths.length === 4 &&
    c.depths.every((d) => Number.isFinite(d) && d < c.referenceCameraZ - 100) &&
    Array.isArray(c.moonUV) &&
    c.moonUV.length === 2 &&
    c.moonUV.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
    Boolean(c.water) &&
    Number.isFinite(c.water.eyeHeight) &&
    c.water.eyeHeight > 0 &&
    Number.isFinite(c.water.shoreUV) &&
    c.water.shoreUV > 0 &&
    c.water.shoreUV < 1 &&
    Array.isArray(c.backingBounds) &&
    c.backingBounds.length === 4 &&
    c.backingBounds.every(Number.isFinite) &&
    c.backingBounds[0] <= 0 &&
    c.backingBounds[1] <= 0 &&
    c.backingBounds[2] >= 1 &&
    c.backingBounds[3] >= 1
  );
}
export function selectEnvironment(direction: { environment?: LandscapeSet; destinationUrl?: string } = {}) {
  if (direction.environment !== undefined) {
    if (!validateLandscapeSet(direction.environment)) throw new Error("invalid-environment-registration");
    return { set: direction.environment, reason: "explicit-registered-set" as const };
  }
  return {
    set: HARBOR_ENVIRONMENT,
    reason: direction.destinationUrl ? ("unregistered-image-generic-harbor" as const) : ("generic-harbor" as const),
  };
}

import { camera, mix, random, smooth, type Vec3 } from "./program";

export type RoomUV = readonly number[];
export const EXTERIOR = {
  skyZ: -12500,
  pierZ: -9000,
  horizon: 1 - 326 / 1024,
  waterHeight: 1100,
  // Source coordinates supported by the registered continuation canvas.
  bounds: [-31 / 1536, -20 / 1024, 1 + 31 / 1536, 1 + 113 / 1024] as const,
};

export function celestialState(time: number, width: number, height: number, roomUV: RoomUV) {
  const viewport: [number, number] = [(1100 * width) / height, 1100];
  const stage = [...viewport];
  const aspect = 1672 / 941;
  if (stage[0] / stage[1] > aspect) stage[1] = stage[0] / aspect;
  else stage[0] = stage[1] * aspect;
  const source: Vec3 = [
    ((0.294 - 0.5) * stage[0] * (1150 + 16000 - 3100)) / 1150,
    ((0.42 - 0.5) * stage[1] * (1150 + 16000 - 3100)) / 1150,
    -16000,
  ];
  const finalUV = [(1167 / 1536 - roomUV[2]) / roomUV[0], (1 - 240 / 1024 - roomUV[3]) / roomUV[1]];
  const destination: Vec3 = [
    ((finalUV[0] - 0.5) * viewport[0] * 13650) / 1150,
    ((finalUV[1] - 0.5) * viewport[1] * 13650) / 1150,
    -12500,
  ];
  // Registration changes only within the middle banks, not throughout arrival.
  const reconciliation = smooth(23.85, 24.75, time);
  const position = source.map((v, i) => mix(v, destination[i], reconciliation)) as Vec3;
  const eye = camera(time).position;
  const direction: Vec3 = [position[0] - eye[0], position[1] - eye[1], position[2] - eye[2] - 1150];
  const length = Math.hypot(...direction);
  const distance = -direction[2];
  return {
    position,
    direction: direction.map((v) => v / length) as Vec3,
    projected: [
      (direction[0] * 1150) / distance / viewport[0] + 0.5,
      (direction[1] * 1150) / distance / viewport[1] + 0.5,
    ] as [number, number],
    radius: mix(590, 225, reconciliation),
    reconciliation,
    reflectionSourceX: mix(0.294, 1167 / 1536, reconciliation),
  };
}

const fogRandom = random(2595989206 ^ 0x464f47);
export const FOG_BANKS = Array.from({ length: 28 }, (_, i) => {
  const phase = i * 2.399963;
  const birth = 21.3 + i * 0.12 + fogRandom() * 0.035;
  const radius = 580 + fogRandom() * 420;
  // The upstream supply swells, then dwindles. Individual banks keep their
  // physical density throughout flight; the viewing volume is never faded.
  const endWisps = 0.045 + 0.955 * Math.exp(-(((i - 20) / (i < 20 ? 7 : 3.1)) ** 2));
  return {
    id: `bank-${i}`,
    birth,
    phase,
    radius,
    speed: 6100 + fogRandom() * 900,
    x: Math.cos(phase) * (1000 + fogRandom() * 650),
    y: Math.sin(phase) * (420 + fogRandom() * 450),
    strength: endWisps,
  };
});

export function fogBanksAt(time: number) {
  return FOG_BANKS.flatMap((bank) => {
    const age = time - bank.birth;
    if (age < 0 || age > 5) return [];
    const c = camera(bank.birth).position;
    const position: Vec3 = [
      c[0] + bank.x + Math.sin(age * 0.9 + bank.phase) * 100,
      c[1] + bank.y + Math.cos(age * 0.7 + bank.phase) * 65,
      c[2] + 1150 + bank.radius * 1.9 - bank.speed * age,
    ];
    // Each bank overtakes the eye, spreads in the downstream volume and exits
    // beyond it. No film-time opacity envelope fills or empties the view.
    return [
      {
        ...bank,
        age,
        position,
        radiusX: bank.radius * 0.72 + age * 1900,
        radiusY: bank.radius * 0.45 + age * 1200,
        radiusZ: bank.radius,
        gain: (bank.strength * 10) / (1 + age * 0.14),
      },
    ];
  });
}

/** Ray/plane intersection for the tilted horizontal water plane. The tilt is
 * the calibrated view of a level sea, not a varying image-row depth field. */
export function exteriorWaterPoint(time: number, uv: readonly number[], viewport: readonly number[], roomUV: RoomUV) {
  const cam = camera(time).position;
  const eye: Vec3 = [cam[0], cam[1], cam[2] + 1150];
  // The visible shoreline is a finite intersection with the distant matte,
  // not the sea's vanishing line. Put that vanishing line behind the land.
  const horizon =
    ((EXTERIOR.horizon - roomUV[3]) / roomUV[1] - 0.5) * viewport[1] +
    (EXTERIOR.waterHeight * 1150) / (1150 - EXTERIOR.skyZ);
  const ray = [((uv[0] - 0.5) * viewport[0]) / 1150, ((uv[1] - 0.5) * viewport[1]) / 1150, -1];
  const distance = (horizon - EXTERIOR.waterHeight - eye[1] - (horizon * eye[2]) / 1150) / (ray[1] - horizon / 1150);
  if (distance <= 0) return null;
  const world = eye.map((v, i) => v + ray[i] * distance) as Vec3;
  const p = [0, 1].map((i) => ((world[i] * 1150) / (1150 - world[2]) / viewport[i] + 0.5) * roomUV[i] + roomUV[i + 2]);
  return { world, sourceUV: p, distance };
}

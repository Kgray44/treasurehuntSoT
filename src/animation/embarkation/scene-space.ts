import { HARBOR_ENVIRONMENT, type LandscapeSet } from "./environment-set";
import { camera, materials, mix, random, smooth, wind, type Vec3 } from "./program";
import { FlightPath } from "./dynamics";
import { eyePosition, projectWorld, viewRay, worldViewport } from "./projection";

export type RoomUV = readonly number[];
export const EXTERIOR = {
  skyZ: -12500,
  pierWaterlineRow: 452,
  openingZ: -2722.5,
  horizon: 1 - 326 / 1024,
  waterHeight: 1100,
  moonDiameterPixels: 24,
  // Source coordinates supported by the registered continuation canvas.
  bounds: [-31 / 1536, -20 / 1024, 1 + 31 / 1536, 1 + 113 / 1024] as const,
};

export function celestialState(
  time: number,
  width: number,
  height: number,
  roomUV: RoomUV,
  registration: LandscapeSet["calibration"] = HARBOR_ENVIRONMENT.calibration,
) {
  const viewport = worldViewport({ width, height });
  const stage = [...viewport];
  const aspect = registration.width / registration.height;
  if (stage[0] / stage[1] > aspect) stage[1] = stage[0] / aspect;
  else stage[0] = stage[1] * aspect;
  const source: Vec3 = [
    ((registration.moonUV[0] - 0.5) * stage[0] * (1150 - registration.depths[0] + registration.referenceCameraZ)) /
      1150,
    ((registration.moonUV[1] - 0.5) * stage[1] * (1150 - registration.depths[0] + registration.referenceCameraZ)) /
      1150,
    registration.depths[0],
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
  const frame = camera(time),
    eye = eyePosition(frame);
  const direction: Vec3 = [position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]];
  const length = Math.hypot(...direction);
  const screen = projectWorld(position, frame, { width, height });
  return {
    position,
    direction: direction.map((v) => v / length) as Vec3,
    projected: [screen.x / width, 1 - screen.y / height] as [number, number],
    // This legacy-named value is the quad's DIAMETER, not a radial distance.
    // Register the 24px source disc through the actual room crop. A fixed 225
    // world units made a smaller disc which visibly enlarged when original
    // aperture pixels returned, especially in tall/mobile room crops.
    radius: mix(590, (EXTERIOR.moonDiameterPixels * viewport[1] * 13650) / (1024 * roomUV[1] * 1150), reconciliation),
    reconciliation,
    reflectionSourceX: mix(registration.moonUV[0], 1167 / 1536, reconciliation),
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
    entrainment: 0.96 + fogRandom() * 0.08,
    x: Math.cos(phase) * (1000 + fogRandom() * 650),
    y: Math.sin(phase) * (420 + fogRandom() * 450),
    strength: endWisps,
  };
});

const fogFlights = new WeakMap<(typeof FOG_BANKS)[number], FlightPath>();
export function fogBanksAt(time: number) {
  return FOG_BANKS.flatMap((bank) => {
    const age = time - bank.birth;
    if (age < 0 || age > 5) return [];
    let path = fogFlights.get(bank);
    if (!path) {
      const eye = eyePosition(camera(bank.birth));
      const position: Vec3 = [eye[0] + bank.x, eye[1] + bank.y, eye[2] + bank.radius * 1.9];
      path = new FlightPath(
        bank.birth,
        {
          position,
          velocity: wind(bank.birth, position).map((v) => v * bank.entrainment) as Vec3,
          orientation: [0, 0, 0, 1],
          angularVelocity: [0, 0, 0],
        },
        { material: materials.mist, spherical: true, pressureCenter: [0, 0, 0] },
        wind,
      );
      fogFlights.set(bank, path);
    }
    const position = path.at(age).position;
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
  const cam = camera(time);
  const eye = eyePosition(cam);
  // The visible shoreline is a finite intersection with the distant matte,
  // not the sea's vanishing line. Put that vanishing line behind the land.
  const horizon =
    ((EXTERIOR.horizon - roomUV[3]) / roomUV[1] - 0.5) * viewport[1] +
    (EXTERIOR.waterHeight * 1150) / (1150 - EXTERIOR.skyZ);
  const ray = viewRay(uv, viewport, cam.roll);
  const distance = (horizon - EXTERIOR.waterHeight - eye[1] - (horizon * eye[2]) / 1150) / (ray[1] - horizon / 1150);
  if (distance <= 0) return null;
  const world = eye.map((v, i) => v + ray[i] * distance) as Vec3;
  const p = [0, 1].map((i) => ((world[i] * 1150) / (1150 - world[2]) / viewport[i] + 0.5) * roomUV[i] + roomUV[i + 2]);
  return { world, sourceUV: p, distance };
}

/** The pier mask's lowest opaque piling meets water at source row 452.
 * Register that shoreline to the same plane, rather than choosing a separate
 * artistic Z which the sea would physically cut through during the dolly.
 */
export function exteriorPierDepth(viewport: readonly number[], roomUV: RoomUV) {
  const horizon =
    ((EXTERIOR.horizon - roomUV[3]) / roomUV[1] - 0.5) * viewport[1] +
    (EXTERIOR.waterHeight * 1150) / (1150 - EXTERIOR.skyZ);
  const waterline = ((1 - EXTERIOR.pierWaterlineRow / 1024 - roomUV[3]) / roomUV[1] - 0.5) * viewport[1];
  return 1150 - (EXTERIOR.waterHeight * 1150) / (horizon - waterline);
}

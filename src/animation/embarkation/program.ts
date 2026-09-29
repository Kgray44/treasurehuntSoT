/** A seekable scene program: all values depend on identity, time and viewport, never frame count. */
import { FlightPath, eulerFromOrientation, orientationFromEuler } from "./dynamics";
import { FOCAL, WORLD_HEIGHT, cssToWorld } from "./projection";
export const EMBARKATION_VERSION = "embarkation-1.0.0";
// Delta 2 is authored in seconds. Fast releases and near passes retain their
// physical velocities; discovery, fog travel and anchor catches get new shots.
export const CUT = {
  pressure: 3.3,
  crossing: 10,
  crest: 12.15,
  catch: 11.45,
  peel: 13.65,
  landscape: 16,
  wonder: 18.5,
  fogIn: 22,
  fogOpaque: 24.25,
  fogOut: 27,
  threshold: 27,
  room: 31,
  assembly: 31,
  settled: 34.35,
  welcomeIn: 33.35,
  welcomeOut: 34.65,
  still: 34.7,
  end: 35.8,
} as const;
export const DURATION = CUT.end;
export const SHELL_REVEAL = { start: CUT.room, end: 32.3 } as const;
export const beats = [
  [0, "The page holds"],
  [2.2, "The title catches the wind"],
  [CUT.pressure, "First gust / edge tension"],
  [5.2, "Anchors fail"],
  [7.2, "The page enters the storm"],
  [10, "Into the crossing"],
  [CUT.catch, "The word catches a page"],
  [CUT.crest, "Storm crest"],
  [14.0, "Through the charts"],
  [16, "The storm opens"],
  [19, "Moonlit island passage"],
  [22, "Into moving fog"],
  [24.25, "Moon through the volume"],
  [26.5, "The harbor emerges"],
  [27, "Backing through the threshold"],
  [28.6, "A light beside the lens"],
  [31, "New anchors"],
  [32.5, "The crew finds its place"],
  [33.35, "Welcome"],
  [34.7, "Arrival stillness"],
  [35.8, "Arrival"],
] as const;
export type Quality = "AUTO" | "CINEMATIC" | "BALANCED" | "PERFORMANCE";
export type Tier = Exclude<Quality, "AUTO">;
export type Vec3 = [number, number, number];
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, t: number) => {
  const x = clamp((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const mix = (a: number, b: number, x: number) => a + (b - a) * x;
export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedFor = (id: string) => hash(`${id}:${EMBARKATION_VERSION}`);
export function beatAt(t: number) {
  return [...beats].reverse().find(([at]) => t >= at)?.[1] ?? beats[0][1];
}
export function gust(t: number) {
  const pressure = smooth(0.8, 9.4, t);
  const crest = 0.79 + 0.86 * Math.exp(-(((t - CUT.crest) / 1.75) ** 2));
  // A compact first gust breaks the page's anchors. Added scenic runtime must
  // not turn that physical event into a nine-second acceleration ramp. It
  // affects the shared air/material/audio field and is gone before crossing.
  const firstGust = 0.62 * smooth(2.6, 4.35, t) * (1 - smooth(5.9, 7.8, t));
  const shelter = 1 - 0.71 * smooth(14.1, 20.5, t);
  // Fog remains advected by the same field. Only the room's last anchor shot
  // removes the residual pressure, rather than resetting wind at a scene cut.
  return (pressure * crest + firstGust) * shelter * (1 - smooth(31.5, CUT.settled, t));
}
export function stormEnergy(t: number) {
  return smooth(1.8, 9.5, t) * (1 - smooth(14.8, 20.4, t)) * (0.72 + 0.28 * Math.exp(-(((t - CUT.crest) / 1.5) ** 2)));
}
export function fogPassage(t: number) {
  return smooth(CUT.fogIn, CUT.fogOpaque, t) * (1 - smooth(25.15, 27.35, t));
}
export function atmosphericDepth(distance: number) {
  // Optical depth, not elapsed lifetime. Near material keeps full coverage;
  // distant storm matter disappears into the maritime volume before arrival.
  return Math.exp(-Math.max(0, distance - 3500) / 4100);
}
export function wind(t: number, p: Vec3, _phase = 0): Vec3 {
  void _phase; // Historical call-site phase cannot change a shared world field.
  // Field phase belongs to the world, never to an individual particle. Adjacent
  // cloth, mist and water therefore bend around the same two vortex tubes.
  // Storm supply decays, but downstream air does not suddenly stop when the
  // viewer enters shelter. Only the actual room volume suppresses that flow.
  const shelter = smooth(CUT.threshold, CUT.room, t) * smooth(-6000, -1700, p[2]);
  // A sheltered fraction of the final gust still loads newly caught material.
  // It decays with the same supply envelope; the outdoor stream keeps flowing.
  const g = (gust(t) + 0.78 * smooth(14.1, 20.5, t)) * (1 - shelter) + gust(t) * 0.24 * shelter,
    depth = 1 + clamp(-p[2] / 6000) * 0.22;
  let x = 100 * Math.sin(p[2] * 0.0006 + t * 0.6),
    y = 45 * Math.cos(p[2] * 0.0008 - t * 0.7);
  for (let i = 0; i < 2; i++) {
    const cx = (i ? -480 : 380) + Math.sin(p[2] * 0.0009 + t * 0.45 + i) * 180;
    const cy = (i ? 170 : -100) + Math.cos(p[2] * 0.0007 - t * 0.53 + i) * 110;
    const dx = p[0] - cx,
      dy = p[1] - cy,
      swirl = Math.exp(-(dx * dx + dy * dy) / 420000) * (i ? -1.25 : 1.65);
    x -= dy * swirl;
    y += dx * swirl;
  }
  return [g * x, g * y, -g * (6200 * depth + 840 * Math.sin(p[2] * 0.0005 - t * 0.8) ** 2)];
}
// Reference streamline transports the continuous volume's fine texture. Bank
// centers use their local integrated field; this integral is only substructure
// advection, not a second fog velocity or an opacity clock.
const airTravelSamples: Vec3[] = [[0, 0, 0]];
export function airTravel(time: number): Vec3 {
  const frame = Math.max(0, time) * 60,
    upper = Math.ceil(frame);
  while (airTravelSamples.length <= upper) {
    const i = airTravelSamples.length,
      before = wind((i - 1) / 60, [0, 0, -6000]),
      after = wind(i / 60, [0, 0, -6000]);
    airTravelSamples.push(before.map((v, axis) => airTravelSamples[i - 1][axis] + (v + after[axis]) / 120) as Vec3);
  }
  const lower = Math.floor(frame),
    u = frame - lower;
  return airTravelSamples[lower].map((v, axis) => mix(v, airTravelSamples[upper][axis], u)) as Vec3;
}
export type Material = {
  mass: number;
  area: number;
  drag: number;
  inertia: number;
  coupling: number;
  flutter: number;
  lift: number;
};
export const materials = {
  paper: { mass: 0.65, area: 1.3, drag: 1.15, inertia: 0.6, coupling: 1, flutter: 1, lift: 0.7 },
  cloth: { mass: 1.1, area: 2, drag: 1.6, inertia: 1, coupling: 0.8, flutter: 0.7, lift: 0.9 },
  card: { mass: 3.8, area: 1.4, drag: 0.6, inertia: 4.1, coupling: 0.35, flutter: 0, lift: 0.12 },
  button: { mass: 6, area: 0.7, drag: 0.8, inertia: 6, coupling: 0.65, flutter: 0, lift: 0.04 },
  metal: { mass: 8, area: 0.4, drag: 0.2, inertia: 7, coupling: 0.1, flutter: 0, lift: 0.04 },
  rope: { mass: 3, area: 0.5, drag: 0.6, inertia: 3, coupling: 0.35, flutter: 0.15, lift: 0.1 },
  mist: { mass: 0.08, area: 3, drag: 2, inertia: 0.1, coupling: 1.8, flutter: 0.35, lift: 1 },
  mote: { mass: 0.04, area: 0.06, drag: 1, inertia: 0.04, coupling: 1.2, flutter: 0, lift: 0.3 },
} satisfies Record<string, Material>;
export type Actor = {
  id: string;
  asset: string;
  material: keyof typeof materials;
  birth: number;
  life: number;
  position: Vec3;
  size: number;
  phase: number;
  rotation: Vec3;
  hero?: "map" | "lantern" | "rope";
  layer: "paper" | "props" | "mist" | "particles" | "light" | "spray";
  additive?: boolean;
};
export type Pose = {
  position: Vec3;
  velocity?: Vec3;
  rotation: Vec3;
  size: number;
  alpha: number;
  bend: number;
  adhesion: number;
  blur: number;
};
// Fixed-step entrainment is precomputed once per actor. Every loose material
// starts behind the eye and overtakes it; seeking never advances a simulation.
const dynamicsCache = new WeakMap<Actor, FlightPath>();
const birthCameraCache = new WeakMap<Actor, { birth: number; position: Vec3 }>();
function actorEye(a: Actor) {
  let cached = birthCameraCache.get(a);
  if (!cached || cached.birth !== a.birth) {
    cached = { birth: a.birth, position: camera(a.birth).position };
    birthCameraCache.set(a, cached);
  }
  return cached.position;
}
export function materialPath(a: Actor) {
  let path = dynamicsCache.get(a);
  if (!path) {
    const eye = actorEye(a);
    const origin: Vec3 = [
      a.position[0] + eye[0],
      a.position[1] + eye[1],
      eye[2] + FOCAL + 170 + Math.abs(a.position[2]) * 0.12,
    ];
    // The upstream emitter is already entrained in the local air. This is an
    // initial condition, not a minimum speed continually imposed on the body.
    const air = wind(a.birth, origin);
    path = new FlightPath(
      a.birth,
      {
        position: origin,
        velocity: air.map((v) => v * 0.82) as Vec3,
        orientation: orientationFromEuler(a.rotation),
        angularVelocity: [0, 0, 0],
      },
      {
        material: materials[a.material],
        spherical: a.material === "mote" || a.material === "mist",
        pressureCenter: [0.14 * Math.sin(a.phase), 0.12 * Math.cos(a.phase), 0.025],
      },
      wind,
    );
    dynamicsCache.set(a, path);
  }
  return path;
}
export function materialMotion(a: Actor, age: number) {
  return materialPath(a).at(age);
}
export function materialResponse(a: Actor, age: number): Vec3 {
  return materialMotion(a, age).position;
}
export function composition(width: number, height: number) {
  const family = width < 600 ? "phone" : width < 1000 ? "tablet" : width / height > 2 ? "wide" : "desktop";
  return {
    family,
    spread: family === "phone" ? 0.5 : family === "tablet" ? 0.75 : family === "wide" ? 1.35 : 1,
    hero: family === "phone" ? 0.68 : 1,
    focusY: family === "phone" ? -0.11 : 0,
  };
}
export function camera(t: number): { position: Vec3; roll: number } {
  if (t >= CUT.room) return { position: [0, 0, 0], roll: 0 };
  if (t > CUT.threshold) {
    const entry = camera(CUT.threshold),
      u = clamp((t - CUT.threshold) / (CUT.room - CUT.threshold));
    const dolly = u * u * u * (10 + u * (-15 + 6 * u)),
      bend = Math.sin(Math.PI * u) ** 2;
    return {
      position: [
        entry.position[0] * (1 - dolly) + 95 * bend,
        entry.position[1] * (1 - dolly) + 26 * bend,
        entry.position[2] * (1 - dolly),
      ],
      roll: entry.roll * (1 - dolly),
    };
  }
  const travel =
    500 * smooth(3.5, 10.8, t) + 2200 * smooth(9.5, 17.5, t) + 940 * smooth(16, 22, t) + 260 * smooth(21.3, 27, t);
  const quiet = 1 - smooth(15, 18, t),
    g = gust(t),
    pass = Math.exp(-(((t - 14.35) / 0.44) ** 2));
  const explore = smooth(16, 21, t) * (1 - smooth(22, 27, t));
  return {
    position: [
      (Math.sin(t * 0.48) * 100 * g + pass * 11) * quiet + 310 * explore + 500 * smooth(21.3, 27, t),
      (Math.sin(t * 0.62) * 38 * g - pass * 7) * quiet + 100 * explore + 550 * smooth(21.3, 27, t),
      -travel,
    ],
    roll: (Math.sin(t * 0.83) * 0.004 * g + pass * 0.004) * quiet,
  };
}
export function buildActors(seed: number): Actor[] {
  const r = random(seed),
    actors: Actor[] = [];
  const add = (a: Omit<Actor, "phase" | "rotation">) =>
    actors.push({ ...a, phase: r() * 6.28, rotation: [(r() - 0.5) * 0.45, (r() - 0.5) * 0.6, (r() - 0.5) * 0.7] });
  // Small material continues through the landscape on the same integrated paths.
  for (let i = 0; i < 118; i++) {
    const asset =
      i % 17 === 0
        ? "P4-journal-page"
        : i % 19 === 1
          ? "P7-sailcloth"
          : i % 6 === 2
            ? i === 2
              ? "P2-compass"
              : `derived/ink-${i % 2}`
            : `derived/scrap-${i % 4}`;
    add({
      id: `recede-${i}`,
      asset,
      material: i === 2 ? "metal" : i % 19 === 1 ? "cloth" : "paper",
      birth: 4.2 + (r() + r()) * 6.3,
      life: 22.6 - (4.2 + r() * 0.6),
      position: [(r() - 0.5) * 2300, (r() - 0.5) * 1350, 140 - r() * 550],
      size: i === 2 ? 230 : 32 + r() * 96,
      layer: i % 6 === 2 ? "props" : "paper",
    });
  }
  add({
    id: "hero-chart",
    asset: "P1-map-fragment",
    material: "paper",
    birth: 13.25,
    life: 14.0,
    position: [0, 0, 0],
    size: 590,
    hero: "map",
    layer: "paper",
  });
  // TitleSnag owns the measured-glyph, constrained paper hero. Preserve the
  // seeded stream for all later actors when replacing its former rigid actor.
  r();
  r();
  r();
  r();
  add({
    id: "lantern",
    asset: "P6-lantern",
    material: "metal",
    birth: CUT.threshold,
    life: CUT.room - CUT.threshold,
    position: [0, 0, 0],
    size: 180,
    hero: "lantern",
    layer: "props",
  });
  for (let i = 0; i < 3; i++)
    add({
      id: `eddy-${i}`,
      asset: `derived/scrap-${i}`,
      material: "paper",
      birth: 12.8 + i * 1.3,
      life: 14,
      position: [(i - 1) * 700, 430, 160],
      size: 180,
      layer: "paper",
    });
  const sources = [
    { kind: "particle", layer: "particles", n: 1600, size: 4, life: 18, add: true },
    { kind: "ember", layer: "particles", n: 42, size: 10, life: 2.5, add: true },
    { kind: "mist", layer: "mist", n: 96, size: 1800, life: 28, add: false },
    { kind: "light", layer: "light", n: 5, size: 380, life: 1.3, add: true },
    { kind: "spray", layer: "spray", n: 2100, size: 12, life: 12, add: false },
    { kind: "debris", layer: "props", n: 22, size: 28, life: 17, add: false },
  ] as const;
  for (const s of sources)
    for (let i = 0; i < s.n; i++) {
      const birth =
        s.kind === "ember"
          ? 25 + r() * 3
          : s.kind === "spray"
            ? 2.3 + (r() + r()) * 6.2
            : s.kind === "light"
              ? 11.1 + r() * 10.5
              : 2.2 + (r() + r()) * 7.9;
      add({
        id: `${s.kind}-${i}`,
        asset: `derived/${s.kind}-${i % (s.kind === "mist" || s.kind === "light" || s.kind === "debris" ? 3 : 4)}`,
        material: s.kind === "mist" ? "mist" : "mote",
        birth,
        life: s.life * (0.7 + r() * 0.7),
        position: [(r() - 0.5) * 3000, (r() - 0.5) * 1800, 350 - r() * 1900],
        size: s.size * (0.4 + r() * 1.2),
        layer: s.layer,
        additive: s.add,
      });
    }
  return actors;
}
export const TITLE_TURN = { start: 4.45, edge: 4.725, end: 5.0 } as const;
/** One title identity: measured page heading -> caught arc -> outdoor landmark. */
export function focusPose(
  t: number,
  width: number,
  height: number,
  origin?: { x: number; y: number; width: number; height: number },
): Pose {
  const c = camera(t).position,
    factor = WORLD_HEIGHT / height;
  const from: Vec3 = origin
    ? cssToWorld(origin.x + origin.width / 2, origin.y + origin.height / 2, 0, { width, height })
    : [-100, 170, 0];
  const lift = smooth(1.2, 3.35, t),
    returning = smooth(3.35, 6.1, t),
    arc = Math.sin(Math.PI * returning);
  const fix = smooth(10, 16.5, t),
    release = smooth(28.2, 30.6, t);
  // Hold the readable face against the growing wind. One brief edge-on turn
  // resolves its cinematic typesetting; the old half revolution exposed the
  // mirrored back for seconds and folded the opening message upside down.
  const turn =
    t < TITLE_TURN.edge ? smooth(TITLE_TURN.start, TITLE_TURN.edge, t) : 1 - smooth(TITLE_TURN.edge, TITLE_TURN.end, t);
  const supported = lift * (1 - returning) * (1 - turn);
  const size = mix(origin ? origin.width * factor : 650, width < 600 ? 800 : 970, returning) * (1 + fix * 1.8);
  const home: Vec3 = [
    mix(from[0], c[0] * 0.7, returning) - 240 * lift * (1 - returning) + arc * 120,
    mix(from[1], 132, returning) + lift * 150 * (1 - returning) + arc * 180,
    c[2] - 780 * lift * (1 - returning),
  ];
  return {
    position: [
      mix(home[0], 430, fix) + release * release * 2800,
      mix(home[1], 520, fix) + Math.sin(release * 5) * 180 * release,
      mix(home[2], -6600, fix) - release * release * 72000,
    ],
    rotation: [
      supported * 0.16 + release * 2.6,
      supported * 0.2 + (turn * Math.PI) / 2 + release * 3.4,
      -supported * 0.1 - release * 2.3,
    ],
    size,
    alpha: t >= 0.45 && t < CUT.room ? 1 : 0,
    bend: supported * 0.25 + release * 3.2,
    adhesion: 0,
    blur: 0,
  };
}
let poseContext:
  | {
      t: number;
      width: number;
      height: number;
      composition: ReturnType<typeof composition>;
      cameraZ: number;
      gust: number;
      storm: number;
    }
  | undefined;
export function poseAt(a: Actor, t: number, width: number, height: number): Pose {
  // A closed scene has no drawable actors. Do not simulate thousands of
  // invisible paths just to return alpha=0 at the already-interactive room.
  // Inactive poses carry asset-local coordinates; physics diagnostics use
  // materialMotion/materialResponse, which remain valid after scene closure.
  if (t >= CUT.room || t < a.birth)
    return {
      position: [...a.position],
      rotation: [...a.rotation],
      size: a.size,
      alpha: 0,
      bend: 0,
      adhesion: 0,
      blur: 0,
    };
  // All actors sampled at one shutter instant share immutable camera/shot
  // values. This memo is keyed by exact film time and viewport, not frame rate.
  if (!poseContext || poseContext.t !== t || poseContext.width !== width || poseContext.height !== height)
    poseContext = {
      t,
      width,
      height,
      composition: composition(width, height),
      cameraZ: camera(t).position[2],
      gust: gust(t),
      storm: stormEnergy(t),
    };
  const age = t - a.birth,
    m = materials[a.material],
    c = poseContext.composition,
    g = poseContext.gust;
  // Authored hero constraints own their trajectories, so preparing a second,
  // unused aerodynamic flight for them wastes both CPU and cache memory.
  const motion = a.hero ? null : materialMotion(a, age),
    advected = motion?.position ?? a.position,
    eye = actorEye(a);
  let position: Vec3 = [eye[0] + (advected[0] - eye[0]) * c.spread, advected[1], advected[2]];
  let rotation: Vec3 = motion ? eulerFromOrientation(motion.orientation) : [...a.rotation];
  let size = a.size,
    adhesion = 0;
  // Birth has full coverage BEHIND the near plane. Only physically distant
  // material fades into atmosphere; no in-front spawning opacity ramp.
  let alpha = age >= 0 ? 1 : 0;
  if (a.hero === "map") {
    const pass = smooth(0, 4.5, age);
    position = [
      eye[0] + mix(-610, 1120, pass) * c.spread,
      eye[1] + 80 + Math.sin(pass * 3.14) * 110,
      // The approved slower near pass is local. Once it passes the viewer,
      // the chart rejoins fast downstream travel instead of lingering forever.
      eye[2] + 1400 - age * 1220 - Math.max(0, age - 4.5) ** 2 * 1400,
    ];
    size *= c.hero;
    rotation = [-0.15 + pass * 0.35, -0.55 + pass * 0.9, -0.24 + pass * 0.5];
  }
  if (a.hero === "lantern") {
    position = [-238, 480, -1200];
    size *= c.hero;
    rotation = [0, -0.08, Math.sin(t * 1.7) * 0.025];
    alpha = age >= 0 && age <= a.life ? 1 : 0;
  }
  if (a.material === "mist" || a.layer === "spray") alpha *= poseContext.storm;
  if (a.id.startsWith("particle-")) alpha *= 0.28 + 0.72 * poseContext.storm;
  if (a.material === "mist") alpha *= 0.35;
  if (a.layer === "particles") alpha *= 0.48 + 0.24 * Math.sin(age * 3 + a.phase) ** 2;
  // Only depth extinction can remove a nearby object. Old particles naturally
  // travel beyond the far atmospheric range before the room assembles.
  const distance = poseContext.cameraZ - position[2];
  alpha *= atmosphericDepth(distance);
  // A world-space downstream exit cannot be undone by the later camera reversal.
  // At this exit optical transmission is already below 0.0001 throughout the path.
  if (t >= CUT.room || eye[2] - position[2] > 48000) alpha = 0;
  return {
    position,
    velocity: motion?.velocity,
    rotation,
    size,
    alpha,
    bend: m.flutter * g * (0.75 + 0.25 * Math.sin(age * 2 + a.phase)),
    adhesion,
    blur: clamp((distance - 700) / 4200) * 1.8,
  };
}
export function welcome(person: { registered: boolean; displayName: string | null }, captain: boolean) {
  return person.registered && person.displayName?.trim()
    ? `WELCOME, ${person.displayName.trim().toLocaleUpperCase()}`
    : captain
      ? "WELCOME, CAPTAIN"
      : "WELCOME ABOARD";
}
export function entryDuration(seen: boolean, replay: boolean, reduced: boolean) {
  return reduced ? 1.8 : seen && !replay ? 2 : DURATION;
}

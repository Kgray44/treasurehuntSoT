/** A seekable scene program: all values depend on identity, time and viewport, never frame count. */
export const EMBARKATION_VERSION = "embarkation-1.0.0";
// Delta 2 is authored in seconds. Fast releases and near passes retain their
// physical velocities; discovery, fog travel and anchor catches get new shots.
export const CUT = {
  pressure: 4,
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
export const beats = [
  [0, "The page holds"],
  [2.2, "The title catches the wind"],
  [4, "Pressure / edge tension"],
  [7.2, "Anchors fail"],
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
  const shelter = 1 - 0.71 * smooth(14.1, 20.5, t);
  // Fog remains advected by the same field. Only the room's last anchor shot
  // removes the residual pressure, rather than resetting wind at a scene cut.
  return pressure * crest * shelter * (1 - smooth(31.5, CUT.settled, t));
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
  const g = gust(t),
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
  hero?: "map" | "collision" | "lantern" | "rope";
  layer: "paper" | "props" | "mist" | "particles" | "light" | "spray";
  additive?: boolean;
};
export type Pose = {
  position: Vec3;
  rotation: Vec3;
  size: number;
  alpha: number;
  bend: number;
  adhesion: number;
  blur: number;
};
// Fixed-step entrainment is precomputed once per actor. Every loose material
// starts behind the eye and overtakes it; seeking never advances a simulation.
const dynamicsCache = new WeakMap<Actor, Float32Array>();
// Physical seconds are independent of how long subsequent scenic beats last.
// The cache has a fixed physical horizon, followed by ballistic continuation.
export const FLIGHT_CACHE_SECONDS = 12;
export function materialResponse(a: Actor, age: number): Vec3 {
  const eye = camera(a.birth).position;
  const origin: Vec3 = [a.position[0] + eye[0], a.position[1] + eye[1], eye[2] + 1320 + Math.abs(a.position[2]) * 0.12];
  if (age <= 0) return origin;
  let samples = dynamicsCache.get(a);
  const dt = a.material === "mote" ? 1 / 45 : 1 / 90;
  if (!samples) {
    const count = Math.ceil(FLIGHT_CACHE_SECONDS / dt) + 1;
    samples = new Float32Array(count * 3);
    const p: Vec3 = [...origin],
      v: Vec3 = [0, 0, a.material === "metal" ? -2000 : a.material === "mote" ? -5200 : -3600],
      m = materials[a.material];
    const drag = Math.min(10, 0.7 + (m.area * m.drag * m.coupling) / (m.mass + 0.08));
    samples.set(p);
    for (let step = 1; step < count; step++) {
      const field = wind(a.birth + step * dt, p);
      for (let axis = 0; axis < 3; axis++) {
        const carry =
          a.material === "metal" ? 5800 : a.material === "cloth" ? 7300 : a.material === "mote" ? 10000 : 8500;
        const target = axis === 2 ? Math.min(-carry, field[axis]) : field[axis];
        v[axis] += (target - v[axis]) * drag * dt;
        p[axis] += v[axis] * dt;
      }
      samples.set(p, step * 3);
    }
    dynamicsCache.set(a, samples);
  }
  if (age > FLIGHT_CACHE_SECONDS) {
    const end = samples.length - 3;
    return [0, 1, 2].map(
      (axis) =>
        samples![end + axis] + ((samples![end + axis] - samples![end - 3 + axis]) / dt) * (age - FLIGHT_CACHE_SECONDS),
    ) as Vec3;
  }
  const frame = clamp(age / dt, 0, samples.length / 3 - 1),
    i = Math.floor(frame),
    j = Math.min(i + 1, samples.length / 3 - 1),
    u = frame - i;
  return [0, 1, 2].map((axis) => mix(samples![i * 3 + axis], samples![j * 3 + axis], u)) as Vec3;
}
/** Spatially shared wind torque with material-dependent inertial response. */
export function flowRotation(t: number, age: number, p: Vec3, phase: number, inertia: number): Vec3 {
  const f = wind(t, p),
    lever = 1 / Math.sqrt(inertia),
    spin = age * (1.65 + 0.42 * Math.sin(phase));
  return [
    (spin * 0.61 + Math.sin(age * 1.3 + phase) * 0.35 + f[1] * 0.0016) * lever,
    (spin + Math.sin(p[2] * 0.0005 + t * 0.45) * 0.3 + f[0] * 0.0012) * lever,
    (spin * 0.43 + Math.sin(age * 0.9 + phase) * 0.23) * lever,
  ];
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
  add({
    id: "focus-catch",
    asset: "derived/scrap-2",
    material: "paper",
    birth: CUT.catch - 0.9,
    life: 18,
    position: [0, 0, 0],
    size: 450,
    hero: "collision",
    layer: "paper",
  });
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
/** One title identity: measured page heading -> caught arc -> outdoor landmark. */
export function focusPose(
  t: number,
  width: number,
  height: number,
  origin?: { x: number; y: number; width: number; height: number },
): Pose {
  const c = camera(t).position,
    factor = 1100 / height;
  const from: Vec3 = origin
    ? [(origin.x + origin.width / 2 - width / 2) * factor, (height / 2 - origin.y - origin.height / 2) * factor, 0]
    : [-100, 170, 0];
  const lift = smooth(1.2, 3.35, t),
    returning = smooth(3.35, 6.1, t),
    arc = Math.sin(Math.PI * returning);
  const fix = smooth(10, 16.5, t),
    release = smooth(28.2, 30.6, t);
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
      lift * (1 - returning) * 0.45 + release * 2.6,
      lift * Math.PI * (1 - returning) + release * 3.4,
      -lift * (1 - returning) * 0.5 - release * 2.3,
    ],
    size,
    alpha: t >= 0.45 && t < CUT.room ? 1 : 0,
    bend: lift * (1 - returning) * 2.1 + release * 3.2,
    adhesion: 0,
    blur: 0,
  };
}
export function poseAt(a: Actor, t: number, width: number, height: number): Pose {
  const age = t - a.birth,
    m = materials[a.material],
    c = composition(width, height),
    g = gust(t);
  const advected = materialResponse(a, age),
    eye = camera(a.birth).position;
  let position: Vec3 = [eye[0] + (advected[0] - eye[0]) * c.spread, advected[1], advected[2]];
  const rotationFlow = flowRotation(t, Math.max(0, age), position, a.phase, m.inertia);
  let rotation: Vec3 = a.rotation.map((r, i) => r + rotationFlow[i]) as Vec3;
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
  if (a.hero === "collision") {
    const catchAt = 0.9,
      peel = smooth(CUT.peel - a.birth, CUT.peel - a.birth + 0.65, age),
      out = Math.max(0, t - CUT.peel - 0.3);
    const f = focusPose(t, width, height),
      contact = smooth(0, catchAt, age);
    const catchPoint: Vec3 = [f.position[0] + f.size * 0.09, f.position[1] - f.size * 0.024, f.position[2] + 35];
    adhesion = smooth(0.72, 0.9, age) * (1 - peel);
    position = [
      mix(eye[0] - 270 * c.spread, catchPoint[0], contact) + out * out * 300,
      mix(eye[1] + 360, catchPoint[1], contact) + Math.sin(out * 3) * 120,
      mix(eye[2] + 1390, catchPoint[2], contact) - out * out * 3700,
    ];
    const releasedSpin = flowRotation(t, out, position, a.phase, m.inertia);
    rotation = [
      -0.4 * (1 - contact) + peel * (1.8 + releasedSpin[0]),
      0.5 * (1 - contact) + peel * (1.2 + releasedSpin[1]),
      0.45 * (1 - contact) - peel * 1.5 + peel * releasedSpin[2],
    ];
    size *= c.hero;
  }
  if (a.material === "mist" || a.layer === "spray") alpha *= stormEnergy(t);
  if (a.id.startsWith("particle-")) alpha *= 0.28 + 0.72 * stormEnergy(t);
  if (a.material === "mist") alpha *= 0.35;
  if (a.layer === "particles") alpha *= 0.48 + 0.24 * Math.sin(age * 3 + a.phase) ** 2;
  // Only depth extinction can remove a nearby object. Old particles naturally
  // travel beyond the far atmospheric range before the room assembles.
  const distance = camera(t).position[2] - position[2];
  alpha *= atmosphericDepth(distance);
  // A world-space downstream exit cannot be undone by the later camera reversal.
  // At this exit optical transmission is already below 0.0001 throughout the path.
  if (t >= CUT.room || eye[2] - position[2] > 48000) alpha = 0;
  return {
    position,
    rotation,
    size,
    alpha,
    bend: m.flutter * g * (0.75 + 0.25 * Math.sin(age * 2 + a.phase)),
    adhesion,
    blur: clamp((camera(t).position[2] - position[2] - 700) / 4200) * 1.8,
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

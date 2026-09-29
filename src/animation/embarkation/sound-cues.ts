import { camera, clamp, hash, poseAt, random, type Actor } from "./program";
import { FOCAL, projectWorld, type Point3, type Viewport } from "./projection";

export type FoleyKind =
  | "paper-release"
  | "cloth-release"
  | "card-release"
  | "button-release"
  | "paper-pass"
  | "paper-contact"
  | "paper-strain"
  | "paper-peel"
  | "wet-hit"
  | "anchor-paper"
  | "anchor-card"
  | "anchor-heavy";
export type SoundCue = {
  id: string;
  time: number;
  duration: number;
  kind: FoleyKind;
  energy: number;
  pan: readonly [number, number];
  source: string;
};
export function soundPan(point: Point3, time: number, viewport: Viewport) {
  const p = projectWorld(point, camera(time), viewport);
  return clamp((p.x / viewport.width - 0.5) * 1.7, -0.9, 0.9);
}
/** Locate a near pass from its actual projected trajectory. The score prefers
 * material occupying the image, not an enormous offscreen object behind eye.
 * This runs during preparation, not in the audio/render frame loop. */
export function paperPassCue(actor: Actor, viewport: Viewport): SoundCue | null {
  let best: { time: number; score: number; point: Point3 } | null = null;
  for (let t = actor.birth; t < Math.min(actor.birth + 5, 31); t += 1 / 120) {
    const p = poseAt(actor, t, viewport.width, viewport.height),
      cam = camera(t),
      q = projectWorld(p.position, cam, viewport);
    if (q.distance < 80 || q.distance > p.size * 10 || p.alpha < 0.2) continue;
    const width = (p.size * FOCAL * viewport.height) / (1100 * q.distance),
      height = width * 0.65;
    const x = Math.max(0, Math.min(viewport.width, q.x + width / 2) - Math.max(0, q.x - width / 2));
    const y = Math.max(0, Math.min(viewport.height, q.y + height / 2) - Math.max(0, q.y - height / 2));
    const score = (x * y) / (viewport.width * viewport.height);
    if (!best || score > best.score) best = { time: t, score, point: p.position };
  }
  if (!best || best.score < 0.006) return null;
  const start = Math.max(actor.birth, best.time - 0.19),
    duration = 0.54;
  const pan = (t: number) => soundPan(poseAt(actor, t, viewport.width, viewport.height).position, t, viewport);
  return {
    id: `pass:${actor.id}`,
    time: start,
    duration,
    kind: "paper-pass",
    energy: clamp(Math.sqrt(best.score) * 1.4, 0.14, 1),
    pan: [pan(start), pan(start + duration)],
    source: `actor:${actor.id}:projected-near-pass`,
  };
}

/** A transport cursor schedules against film time. It does not infer pauses
 * from frame duration, so a long frame never replays an expired impact. */
export class SoundCueCursor {
  private submitted = new Set<string>();
  private rate = 1;
  private previous = -Infinity;
  private paused = true;
  cues: readonly SoundCue[] = [];
  replace(cues: readonly SoundCue[]) {
    const ids = new Set(cues.map((c) => c.id));
    if (ids.size !== cues.length) throw new Error("Duplicate physical sound event identity");
    for (const c of cues)
      if (!Number.isFinite(c.time) || c.duration <= 0 || !Number.isFinite(c.duration))
        throw new Error("Invalid physical sound event");
    this.cues = [...cues].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  }
  reset() {
    this.submitted.clear();
    this.previous = -Infinity;
    this.paused = true;
  }
  advance(time: number, playing: boolean, rate = 1) {
    const reset = this.paused !== !playing || rate !== this.rate || time < this.previous - 0.0001;
    if (reset) this.submitted.clear();
    this.rate = rate;
    this.previous = time;
    this.paused = !playing;
    if (!playing) return { reset, start: [] as Array<{ cue: SoundCue; delay: number; offset: number }> };
    const start = [];
    for (const cue of this.cues) {
      if (cue.time > time + 0.1 * rate) break;
      if (cue.time + cue.duration <= time || this.submitted.has(cue.id)) continue;
      this.submitted.add(cue.id);
      start.push({ cue, delay: Math.max(0, (cue.time - time) / rate), offset: Math.max(0, time - cue.time) });
    }
    return { reset, start };
  }
}

/** Purpose-built dry foley. Material-specific resonances, filtered excitation
 * and irregular crackles are deterministic; energy/panning remain event data.
 * Output is unmastered mono at the AudioContext rate. */
export function synthesizeFoley(cue: SoundCue, seed: number, sampleRate: number) {
  const rng = random(seed ^ hash(cue.id)),
    n = Math.ceil(cue.duration * sampleRate),
    out = new Float32Array(n);
  const wet = cue.kind === "wet-hit",
    pass = cue.kind === "paper-pass",
    strain = cue.kind === "paper-strain";
  const cloth = cue.kind === "cloth-release",
    heavy = cue.kind === "anchor-heavy" || cue.kind === "button-release";
  const card = cue.kind === "card-release" || cue.kind === "anchor-card";
  const base = wet ? 1150 : heavy ? 175 : card ? 430 : cloth ? 260 : strain ? 920 : 1450;
  const attack = pass ? 0.045 : strain ? 0.028 : cloth ? 0.018 : wet ? 0.0015 : 0.003;
  let low = 0,
    mid = 0,
    phase = 0,
    previous = 0;
  const crackles = Array.from({ length: strain ? 19 : cloth ? 8 : pass ? 0 : 5 }, () => ({
    time: rng() * cue.duration * 0.82,
    width: 0.002 + rng() * 0.014,
    level: 0.2 + rng() * 0.8,
  }));
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate,
      u = t / cue.duration,
      white = rng() * 2 - 1;
    low += 0.035 * (white - low);
    mid += 0.24 * (white - mid);
    phase += (2 * Math.PI * base * (wet ? Math.exp(-t * 14) : 1)) / sampleRate;
    const damp = Math.exp(-t * (heavy ? 27 : wet ? 38 : card ? 35 : 22));
    const resonance = (Math.sin(phase) + 0.34 * Math.sin(phase * 1.63) + 0.12 * Math.sin(phase * 2.81)) * damp;
    let texture = pass ? low * 4 : cloth ? mid * 0.85 : strain ? (white - mid) * 0.17 : (white - mid) * 0.28;
    for (const click of crackles) {
      const d = (t - click.time) / click.width;
      texture += (white - previous) * Math.exp(-d * d) * click.level * 0.17;
    }
    const head = Math.min(1, t / attack),
      tail = Math.min(1, (cue.duration - t) / 0.025);
    const envelope =
      head *
      tail *
      (pass
        ? Math.sin(Math.PI * u) ** 1.5
        : strain
          ? 0.54 + 0.24 * Math.sin(t * 17.9) ** 2
          : Math.exp(-u * (cloth ? 2.2 : 4.5)));
    out[i] = Math.tanh((texture + resonance * (heavy ? 0.45 : wet ? 0.32 : card ? 0.25 : 0.08)) * envelope) * 0.78;
    previous = white;
  }
  return out;
}

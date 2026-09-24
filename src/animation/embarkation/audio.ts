import { CUT, gust, random, smooth } from "./program";

export type AudioStem = { id: string; url: string; start: number; gain: number };
/** Procedural, event-synchronized sound design. Approved recorded stems can be
 * supplied without changing choreography. No unrelated music dependency. */
export class EmbarkationAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: {
    gain: GainNode;
    filter?: BiquadFilterNode;
    pan?: StereoPannerNode;
    kind: string;
    level?: number;
  }[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private volume = 0.5;
  private enabled = false;
  private suspended = false;
  private noise: AudioBuffer | null = null;
  private lastUpdate: { time: number; enabled: boolean; paused: boolean } | null = null;
  prepare(seed: number) {
    if (this.noise) return;
    try {
      this.context ??= new AudioContext({ latencyHint: "interactive" });
      const buffer = new AudioBuffer({ numberOfChannels: 2, length: 48000 * 7, sampleRate: 48000 });
      const rng = random(seed);
      for (let ch = 0; ch < 2; ch++) {
        const b = buffer.getChannelData(ch);
        let brown = 0;
        for (let i = 0; i < b.length; i++) {
          brown = (brown + (rng() * 2 - 1) * 0.025) / 1.02;
          b[i] = brown * 3;
        }
        for (let i = 0; i < 512; i++) {
          const blend = i / 511;
          b[b.length - 512 + i] = b[b.length - 512 + i] * (1 - blend) + b[i] * blend;
        }
      }
      this.noise = buffer;
    } catch {
      /* Unsupported audio leaves the complete visual ceremony available. */
    }
  }
  async unlock(seed: number, enabled: boolean, volume: number, stems: AudioStem[] = []) {
    this.enabled = enabled;
    this.volume = volume;
    if (!enabled) return;
    try {
      const ctx = this.context ?? new AudioContext();
      this.context = ctx;
      let resumeTimer: ReturnType<typeof setTimeout> | undefined;
      const resumed = await Promise.race([
        ctx.resume().then(() => true),
        new Promise<boolean>((resolve) => {
          resumeTimer = setTimeout(() => resolve(false), 1500);
        }),
      ]);
      clearTimeout(resumeTimer);
      if (!resumed) return;
      if (this.suspended) return;
      if (this.master) return;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.master = master;
      this.prepare(seed);
      const buffer = this.noise;
      if (!buffer) return;
      for (const [kind, freq, pan] of [
        ["air", 620, 0],
        ["gust", 240, 0],
        ["flutter", 1800, -0.2],
        ["pass", 1150, -0.8],

        ["collision", 2600, 0.1],
        ["ocean", 380, 0.3],
        ["wood", 160, -0.35],
      ] as const) {
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain(),
          panner = ctx.createStereoPanner();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = kind === "flutter" ? 1.8 : kind === "wood" ? 0.55 : 1;
        filter.type = kind === "air" || kind === "ocean" ? "lowpass" : "bandpass";
        filter.frequency.value = freq;
        filter.Q.value = kind === "wood" ? 4 : 0.5;
        gain.gain.value = 0;
        panner.pan.value = pan;
        source.connect(filter).connect(gain).connect(panner).connect(master);
        source.start();
        this.sources.push(source);
        this.voices.push({ kind, gain, filter, pan: panner });
      }
      for (const f of [146.83, 220, 293.66]) {
        const o = ctx.createOscillator(),
          gain = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        gain.gain.value = 0;
        o.connect(gain).connect(master);
        o.start();
        this.sources.push(o);
        this.voices.push({ kind: "resolve", gain });
      }
      for (const stem of stems) {
        try {
          const bytes = await (await fetch(stem.url)).arrayBuffer(),
            b = await ctx.decodeAudioData(bytes);
          if (this.suspended) break;
          const s = ctx.createBufferSource(),
            gain = ctx.createGain();
          s.buffer = b;
          gain.gain.value = 0;
          s.connect(gain).connect(master);
          s.start(ctx.currentTime + stem.start);
          this.sources.push(s);
          this.voices.push({ kind: "stem", gain, level: stem.gain });
        } catch {
          /* Optional stems never block arrival. */
        }
      }
      // Some browser/device combinations report running before the first
      // hardware audio block. Warm that clock before frame one when possible.
      const began = performance.now();
      while (!this.suspended && ctx.currentTime === 0 && performance.now() - began < 1200)
        await new Promise((resolve) => setTimeout(resolve, 16));
    } catch {
      /* Browser autoplay/device policy can keep the complete film silent. */
    }
  }
  update(t: number, enabled = this.enabled, volume = this.volume, paused = false, ambience = false) {
    this.lastUpdate = { time: t, enabled, paused };
    const c = this.context;
    if (!c || !this.master) return;
    this.master.gain.setTargetAtTime(
      enabled && !paused ? Math.min(1, Math.max(0, volume)) * 0.38 : 0,
      c.currentTime,
      0.04,
    );
    const g = gust(t),
      env = smooth(25.5, 30.5, t),
      tail = 1 - smooth(34.2, CUT.end, t);
    for (const v of this.voices) {
      const value = ambience
        ? v.kind === "ocean"
          ? 0.13
          : v.kind === "wood"
            ? 0.014
            : 0
        : v.kind === "air"
          ? 0.08 * tail
          : v.kind === "gust"
            ? g * 0.8
            : v.kind === "flutter"
              ? g * (0.1 + 0.055 * Math.sin(t * 31) ** 2)
              : v.kind === "pass"
                ? Math.exp(-(((t - 14.1) / 0.44) ** 2)) * 0.8
                : v.kind === "rope"
                  ? Math.exp(-(((t - 10.05) / 0.35) ** 2)) * 0.42
                  : v.kind === "collision"
                    ? Math.exp(-(((t - CUT.catch) / 0.075) ** 2)) * 0.21
                    : v.kind === "ocean"
                      ? env * 0.23 * tail
                      : v.kind === "wood"
                        ? env * 0.024 * tail
                        : v.kind === "resolve"
                          ? smooth(33.1, 34.1, t) * 0.026 * tail
                          : tail * (v.level ?? 0.25);
      v.gain.gain.setTargetAtTime(value, c.currentTime, 0.023);
      if (v.kind === "pass") v.pan?.pan.setValueAtTime(Math.max(-1, Math.min(1, (t - 14.1) * 2)), c.currentTime);
      if (v.kind === "rope") v.pan?.pan.setValueAtTime(Math.max(-1, Math.min(1, (10.05 - t) * 2)), c.currentTime);
      if (v.kind === "gust") v.filter?.frequency.setTargetAtTime(180 + g * 570, c.currentTime, 0.06);
    }
  }
  dispose() {
    this.suspended = true;
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.sources = [];
    this.voices = [];
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.noise = null;
  }
  diagnostics() {
    return {
      state: this.context?.state ?? "silent",
      clock: this.context?.currentTime,
      lastUpdate: this.lastUpdate,
      gain: this.master?.gain.value ?? 0,
      voices: this.voices.map((v) => ({ kind: v.kind, gain: v.gain.gain.value, pan: v.pan?.pan.value })),
    };
  }
}

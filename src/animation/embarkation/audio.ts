import { CUT, gust, hash, random, smooth } from "./program";
import { SoundCueCursor, synthesizeFoley, type SoundCue } from "./sound-cues";

/** Continuous air/room beds plus physical event foley. The transport owns event
 * time; AudioContext owns sample time. Seeking/pause/rate changes reconstruct
 * only the live tail of an event, never a second full attack. */
export class EmbarkationAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private output: DynamicsCompressorNode | null = null;
  private voices: { gain: GainNode; filter?: BiquadFilterNode; pan?: StereoPannerNode; kind: string }[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private events = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }>();
  private buffers = new Map<string, AudioBuffer>();
  private cursor = new SoundCueCursor();
  private seed = 0;
  private volume = 0.5;
  private enabled = false;
  private disposed = false;
  private noise: AudioBuffer | null = null;
  private unlocking: Promise<void> | null = null;
  private fired: Array<{ id: string; filmTime: number; scheduledAt: number; offset: number; rate: number }> = [];
  private lastUpdate: { time: number; enabled: boolean; paused: boolean; rate: number; ambience: boolean } | null =
    null;
  private bufferKey(cue: SoundCue) {
    return `${cue.id}:${cue.kind}:${cue.duration}`;
  }
  setCues(cues: readonly SoundCue[]) {
    const old = this.cursor.cues;
    if (JSON.stringify(old) === JSON.stringify([...cues].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))))
      return;
    this.stopEvents();
    this.cursor.reset();
    this.cursor.replace(cues);
    this.prepareEvents();
  }
  private prepareEvents() {
    const ctx = this.context;
    if (!ctx) return;
    const keep = new Set<string>();
    for (const cue of this.cursor.cues) {
      const key = this.bufferKey(cue);
      keep.add(key);
      if (this.buffers.has(key)) continue;
      const samples = synthesizeFoley(cue, this.seed, ctx.sampleRate),
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(key, buffer);
    }
    for (const key of this.buffers.keys()) if (!keep.has(key)) this.buffers.delete(key);
  }
  prepare(seed: number) {
    if (this.disposed) return;
    if (this.seed !== seed) {
      this.buffers.clear();
      this.noise = null;
    }
    this.seed = seed;
    try {
      this.context ??= new AudioContext({ latencyHint: "interactive" });
      if (!this.noise) {
        const buffer = this.context.createBuffer(2, this.context.sampleRate * 7, this.context.sampleRate),
          rng = random(seed);
        for (let channel = 0; channel < 2; channel++) {
          const b = buffer.getChannelData(channel);
          let brown = 0;
          for (let i = 0; i < b.length; i++) {
            brown = (brown + (rng() * 2 - 1) * 0.025) / 1.02;
            b[i] = brown * 3;
          }
          for (let i = 0; i < 512; i++) {
            const u = i / 511;
            b[b.length - 512 + i] = b[b.length - 512 + i] * (1 - u) + b[i] * u;
          }
        }
        this.noise = buffer;
      }
      this.prepareEvents();
    } catch {
      /* Silent playback remains complete on unsupported audio platforms. */
    }
  }
  unlock(seed: number, enabled: boolean, volume: number) {
    this.seed = seed;
    this.enabled = enabled;
    this.volume = volume;
    if (!enabled || this.disposed) return Promise.resolve();
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.start(seed).finally(() => {
      this.unlocking = null;
    });
    return this.unlocking;
  }
  private async start(seed: number) {
    try {
      this.prepare(seed);
      const ctx = this.context;
      if (!ctx) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resumed = await Promise.race([
        ctx.resume().then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 1500);
        }),
      ]);
      clearTimeout(timer);
      if (!resumed || this.disposed || this.master) return;
      const master = ctx.createGain(),
        compressor = ctx.createDynamicsCompressor();
      master.gain.value = 0;
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.007;
      compressor.release.value = 0.18;
      master.connect(compressor).connect(ctx.destination);
      this.master = master;
      this.output = compressor;
      for (const [kind, freq, pan, rate] of [
        ["air", 620, 0, 1],
        ["gust", 240, 0, 1.137],
        ["ocean", 380, 0.3, 0.731],
        ["wood", 160, -0.35, 0.55],
      ] as const) {
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain(),
          panner = ctx.createStereoPanner();
        source.buffer = this.noise;
        source.loop = true;
        source.playbackRate.value = rate;
        filter.type = kind === "air" || kind === "ocean" ? "lowpass" : "bandpass";
        filter.frequency.value = freq;
        filter.Q.value = kind === "wood" ? 4 : 0.5;
        gain.gain.value = 0;
        panner.pan.value = pan;
        source.connect(filter).connect(gain).connect(panner).connect(master);
        source.start(0, (hash(kind) % 6500) / 1000);
        this.sources.push(source);
        this.voices.push({ kind, gain, filter, pan: panner });
      }
      for (const frequency of [146.83, 220, 293.66]) {
        const source = ctx.createOscillator(),
          gain = ctx.createGain();
        source.type = "sine";
        source.frequency.value = frequency;
        gain.gain.value = 0;
        source.connect(gain).connect(master);
        source.start();
        this.sources.push(source);
        this.voices.push({ kind: "resolve", gain });
      }
    } catch {
      /* Autoplay/device refusal leaves the ceremony silent. */
    }
  }
  private retiring = new Set<{ source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }>();
  private stopEvents(immediate = false) {
    for (const { source, gain, pan } of this.events.values()) {
      const event = { source, gain, pan };
      const cleanup = () => {
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
        this.retiring.delete(event);
      };
      this.retiring.add(event);
      source.onended = cleanup;
      try {
        const now = this.context?.currentTime ?? 0;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.002);
        source.stop(now + (immediate ? 0 : 0.012));
      } catch {}
      if (immediate) {
        source.onended = null;
        cleanup();
      }
    }
    this.events.clear();
  }
  seek(time: number) {
    this.stopEvents();
    this.cursor.reset();
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
    }
    if (this.lastUpdate) this.lastUpdate = { ...this.lastUpdate, time, paused: true };
  }
  update(t: number, enabled = this.enabled, volume = this.volume, paused = false, ambience = false, rate = 1) {
    this.enabled = enabled;
    this.volume = volume;
    this.lastUpdate = { time: t, enabled, paused, rate, ambience };
    if (this.disposed) return;
    if (enabled && !this.master && !this.unlocking) void this.unlock(this.seed, enabled, volume);
    const c = this.context;
    if (!c || !this.master) return;
    this.master.gain.setTargetAtTime(
      enabled && !paused ? Math.min(1, Math.max(0, volume)) * 0.38 : 0,
      c.currentTime,
      0.018,
    );
    const g = gust(t),
      env = smooth(25.5, CUT.room, t),
      shelter = 1 - smooth(CUT.threshold, CUT.room, t),
      tail = 1 - smooth(CUT.settled, CUT.still, t);
    for (const v of this.voices) {
      // Film and ambient modes have the same settled target. The loop and
      // filter state continue across visual handoff without a gain restart.
      const value =
        v.kind === "ocean"
          ? env * (0.13 + 0.06 * tail)
          : v.kind === "wood"
            ? env * (0.014 + 0.004 * tail)
            : v.kind === "air"
              ? 0.08 * tail * shelter
              : v.kind === "gust"
                ? g * 0.8 * shelter
                : v.kind === "resolve"
                  ? smooth(CUT.welcomeIn - 0.25, CUT.welcomeIn + 0.6, t) * 0.026 * tail
                  : 0;
      v.gain.gain.setTargetAtTime(value, c.currentTime, 0.023);
      if (v.kind === "gust") v.filter?.frequency.setTargetAtTime(180 + g * 570, c.currentTime, 0.06);
    }
    const plan = this.cursor.advance(t, enabled && !paused && !ambience, rate);
    if (plan.reset || !enabled || paused || ambience) this.stopEvents();
    for (const { cue, delay, offset } of plan.start) {
      const buffer = this.buffers.get(this.bufferKey(cue));
      if (!buffer) continue;
      const source = c.createBufferSource(),
        gain = c.createGain(),
        pan = c.createStereoPanner(),
        start = c.currentTime + delay;
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const level =
        cue.kind === "paper-pass"
          ? 0.42
          : cue.kind === "paper-strain"
            ? 0.1
            : cue.kind === "wet-hit"
              ? 0.23
              : cue.kind === "anchor-heavy"
                ? 0.34
                : 0.27;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level * Math.max(0, Math.min(1, cue.energy)), start + 0.002);
      const fraction = offset / cue.duration;
      pan.pan.setValueAtTime(cue.pan[0] + (cue.pan[1] - cue.pan[0]) * fraction, start);
      pan.pan.linearRampToValueAtTime(cue.pan[1], start + (cue.duration - offset) / rate);
      source.connect(gain).connect(pan).connect(this.master);
      const event = { source, gain, pan };
      this.events.set(cue.id, event);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
        if (this.events.get(cue.id) === event) this.events.delete(cue.id);
      };
      source.start(start, offset);
      this.fired.push({ id: cue.id, filmTime: t, scheduledAt: cue.time, offset, rate });
      if (this.fired.length > 256) this.fired.shift();
    }
  }
  dispose() {
    this.disposed = true;
    this.stopEvents(true);
    for (const { source, gain, pan } of this.retiring) {
      source.onended = null;
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    }
    this.retiring.clear();
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.sources = [];
    this.voices = [];
    this.buffers.clear();
    this.master?.disconnect();
    this.output?.disconnect();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.output = null;
    this.noise = null;
  }
  /** Exposed only by the development inspector for direct bus recording.
   * Does not request microphone, desktop or loopback-device permission. */
  inspectionOutput(): AudioNode | null {
    return this.output;
  }
  diagnostics() {
    return {
      state: this.context?.state ?? "silent",
      clock: this.context?.currentTime,
      lastUpdate: this.lastUpdate,
      gain: this.master?.gain.value ?? 0,
      voices: this.voices.map((v) => ({ kind: v.kind, gain: v.gain.gain.value, pan: v.pan?.pan.value })),
      activeEvents: this.events.size,
      preparedEvents: this.buffers.size,
      cues: this.cursor.cues,
      fired: this.fired,
      bufferBytes: [...this.buffers.values()].reduce((s, b) => s + b.length * 4, 0),
      compressorReduction: this.output?.reduction,
    };
  }
}

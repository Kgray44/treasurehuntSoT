import type { SpatialElement } from "@/parallax/element-contracts";
type AudioElement = Extract<SpatialElement, { kind: "SPATIAL_AUDIO" }>;
/** Task-local preview sound. Activation comes from a deliberate user gesture; no imported/private audio. */
export function createSpatialAudio() {
  let context: AudioContext | null = null;
  const voices = new Map<
    string,
    { source: AudioScheduledSourceNode; gain: GainNode; panner: PannerNode; filter: BiquadFilterNode; sound: string }
  >();
  const clear = () => {
    for (const v of voices.values()) {
      v.source.stop();
      v.source.disconnect();
      v.filter.disconnect();
      v.gain.disconnect();
      v.panner.disconnect();
    }
    voices.clear();
  };
  return {
    async enable() {
      context ??= new AudioContext();
      await context.resume();
    },
    update(
      sources: { id: string; element: AudioElement; position: [number, number, number]; envelope: number }[],
      listener: { position: number[]; forward: number[]; up: number[] },
      active: boolean,
    ) {
      if (!context) return;
      if (!active) {
        clear();
        return;
      }
      const live = new Set(sources.filter((s) => s.envelope > 0).map((s) => s.id));
      for (const [id, v] of voices)
        if (!live.has(id) || sources.find((s) => s.id === id)?.element.sound !== v.sound) {
          v.source.stop();
          v.source.disconnect();
          v.filter.disconnect();
          v.gain.disconnect();
          v.panner.disconnect();
          voices.delete(id);
        }
      const now = context.currentTime,
        l = context.listener;
      [l.positionX, l.positionY, l.positionZ].forEach((p, i) => p.setValueAtTime(listener.position[i], now));
      [l.forwardX, l.forwardY, l.forwardZ].forEach((p, i) => p.setValueAtTime(listener.forward[i], now));
      [l.upX, l.upY, l.upZ].forEach((p, i) => p.setValueAtTime(listener.up[i], now));
      for (const { id, element: e, position, envelope } of sources) {
        if (!live.has(id)) continue;
        let voice = voices.get(id);
        if (!voice) {
          const filter = context.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = e.sound === "WIND" ? 450 : 1200;
          let source: AudioScheduledSourceNode;
          if (e.sound === "WIND") {
            const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate),
              samples = buffer.getChannelData(0);
            let seed = 173;
            for (let i = 0; i < samples.length; i++) {
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              samples[i] = ((seed / 4294967296) * 2 - 1) * 0.3;
            }
            const noise = context.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            source = noise;
          } else {
            const osc = context.createOscillator();
            osc.type = "sine";
            osc.frequency.value = e.sound === "ETHER" ? 174.61 : 65.41;
            source = osc;
          }
          const gain = context.createGain(),
            panner = context.createPanner();
          panner.panningModel = "HRTF";
          panner.distanceModel = "inverse";
          source.connect(filter).connect(gain).connect(panner).connect(context.destination);
          source.start();
          voice = { source, gain, panner, filter, sound: e.sound };
          voices.set(id, voice);
        }
        const p = voice.panner;
        p.refDistance = e.refDistance;
        p.maxDistance = e.maxDistance;
        p.rolloffFactor = e.rolloff;
        [p.positionX, p.positionY, p.positionZ].forEach((v, i) => v.setValueAtTime(position[i], now));
        voice.gain.gain.setTargetAtTime(e.gain * envelope, now, 0.025);
      }
    },
    stop() {
      clear();
    },
    dispose() {
      clear();
      void context?.close();
      context = null;
    },
    count: () => voices.size,
  };
}

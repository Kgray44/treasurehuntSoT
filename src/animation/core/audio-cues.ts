export const audioCueNames = [
  "ocean-rise",
  "wood-creak",
  "lantern-ignition",
  "brass-latch",
  "seal-pressure",
  "wax-crack",
  "page-turn",
  "paper-flutter",
  "quill-scratch",
  "stamp-impact",
  "compass-click",
  "map-scratch",
  "artifact-chime",
  "mechanism-hum",
  "pause-wind-down",
  "undo-reverse",
] as const;

export type AudioCueName = (typeof audioCueNames)[number];

const frequencies: Record<AudioCueName, [number, number, number]> = {
  "ocean-rise": [48, 72, 1.1],
  "wood-creak": [96, 64, 0.45],
  "lantern-ignition": [180, 320, 0.22],
  "brass-latch": [240, 92, 0.18],
  "seal-pressure": [82, 54, 0.42],
  "wax-crack": [136, 44, 0.24],
  "page-turn": [220, 110, 0.32],
  "paper-flutter": [310, 170, 0.28],
  "quill-scratch": [420, 360, 0.18],
  "stamp-impact": [118, 46, 0.3],
  "compass-click": [520, 260, 0.12],
  "map-scratch": [360, 210, 0.32],
  "artifact-chime": [440, 880, 0.7],
  "mechanism-hum": [58, 92, 0.9],
  "pause-wind-down": [120, 42, 0.68],
  "undo-reverse": [210, 74, 0.5],
};

export class AudioCuePlayer {
  private context: AudioContext | null = null;
  private active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private volume = 0.4;
  private muted = false;

  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") {
        void this.context.resume().catch(() => {
          // Audio is optional; a blocked device must never hold the journal closed.
        });
      }
    } catch {
      this.context = null;
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  play(name: AudioCueName) {
    if (!this.context || this.muted || this.volume <= 0) return;
    const [start, end, duration] = frequencies[name];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = name.includes("chime") || name.includes("compass") ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);
    gain.gain.setValueAtTime(Math.max(0.001, this.volume * 0.11), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    const entry = { oscillator, gain };
    this.active.add(entry);
    oscillator.onended = () => this.active.delete(entry);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  stopAll() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.active.forEach(({ oscillator, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.001, now, 0.025);
      try {
        oscillator.stop(now + 0.12);
      } catch {
        // The cue may already have reached its natural end.
      }
    });
  }

  close() {
    this.stopAll();
    void this.context?.close();
    this.context = null;
  }
}

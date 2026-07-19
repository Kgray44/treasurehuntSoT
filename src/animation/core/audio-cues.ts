import type { ResolvedMotionPolicy } from "./animation-types";

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

export type AudioCueMotionPolicy = Pick<ResolvedMotionPolicy, "allowMotionCues">;

export type ValidatedAudioCueRequest = {
  name: AudioCueName;
  motionPolicy: AudioCueMotionPolicy;
  motionOnly: boolean;
  presentationValidated: boolean;
  semanticLabel: string | null;
  allowedSemanticLabels: readonly string[];
};

export type AudioCueSkipReason =
  | "presentation-not-validated"
  | "semantic-label-not-allowed"
  | "motion-cues-disabled"
  | "muted"
  | "zero-volume"
  | "audio-context-locked";

export type AudioCueRuntimeFailureCode =
  | "audio-context-unavailable"
  | "audio-context-suspended"
  | "audio-context-closed"
  | "audio-node-failed"
  | "audio-close-failed";

export type AudioCuePlaybackResult =
  | {
      cue: AudioCueName;
      outcome: "played";
      started: true;
      presentationProof: false;
    }
  | {
      cue: AudioCueName;
      outcome: "skipped";
      reason: AudioCueSkipReason;
      started: false;
      presentationProof: false;
    }
  | {
      cue: AudioCueName;
      outcome: "runtime-failed";
      code: AudioCueRuntimeFailureCode;
      started: false;
      presentationProof: false;
    };

export type AudioCueUnlockResult =
  | { outcome: "ready" | "resume-requested" }
  | { outcome: "runtime-failed"; code: AudioCueRuntimeFailureCode };

export type AudioCueCleanupResult =
  | { outcome: "closed" | "already-closed" }
  | { outcome: "runtime-failed"; code: "audio-close-failed" };

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

type ActiveAudioCue = {
  oscillator: OscillatorNode;
  gain: GainNode;
  stopRequested: boolean;
  released: boolean;
};

export class AudioCuePlayer {
  private context: AudioContext | null = null;
  private active = new Set<ActiveAudioCue>();
  private volume = 0.4;
  private muted = false;
  private contextUnavailable = false;

  unlock(): AudioCueUnlockResult {
    try {
      this.context ??= new AudioContext();
      this.contextUnavailable = false;
      if (this.context.state === "suspended") {
        void this.context.resume().catch(() => {
          // Audio is optional; a blocked device must never hold the journal closed.
        });
        return { outcome: "resume-requested" };
      }
      return { outcome: "ready" };
    } catch {
      this.context = null;
      this.contextUnavailable = true;
      return { outcome: "runtime-failed", code: "audio-context-unavailable" };
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  /**
   * @deprecated Temporary compatibility for callers that have not migrated to
   * presentation receipts. New integrations must use playValidated().
   */
  play(name: AudioCueName): AudioCuePlaybackResult {
    return this.startCue(name, true);
  }

  playValidated(request: ValidatedAudioCueRequest): AudioCuePlaybackResult {
    if (!request.presentationValidated) {
      return this.skipped(request.name, "presentation-not-validated");
    }
    if (!request.semanticLabel || !request.allowedSemanticLabels.includes(request.semanticLabel)) {
      return this.skipped(request.name, "semantic-label-not-allowed");
    }
    if (request.motionOnly && !request.motionPolicy.allowMotionCues) {
      return this.skipped(request.name, "motion-cues-disabled");
    }
    return this.startCue(request.name);
  }

  private startCue(name: AudioCueName, allowSuspendedContext = false): AudioCuePlaybackResult {
    if (this.muted) return this.skipped(name, "muted");
    if (this.volume <= 0) return this.skipped(name, "zero-volume");
    if (!this.context) {
      if (this.contextUnavailable) return this.runtimeFailed(name, "audio-context-unavailable");
      return this.skipped(name, "audio-context-locked");
    }
    if (this.context.state === "suspended" && !allowSuspendedContext) {
      return this.runtimeFailed(name, "audio-context-suspended");
    }
    if (this.context.state === "closed") return this.runtimeFailed(name, "audio-context-closed");

    const [start, end, duration] = frequencies[name];
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let entry: ActiveAudioCue | null = null;

    try {
      oscillator = this.context.createOscillator();
      gain = this.context.createGain();
      const now = this.context.currentTime;
      oscillator.type = name.includes("chime") || name.includes("compass") ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);
      gain.gain.setValueAtTime(Math.max(0.001, this.volume * 0.11), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      entry = { oscillator, gain, stopRequested: false, released: false };
      this.active.add(entry);
      const activeEntry = entry;
      oscillator.onended = () => this.release(activeEntry);
      oscillator.start(now);
      if (!this.requestStop(entry, now + duration + 0.02)) {
        this.release(entry);
        return this.runtimeFailed(name, "audio-node-failed");
      }
      return { cue: name, outcome: "played", started: true, presentationProof: false };
    } catch {
      if (entry) {
        this.release(entry);
      } else {
        this.disconnectNodes(oscillator, gain);
      }
      return this.runtimeFailed(name, "audio-node-failed");
    }
  }

  stopAll() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.active.forEach((entry) => {
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setTargetAtTime(0.001, now, 0.025);
      this.requestStop(entry, now + 0.12);
    });
  }

  async close(): Promise<AudioCueCleanupResult> {
    const context = this.context;
    if (!context) return { outcome: "already-closed" };

    const now = context.currentTime;
    this.active.forEach((entry) => {
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setTargetAtTime(0.001, now, 0.025);
      this.requestStop(entry, now + 0.12);
      this.release(entry);
    });
    this.context = null;

    try {
      await context.close();
      return { outcome: "closed" };
    } catch {
      return { outcome: "runtime-failed", code: "audio-close-failed" };
    }
  }

  private requestStop(entry: ActiveAudioCue, when: number) {
    if (entry.stopRequested) return true;
    try {
      entry.oscillator.stop(when);
      entry.stopRequested = true;
      return true;
    } catch {
      return false;
    }
  }

  private release(entry: ActiveAudioCue) {
    if (entry.released) return;
    entry.released = true;
    entry.oscillator.onended = null;
    this.active.delete(entry);
    this.disconnectNodes(entry.oscillator, entry.gain);
  }

  private disconnectNodes(oscillator: OscillatorNode | null, gain: GainNode | null) {
    if (oscillator) {
      try {
        oscillator.disconnect();
      } catch {
        // Node cleanup is best-effort and never changes presentation truth.
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {
        // Node cleanup is best-effort and never changes presentation truth.
      }
    }
  }

  private skipped(cue: AudioCueName, reason: AudioCueSkipReason): AudioCuePlaybackResult {
    return { cue, outcome: "skipped", reason, started: false, presentationProof: false };
  }

  private runtimeFailed(cue: AudioCueName, code: AudioCueRuntimeFailureCode): AudioCuePlaybackResult {
    return { cue, outcome: "runtime-failed", code, started: false, presentationProof: false };
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioCuePlayer, type ValidatedAudioCueRequest } from "./audio-cues";

function createMockOscillator() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function createMockGain() {
  return {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  state: AudioContextState = "running";
  currentTime = 2;
  destination = {} as AudioDestinationNode;
  oscillators: ReturnType<typeof createMockOscillator>[] = [];
  gains: ReturnType<typeof createMockGain>[] = [];
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  createOscillator = vi.fn(() => {
    const oscillator = createMockOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  });
  createGain = vi.fn(() => {
    const gain = createMockGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }
}

function request(overrides: Partial<ValidatedAudioCueRequest> = {}): ValidatedAudioCueRequest {
  return {
    name: "wax-crack",
    motionPolicy: { allowMotionCues: true },
    motionOnly: true,
    presentationValidated: true,
    semanticLabel: "seal-fracture",
    allowedSemanticLabels: ["seal-fracture"],
    ...overrides,
  };
}

function unlockedPlayer() {
  const player = new AudioCuePlayer();
  expect(player.unlock()).toEqual({ outcome: "ready" });
  return { player, context: MockAudioContext.instances.at(-1)! };
}

describe("AudioCuePlayer validated playback", () => {
  beforeEach(() => {
    MockAudioContext.instances = [];
    vi.stubGlobal("AudioContext", MockAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed before validated presentation or an allowed semantic label", () => {
    const { player, context } = unlockedPlayer();

    expect(player.playValidated(request({ presentationValidated: false }))).toMatchObject({
      outcome: "skipped",
      reason: "presentation-not-validated",
      started: false,
      presentationProof: false,
    });
    expect(
      player.playValidated(request({ semanticLabel: "before-seal", allowedSemanticLabels: ["seal-fracture"] })),
    ).toMatchObject({
      outcome: "skipped",
      reason: "semantic-label-not-allowed",
      started: false,
      presentationProof: false,
    });
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it("suppresses only motion-related cues when the resolved policy disables them", () => {
    const { player, context } = unlockedPlayer();

    expect(player.playValidated(request({ motionPolicy: { allowMotionCues: false }, motionOnly: true }))).toMatchObject(
      { outcome: "skipped", reason: "motion-cues-disabled", started: false },
    );
    expect(
      player.playValidated(request({ motionPolicy: { allowMotionCues: false }, motionOnly: false })),
    ).toMatchObject({ outcome: "played", started: true, presentationProof: false });
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("keeps mute and clamped volume independent from validation and motion policy", () => {
    const { player, context } = unlockedPlayer();

    player.setMuted(true);
    expect(player.playValidated(request())).toMatchObject({ outcome: "skipped", reason: "muted" });

    player.setMuted(false);
    player.setVolume(-1);
    expect(player.playValidated(request())).toMatchObject({ outcome: "skipped", reason: "zero-volume" });

    player.setVolume(2);
    expect(player.playValidated(request())).toMatchObject({ outcome: "played", started: true });
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.11, context.currentTime);
  });

  it("starts an allowed cue only after all gates pass and never reports presentation proof", () => {
    const { player, context } = unlockedPlayer();

    const result = player.playValidated(request({ name: "artifact-chime" }));

    expect(result).toEqual({
      cue: "artifact-chime",
      outcome: "played",
      started: true,
      presentationProof: false,
    });
    expect(context.oscillators[0].start).toHaveBeenCalledWith(context.currentTime);
    expect(context.oscillators[0].connect).toHaveBeenCalledTimes(1);
    expect(context.gains[0].connect).toHaveBeenCalledWith(context.destination);
  });

  it("returns sanitized nonblocking outcomes when AudioContext or node creation fails", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("private invitation PIN 1234");
        }
      },
    );
    const unavailable = new AudioCuePlayer();
    const unlockResult = unavailable.unlock();
    const unavailableResult = unavailable.playValidated(request());

    expect(unlockResult).toEqual({ outcome: "runtime-failed", code: "audio-context-unavailable" });
    expect(unavailableResult).toMatchObject({
      outcome: "runtime-failed",
      code: "audio-context-unavailable",
      started: false,
      presentationProof: false,
    });
    expect(JSON.stringify([unlockResult, unavailableResult])).not.toContain("1234");

    vi.stubGlobal("AudioContext", MockAudioContext);
    const { player, context } = unlockedPlayer();
    context.createOscillator.mockImplementationOnce(() => {
      throw new Error("private story prose");
    });
    const nodeFailure = player.playValidated(request());
    expect(nodeFailure).toMatchObject({ outcome: "runtime-failed", code: "audio-node-failed" });
    expect(JSON.stringify(nodeFailure)).not.toContain("private story prose");

    context.createOscillator.mockImplementationOnce(() => {
      const oscillator = createMockOscillator();
      oscillator.stop.mockImplementationOnce(() => {
        throw new Error("private runtime details");
      });
      context.oscillators.push(oscillator);
      return oscillator as unknown as OscillatorNode;
    });
    const stopFailure = player.playValidated(request());
    expect(stopFailure).toMatchObject({ outcome: "runtime-failed", code: "audio-node-failed" });
    expect(context.oscillators.at(-1)?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("closes the context and disconnects each active node exactly once", async () => {
    const { player, context } = unlockedPlayer();
    expect(player.playValidated(request())).toMatchObject({ outcome: "played" });
    const oscillator = context.oscillators[0];
    const gain = context.gains[0];
    const naturalEnd = oscillator.onended;

    await expect(player.close()).resolves.toEqual({ outcome: "closed" });
    await expect(player.close()).resolves.toEqual({ outcome: "already-closed" });
    naturalEnd?.();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it("sanitizes a nonblocking AudioContext close failure after releasing nodes", async () => {
    const { player, context } = unlockedPlayer();
    expect(player.playValidated(request())).toMatchObject({ outcome: "played" });
    context.close.mockRejectedValueOnce(new Error("private close details"));

    const result = await player.close();

    expect(result).toEqual({ outcome: "runtime-failed", code: "audio-close-failed" });
    expect(JSON.stringify(result)).not.toContain("private close details");
    expect(context.oscillators[0].disconnect).toHaveBeenCalledTimes(1);
    expect(context.gains[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the legacy play entry point working until callers migrate", () => {
    const { player, context } = unlockedPlayer();
    context.state = "suspended";

    expect(player.play("page-turn")).toMatchObject({ outcome: "played", started: true });
    expect(player.playValidated(request())).toMatchObject({
      outcome: "runtime-failed",
      code: "audio-context-suspended",
      started: false,
    });
  });
});

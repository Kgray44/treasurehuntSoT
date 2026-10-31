import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbarkationAudio } from "./audio";

class Param {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  pan = new Param();
  frequency = new Param();
  Q = new Param();
  playbackRate = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  reduction = 0;
  onended: (() => void) | null = null;
  loop = false;
  buffer: unknown;
  type = "";
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
  connect<T>(node: T): T {
    return node;
  }
}
class Context {
  currentTime = 0;
  state = "running";
  sampleRate = 16000;
  destination = new Node();
  nodes: Node[] = [];
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: (c: number) => data[c],
      copyToChannel: (a: Float32Array, c: number) => data[c].set(a),
    };
  }
  private node() {
    const n = new Node();
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.node();
  }
  createDynamicsCompressor() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createStereoPanner() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
}
afterEach(() => vi.unstubAllGlobals());
describe("Event audio lifecycle", () => {
  it("prepares before play, avoids duplicate unlocks, and releases sources at pause, mute and dispose", async () => {
    const context = new Context();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    const audio = new EmbarkationAudio();
    audio.prepare(42);
    audio.setCues([
      { id: "catch", time: 4, duration: 0.4, kind: "anchor-card", energy: 0.5, pan: [-0.2, 0.2], source: "measured" },
    ]);
    expect(audio.diagnostics().preparedEvents).toBe(1);
    await Promise.all([audio.unlock(42, true, 0.5), audio.unlock(42, true, 0.5)]);
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.update(3.95, true, 0.5);
    audio.update(4, true, 0.5);
    expect(audio.diagnostics().activeEvents).toBe(1);
    expect(audio.diagnostics().fired).toHaveLength(1);
    audio.update(4.1, true, 0.5, true);
    expect(audio.diagnostics().activeEvents).toBe(0);
    audio.update(4.1, true, 0.5);
    expect(audio.diagnostics().fired.at(-1)?.offset).toBeCloseTo(0.1);
    audio.update(4.15, false, 0.5);
    expect(audio.diagnostics().activeEvents).toBe(0);
    expect(audio.diagnostics().gain).toBe(0);
    audio.seek(0);
    audio.update(3.95, true, 0.5);
    expect(audio.diagnostics().activeEvents).toBe(1);
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(audio.diagnostics().activeEvents).toBe(0);
    expect(context.nodes.filter((n) => n.start.mock.calls.length).every((n) => n.stop.mock.calls.length > 0)).toBe(
      true,
    );
  });
  it("keeps settled room gains and source identity through cinematic to ambient handoff", async () => {
    const context = new Context();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    const audio = new EmbarkationAudio();
    await audio.unlock(4, true, 0.6);
    audio.update(35.8, true, 0.6, false, false);
    const before = audio.diagnostics(),
      count = context.nodes.length;
    audio.update(35.8, true, 0.6, false, true);
    const after = audio.diagnostics();
    expect(after.voices).toEqual(before.voices);
    expect(context.nodes.length).toBe(count);
    expect(after.voices.filter((v) => v.gain > 0).map((v) => v.kind)).toEqual(["ocean", "wood"]);
    audio.dispose();
  });
});

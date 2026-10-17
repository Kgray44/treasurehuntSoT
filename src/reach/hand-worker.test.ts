// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(fail: string[] = []) {
  const detector = { detectForVideo: vi.fn(() => ({ landmarks: [], handedness: [] })), close: vi.fn() };
  const create = vi.fn(async (_files: unknown, options: { baseOptions: { delegate: string } }) => {
    if (fail.includes(options.baseOptions.delegate)) throw new Error("UNAVAILABLE_BACKEND");
    return detector;
  });
  const messages: Record<string, unknown>[] = [];
  const self = {
    onmessage: null as unknown as (event: { data: Record<string, unknown> }) => Promise<void>,
    postMessage: (message: Record<string, unknown>) => messages.push(message),
    close: vi.fn(),
  };
  const context = createContext({
    self,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    crypto: {
      subtle: {
        digest: async () =>
          Uint8Array.from(Buffer.from("fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1", "hex"))
            .buffer,
      },
    },
    performance: { timeOrigin: 0, now: () => 110 },
    importScripts: () => {
      context.exports.FilesetResolver = { forVisionTasks: async () => ({}) };
      context.exports.HandLandmarker = { createFromOptions: create };
    },
  });
  runInContext(readFileSync(resolve("public/reach/hand-worker.js"), "utf8"), context);
  return { detector, create, messages, send: (data: Record<string, unknown>) => self.onmessage({ data }) };
}

describe("pinned hand worker startup backend", () => {
  it("keeps CPU as the default with the accepted weights, two hands and thresholds", async () => {
    const w = worker();
    await w.send({ type: "INIT", generation: 1 });
    expect(w.messages).toEqual([{ type: "READY", generation: 1, backend: "CPU_WASM" }]);
    expect(w.create).toHaveBeenCalledOnce();
    expect(w.create.mock.calls[0][1]).toMatchObject({
      baseOptions: { delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  });
  it("reports the actual CPU backend throughout a source generation", async () => {
    const w = worker();
    await w.send({ type: "INIT", generation: 2 });
    const bitmap = { width: 640, height: 480, close: vi.fn() };
    await w.send({ type: "FRAME", generation: 2, capture: 100, bitmap });
    expect(w.messages[0]).toEqual({ type: "READY", generation: 2, backend: "CPU_WASM" });
    expect(w.messages[1]).toMatchObject({ type: "RESULT", generation: 2, capture: 100, backend: "CPU_WASM" });
    expect(w.create).toHaveBeenCalledOnce();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("does not retry another backend after inference fails", async () => {
    const w = worker();
    await w.send({ type: "INIT", generation: 3 });
    w.detector.detectForVideo.mockImplementationOnce(() => {
      throw new Error("INFERENCE_FAILED");
    });
    await w.send({ type: "FRAME", generation: 3, capture: 100, bitmap: { close: vi.fn() } });
    expect(w.messages.at(-1)).toMatchObject({ type: "ERROR", reason: "MODEL_INFERENCE" });
    expect(w.create).toHaveBeenCalledOnce();
  });
  it("reports an explicit CPU model-init failure", async () => {
    const w = worker(["CPU"]);
    await w.send({ type: "INIT", generation: 4 });
    expect(w.messages).toEqual([{ type: "ERROR", generation: 4, reason: "MODEL_INIT" }]);
  });
});

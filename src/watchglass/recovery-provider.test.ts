// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Rect = { xCenter: number; yCenter: number; width: number; height: number; rotation: number };
type Point = { x: number; y: number; z: number };
type Result = { landmarks: Point[][]; worldLandmarks: Point[][]; handedness: unknown[][] };
type Geometry = { width: number; height: number; session: string; geometry: string; mirror: boolean };
type Assets = { task: Uint8Array; palm: Uint8Array; landmark: Uint8Array };
type Cache = {
  begin(capture: number, geometry: Geometry): Rect[];
  observe(capture: number, landmarks: Point[][], rects: Rect[]): void;
  reset(): void;
};
type Model = {
  detectForVideo(image: { width: number; height: number }, capture: number): Result;
  reset(context: Omit<Geometry, "width" | "height">): void;
  close(): void;
};
type Provider = {
  policy: { retentionMs: number; detection: number; presence: number; association: number };
  extractTaskChildren(bytes: Uint8Array): Pick<Assets, "palm" | "landmark">;
  verifyAssets(bundle: Uint8Array, task: Uint8Array): Promise<Assets>;
  createActualRegionCache(): Cache;
  create(fileset: object, assets: Assets, options?: { delegate?: string }): Promise<Model>;
};
const directory = resolve(process.cwd(), "public/reach");
const source = readFileSync(resolve(directory, "recovery-provider.js"), "utf8");
const workerSource = readFileSync(resolve(directory, "recovery-worker.js"), "utf8");
const bundle = new Uint8Array(readFileSync(resolve(directory, "vendor/vision_bundle.js")));
const task = new Uint8Array(readFileSync(resolve(directory, "vendor/hand_landmarker.task")));
const rect: Rect = { xCenter: 0.4, yCenter: 0.5, width: 0.3, height: 0.4, rotation: 0.2 };
const hand = () => Array.from({ length: 21 }, (_, index) => ({ x: 0.3 + index / 100, y: 0.4, z: -index / 200 }));
const geometry: Geometry = { width: 800, height: 600, session: "lease1", geometry: "v1", mirror: false };
function load(extra: Record<string, unknown> = {}) {
  const exports: { WatchglassRecoveryProvider?: Provider } = {};
  runInNewContext(source, {
    exports,
    Uint8Array,
    Float32Array,
    DataView,
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    ...extra,
  });
  return exports.WatchglassRecoveryProvider!;
}

describe("unreferenced pinned recovery provider", () => {
  it("extracts exactly the unchanged stored child models without new downloads or copies", async () => {
    const provider = load();
    const children = provider.extractTaskChildren(task);
    expect(children.palm.buffer).toBe(task.buffer);
    expect(children.landmark.buffer).toBe(task.buffer);
    expect(children.palm.byteOffset).toBe(52);
    expect(children.landmark.byteOffset).toBe(2339992);
    const verified = await provider.verifyAssets(bundle, task);
    expect(verified.palm.buffer).toBe(task.buffer);
    expect(verified.palm.byteOffset).toBe(children.palm.byteOffset);
    expect(verified.landmark.byteLength).toBe(children.landmark.byteLength);
  });
  it("fails closed on either changed pin before graph creation", async () => {
    const provider = load();
    const altered = bundle.slice();
    altered[30] ^= 1;
    await expect(provider.verifyAssets(altered, task)).rejects.toThrow("RECOVERY_RUNTIME_INTEGRITY");
    const alteredTask = task.slice();
    alteredTask[500] ^= 1;
    await expect(provider.verifyAssets(bundle, alteredTask)).rejects.toThrow("RECOVERY_TASK_INTEGRITY");
    await expect(provider.create({}, { task, ...provider.extractTaskChildren(task) })).rejects.toThrow(
      "RECOVERY_VERIFIED_ASSETS_REQUIRED",
    );
  });
  it("accepts the actual pinned protobuf schema array before invoking the model factory", async () => {
    const bindings = runInNewContext(`${new TextDecoder().decode(bundle)}\n({Uc,Vi,qs});`, {
      exports: {},
      TextEncoder,
      TextDecoder,
      Uint8Array,
      DataView,
      performance,
      self: {},
    }) as { Uc: unknown; Vi: unknown; qs: unknown };
    expect(Array.isArray(bindings.qs)).toBe(true);
    expect(bindings.qs).toHaveLength(5);
    const provider = load({
      ...bindings,
      fc: async () => {
        throw new Error("FACTORY_REACHED_WITH_REAL_ABI");
      },
    });
    await expect(provider.create({}, await provider.verifyAssets(bundle, task))).rejects.toThrow(
      "FACTORY_REACHED_WITH_REAL_ABI",
    );
  });
  it.each([
    ["compressed member", 7818941 + 10, 8],
    ["encrypted member", 7818941 + 8, 1],
    ["different local size", 2 + 18, 0],
    ["different local name", 2 + 30, 90],
    ["bad central offset", task.length - 22 + 16, 0],
  ])("rejects %s without decompression", (_name, at, value) => {
    const bad = task.slice();
    bad[at as number] = value as number;
    expect(() => load().extractTaskChildren(bad)).toThrow();
  });
  it("retains only real current neural regions for250ms, without renewal on empty results", () => {
    const cache = load().createActualRegionCache();
    expect(cache.begin(100, geometry)).toEqual([]);
    cache.observe(100, [hand()], [rect]);
    expect(cache.begin(200, geometry)).toEqual([rect]);
    cache.observe(200, [], []);
    expect(cache.begin(350, geometry)).toEqual([rect]);
    cache.observe(350, [], []);
    expect(cache.begin(350.001, geometry)).toEqual([]);
  });
  it.each(["width", "height", "session", "geometry", "mirror"] as const)("clears hypotheses on changed %s", (key) => {
    const cache = load().createActualRegionCache();
    cache.begin(100, geometry);
    cache.observe(100, [hand()], [rect]);
    const next = {
      ...geometry,
      [key]: typeof geometry[key] === "boolean" ? true : typeof geometry[key] === "number" ? 720 : "changed",
    };
    expect(cache.begin(101, next)).toEqual([]);
  });
  it("rejects reordered clocks even after an explicit reset and does not borrow later output", () => {
    const cache = load().createActualRegionCache();
    cache.begin(100, geometry);
    cache.observe(100, [hand()], [rect]);
    cache.reset();
    expect(() => cache.begin(100, geometry)).toThrow("RECOVERY_CAPTURE_ORDER");
    cache.begin(101, geometry);
    expect(() => cache.observe(100, [hand()], [rect])).toThrow("RECOVERY_CURRENT_OUTPUT");
    expect(() => cache.observe(101, [hand()], [])).toThrow("RECOVERY_CURRENT_OUTPUT");
    expect(() => cache.observe(101, [hand().slice(1)], [rect])).toThrow("RECOVERY_CURRENT_OUTPUT");
    expect(() => cache.observe(101, [hand(), hand(), hand()], [rect, rect, rect])).toThrow("RECOVERY_CURRENT_OUTPUT");
  });
  it("owns cached region values and has no fabricated joint or confidence output", () => {
    const cache = load().createActualRegionCache(),
      original = { ...rect };
    cache.begin(100, geometry);
    cache.observe(100, [hand()], [original]);
    original.xCenter = 0.9;
    const priors = cache.begin(101, geometry);
    expect(priors).toEqual([rect]);
    priors[0].xCenter = 0.1;
    expect(cache.begin(102, geometry)).toEqual([rect]);
    expect(Object.keys(cache).sort()).toEqual(["begin", "observe", "reset"]);
  });

  it("builds a global-palm-first graph with real scalar ROI bridges and emits only current output", async () => {
    let graphBytes: Uint8Array = new Uint8Array(),
      current: Record<string, unknown> = {};
    const listeners = new Map<string, (values: Uint8Array[], time: number) => void>();
    const protoInputs: { stream: string; capture: number }[] = [];
    const close = vi.fn(),
      baseSerialize = vi.fn(() => new Uint8Array([16, 1]));
    const syntheticCanvases: { width: number; height: number }[] = [];
    const processedCaptures: number[] = [];
    let output: { landmarks: Point[][]; rects: Rect[] } = { landmarks: [hand()], rects: [rect] };
    class Base {
      landmarks: Point[][] = [];
      worldLandmarks: Point[][] = [];
      handedness: unknown[][] = [];
      baseOptions = { clone: () => ({}) };
      g = {
        attachProtoVectorListener: (name: string, listener: (values: Uint8Array[], time: number) => void) =>
          listeners.set(name, listener),
        attachEmptyPacketListener: vi.fn(),
        addProtoToStream: (_bytes: Uint8Array, _type: string, stream: string, capture: number) =>
          protoInputs.push({ stream, capture }),
        addEmptyPacketToStream: vi.fn(),
        addFloatVectorToStream: vi.fn(),
      };
      setGraph(bytes: Uint8Array) {
        graphBytes = bytes;
      }
      close = close;
    }
    const provider = load({
      OffscreenCanvas: class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          syntheticCanvases.push(this);
        }
        getContext() {
          return { fillStyle: "", fillRect: vi.fn() };
        }
      },
      Uc: Base,
      fc: async (Type: new () => Base & { m(): void }) => {
        const model = new Type();
        model.m();
        current = model as unknown as Record<string, unknown>;
        return model;
      },
      nn: vi.fn(),
      Vi: () => baseSerialize,
      qs: [0, {}, {}, {}, {}],
      pa: () => {},
      gc: (_task: object, _image: object, _options: unknown, capture: number) => {
        processedCaptures.push(capture);
        current.landmarks = output.landmarks;
        current.worldLandmarks = output.landmarks;
        current.handedness = output.landmarks.map(() => []);
        const rectBytes = output.rects.map((item) => {
          const bytes = new Uint8Array(25);
          let at = 0;
          for (const [key, value] of [
            [1, item.xCenter],
            [2, item.yCenter],
            [3, item.height],
            [4, item.width],
            [5, item.rotation],
          ]) {
            bytes[at] = key * 8 + 5;
            new DataView(bytes.buffer).setFloat32(at + 1, value, true);
            at += 5;
          }
          return bytes;
        });
        listeners.get("next_rects")!(rectBytes, capture);
      },
    });
    const model = await provider.create({}, await provider.verifyAssets(bundle, task));
    expect(processedCaptures).toEqual([-1]);
    expect(syntheticCanvases).toEqual([{ width: 0, height: 0 }]);
    expect(protoInputs).toEqual([{ stream: "recovery_prior0", capture: -1 }]);
    const graphText = new TextDecoder().decode(graphBytes);
    expect(graphText).toContain("HandDetectorGraph");
    expect(graphText).toContain("RECTS:0:detected_rects");
    expect(graphText).toContain("RECTS:1:prior_rects0");
    expect(graphText).toContain("HandLandmarksDeduplicationCalculator");
    expect(graphText).not.toContain("GateCalculator");
    expect(graphText).not.toContain("BASE_RECTS");
    expect(graphText).not.toContain("PreviousLoopback");
    expect(baseSerialize).toHaveBeenCalledTimes(2);
    const image = { width: 800, height: 600 };
    expect(model.detectForVideo(image, 0).landmarks).toHaveLength(1);
    output = { landmarks: [], rects: [] };
    const absent = model.detectForVideo(image, 200);
    expect(absent).toEqual({ landmarks: [], worldLandmarks: [], handedness: [] });
    expect(protoInputs).toEqual([
      { stream: "recovery_prior0", capture: -1 },
      { stream: "recovery_prior0", capture: 200 },
    ]);
    model.detectForVideo(image, 351);
    expect(protoInputs).toHaveLength(2);
    expect(processedCaptures).toEqual([-1, 0, 200, 351]);
    model.close();
    model.close();
    expect(close).toHaveBeenCalledTimes(1);
    expect(() => model.detectForVideo(image, 400)).toThrow("RECOVERY_CLOSED");
  });
  it("tags partial graph cleanup failure as fatal instead of allowing a second graph", async () => {
    class Partial {
      close() {
        throw new Error("driver cleanup failed");
      }
    }
    const provider = load({
      Uc: Partial,
      Vi: () => {},
      qs: [0, {}, {}, {}, {}],
      fc: async (Type: new () => Partial) => {
        new Type();
        throw new Error("initialization failed");
      },
    });
    await expect(provider.create({}, await provider.verifyAssets(bundle, task))).rejects.toThrow(
      "RECOVERY_PARTIAL_CLOSE_FAILED",
    );
  });
});

function workerHarness({
  candidateFailure = false,
  integrityFailure = false,
  pendingCreate = false,
  partialCleanupFailure = false,
} = {}) {
  const messages: Record<string, unknown>[] = [],
    modelClose = vi.fn(),
    bitmapClose = vi.fn(),
    originalCreate = vi.fn();
  const model = {
    reset: vi.fn(),
    close: modelClose,
    detectForVideo: vi.fn(() => ({ landmarks: [hand()], worldLandmarks: [hand()], handedness: [[]] })),
  };
  let release: (() => void) | undefined;
  const provider = {
    policy: { taskBytes: task.length, version: "CANDIDATE" },
    verifyAssets: vi.fn(async () => {
      if (integrityFailure) throw new Error("RECOVERY_RUNTIME_INTEGRITY");
      return {};
    }),
    create: vi.fn(async () => {
      if (pendingCreate)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      if (partialCleanupFailure) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
      if (candidateFailure) throw new Error("bad ABI");
      return model;
    }),
  };
  const scope: Record<string, unknown> = {
    Uint8Array,
    Error,
    AbortController,
    Blob,
    URL: { createObjectURL: () => "blob:verified", revokeObjectURL: vi.fn() },
    performance: { timeOrigin: 1000, now: () => 20 },
    self: { postMessage: (message: Record<string, unknown>) => messages.push(message), close: vi.fn() },
    fetch: vi.fn(async () => ({ ok: true, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(1) })),
  };
  scope.importScripts = (path: string) => {
    const exports = scope.exports as Record<string, unknown>;
    if (path === "./recovery-provider.js") exports.WatchglassRecoveryProvider = provider;
    else {
      exports.FilesetResolver = { forVisionTasks: async () => ({}) };
      exports.HandLandmarker = { createFromOptions: originalCreate.mockResolvedValue(model) };
    }
  };
  runInNewContext(workerSource, scope);
  const send = (data: Record<string, unknown>) =>
    (scope.self as { onmessage(event: { data: Record<string, unknown> }): Promise<void> }).onmessage({ data });
  const frame = (capture = 1, generation = 7) =>
    send({ type: "FRAME", generation, capture, bitmap: { width: 800, height: 600, close: bitmapClose } });
  return { send, frame, messages, model, modelClose, bitmapClose, originalCreate, provider, release: () => release!() };
}
describe("unreferenced recovery worker lifecycle", () => {
  it.each(["NONE", "PREVIEW_X"])("preserves the established %s mirror binding", async (mirrorTransform) => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7, geometryVersion: 2, mirrorTransform });
    expect(h.model.reset).toHaveBeenCalledWith({
      session: "7",
      geometry: "2",
      mirror: mirrorTransform === "PREVIEW_X",
    });
    expect(h.messages[0]).toMatchObject({ type: "READY" });
  });
  it.each([
    { mirrorTransform: "MIRROR_X" },
    { mirrorTransform: "unknown" },
    { geometryVersion: "2" },
    { geometryVersion: 0 },
    { geometryVersion: 1.1 },
    { geometryVersion: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects unsupported source context %j before loading assets", async (context) => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7, ...context });
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_INIT_CONTEXT" }]);
    expect(h.provider.verifyAssets).not.toHaveBeenCalled();
    expect(h.originalCreate).not.toHaveBeenCalled();
  });
  it("reports candidate/backend identity and closes every delivered bitmap", async () => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7 });
    await h.frame();
    await h.frame(2, 99);
    expect(h.messages[0]).toMatchObject({
      type: "READY",
      providerPolicy: "CANDIDATE",
      backend: "CPU_WASM",
      fallbackReason: null,
    });
    expect(h.messages[1]).toMatchObject({ type: "RESULT", capture: 1, width: 800 });
    expect(h.bitmapClose).toHaveBeenCalledTimes(2);
  });
  it("falls back only during initialization and explicitly identifies the originalCPU source", async () => {
    const h = workerHarness({ candidateFailure: true });
    await h.send({ type: "INIT", generation: 7, delegate: "GPU" });
    expect(h.originalCreate).toHaveBeenCalledOnce();
    expect(h.messages[0]).toMatchObject({
      type: "READY",
      backend: "CPU_WASM",
      providerPolicy: "ORIGINAL_CPU",
      fallbackReason: "RECOVERY_PROVIDER_INIT_UNAVAILABLE",
    });
    expect(h.originalCreate.mock.calls[0][1].baseOptions.delegate).toBe("CPU");
  });
  it("never executes an unverified runtime via fallback", async () => {
    const h = workerHarness({ integrityFailure: true });
    await h.send({ type: "INIT", generation: 7 });
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_RUNTIME_INTEGRITY" }]);
  });
  it("does not create a second graph after fatal partial cleanup failure", async () => {
    const h = workerHarness({ partialCleanupFailure: true });
    await h.send({ type: "INIT", generation: 7 });
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_PARTIAL_CLOSE_FAILED" }]);
  });
  it("still emits an ERROR when closing a failed live graph itself throws", async () => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7 });
    h.model.detectForVideo.mockImplementationOnce(() => {
      throw new Error("inference failed");
    });
    h.modelClose.mockImplementationOnce(() => {
      throw new Error("close failed");
    });
    await h.frame();
    expect(h.messages.at(-1)).toMatchObject({ type: "ERROR", reason: "RECOVERY_PARTIAL_CLOSE_FAILED" });
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.bitmapClose).toHaveBeenCalledOnce();
  });
  it("fails the established generation on inference error without silently changing backend", async () => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7 });
    h.model.detectForVideo.mockImplementationOnce(() => {
      throw new Error("inference failed");
    });
    await h.frame();
    await h.frame(2);
    expect(h.messages.at(-1)).toMatchObject({ type: "ERROR", reason: "MODEL_INFERENCE" });
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.modelClose).toHaveBeenCalledOnce();
    expect(h.bitmapClose).toHaveBeenCalledTimes(2);
  });
  it("closes a late initialization result after CLOSE without announcing a fresh session", async () => {
    const h = workerHarness({ pendingCreate: true }),
      init = h.send({ type: "INIT", generation: 7 });
    await vi.waitFor(() => expect(h.provider.create).toHaveBeenCalled());
    await h.send({ type: "CLOSE" });
    h.release();
    await init;
    expect(h.modelClose).toHaveBeenCalledOnce();
    expect(h.messages).toEqual([]);
  });
});

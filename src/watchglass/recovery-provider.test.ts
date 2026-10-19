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
  qualifyStartupLatency(geometry: { width: number; height: number }): {
    passed: boolean;
    width: number;
    height: number;
    probes: { timestamp: number; elapsedMs: number; forcedRegions: number }[];
    outputsDiscarded: boolean;
    retainedRegionsCleared: boolean;
  };
  detectForVideo(image: { width: number; height: number }, capture: number): Result;
  reset(context: Omit<Geometry, "width" | "height">): void;
  close(): void;
};
type Provider = {
  policy: {
    retentionMs: number;
    detection: number;
    presence: number;
    association: number;
    startup: { healthProbe: { minimumDimension: number; maximumDimension: number } };
  };
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

// Exercises the actual pinned provider wrapper with a mock graph/clock. This
// checks submission and cleanup contracts, not neural output or runtime cost.
async function startupProviderHarness(costs: Record<number, number> = {}, throwAt?: number) {
  const submissions: { capture: number; width: number; height: number }[] = [],
    priors: { capture: number; bytes: number[] }[] = [],
    canvases: { width: number; height: number }[] = [];
  let clock = 0;
  const close = vi.fn();
  class Base {
    landmarks: Point[][] = [];
    worldLandmarks: Point[][] = [];
    handedness: unknown[][] = [];
    currentNextRects: Rect[] = [];
    baseOptions = { clone: () => ({}) };
    g = {
      attachProtoVectorListener: vi.fn(),
      attachEmptyPacketListener: vi.fn(),
      addProtoToStream: (bytes: Uint8Array, _type: string, _stream: string, capture: number) =>
        priors.push({ capture, bytes: Array.from(bytes) }),
      addEmptyPacketToStream: vi.fn(),
      addFloatVectorToStream: vi.fn(),
    };
    setGraph() {}
    close = close;
  }
  let current: Base;
  const provider = load({
    performance: { now: () => clock },
    OffscreenCanvas: class {
      constructor(
        public width: number,
        public height: number,
      ) {
        canvases.push(this);
      }
      getContext() {
        return { fillStyle: "", fillRect: vi.fn() };
      }
    },
    Uc: Base,
    fc: async (Type: new () => Base & { m(): void }) => {
      current = new Type();
      (current as Base & { m(): void }).m();
      return current;
    },
    nn: vi.fn(),
    Vi: () => () => new Uint8Array([16, 1]),
    qs: [0, {}, {}, {}, {}],
    pa: () => {},
    gc: (graph: Base, image: { width: number; height: number }, _options: unknown, capture: number) => {
      submissions.push({ capture, width: image.width, height: image.height });
      clock += costs[capture] ?? 1;
      graph.landmarks = [hand()];
      graph.worldLandmarks = [hand()];
      graph.handedness = [[]];
      graph.currentNextRects = [rect];
      if (capture === throwAt) throw new Error("PROBE_EXECUTION_FAILED");
    },
  });
  const model = await provider.create({}, await provider.verifyAssets(bundle, task));
  return { provider, model, submissions, priors, canvases, close, current: () => current };
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
      performance: { now: () => 0 },
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
    expect(processedCaptures).toEqual([-3]);
    expect(syntheticCanvases).toEqual([{ width: 0, height: 0 }]);
    expect(protoInputs).toEqual([{ stream: "recovery_prior0", capture: -3 }]);
    const graphText = new TextDecoder().decode(graphBytes);
    expect(graphText).toContain("HandDetectorGraph");
    expect(graphText).toContain("RECTS:0:detected_rects");
    expect(graphText).toContain("RECTS:1:prior_rects0");
    expect(graphText).toContain("HandLandmarksDeduplicationCalculator");
    expect(graphText).not.toContain("GateCalculator");
    expect(graphText).not.toContain("BASE_RECTS");
    expect(graphText).not.toContain("PreviousLoopback");
    expect([...listeners.keys()].sort()).toEqual([
      "hand_landmarks",
      "handedness",
      "next_rects",
      "world_hand_landmarks",
    ]);
    expect(baseSerialize).toHaveBeenCalledTimes(2);
    const image = { width: 800, height: 600 };
    expect(model.qualifyStartupLatency(image)).toMatchObject({
      passed: true,
      width: 800,
      height: 600,
      outputsDiscarded: true,
      retainedRegionsCleared: true,
      probes: [
        { timestamp: -2, elapsedMs: 0, forcedRegions: 2 },
        { timestamp: -1, elapsedMs: 0, forcedRegions: 2 },
      ],
    });
    expect(syntheticCanvases).toEqual(Array.from({ length: 3 }, () => ({ width: 0, height: 0 })));
    for (const key of ["landmarks", "worldLandmarks", "handedness", "currentNextRects"])
      expect(current[key]).toEqual([]);
    expect(model.detectForVideo(image, 0).landmarks).toHaveLength(1);
    output = { landmarks: [], rects: [] };
    const absent = model.detectForVideo(image, 200);
    expect(absent).toEqual({ landmarks: [], worldLandmarks: [], handedness: [] });
    expect(protoInputs).toEqual([
      { stream: "recovery_prior0", capture: -3 },
      { stream: "recovery_prior0", capture: -2 },
      { stream: "recovery_prior1", capture: -2 },
      { stream: "recovery_prior0", capture: -1 },
      { stream: "recovery_prior1", capture: -1 },
      { stream: "recovery_prior0", capture: 200 },
    ]);
    model.detectForVideo(image, 351);
    expect(protoInputs).toHaveLength(6);
    expect(processedCaptures).toEqual([-3, -2, -1, 0, 200, 351]);
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
  it("uses the actual bound geometry twice and discards every synthetic output and prior", async () => {
    const h = await startupProviderHarness({ [-2]: 40, [-1]: 50 });
    const report = h.model.qualifyStartupLatency({ width: 320, height: 240 });
    expect(report).toMatchObject({ passed: true, width: 320, height: 240 });
    expect(report.probes.map((probe) => probe.elapsedMs)).toEqual([40, 50]);
    expect(h.submissions).toEqual([
      { capture: -3, width: 64, height: 64 },
      { capture: -2, width: 320, height: 240 },
      { capture: -1, width: 320, height: 240 },
    ]);
    for (const capture of [-2, -1]) {
      const priors = h.priors.filter((prior) => prior.capture === capture);
      expect(priors).toHaveLength(2);
      expect(priors[0].bytes).not.toEqual(priors[1].bytes);
    }
    for (const key of ["landmarks", "worldLandmarks", "handedness", "currentNextRects"] as const)
      expect(h.current()[key]).toEqual([]);
    expect(h.canvases).toEqual(Array.from({ length: 3 }, () => ({ width: 0, height: 0 })));
    h.model.detectForVideo({ width: 320, height: 240 }, 0);
    expect(h.priors.filter((prior) => prior.capture === 0)).toEqual([]);
    expect(() => h.model.qualifyStartupLatency({ width: 320, height: 240 })).toThrow("RECOVERY_STARTUP_HEALTH_STATE");
    h.model.close();
  });
  it.each([
    [150, true],
    [151, false],
    [-1, false],
    [NaN, false],
    [Infinity, false],
  ])("counts both native probes and rejects an invalid first cost %s", async (cost, passed) => {
    const h = await startupProviderHarness({ [-2]: cost as number, [-1]: 20 });
    const report = h.model.qualifyStartupLatency({ width: 800, height: 600 });
    expect(report.passed).toBe(passed);
    expect(report.probes).toHaveLength(2);
    expect(h.submissions.map((frame) => frame.capture)).toEqual([-3, -2, -1]);
    if (!passed)
      expect(() => h.model.detectForVideo({ width: 800, height: 600 }, 0)).toThrow("RECOVERY_STARTUP_HEALTH_REQUIRED");
    h.model.close();
  });
  it("requires geometry qualification and rejects a changed frame before graph submission", async () => {
    const h = await startupProviderHarness();
    expect(() => h.model.detectForVideo({ width: 800, height: 600 }, 0)).toThrow("RECOVERY_STARTUP_HEALTH_REQUIRED");
    expect(h.submissions).toHaveLength(1);
    for (const invalid of [
      {},
      { width: 0, height: 600 },
      { width: 800, height: -1 },
      { width: 800.5, height: 600 },
      { width: 16385, height: 600 },
      { width: 800, height: 16385 },
      { width: 800, height: NaN },
      { width: "800", height: 600 },
    ])
      expect(() => h.model.qualifyStartupLatency(invalid as { width: number; height: number })).toThrow(
        "RECOVERY_STARTUP_GEOMETRY",
      );
    expect(h.submissions).toHaveLength(1);
    expect(h.canvases).toHaveLength(1);
    h.model.qualifyStartupLatency({ width: 800, height: 600 });
    expect(() => h.model.detectForVideo({ width: 600, height: 800 }, 0)).toThrow("RECOVERY_FRAME_GEOMETRY_MISMATCH");
    expect(h.submissions).toHaveLength(3);
    h.model.close();
  });
  it.each([1, 16384])("uses source-schema bound %s with a canvas mock, without claiming visibility", async (size) => {
    const h = await startupProviderHarness();
    expect(h.model.qualifyStartupLatency({ width: size, height: size })).toMatchObject({
      passed: true,
      width: size,
      height: size,
    });
    expect(h.submissions.slice(1).every((frame) => frame.width === size && frame.height === size)).toBe(true);
    h.model.close();
  });
  it("clears partial probe output on failure and cannot reuse that health attempt", async () => {
    const h = await startupProviderHarness({}, -2);
    expect(() => h.model.qualifyStartupLatency({ width: 800, height: 600 })).toThrow("PROBE_EXECUTION_FAILED");
    for (const key of ["landmarks", "worldLandmarks", "handedness", "currentNextRects"] as const)
      expect(h.current()[key]).toEqual([]);
    expect(h.canvases).toEqual([
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    ]);
    expect(() => h.model.qualifyStartupLatency({ width: 800, height: 600 })).toThrow("RECOVERY_STARTUP_HEALTH_STATE");
    expect(() => h.model.detectForVideo({ width: 800, height: 600 }, 0)).toThrow("RECOVERY_STARTUP_HEALTH_REQUIRED");
    h.model.close();
    expect(h.close).toHaveBeenCalledOnce();
  });
});

function workerHarness({
  candidateFailure = false,
  integrityFailure = false,
  pendingCreate = false,
  partialCleanupFailure = false,
  health = [true],
  healthThrows = [],
  closeFailures = [],
}: {
  candidateFailure?: boolean;
  integrityFailure?: boolean;
  pendingCreate?: boolean;
  partialCleanupFailure?: boolean;
  health?: boolean[];
  healthThrows?: number[];
  closeFailures?: number[];
} = {}) {
  const messages: Record<string, unknown>[] = [],
    modelClose = vi.fn(() => {
      if (closeFailures.includes(modelClose.mock.calls.length - 1)) throw new Error("driver cleanup failed");
    }),
    bitmapClose = vi.fn(),
    originalCreate = vi.fn(),
    selfClose = vi.fn();
  let delegate = "CPU",
    healthIndex = 0;
  const model = {
    reset: vi.fn(),
    close: modelClose,
    qualifyStartupLatency: vi.fn((dimensions: { width: number; height: number }) => {
      const index = healthIndex++;
      if (healthThrows.includes(index)) throw new Error("probe inference failed");
      return {
        passed: health[index] ?? true,
        delegate,
        ...dimensions,
        probes: [
          { timestamp: -2, elapsedMs: health[index] === false ? 151 : 35, forcedRegions: 2 },
          { timestamp: -1, elapsedMs: 30, forcedRegions: 2 },
        ],
        outputsDiscarded: true,
        retainedRegionsCleared: true,
      };
    }),
    detectForVideo: vi.fn(() => ({ landmarks: [hand()], worldLandmarks: [hand()], handedness: [[]] })),
  };
  let release: (() => void) | undefined;
  const provider = {
    policy: { taskBytes: task.length, version: "CANDIDATE", startup: load().policy.startup },
    verifyAssets: vi.fn(async () => {
      if (integrityFailure) throw new Error("RECOVERY_RUNTIME_INTEGRITY");
      return {};
    }),
    create: vi.fn(async (_fileset: unknown, _assets: unknown, options: { delegate: string }) => {
      delegate = options.delegate;
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
    self: { postMessage: (message: Record<string, unknown>) => messages.push(message), close: selfClose },
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
    (scope.self as { onmessage(event: { data: Record<string, unknown> }): Promise<void> }).onmessage({
      data: data.type === "INIT" ? { frameWidth: 800, frameHeight: 600, ...data } : data,
    });
  const frame = (capture = 1, generation = 7, width = 800, height = 600) =>
    send({ type: "FRAME", generation, capture, bitmap: { width, height, close: bitmapClose } });
  return {
    send,
    frame,
    messages,
    model,
    modelClose,
    bitmapClose,
    originalCreate,
    provider,
    selfClose,
    fetch: scope.fetch as ReturnType<typeof vi.fn>,
    release: () => release!(),
  };
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
    expect(h.messages[0]).toMatchObject({
      type: "READY",
      startupHealth: {
        probeDimensions: { width: 800, height: 600 },
        geometryVersion: 2,
        mirrorTransform,
        livePixelQualification: false,
      },
    });
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
  it("qualifies both delegates at the bound geometry and closes GPU before creating CPU", async () => {
    const h = workerHarness({ health: [false, true] });
    await h.send({
      type: "INIT",
      generation: 7,
      delegate: "GPU",
      frameWidth: 320,
      frameHeight: 240,
      geometryVersion: 3,
      mirrorTransform: "PREVIEW_X",
    });
    expect(h.provider.create.mock.calls.map((call) => call[2].delegate)).toEqual(["GPU", "CPU"]);
    expect(h.modelClose.mock.invocationCallOrder[0]).toBeLessThan(h.provider.create.mock.invocationCallOrder[1]);
    expect(h.model.qualifyStartupLatency.mock.calls).toEqual([
      [{ width: 320, height: 240 }],
      [{ width: 320, height: 240 }],
    ]);
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages[0]).toMatchObject({
      type: "READY",
      backend: "CPU_WASM",
      providerPolicy: "CANDIDATE",
      fallbackReason: "GPU_STARTUP_LATENCY_HEALTH_FAILED",
      startupHealth: {
        probeDimensions: { width: 320, height: 240 },
        geometryVersion: 3,
        mirrorTransform: "PREVIEW_X",
        attempts: [
          { passed: false, delegate: "GPU", width: 320, height: 240 },
          {
            passed: true,
            delegate: "CPU",
            width: 320,
            height: 240,
            outputsDiscarded: true,
            retainedRegionsCleared: true,
          },
        ],
      },
    });
    await h.frame(1, 7, 320, 240);
    expect(h.messages[1]).toMatchObject({
      type: "RESULT",
      backend: "CPU_WASM",
      providerPolicy: "CANDIDATE",
      width: 320,
      height: 240,
    });
  });
  it("treats GPU probe exceptions as a bounded health failure", async () => {
    const h = workerHarness({ healthThrows: [0] });
    await h.send({ type: "INIT", generation: 7, delegate: "GPU" });
    expect(h.provider.create).toHaveBeenCalledTimes(2);
    expect(h.modelClose).toHaveBeenCalledOnce();
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages[0]).toMatchObject({ type: "READY", backend: "CPU_WASM" });
  });
  it.each(["CPU", "GPU"])("does not bypass failed %s health with a generic third provider", async (delegate) => {
    const h = workerHarness({ health: [false, false] });
    await h.send({ type: "INIT", generation: 7, delegate });
    const attempts = delegate === "GPU" ? 2 : 1;
    expect(h.provider.create).toHaveBeenCalledTimes(attempts);
    expect(h.modelClose).toHaveBeenCalledTimes(attempts);
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_CPU_STARTUP_HEALTH_FAILED" }]);
  });
  it.each([0, 1])("makes failed health cleanup %s fatal before any further graph", async (closeIndex) => {
    const h = workerHarness({ health: [false, false], closeFailures: [closeIndex] });
    await h.send({ type: "INIT", generation: 7, delegate: "GPU" });
    expect(h.provider.create).toHaveBeenCalledTimes(closeIndex + 1);
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.selfClose).toHaveBeenCalledOnce();
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_PARTIAL_CLOSE_FAILED" }]);
  });
  it.each([
    { frameWidth: undefined },
    { frameHeight: undefined },
    { frameWidth: 0 },
    { frameHeight: -1 },
    { frameWidth: 800.5 },
    { frameHeight: NaN },
    { frameWidth: Infinity },
    { frameWidth: "800" },
    { frameWidth: 16385 },
    { frameHeight: 16385 },
  ])("rejects invalid INIT frame geometry %j before assets", async (dimensions) => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7, ...dimensions });
    expect(h.messages).toEqual([{ type: "ERROR", generation: 7, reason: "RECOVERY_INIT_CONTEXT" }]);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.provider.create).not.toHaveBeenCalled();
    expect(h.originalCreate).not.toHaveBeenCalled();
  });
  it.each([
    [600, 800],
    [800, 0],
    [16385, 600],
  ])("closes a current mismatched frame %sx%s before inference", async (width, height) => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7 });
    await h.frame(1, 7, width, height);
    await h.frame(2);
    expect(h.model.detectForVideo).not.toHaveBeenCalled();
    expect(h.modelClose).toHaveBeenCalledOnce();
    expect(h.bitmapClose).toHaveBeenCalledTimes(2);
    expect(h.messages.at(-1)).toMatchObject({ type: "ERROR", reason: "RECOVERY_FRAME_GEOMETRY_MISMATCH" });
    expect(h.provider.create).toHaveBeenCalledOnce();
    expect(h.originalCreate).not.toHaveBeenCalled();
  });
  it("discards preREADY and delayed foreign frames without borrowing their geometry", async () => {
    const h = workerHarness({ pendingCreate: true });
    await h.frame();
    const init = h.send({ type: "INIT", generation: 7, frameWidth: 320, frameHeight: 240 });
    await vi.waitFor(() => expect(h.provider.create).toHaveBeenCalled());
    await h.frame(2, 7, 800, 600);
    expect(h.model.detectForVideo).not.toHaveBeenCalled();
    expect(h.messages).toEqual([]);
    h.release();
    await init;
    await h.frame(3, 99, 800, 600);
    await h.frame(4, 7, 320, 240);
    expect(h.model.detectForVideo).toHaveBeenCalledOnce();
    expect(h.bitmapClose).toHaveBeenCalledTimes(4);
    expect(h.messages.at(-1)).toMatchObject({ type: "RESULT", capture: 4, width: 320, height: 240 });
  });
  it("cannot replace a READY binding with a delayed INIT", async () => {
    const h = workerHarness();
    await h.send({ type: "INIT", generation: 7, frameWidth: 320, frameHeight: 240 });
    await h.send({ type: "INIT", generation: 8 });
    expect(h.provider.create).toHaveBeenCalledOnce();
    expect(h.model.reset).toHaveBeenCalledOnce();
    expect(h.originalCreate).not.toHaveBeenCalled();
    expect(h.messages.at(-1)).toEqual({ type: "ERROR", generation: 7, reason: "RECOVERY_ALREADY_INITIALIZED" });
  });
  it("honors CLOSE before INIT and closes frames delivered afterward", async () => {
    const h = workerHarness();
    await h.send({ type: "CLOSE" });
    await h.send({ type: "INIT", generation: 7 });
    await h.frame();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.provider.create).not.toHaveBeenCalled();
    expect(h.messages).toEqual([]);
    expect(h.bitmapClose).toHaveBeenCalledOnce();
  });
  it("closes a late CPU recovery result after cancellation without READY", async () => {
    const h = workerHarness({ pendingCreate: true, health: [false, true] });
    const init = h.send({ type: "INIT", generation: 7, delegate: "GPU" });
    await vi.waitFor(() => expect(h.provider.create).toHaveBeenCalledTimes(1));
    h.release();
    await vi.waitFor(() => expect(h.provider.create).toHaveBeenCalledTimes(2));
    await h.send({ type: "CLOSE" });
    h.release();
    await init;
    expect(h.modelClose).toHaveBeenCalledTimes(2);
    expect(h.model.qualifyStartupLatency).toHaveBeenCalledOnce();
    expect(h.messages).toEqual([]);
    expect(h.originalCreate).not.toHaveBeenCalled();
  });
});

/* Watchglass region provider built from exact pinned MediaPipe internals. */
/* global exports, Uc, fc, nn, Vi, qs, Rs, Yo, Ss, qo, ws, Fn, Rn, ge, tn, pa, gc */
"use strict";

(() => {
  const policy = Object.freeze({
    version: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
    runtimeVersion: "0.10.32",
    bundleSha256: "1cdadf6c65d572330994f37be24fd575526480e4e7a2608ae1937be331c88c41",
    taskSha256: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
    taskBytes: 7819105,
    maximumHands: 2,
    retentionMs: 250,
    detection: 0.6,
    presence: 0.6,
    association: 0.6,
    startup: Object.freeze({
      syntheticCanvasSide: 64,
      timestamp: -3,
      outputsDiscarded: true,
      healthProbe: Object.freeze({
        minimumDimension: 1,
        maximumDimension: 16384,
        timestamps: Object.freeze([-2, -1]),
        maximumElapsedMs: 150,
        geometryPolicy: "SEXTANT_SOURCE_GEOMETRY_V1_1_TO_16384",
        coverage: "ACTUAL_BOUND_FRAME_GEOMETRY_SYNTHETIC_GRAY_NECESSARY_CONDITION_NOT_LIVE_PIXEL_QUALIFICATION",
      }),
    }),
    palm: Object.freeze({
      name: "hand_detector.tflite",
      bytes: 2339878,
      sha256: "945f713bc23570bd4ed60f848c401dc8eaf95713183d43ba14cf12e467d27a7d",
    }),
    landmark: Object.freeze({
      name: "hand_landmarks_detector.tflite",
      bytes: 5478949,
      sha256: "6acda74af3fbf40e68265c20c7394b2bad81a16a481dcd79ad7a081887c3d6b9",
    }),
  });
  const verified = new WeakSet();
  const fail = (reason) => {
    throw new Error(reason);
  };
  const hash = async (bytes) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (bytes, offset) => view(bytes).getUint16(offset, true);
  const u32 = (bytes, offset) => view(bytes).getUint32(offset, true);
  const slice = (bytes, start, length) => {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(length) ||
      start < 0 ||
      length < 0 ||
      start + length > bytes.length
    )
      fail("RECOVERY_ARCHIVE_BOUNDS");
    return bytes.subarray(start, start + length);
  };

  // This exact task is a stored ZIP with padding. Central-directory offsets,
  // local headers and exact member names must agree; no decompression or fetch.
  function extractTaskChildren(task) {
    if (!(task instanceof Uint8Array) || task.length !== policy.taskBytes) fail("RECOVERY_TASK_SIZE");
    const end = task.length - 22;
    if (
      u32(task, end) !== 0x06054b50 ||
      u16(task, end + 4) !== 0 ||
      u16(task, end + 6) !== 0 ||
      u16(task, end + 8) !== 2 ||
      u16(task, end + 10) !== 2 ||
      u16(task, end + 20) !== 0
    )
      fail("RECOVERY_ARCHIVE_DIRECTORY");
    let at = u32(task, end + 16);
    const directoryEnd = at + u32(task, end + 12);
    if (directoryEnd !== end) fail("RECOVERY_ARCHIVE_DIRECTORY");
    const children = {};
    const regions = [];
    for (let i = 0; i < 2; i++) {
      slice(task, at, 46);
      if (
        u32(task, at) !== 0x02014b50 ||
        u16(task, at + 8) !== 0 ||
        u16(task, at + 10) !== 0 ||
        u16(task, at + 34) !== 0
      )
        fail("RECOVERY_ARCHIVE_MEMBER");
      const nameLength = u16(task, at + 28),
        extraLength = u16(task, at + 30),
        commentLength = u16(task, at + 32);
      const name = new TextDecoder("utf-8", { fatal: true }).decode(slice(task, at + 46, nameLength));
      const expected = [policy.palm, policy.landmark].find((entry) => entry.name === name);
      if (!expected || children[name] || u32(task, at + 20) !== expected.bytes || u32(task, at + 24) !== expected.bytes)
        fail("RECOVERY_ARCHIVE_MEMBER");
      const local = u32(task, at + 42);
      slice(task, local, 30);
      if (
        u32(task, local) !== 0x04034b50 ||
        u16(task, local + 6) !== 0 ||
        u16(task, local + 8) !== 0 ||
        u32(task, local + 14) !== u32(task, at + 16) ||
        u32(task, local + 18) !== expected.bytes ||
        u32(task, local + 22) !== expected.bytes
      )
        fail("RECOVERY_ARCHIVE_LOCAL");
      const localNameLength = u16(task, local + 26),
        localExtraLength = u16(task, local + 28);
      if (new TextDecoder("utf-8", { fatal: true }).decode(slice(task, local + 30, localNameLength)) !== name)
        fail("RECOVERY_ARCHIVE_LOCAL");
      const dataOffset = local + 30 + localNameLength + localExtraLength;
      const data = slice(task, dataOffset, expected.bytes);
      if (
        dataOffset + data.length > u32(task, end + 16) ||
        regions.some(([start, stop]) => dataOffset < stop && dataOffset + data.length > start)
      )
        fail("RECOVERY_ARCHIVE_OVERLAP");
      regions.push([dataOffset, dataOffset + data.length]);
      children[name] = data;
      at += 46 + nameLength + extraLength + commentLength;
    }
    if (at !== directoryEnd) fail("RECOVERY_ARCHIVE_DIRECTORY");
    return { palm: children[policy.palm.name], landmark: children[policy.landmark.name] };
  }
  async function verifyAssets(bundle, task) {
    if (!(bundle instanceof Uint8Array) || bundle.length !== 204618 || (await hash(bundle)) !== policy.bundleSha256)
      fail("RECOVERY_RUNTIME_INTEGRITY");
    if (!(task instanceof Uint8Array) || task.length !== policy.taskBytes || (await hash(task)) !== policy.taskSha256)
      fail("RECOVERY_TASK_INTEGRITY");
    const children = extractTaskChildren(task);
    if (
      (await hash(children.palm)) !== policy.palm.sha256 ||
      (await hash(children.landmark)) !== policy.landmark.sha256
    )
      fail("RECOVERY_CHILD_INTEGRITY");
    const assets = Object.freeze({ task, ...children });
    verified.add(assets);
    return assets;
  }
  const validRect = (rect) =>
    rect &&
    [rect.xCenter, rect.yCenter, rect.width, rect.height, rect.rotation].every(Number.isFinite) &&
    Math.abs(rect.xCenter) <= 3 &&
    Math.abs(rect.yCenter) <= 3 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.width <= 3 &&
    rect.height <= 3 &&
    Math.abs(rect.rotation) <= 2 * Math.PI;
  function createActualRegionCache() {
    let previousCapture = -Infinity,
      geometry = null,
      regions = [],
      actualCapture = -Infinity;
    return {
      reset() {
        geometry = null;
        regions = [];
        actualCapture = -Infinity;
      },
      begin(capture, context) {
        if (!Number.isFinite(capture) || capture < 0 || capture <= previousCapture) fail("RECOVERY_CAPTURE_ORDER");
        if (
          !context ||
          !Number.isSafeInteger(context.width) ||
          !Number.isSafeInteger(context.height) ||
          context.width <= 0 ||
          context.height <= 0 ||
          typeof context.session !== "string" ||
          typeof context.geometry !== "string" ||
          typeof context.mirror !== "boolean"
        )
          fail("RECOVERY_GEOMETRY");
        if (!geometry || Object.keys(context).some((key) => geometry[key] !== context[key])) {
          regions = [];
          actualCapture = -Infinity;
          geometry = { ...context };
        }
        previousCapture = capture;
        return capture - actualCapture <= policy.retentionMs ? regions.map((rect) => ({ ...rect })) : [];
      },
      observe(capture, landmarks, nextRegions) {
        if (
          capture !== previousCapture ||
          !Array.isArray(landmarks) ||
          !Array.isArray(nextRegions) ||
          landmarks.length > 2 ||
          nextRegions.length !== landmarks.length
        )
          fail("RECOVERY_CURRENT_OUTPUT");
        if (landmarks.length === 0) return;
        if (
          !landmarks.every(
            (hand) =>
              Array.isArray(hand) &&
              hand.length === 21 &&
              hand.every((point) => point && [point.x, point.y, point.z].every(Number.isFinite)),
          ) ||
          !nextRegions.every(validRect)
        )
          fail("RECOVERY_CURRENT_OUTPUT");
        regions = nextRegions.map((rect) => ({ ...rect }));
        actualCapture = capture;
      },
    };
  }
  function concat(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
  function varint(value) {
    const out = [];
    do {
      const byte = value % 128;
      value = Math.floor(value / 128);
      out.push(byte | (value ? 128 : 0));
    } while (value);
    return new Uint8Array(out);
  }
  function field(number, wire, value) {
    const key = varint(number * 8 + wire);
    if (wire === 2) {
      const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
      return concat([key, varint(bytes.length), bytes]);
    }
    if (wire === 5) {
      const bytes = new Uint8Array(4);
      view(bytes).setFloat32(0, value, true);
      return concat([key, bytes]);
    }
    fail("RECOVERY_PROTO_WIRE");
  }
  function decodeRect(bytes) {
    const rect = {},
      names = { 1: "xCenter", 2: "yCenter", 3: "height", 4: "width", 5: "rotation" };
    if (bytes.length > 64) fail("RECOVERY_RECT_PACKET");
    for (let at = 0; at < bytes.length; at += 5) {
      if (
        at + 5 > bytes.length ||
        (bytes[at] & 7) !== 5 ||
        !names[bytes[at] >> 3] ||
        Object.hasOwn(rect, names[bytes[at] >> 3])
      )
        fail("RECOVERY_RECT_PACKET");
      rect[names[bytes[at] >> 3]] = view(bytes).getFloat32(at + 1, true);
    }
    if (!Object.hasOwn(rect, "rotation")) rect.rotation = 0;
    if (!validRect(rect)) fail("RECOVERY_RECT_PACKET");
    return rect;
  }
  const rectPacket = (rect) =>
    concat(
      [
        [1, rect.xCenter],
        [2, rect.yCenter],
        [3, rect.height],
        [4, rect.width],
        [5, rect.rotation],
      ].map(([key, value]) => field(key, 5, value)),
    );
  async function create(fileset, assets, options = {}) {
    if (!verified.has(assets)) fail("RECOVERY_VERIFIED_ASSETS_REQUIRED");
    const delegate = options.delegate ?? "CPU";
    if (
      !["CPU", "GPU"].includes(delegate) ||
      typeof Uc !== "function" ||
      typeof fc !== "function" ||
      typeof Vi !== "function" ||
      !Array.isArray(qs) ||
      qs.length !== 5 ||
      typeof qs[0] !== "number"
    )
      fail("RECOVERY_RUNTIME_ABI");
    const cache = createActualRegionCache();
    let partial = null;
    class RecoveryGraph extends Uc {
      constructor(module, canvas) {
        super(module, canvas);
        // Retain the partially constructed task so a rejected asynchronous
        // factory can close its graph/WASM resources before CPU fallback.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        partial = this;
      }
      m() {
        const graph = [],
          option = (number, body) => field(number, 2, body);
        const add = (name, calculator, inputs, outputs, settings) =>
          graph.push(
            field(
              1,
              2,
              concat([
                field(1, 2, name),
                field(2, 2, calculator),
                ...inputs.map((s) => field(3, 2, s)),
                ...outputs.map((s) => field(4, 2, s)),
                ...(settings ? [field(7, 2, settings)] : []),
              ]),
            ),
          );
        const childBase = (weights) => {
          const base = this.baseOptions.clone();
          nn(base, 1);
          return concat([Vi(qs).call(base), field(1, 2, field(1, 2, weights))]);
        };
        for (const name of [
          "image_in",
          "norm_rect",
          "recovery_prior0",
          "recovery_prior1",
          "recovery_slots0",
          "recovery_slots1",
        ])
          graph.push(field(10, 2, name));
        for (const name of ["hand_landmarks", "world_hand_landmarks", "handedness", "next_rects"])
          graph.push(field(15, 2, name));
        for (let i = 0; i < 2; i++) {
          add(
            "recovery_loop" + i,
            "BeginLoopFloatCalculator",
            ["ITERABLE:recovery_slots" + i, "CLONE:recovery_prior" + i],
            ["ITEM:unused_slot" + i, "CLONE:inner_rect" + i, "BATCH_END:batch_end" + i],
          );
          add(
            "recovery_vector" + i,
            "EndLoopNormalizedRectCalculator",
            ["ITEM:inner_rect" + i, "BATCH_END:batch_end" + i],
            ["ITERABLE:prior_rects" + i],
          );
        }
        // Every capture scans the full scene. Fresh palm proposals precede
        // optional retained hypotheses; old counts can never suppress a scan.
        add(
          "recovery_scene",
          "mediapipe.tasks.vision.hand_detector.HandDetectorGraph",
          ["IMAGE:image_in", "NORM_RECT:norm_rect"],
          ["HAND_RECTS:detected_rects"],
          option(
            464864288,
            concat([field(1, 2, childBase(assets.palm)), field(2, 5, policy.detection), new Uint8Array([24, 2])]),
          ),
        );
        add(
          "recovery_association",
          "HandAssociationCalculator",
          ["RECTS:0:detected_rects", "RECTS:1:prior_rects0", "RECTS:2:prior_rects1"],
          ["associated_rects"],
          option(408244367, field(1, 5, policy.association)),
        );
        add(
          "recovery_clip",
          "ClipNormalizedRectVectorSizeCalculator",
          ["associated_rects"],
          ["clipped_rects"],
          option(274674998, new Uint8Array([8, 2])),
        );
        add(
          "recovery_landmarks",
          "mediapipe.tasks.vision.hand_landmarker.MultipleHandLandmarksDetectorGraph",
          ["IMAGE:image_in", "HAND_RECT:clipped_rects"],
          [
            "LANDMARKS:raw_landmarks",
            "WORLD_LANDMARKS:raw_world",
            "HANDEDNESS:raw_handedness",
            "HAND_RECT_NEXT_FRAME:raw_next_rects",
          ],
          option(474472470, concat([field(1, 2, childBase(assets.landmark)), field(2, 5, policy.presence)])),
        );
        add("recovery_dimensions", "ImagePropertiesCalculator", ["IMAGE:image_in"], ["SIZE:image_size"]);
        add(
          "recovery_dedup",
          "HandLandmarksDeduplicationCalculator",
          [
            "MULTI_LANDMARKS:raw_landmarks",
            "MULTI_WORLD_LANDMARKS:raw_world",
            "MULTI_CLASSIFICATIONS:raw_handedness",
            "MULTI_ROIS:raw_next_rects",
            "IMAGE_SIZE:image_size",
          ],
          [
            "MULTI_LANDMARKS:hand_landmarks",
            "MULTI_WORLD_LANDMARKS:world_hand_landmarks",
            "MULTI_CLASSIFICATIONS:handedness",
            "MULTI_ROIS:next_rects",
          ],
        );
        const attach = (name, consume) => {
          this.g.attachProtoVectorListener(name, (values, time) => {
            consume(values);
            pa(this, time);
          });
          this.g.attachEmptyPacketListener(name, (time) => pa(this, time));
        };
        attach("hand_landmarks", (values) => {
          this.landmarks.push(...values.map((data) => Yo(Rs(data))));
        });
        attach("world_hand_landmarks", (values) => {
          this.worldLandmarks.push(...values.map((data) => qo(Ss(data))));
        });
        attach("handedness", (values) => {
          this.handedness.push(
            ...values.map((data) =>
              ws(data)
                .g()
                .map((item) => ({
                  score: Fn(item, 2) ?? 0,
                  index: Rn(item, 1) ?? -1,
                  categoryName: ge(tn(item, 3)) ?? "",
                  displayName: ge(tn(item, 4)) ?? "",
                })),
            ),
          );
        });
        attach("next_rects", (values) => {
          this.currentNextRects = values.map(decodeRect);
        });
        this.setGraph(concat(graph), true);
      }
    }
    let task;
    const submit = (image, capture, priors) => {
      task.landmarks = [];
      task.worldLandmarks = [];
      task.handedness = [];
      task.currentNextRects = [];
      for (let i = 0; i < 2; i++) {
        if (priors[i])
          task.g.addProtoToStream(rectPacket(priors[i]), "mediapipe.NormalizedRect", "recovery_prior" + i, capture);
        else task.g.addEmptyPacketToStream("recovery_prior" + i, capture);
        task.g.addFloatVectorToStream(new Float32Array(priors[i] ? [0] : []), "recovery_slots" + i, capture);
      }
      gc(task, image, undefined, capture);
    };
    try {
      task = await fc(RecoveryGraph, fileset, {
        baseOptions: { modelAssetBuffer: assets.task, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      // Startup is not a camera observation. A synthetic full-image hypothesis
      // forces both networks to materialize before READY, including GPU shaders.
      // The ordinary negative timestamp precedes every accepted live capture.
      const synthetic = new OffscreenCanvas(policy.startup.syntheticCanvasSide, policy.startup.syntheticCanvasSide);
      try {
        const context = synthetic.getContext("2d");
        if (!context) fail("RECOVERY_STARTUP_CANVAS");
        context.fillStyle = "#808080";
        context.fillRect(0, 0, synthetic.width, synthetic.height);
        submit(synthetic, policy.startup.timestamp, [{ xCenter: 0.5, yCenter: 0.5, width: 1, height: 1, rotation: 0 }]);
      } finally {
        synthetic.width = 0;
        synthetic.height = 0;
        task.landmarks = [];
        task.worldLandmarks = [];
        task.handedness = [];
        task.currentNextRects = [];
        cache.reset();
      }
    } catch (error) {
      try {
        partial?.close();
      } catch {
        const fatal = new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        fatal.cause = error;
        throw fatal;
      }
      throw error;
    }
    let closed = false,
      startupHealthAttempted = false,
      liveStarted = false;
    let qualifiedGeometry = null;
    let context = { session: "initial", geometry: "initial", mirror: false };
    return Object.freeze({
      metadata: Object.freeze({
        policyVersion: policy.version,
        delegate,
        maximumRetainedAgeMs: policy.retentionMs,
        modelSha256: policy.taskSha256,
      }),
      qualifyStartupLatency(geometry) {
        if (closed || liveStarted || startupHealthAttempted) fail("RECOVERY_STARTUP_HEALTH_STATE");
        const settings = policy.startup.healthProbe;
        const width = geometry?.width,
          height = geometry?.height;
        if (
          ![width, height].every(
            (value) =>
              Number.isSafeInteger(value) && value >= settings.minimumDimension && value <= settings.maximumDimension,
          )
        )
          fail("RECOVERY_STARTUP_GEOMETRY");
        startupHealthAttempted = true;
        const probes = [];
        const forced = [
          { xCenter: 0.25, yCenter: 0.5, width: 0.4, height: 0.8, rotation: 0 },
          { xCenter: 0.75, yCenter: 0.5, width: 0.4, height: 0.8, rotation: 0 },
        ];
        for (let i = 0; i < settings.timestamps.length; i++) {
          const started = performance.now();
          let synthetic = null;
          let discarded = 0;
          try {
            synthetic = new OffscreenCanvas(width, height);
            const drawing = synthetic.getContext("2d");
            if (!drawing) fail("RECOVERY_STARTUP_PROBE_CANVAS");
            drawing.fillStyle = i === 0 ? "#606060" : "#a0a0a0";
            drawing.fillRect(0, 0, width, height);
            submit(synthetic, settings.timestamps[i], forced);
            discarded = task.landmarks.length;
          } finally {
            if (synthetic) {
              synthetic.width = 0;
              synthetic.height = 0;
            }
            task.landmarks = [];
            task.worldLandmarks = [];
            task.handedness = [];
            task.currentNextRects = [];
            cache.reset();
          }
          const elapsedMs = performance.now() - started;
          probes.push(
            Object.freeze({
              timestamp: settings.timestamps[i],
              elapsedMs,
              forcedRegions: 2,
              discardedHandOutputs: discarded,
            }),
          );
        }
        const passed =
          probes.length === 2 &&
          probes.every(
            (p) => Number.isFinite(p.elapsedMs) && p.elapsedMs >= 0 && p.elapsedMs <= settings.maximumElapsedMs,
          );
        if (passed) qualifiedGeometry = Object.freeze({ width, height });
        return Object.freeze({
          passed,
          delegate,
          width,
          height,
          maximumElapsedMs: settings.maximumElapsedMs,
          probes: Object.freeze(probes),
          outputsDiscarded: true,
          retainedRegionsCleared: true,
          coverage: settings.coverage,
        });
      },
      reset(next) {
        if (
          closed ||
          !next ||
          typeof next.session !== "string" ||
          typeof next.geometry !== "string" ||
          typeof next.mirror !== "boolean"
        )
          fail("RECOVERY_CONTEXT");
        cache.reset();
        context = { ...next };
      },
      detectForVideo(image, capture) {
        if (closed) fail("RECOVERY_CLOSED");
        if (!qualifiedGeometry) fail("RECOVERY_STARTUP_HEALTH_REQUIRED");
        if (!image || image.width !== qualifiedGeometry.width || image.height !== qualifiedGeometry.height)
          fail("RECOVERY_FRAME_GEOMETRY_MISMATCH");
        liveStarted = true;
        const priors = cache.begin(capture, { ...context, width: image.width, height: image.height });
        submit(image, capture, priors);
        cache.observe(capture, task.landmarks, task.currentNextRects);
        return { landmarks: task.landmarks, worldLandmarks: task.worldLandmarks, handedness: task.handedness };
      },
      close() {
        if (closed) return;
        closed = true;
        cache.reset();
        task.close();
      },
    });
  }
  exports.WatchglassRecoveryProvider = Object.freeze({
    policy,
    verifyAssets,
    extractTaskChildren,
    createActualRegionCache,
    create,
  });
})();

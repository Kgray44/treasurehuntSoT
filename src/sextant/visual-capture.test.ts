// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import {
  VisualCaptureLatest,
  VisualFrameHandle,
  pairVisualFrames,
  visualCaptureDescriptorSchema,
  visualCapturePolicy,
  type VisualFrameAuthorization,
  type VisualFrameMetadata,
  type VisualSourceBinding,
} from "./visual-capture";

const source = (side: "color" | "infrared" = "color"): VisualSourceBinding => ({
  providerId: "synthetic-visual-provider",
  providerVersion: "1",
  ephemeralSourceId: side,
  ephemeralGroupId: "ephemeral-test-rig",
  modality: side === "color" ? "COLOR" : "INFRARED",
  leaseId: "lease-" + side,
  leaseGeneration: 1,
  providerGeneration: 2,
  geometryVersion: 3,
  width: 640,
  height: side === "color" ? 480 : 360,
  rotation: 0,
  mirrored: false,
  format: { pixelFormat: "PLATFORM_HANDLE", layout: "OPAQUE", bytesPerPixel: null, rowStrideBytes: null },
});
const auth = (side: "color" | "infrared" = "color"): VisualFrameAuthorization => ({
  source: source(side),
  referenceClockDomain: "runtime-monotonic",
  maximumCaptureAgeMs: 150,
  clockCalibration: null,
});
const meta = (side: "color" | "infrared" = "color", capture = 100, sequence = 0): VisualFrameMetadata => ({
  schemaVersion: 1,
  source: source(side),
  sequence,
  capture: { clockDomain: "runtime-monotonic", timestampMs: capture, uncertaintyMs: 0 },
  received: { clockDomain: "runtime-monotonic", timestampMs: capture + 3 },
  clockCalibrationVersion: null,
});
const handle = (m = meta()) => {
  const release = vi.fn();
  const payload = { numericPixelExample: new Uint8Array([1, 2, 3]) };
  return { frame: VisualFrameHandle.create(m, payload, release), release, payload };
};
const registration = () => ({
  verified: true as const,
  evidenceReference: "synthetic-known-transform-v1",
  left: source(),
  right: source("infrared"),
});

describe("Sextant visual capture declarations", () => {
  const descriptor = () => ({
    schemaVersion: 1,
    providerId: "synthetic-visual-provider",
    providerVersion: "1",
    ephemeralSourceId: "infrared",
    ephemeralGroupId: "ephemeral-test-rig",
    modality: "INFRARED",
    detected: "PRESENT",
    access: "UNAVAILABLE",
    permission: "GRANTED",
    streaming: "STOPPED",
    controls: { exposure: "UNKNOWN", driverManagedIllumination: "SUPPORTED", directInfraredLed: "UNSUPPORTED" },
  });
  it("keeps discovery, access, permission and streaming independent without inventing availability", () => {
    expect(visualCaptureDescriptorSchema.parse(descriptor())).toEqual(descriptor());
    expect(
      visualCaptureDescriptorSchema.parse({ ...descriptor(), detected: "UNKNOWN", permission: "DENIED" }).access,
    ).toBe("UNAVAILABLE");
  });
  it("does not equate driver-managed infrared illumination with direct LED control", () => {
    const d = visualCaptureDescriptorSchema.parse(descriptor());
    expect(d.controls.driverManagedIllumination).toBe("SUPPORTED");
    expect(d.controls.directInfraredLed).toBe("UNSUPPORTED");
    expect(d.controls.exposure).toBe("UNKNOWN");
  });
  it("permits only a consumer-qualified profile reference, not model quality asserted by Sextant", () => {
    expect(
      visualCaptureDescriptorSchema.parse({
        ...descriptor(),
        consumerQualifiedProfile: {
          owner: "WATCHGLASS",
          profileId: "explicit-ir-profile",
          qualificationReference: "synthetic-review-v1",
        },
      }).consumerQualifiedProfile?.owner,
    ).toBe("WATCHGLASS");
    expect(visualCaptureDescriptorSchema.safeParse({ ...descriptor(), modelCompatible: true }).success).toBe(false);
    expect(
      visualCaptureDescriptorSchema.safeParse({ ...descriptor(), deviceName: "Name does not prove IR" }).success,
    ).toBe(false);
  });
  it.each(["COLOR", "INFRARED", "DEPTH"])("declares %s without opening or acquiring hardware", (modality) => {
    expect(visualCaptureDescriptorSchema.parse({ ...descriptor(), modality }).modality).toBe(modality);
  });
});

describe("opaque visual frame ownership", () => {
  it("keeps payload in memory, forbids JSON, and closes exactly once", () => {
    const { frame, release, payload } = handle();
    expect(frame.payload).toBe(payload);
    expect(Object.keys(frame)).not.toContain("payload");
    expect(() => JSON.stringify(frame)).toThrow("VISUAL_FRAME_SERIALIZATION_FORBIDDEN");
    expect(Object.isFrozen(frame.metadata.source)).toBe(true);
    frame.close();
    frame.close();
    expect(release).toHaveBeenCalledExactlyOnceWith(payload);
    expect(() => frame.payload).toThrow("VISUAL_FRAME_CLOSED");
  });
  it("disposes malformed metadata and isolates a failing disposer", () => {
    const release = vi.fn(() => {
      throw Error("synthetic disposal error");
    });
    expect(() => VisualFrameHandle.create({ ...meta(), rawPixels: [1] }, {}, release)).toThrow();
    expect(release).toHaveBeenCalledTimes(1);
    const frame = VisualFrameHandle.create(meta(), {}, release);
    expect(frame.close()).toBe(false);
    expect(frame.closed).toBe(true);
    expect(frame.close()).toBe(false);
    expect(release).toHaveBeenCalledTimes(2);
  });
  it("validates negotiated packed row stride and byte length without assuming a camera size or RGB layout", () => {
    const m = meta();
    m.source.width = 2;
    m.source.height = 3;
    m.source.format = { pixelFormat: "GRAY8", layout: "PACKED", bytesPerPixel: 1, rowStrideBytes: 4 };
    const release = vi.fn(),
      bytes = new Uint8Array(12);
    const frame = VisualFrameHandle.create(m, bytes, release);
    expect(frame.payload).toBe(bytes);
    frame.close();
    expect(release).toHaveBeenCalledExactlyOnceWith(bytes);
    const bad = vi.fn();
    expect(() => VisualFrameHandle.create(m, new Uint8Array(11), bad)).toThrow("VISUAL_PAYLOAD_SIZE_INVALID");
    expect(bad).toHaveBeenCalledTimes(1);
    m.source.format.rowStrideBytes = 1;
    expect(() => VisualFrameHandle.create(m, bytes, vi.fn())).toThrow();
    expect(() => VisualFrameHandle.create(meta(), bytes, vi.fn())).toThrow(
      "VISUAL_BYTE_PAYLOAD_REQUIRES_PACKED_FORMAT",
    );
  });
  it("does not allow callers to replace the validated metadata reference", () => {
    const { frame } = handle();
    expect(() => Object.defineProperty(frame, "metadata", { value: meta("infrared") })).toThrow();
    frame.close();
  });
});

describe("bounded latest frame validation", () => {
  it("replaces and disposes previous frames, transfers only the latest, and never queues", () => {
    const latest = new VisualCaptureLatest(auth());
    const a = handle(meta()),
      b = handle(meta("color", 120, 1));
    expect(latest.offer(a.frame, 104)).toEqual({ accepted: true });
    expect(latest.offer(b.frame, 124)).toEqual({ accepted: true });
    expect(a.release).toHaveBeenCalledTimes(1);
    expect(latest.take(124)).toBe(b.frame);
    expect(latest.take(124)).toBeNull();
    latest.dispose();
    expect(b.frame.closed).toBe(false); // Ownership was transferred to the consumer.
    b.frame.close();
  });
  it("retains the existing 150 ms capture freshness boundary including capture uncertainty", () => {
    expect(auth().maximumCaptureAgeMs).toBe(150);
    const latest = new VisualCaptureLatest(auth());
    const good = handle(meta()),
      stale = handle(meta("color", 101, 1));
    expect(latest.offer(good.frame, 250)).toEqual({ accepted: true });
    expect(latest.take(250.001)).toBeNull();
    expect(good.release).toHaveBeenCalledTimes(1);
    expect(latest.offer(stale.frame, 251.001)).toEqual({ accepted: false, reason: "VISUAL_FRAME_STALE" });
    const uncertain = meta("color", 110, 2);
    uncertain.capture.uncertaintyMs = 4;
    expect(latest.offer(handle(uncertain).frame, 257)).toEqual({ accepted: false, reason: "VISUAL_FRAME_STALE" });
  });
  it("requires the authorized consumer age budget rather than assigning Reach freshness to every Sextant consumer", () => {
    const other = auth();
    other.maximumCaptureAgeMs = 300;
    const frame = handle();
    expect(new VisualCaptureLatest(other).offer(frame.frame, 350)).toEqual({ accepted: true });
    frame.frame.close();
    const missing = { ...auth() } as Record<string, unknown>;
    delete missing.maximumCaptureAgeMs;
    expect(() => new VisualCaptureLatest(missing)).toThrow();
  });
  it.each([
    "providerId",
    "providerVersion",
    "ephemeralSourceId",
    "leaseId",
    "leaseGeneration",
    "providerGeneration",
    "geometryVersion",
    "width",
    "mirrored",
  ] as const)("rejects and disposes a changed %s without replacing the authorized source", (key) => {
    const latest = new VisualCaptureLatest(auth()),
      good = handle(),
      changed = meta("color", 120, 1);
    latest.offer(good.frame, 104);
    if (typeof changed.source[key] === "number")
      Object.assign(changed.source, { [key]: Number(changed.source[key]) + 1 });
    else if (typeof changed.source[key] === "boolean") Object.assign(changed.source, { [key]: !changed.source[key] });
    else Object.assign(changed.source, { [key]: "different" });
    const bad = handle(changed);
    expect(latest.offer(bad.frame, 124)).toEqual({ accepted: false, reason: "VISUAL_SOURCE_MISMATCH" });
    expect(bad.release).toHaveBeenCalledTimes(1);
    expect(latest.take(124)).toBe(good.frame);
    good.frame.close();
  });
  it("rejects duplicate/regressing capture or sequence even after take, without poisoning the next good frame", () => {
    const latest = new VisualCaptureLatest(auth());
    latest.offer(handle(meta("color", 100, 4)).frame, 104);
    latest.take(104)?.close();
    for (const m of [meta("color", 110, 4), meta("color", 100, 5), meta("color", 90, 6)]) {
      const x = handle(m);
      expect(latest.offer(x.frame, 114)).toEqual({ accepted: false, reason: "VISUAL_FRAME_REORDERED" });
      expect(x.release).toHaveBeenCalledTimes(1);
    }
    expect(latest.offer(handle(meta("color", 120, 7)).frame, 124)).toEqual({ accepted: true });
    latest.dispose();
  });
  it("rejects future capture, delayed receive relabeling, nonfinite now, and ended lifecycle", () => {
    const latest = new VisualCaptureLatest(auth());
    const future = meta();
    future.capture.timestampMs = 120;
    expect(latest.offer(handle(future).frame, 110).accepted).toBe(false);
    const delayed = meta();
    delayed.received.timestampMs = 300;
    expect(latest.offer(handle(delayed).frame, 301)).toEqual({ accepted: false, reason: "VISUAL_FRAME_STALE" });
    expect(latest.offer(handle().frame, NaN)).toEqual({ accepted: false, reason: "VISUAL_CLOCK_INVALID" });
    latest.dispose();
    const stopped = handle();
    expect(latest.offer(stopped.frame, 104)).toEqual({ accepted: false, reason: "VISUAL_LIFECYCLE_ENDED" });
    expect(stopped.release).toHaveBeenCalledTimes(1);
  });
});

describe("authorized clock conversion and multimodal pairing", () => {
  const foreign = () => {
    const a = auth("infrared");
    a.clockCalibration = {
      version: 1,
      sourceClockDomain: "sensor-clock",
      referenceClockDomain: "runtime-monotonic",
      offsetMs: -900,
      uncertaintyMs: 1,
      validFromMs: 0,
      validUntilMs: 500,
    };
    const m = meta("infrared", 106);
    m.capture = { clockDomain: "sensor-clock", timestampMs: 1006, uncertaintyMs: 1 };
    m.clockCalibrationVersion = 1;
    return { a, m };
  };
  it("requires an explicitly authorized current calibrated clock, not an inferred receive time", () => {
    const { a, m } = foreign();
    expect(new VisualCaptureLatest(a).offer(handle(m).frame, 110)).toEqual({ accepted: true });
    expect(new VisualCaptureLatest(auth("infrared")).offer(handle(m).frame, 110)).toEqual({
      accepted: false,
      reason: "VISUAL_CLOCK_UNCALIBRATED",
    });
    const expired = foreign();
    expired.a.clockCalibration!.validUntilMs = 109;
    expect(new VisualCaptureLatest(expired.a).offer(handle(expired.m).frame, 110)).toEqual({
      accepted: false,
      reason: "VISUAL_CLOCK_CALIBRATION_EXPIRED",
    });
    const boundary = foreign();
    boundary.a.clockCalibration!.validFromMs = 105;
    expect(new VisualCaptureLatest(boundary.a).offer(handle(boundary.m).frame, 110)).toEqual({
      accepted: false,
      reason: "VISUAL_CLOCK_CALIBRATION_EXPIRED",
    });
  });
  it("accepts a current same-group RGB/IR pair at conservative 10 ms skew but only for acquisition assistance", () => {
    expect(visualCapturePolicy.defaultMaximumPairSkewMs).toBe(10);
    const { a, m } = foreign(),
      l = handle(),
      r = handle(m);
    const p = pairVisualFrames(l.frame, r.frame, { left: auth(), right: a }, 110);
    expect(p.ok).toBe(true);
    if (!p.ok) throw Error(p.reason);
    expect(p.skewUpperBoundMs).toBe(8);
    expect(p.usage).toBe("ACQUISITION_ASSISTANCE_ONLY");
    expect(p.registrationReference).toBeNull();
    p.close();
    p.close();
    expect(l.release).toHaveBeenCalledTimes(1);
    expect(r.release).toHaveBeenCalledTimes(1);
  });
  it("rejects near timestamps when combined clock uncertainty exceeds the skew budget", () => {
    const { a, m } = foreign();
    m.capture.uncertaintyMs = 4;
    m.received.timestampMs = 115;
    const l = handle(),
      r = handle(m);
    expect(pairVisualFrames(l.frame, r.frame, { left: auth(), right: a }, 115)).toEqual({
      ok: false,
      reason: "VISUAL_PAIR_SKEW_EXCEEDED",
    });
    expect(l.release).toHaveBeenCalledTimes(1);
    expect(r.release).toHaveBeenCalledTimes(1);
  });
  it.each(["ephemeralGroupId", "leaseId", "geometryVersion"] as const)(
    "rejects mismatched pair %s and disposes both handles",
    (key) => {
      const a = auth("infrared"),
        m = meta("infrared", 106);
      if (key === "ephemeralGroupId") {
        a.source.ephemeralGroupId = "another-rig";
        m.source.ephemeralGroupId = "another-rig";
      } else if (key === "leaseId") m.source.leaseId = "unapproved-lease";
      else m.source.geometryVersion++;
      const l = handle(),
        r = handle(m),
        result = pairVisualFrames(l.frame, r.frame, { left: auth(), right: a }, 110);
      expect(result.ok).toBe(false);
      expect(l.frame.closed).toBe(true);
      expect(r.frame.closed).toBe(true);
    },
  );
  it("requires exact verified geometry registration before any coordinate-fusion use", () => {
    const l = handle(),
      r = handle(meta("infrared", 106));
    expect(
      pairVisualFrames(
        l.frame,
        r.frame,
        { left: auth(), right: auth("infrared"), requireRegisteredGeometry: true },
        110,
      ),
    ).toEqual({ ok: false, reason: "VISUAL_GEOMETRY_UNREGISTERED" });
    const p = pairVisualFrames(
      handle().frame,
      handle(meta("infrared", 106)).frame,
      { left: auth(), right: auth("infrared"), registration: registration(), requireRegisteredGeometry: true },
      110,
    );
    expect(p.ok && p.usage).toBe("REGISTERED_COORDINATE_FUSION");
    if (p.ok) p.close();
    const wrong = registration();
    wrong.right.geometryVersion++;
    const bad = pairVisualFrames(
      handle().frame,
      handle(meta("infrared", 106)).frame,
      { left: auth(), right: auth("infrared"), registration: wrong },
      110,
    );
    expect(bad).toEqual({ ok: false, reason: "VISUAL_GEOMETRY_REGISTRATION_MISMATCH" });
  });
  it("rejects stale or foreign-clock pairs and bounds explicit skew by each consumer freshness budget", () => {
    const l = handle(),
      r = handle(meta("infrared", 106));
    expect(pairVisualFrames(l.frame, r.frame, { left: auth(), right: auth("infrared") }, 257)).toEqual({
      ok: false,
      reason: "VISUAL_FRAME_STALE",
    });
    const wrong = auth("infrared");
    wrong.referenceClockDomain = "uncalibrated-other-clock";
    expect(
      pairVisualFrames(handle().frame, handle(meta("infrared", 106)).frame, { left: auth(), right: wrong }, 110).ok,
    ).toBe(false);
    expect(
      pairVisualFrames(
        handle().frame,
        handle(meta("infrared", 106)).frame,
        { left: auth(), right: auth("infrared"), maximumSkewMs: 151 },
        110,
      ),
    ).toEqual({ ok: false, reason: "VISUAL_PAIR_AUTHORIZATION_INVALID" });
    const custom = pairVisualFrames(
      handle().frame,
      handle(meta("infrared", 124)).frame,
      { left: auth(), right: auth("infrared"), maximumSkewMs: 25 },
      130,
    );
    expect(custom.ok && custom.skewUpperBoundMs).toBe(24);
    if (custom.ok) custom.close();
  });
  it.each(["providerVersion", "leaseGeneration", "width", "height", "rotation", "mirrored", "format"] as const)(
    "rejects an old registration after a newly authorized %s change even if geometryVersion is unchanged",
    (key) => {
      const a = auth("infrared"),
        m = meta("infrared", 106);
      if (key === "providerVersion") {
        a.source.providerVersion = "2";
        m.source.providerVersion = "2";
      } else if (key === "mirrored") {
        a.source.mirrored = true;
        m.source.mirrored = true;
      } else if (key === "rotation") {
        a.source.rotation = 90;
        m.source.rotation = 90;
      } else if (key === "format") {
        a.source.format.pixelFormat = "ALTERNATE_OPAQUE";
        m.source.format.pixelFormat = "ALTERNATE_OPAQUE";
      } else {
        Object.assign(a.source, { [key]: a.source[key] + 1 });
        Object.assign(m.source, { [key]: m.source[key] + 1 });
      }
      const p = pairVisualFrames(
        handle().frame,
        handle(m).frame,
        { left: auth(), right: a, registration: registration() },
        110,
      );
      expect(p).toEqual({ ok: false, reason: "VISUAL_GEOMETRY_REGISTRATION_MISMATCH" });
    },
  );
});

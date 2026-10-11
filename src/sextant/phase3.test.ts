// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase3.field-context
import { afterEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  MagneticFieldContext,
  RelativeElevationContext,
  PedometerContext,
  MagneticHunt,
  stepEvidenceSchema,
} from "./field-context";
import { SextantCapabilityRegistry } from "./capabilities";
import { SecureRangingSession, WebBleCapability, WebNfcCapability, ndefEnvelopeSchema } from "./nearby";
import { webMediaCapabilities } from "./media-capability";
import { WebMagneticFieldProvider, SextantFieldDerivations } from "./field-provider";
import { SextantProviderRegistry } from "./providers";
import {
  magneticObservation,
  pressureObservation,
  phase3Fixture,
  nearbyPurpose,
  mediaPurpose,
  peerContract,
  blePolicy,
  requirementFixture,
} from "./phase3-fixtures";
import { sextantAuthoringSchema, simulateSextantRequirement } from "./requirements";
afterEach(() => vi.useRealTimers());
describe("honest local field semantics", () => {
  it("samples a stable baseline then derives an approach trend; one spike does not become success", () => {
    const m = new MagneticFieldContext();
    let r;
    for (let at = 0; at <= 800; at += 200) r = m.accept(magneticObservation(50, at), at);
    expect(r).toMatchObject({ state: "READY", deltaMicrotesla: 0 });
    for (let at = 1000; at <= 1400; at += 200) r = m.accept(magneticObservation(50 + (at - 800) / 50, at), at);
    expect(r).toMatchObject({ trend: "APPROACHING", deltaMicrotesla: 12 });
    const hunt = new MagneticHunt({
      version: 1,
      thresholdMicrotesla: 10,
      dwellMs: 800,
      timeoutMs: 10000,
      fallback: "Use screen clue",
      safeProp: "WEAK_ENCLOSED_DISTANT",
      safetyAcknowledged: true,
    });
    for (let at = 0; at <= 800; at += 200) hunt.accept(magneticObservation(50, at), at);
    expect(hunt.accept(magneticObservation(65, 1000), 1000).state).toBe("SEARCHING");
    expect(hunt.accept(magneticObservation(50, 1200), 1200).state).toBe("SEARCHING");
    for (let at = 1400; at <= 2400; at += 200) hunt.accept(magneticObservation(65, at), at);
    expect(hunt.accept(magneticObservation(65, 2600), 2600).state).toBe("REFERENCE_REACHED");
    expect(hunt.accept(magneticObservation(65, 2800, { discontinuity: true }), 2800).state).toBe("SEARCHING");
  });
  it.each(["DISTURBED", "UNKNOWN"] as const)("downgrades %s calibration and resets the baseline", (calibration) => {
    const m = new MagneticFieldContext();
    for (let at = 0; at <= 800; at += 200) m.accept(magneticObservation(50, at), at);
    expect(m.accept(magneticObservation(50, 1000, { calibrationState: calibration }), 1000).state).toBe("UNUSABLE");
    expect(m.accept(magneticObservation(50, 1200), 1200).state).toBe("CALIBRATING");
  });
  it.each([
    { qualityClass: "LOW" as const },
    { provenanceRoot: "synthetic.other@1" },
    { sequence: 0 },
    { timestampMonotonic: 0 },
    { referenceFrame: "NONE" as const },
    { units: "tesla" },
  ])("does not bridge loss or substitution %j", (change) => {
    const m = new MagneticFieldContext();
    for (let at = 0; at <= 800; at += 200) m.accept(magneticObservation(50, at), at);
    expect(m.accept(magneticObservation(70, 1000, change), 1000).deltaMicrotesla).toBeNull();
  });
  it("rejects nonfinite values and strong disturbance; unstable calibration stays unqualified", () => {
    const m = new MagneticFieldContext();
    expect(() => m.accept(magneticObservation(NaN, 0), 0)).toThrow();
    expect(m.accept(magneticObservation(1000, 0), 0).state).toBe("UNUSABLE");
    for (let at = 0; at <= 800; at += 200)
      expect(m.accept(magneticObservation(at % 400 ? 70 : 30, at), at).state).toBe("CALIBRATING");
  });
  it("reports approximately six metres relative climb with an environmental warning, never a floor", () => {
    const p = new RelativeElevationContext();
    for (let at = 0; at <= 800; at += 200) p.accept(pressureObservation(1013.25, at), at);
    const pressure = 1013.25 * Math.pow(1 - 6 / 44330, 1 / 0.1903),
      r = p.accept(pressureObservation(pressure, 1000), 1000);
    expect(r).toMatchObject({ deltaMeters: 6, state: "READY", environmentalWarning: "UNKNOWN" });
    expect(r).not.toHaveProperty("floor");
    expect(r).not.toHaveProperty("absoluteAltitude");
  });
  it("requires weather baseline revalidation and rejects absolute/invalid pressure input", () => {
    const p = new RelativeElevationContext();
    for (let at = 0; at <= 120000; at += 1000) p.accept(pressureObservation(1013.25, at), at);
    expect(p.accept(pressureObservation(1012, 121000), 121000)).toMatchObject({
      state: "REVALIDATE",
      deltaMeters: null,
    });
    expect(() => p.accept(pressureObservation(Infinity, 0), 0)).toThrow();
    expect(p.accept(pressureObservation(1000, 0, { referenceFrame: "WGS84" }), 0).state).toBe("REVALIDATE");
  });
  it("separates step delta from route distance, resets on pause/restart and declares uncertainty", () => {
    const p = new PedometerContext();
    const input = { count: 100, at: 0, generation: "one", method: "OS_PEDOMETER" as const };
    expect(p.accept(input, 0)?.stepDelta).toBe(0);
    expect(
      p.accept({ ...input, count: 102, at: 1000, stride: { meters: 0.7, uncertaintyMeters: 0.3 } }, 1000),
    ).toMatchObject({ stepDelta: 2, approximateDistanceMeters: 1, distanceUncertaintyMeters: 1 });
    p.reset();
    expect(p.accept({ ...input, count: 104, at: 2000 }, 2000)?.stepDelta).toBe(0);
    expect(p.accept({ ...input, count: 20, at: 3000, generation: "two" }, 3000)?.stepDelta).toBe(0);
    expect(p.accept({ ...input, count: 1000, at: 3500, generation: "two" }, 3500)).toBeNull();
    expect(
      stepEvidenceSchema.safeParse({
        stepDelta: 2,
        cadenceClass: "SLOW",
        method: "OS_PEDOMETER",
        approximateDistanceMeters: 10,
      }).success,
    ).toBe(false);
  });
  it("keeps v1 scalars compatible and rejects synthetic field injection in production", () => {
    const r = new SextantCapabilityRegistry();
    expect(r.get("sextant.magnetic.field").valueSchema.parse({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
    expect(r.get("sextant.elevation.relative").valueSchema.parse(6)).toBe(6);
    const p = new WebMagneticFieldProvider(null, true, () => 0, "lab");
    expect(() => new SextantProviderRegistry(r).register(p)).toThrow("SEXTANT_SIMULATION_FORBIDDEN");
    expect(p.discover().support).toBe("UNSUPPORTED");
    const derived = new SextantFieldDerivations();
    expect(derived.pedometer({ count: 1, at: 0, generation: "one", method: "OS_PEDOMETER" }, 0)?.stepDelta).toBe(0);
  });
});
describe("camera/microphone state and consumer-owned resources", () => {
  it("isolates a late media denial from a newer granted source generation", async () => {
    const f = phase3Fixture();
    let denyOld!: (error: unknown) => void;
    const old = f.media.acquire(
      "CAMERA",
      mediaPurpose,
      () =>
        new Promise((_, reject) => {
          denyOld = reject;
        }),
      () => {},
    );
    f.media.cancelConsumer(mediaPurpose.consumerId);
    const current = await f.media.acquire(
      "CAMERA",
      { ...mediaPurpose, consumerId: "new-camera-consumer" },
      async () => ({ resource: f.resource }),
      () => {},
    );
    const rejected = expect(old).rejects.toThrow("SEXTANT_MEDIA_UNAVAILABLE");
    denyOld(new DOMException("old request denied", "NotAllowedError"));
    await rejected;
    expect(f.media.snapshot("CAMERA")).toMatchObject({
      permission: "GRANTED",
      availability: "AVAILABLE",
      generation: current.generation,
    });
    expect(f.media.diagnostics().activeResources).toBe(1);
    current.release();
  });
  it("isolates a queued old media ended callback from a newer source generation", async () => {
    const f = phase3Fixture();
    let endedOld!: () => void;
    const old = await f.media.acquire(
      "CAMERA",
      mediaPurpose,
      async () => ({
        resource: {
          stop: f.resource.stop,
          onEnded: (callback) => {
            endedOld = callback;
            return () => {};
          },
        },
      }),
      () => {},
    );
    old.release();
    const current = await f.media.acquire(
      "CAMERA",
      { ...mediaPurpose, consumerId: "new-camera-consumer" },
      async () => ({ resource: f.resource }),
      () => {},
    );
    endedOld();
    expect(f.media.snapshot("CAMERA")).toMatchObject({
      permission: "GRANTED",
      availability: "AVAILABLE",
      generation: current.generation,
    });
    expect(f.media.diagnostics().activeResources).toBe(1);
    current.release();
    expect(f.stats().stops).toBe(2);
  });
  it("detaches media listeners when the source ends synchronously during registration", async () => {
    const f = phase3Fixture();
    let detached = 0;
    await expect(
      f.media.acquire(
        "CAMERA",
        mediaPurpose,
        async () => ({
          resource: {
            stop: f.resource.stop,
            onEnded: (callback) => {
              callback();
              return () => {
                detached++;
              };
            },
          },
        }),
        () => {},
      ),
    ).rejects.toThrow();
    expect(detached).toBe(1);
    expect(f.media.diagnostics().activeResources).toBe(0);
  });
  it("projects a granted busy camera separately from denial and supports explicit retry", async () => {
    const f = phase3Fixture();
    f.media.setPermission("CAMERA", "GRANTED");
    await expect(
      f.media.acquire(
        "CAMERA",
        mediaPurpose,
        async () => {
          throw new DOMException("busy", "NotReadableError");
        },
        () => {},
      ),
    ).rejects.toThrow();
    expect(f.media.snapshot("CAMERA")).toMatchObject({ permission: "GRANTED", availability: "BUSY" });
    await expect(
      f.media.acquire(
        "MICROPHONE",
        mediaPurpose,
        async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
        () => {},
      ),
    ).rejects.toThrow();
    expect(f.media.snapshot("MICROPHONE").permission).toBe("DENIED");
    const make = vi.fn(async () => ({ resource: f.resource }));
    await expect(f.media.acquire("MICROPHONE", mediaPurpose, make, () => {})).rejects.toThrow();
    expect(make).not.toHaveBeenCalled();
    const lease = await f.media.acquire("MICROPHONE", { ...mediaPurpose, retry: true }, make, () => {});
    lease.release();
    f.media.dispose();
  });
  it("expires silent media leases and records failed resource cleanup", async () => {
    vi.useFakeTimers();
    const f = phase3Fixture();
    await f.media.acquire(
      "CAMERA",
      mediaPurpose,
      async () => ({
        resource: {
          stop: () => {
            throw new Error("failure");
          },
          onEnded: () => () => {},
        },
      }),
      () => {},
    );
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.media.diagnostics()).toMatchObject({ activeResources: 0, cleanupFailures: 1 });
  });
  it("discovers without capture/enumeration and separates permission from availability", () => {
    const getUserMedia = vi.fn();
    const media = webMediaCapabilities({
      isSecureContext: true,
      navigator: { mediaDevices: { getUserMedia, getSupportedConstraints: () => ({ width: true, deviceId: true }) } },
    });
    expect(media.snapshot("CAMERA")).toMatchObject({
      support: "SUPPORTED",
      permission: "PROMPT",
      availability: "TEMPORARILY_UNAVAILABLE",
      captureConstraints: ["width"],
    });
    media.setPermission("CAMERA", "GRANTED");
    expect(media.snapshot("MICROPHONE").permission).toBe("PROMPT");
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(webMediaCapabilities({ isSecureContext: false }).snapshot("CAMERA").permission).toBe("RESTRICTED");
  });
  it("shared explicit acquisition preserves the remaining consumer and stops on last release", async () => {
    const f = phase3Fixture();
    const make = vi.fn(async () => ({
      resource: f.resource,
      geometry: { width: 640, height: 480, facing: "REAR" as const, mirrored: false },
    }));
    const first = await f.media.acquire("CAMERA", { ...mediaPurpose, shareKey: "vision" }, make, () => {});
    const second = await f.media.acquire(
      "CAMERA",
      { ...mediaPurpose, consumerId: "other", shareKey: "vision" },
      make,
      () => {},
    );
    expect(make).toHaveBeenCalledTimes(1);
    first.release();
    expect(f.stats().stops).toBe(0);
    second.release();
    expect(f.stats().stops).toBe(1);
    expect(f.media.diagnostics().activeResources).toBe(0);
  });
  it.each([
    "SOURCE_CHANGED",
    "GEOMETRY_CHANGED",
    "THERMAL_RESTRICTED",
    "TRACK_ENDED",
    "PERMISSION_REVOKED",
    "BACKGROUND_RESTRICTED",
  ])("invalidates calibration generation for %s", async (reason) => {
    const f = phase3Fixture(),
      invalidated = vi.fn();
    const lease = await f.media.acquire("CAMERA", mediaPurpose, async () => ({ resource: f.resource }), invalidated);
    if (reason === "TRACK_ENDED") f.trackEnd();
    else if (reason === "PERMISSION_REVOKED") f.media.setPermission("CAMERA", "DENIED");
    else if (reason === "BACKGROUND_RESTRICTED") f.media.setForeground(false);
    else f.media.invalidate("CAMERA", reason);
    expect(f.media.snapshot("CAMERA").generation).toBeGreaterThan(lease.generation);
    expect(invalidated).toHaveBeenCalledWith(reason);
    expect(f.stats().stops).toBe(1);
    expect(f.stats().trackListeners).toBe(0);
  });
  it("rejects busy/no consent and cleans a late grant after suspension", async () => {
    const f = phase3Fixture();
    let resolve!: (a: { resource: typeof f.resource }) => void;
    const pending = f.media.acquire(
      "CAMERA",
      mediaPurpose,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      () => {},
    );
    await expect(
      f.media.acquire(
        "CAMERA",
        mediaPurpose,
        async () => ({ resource: f.resource }),
        () => {},
      ),
    ).rejects.toThrow("BUSY");
    f.media.setForeground(false);
    resolve({ resource: f.resource });
    await expect(pending).rejects.toThrow();
    expect(f.stats().stops).toBe(1);
    await expect(
      f.media.acquire(
        "MICROPHONE",
        { ...mediaPurpose, consent: false },
        async () => ({ resource: f.resource }),
        () => {},
      ),
    ).rejects.toThrow();
    f.media.dispose();
  });
  it("times out capture while preserving late-resource cleanup", async () => {
    vi.useFakeTimers();
    const f = phase3Fixture();
    let resolve!: (a: { resource: typeof f.resource }) => void;
    const pending = f.media.acquire(
      "CAMERA",
      mediaPurpose,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      () => {},
    );
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10001);
    await rejected;
    resolve({ resource: f.resource });
    await Promise.resolve();
    expect(f.stats().stops).toBe(1);
    expect(f.media.diagnostics().activeResources).toBe(0);
  });
});
describe("nearby security, privacy and optional web adapters", () => {
  it("does not treat an authenticated BLE policy label as owner proof, and rechecks revocation", async () => {
    const f = phase3Fixture(),
      policy = { ...blePolicy, applicationSecurity: "APPLICATION_AUTHENTICATED" };
    const unverified = await new WebBleCapability(f.bluetooth, true, f.sessions).connect(nearbyPurpose, policy);
    if (unverified.state !== "CONNECTED") throw Error("connect");
    const first = await unverified.characteristic(blePolicy.services[0], blePolicy.services[0]);
    await expect(first.write(new Uint8Array([1]))).rejects.toThrow("FORBIDDEN");
    unverified.release();
    f.setTime(1000);
    let authenticated = true;
    const verified = await new WebBleCapability(f.bluetooth, true, f.sessions).connect(
      nearbyPurpose,
      policy,
      () => authenticated,
    );
    if (verified.state !== "CONNECTED") throw Error("connect");
    const second = await verified.characteristic(blePolicy.services[0], blePolicy.services[0]);
    await expect(second.write(new Uint8Array([1]))).resolves.toBeUndefined();
    authenticated = false;
    await expect(second.write(new Uint8Array([1]))).rejects.toThrow("FORBIDDEN");
    verified.release();
  });
  it("sanitizes synchronous and asynchronous nearby failures and terminates the owned session", async () => {
    for (const synchronous of [true, false]) {
      const f = phase3Fixture(),
        lease = f.sessions.begin(nearbyPurpose);
      await expect(
        f.sessions.acquire(
          lease.token,
          () => {
            if (synchronous) throw Error("PRIVATE_DEVICE_NAME");
            return Promise.reject(Error("PRIVATE_DEVICE_NAME"));
          },
          () => {},
        ),
      ).rejects.toThrow("SEXTANT_NEARBY_OPERATION_FAILED");
      expect(f.sessions.diagnostics().activeSessions).toBe(0);
    }
  });
  it("bounds accessory operations, reports cleanup failure and expires without readings", async () => {
    vi.useFakeTimers();
    const f = phase3Fixture(),
      lease = f.sessions.begin(nearbyPurpose);
    f.sessions.own(lease.token, () => {
      throw new Error("cleanup");
    });
    for (let i = 0; i < 64; i++)
      await f.sessions.acquire(
        lease.token,
        async () => true,
        () => {},
      );
    await expect(
      f.sessions.acquire(
        lease.token,
        async () => true,
        () => {},
      ),
    ).rejects.toThrow("OPERATION_LIMIT");
    expect(f.sessions.diagnostics()).toMatchObject({ activeSessions: 0, cleanupFailures: 1 });
    f.setTime(1000);
    const second = f.sessions.begin({ ...nearbyPurpose, expiresAt: 2000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.sessions.active(second.token)).toBe(false);
  });
  it("requires consent, bounded leases, user action and rate limits", () => {
    const f = phase3Fixture();
    for (const change of [{ consent: false }, { userInitiated: false }, { purpose: "" }, { expiresAt: 70000 }])
      expect(() => f.sessions.begin({ ...nearbyPurpose, ...change })).toThrow();
    const l = f.sessions.begin(nearbyPurpose);
    expect(() => f.sessions.begin({ ...nearbyPurpose, consumerId: "other" })).toThrow();
    l.release();
    f.sessions.dispose();
  });
  it("binds authenticated OOB to owner purpose/generation/nonce and rejects replay/dropout", () => {
    const f = phase3Fixture(),
      lease = f.sessions.begin(nearbyPurpose);
    expect(() => new SecureRangingSession(peerContract(), f.sessions, lease, () => false)).toThrow("UNAUTHENTICATED");
    expect(() => new SecureRangingSession(peerContract({ surfaceId: "wrong" }), f.sessions, lease, () => true)).toThrow(
      "BINDING",
    );
    const s = new SecureRangingSession(peerContract(), f.sessions, lease, () => true);
    expect(() => new SecureRangingSession(peerContract(), f.sessions, lease, () => true)).toThrow("BINDING");
    const o = {
      peerSessionId: peerContract().peerSessionId,
      sequence: 0,
      generation: lease.generation,
      timestampMonotonic: 0,
      distanceMeters: 1,
      uncertaintyMeters: 0.2,
      technologyClass: "UWB",
      referenceFrame: "LOCAL_ARBITRARY",
      lifecycle: "FOREGROUND_ONLY",
      securityMode: "PLATFORM_SECURE_RANGING",
    };
    expect(s.accept(o)).toMatchObject({ presenceProof: false, globalPosition: false });
    expect(() => s.accept(o)).toThrow("REPLAY_OR_DROPOUT");
    expect(f.sessions.diagnostics().activeSessions).toBe(0);
  });
  it.each([
    { distanceMeters: NaN },
    { uncertaintyMeters: -1 },
    { generation: 99 },
    { securityMode: "STATIC" },
    { peerSessionId: "other-session" },
  ])("rejects malformed/spoofed range %j", (changes) => {
    const f = phase3Fixture(),
      lease = f.sessions.begin(nearbyPurpose),
      s = new SecureRangingSession(peerContract(), f.sessions, lease, () => true);
    expect(() =>
      s.accept({
        peerSessionId: peerContract().peerSessionId,
        sequence: 0,
        generation: lease.generation,
        timestampMonotonic: 0,
        distanceMeters: 1,
        uncertaintyMeters: 0.2,
        technologyClass: "UWB",
        referenceFrame: "LOCAL_ARBITRARY",
        lifecycle: "FOREGROUND_ONLY",
        securityMode: "PLATFORM_SECURE_RANGING",
        ...changes,
      }),
    ).toThrow();
    lease.release();
  });
  it("handles BLE denial, unsupported APIs, service allowlist and disconnect cleanup", async () => {
    const f = phase3Fixture();
    expect((await new WebBleCapability(null, true, f.sessions).connect(nearbyPurpose, blePolicy)).state).toBe(
      "FALLBACK",
    );
    const denied = new WebBleCapability(
      {
        requestDevice: async () => {
          throw new Error("private device name");
        },
      },
      true,
      f.sessions,
    );
    expect(await denied.connect(nearbyPurpose, blePolicy)).toMatchObject({
      state: "FALLBACK",
      reason: "PERMISSION_DENIED_OR_ACCESSORY_DISCONNECTED",
    });
    f.setTime(1000);
    const result = await new WebBleCapability(f.bluetooth, true, f.sessions).connect(nearbyPurpose, blePolicy);
    expect(result.state).toBe("CONNECTED");
    if (result.state !== "CONNECTED") throw Error("connect");
    await expect(result.characteristic("00000000-0000-0000-0000-000000000000", blePolicy.services[0])).rejects.toThrow(
      "FORBIDDEN",
    );
    const c = await result.characteristic(blePolicy.services[0], blePolicy.services[0]);
    expect(await c.read()).toEqual(new Uint8Array([1, 2]));
    await expect(c.write(new Uint8Array([1]))).rejects.toThrow("FORBIDDEN");
    f.disconnect();
    expect(f.sessions.diagnostics().activeSessions).toBe(0);
    expect(f.stats().deviceListeners).toBe(0);
    await expect(c.read()).rejects.toThrow("EXPIRED");
  });
  it("stops a BLE device arriving after foreground loss, without auto reconnect", async () => {
    const f = phase3Fixture();
    let resolve!: (v: typeof f.device) => void;
    const pending = new WebBleCapability(
      {
        requestDevice: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
      true,
      f.sessions,
    ).connect(nearbyPurpose, blePolicy);
    f.sessions.setForeground(false);
    resolve(f.device);
    expect((await pending).state).toBe("FALLBACK");
    expect(f.stats().disconnected).toBe(1);
    f.sessions.dispose();
  });
  it.each(["text", "url"])("NFC %s goes through strict consumer parsing with no identifiers retained", async (type) => {
    const f = phase3Fixture(),
      payload = vi.fn(),
      fallback = vi.fn();
    await new WebNfcCapability(() => f.reader, true, f.sessions, "lab-nfc-v1").read(
      nearbyPurpose,
      ndefEnvelopeSchema,
      payload,
      fallback,
    );
    f.nfc(type);
    if (type === "text") {
      expect(payload).toHaveBeenCalledTimes(1);
      expect(payload.mock.calls[0][1]).toEqual({ syntheticFlag: true, simulationIdentity: "lab-nfc-v1" });
      expect(JSON.stringify(payload.mock.calls)).not.toContain("PRIVATE_FIXTURE_ID");
    } else {
      expect(payload).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledWith("NFC_PAYLOAD_REJECTED");
    }
    expect(f.stats().radioListeners).toBe(0);
    expect(f.stats().aborted).toBe(true);
    expect(f.sessions.diagnostics().activeSessions).toBe(0);
  });
  it("rejects scripted production NFC events and consumer-schema mismatch", async () => {
    const f = phase3Fixture(),
      payload = vi.fn();
    const lease = await new WebNfcCapability(() => f.reader, true, f.sessions).read(
      nearbyPurpose,
      ndefEnvelopeSchema,
      payload,
      () => {},
    );
    f.nfc();
    expect(payload).not.toHaveBeenCalled();
    lease.release();
    f.setTime(1000);
    const fallback = vi.fn();
    await new WebNfcCapability(() => f.reader, true, f.sessions, "lab").read(
      nearbyPurpose,
      z.never(),
      payload,
      fallback,
    );
    f.nfc();
    expect(fallback).toHaveBeenCalledWith("NFC_PAYLOAD_REJECTED");
  });
  it("rejects oversized NDEF, cannot serialize raw nearby data into diagnostics", async () => {
    const f = phase3Fixture(),
      payload = vi.fn(),
      fallback = vi.fn();
    await new WebNfcCapability(() => f.reader, true, f.sessions, "lab").read(
      nearbyPurpose,
      ndefEnvelopeSchema,
      payload,
      fallback,
    );
    f.nfc("text", new Uint8Array(2049));
    expect(payload).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
    expect(JSON.stringify(f.sessions.diagnostics())).not.toMatch(/nonce|peer|serial|data|purpose/i);
  });
});
describe("Creator/Drydock schemas and outcome fallback", () => {
  it("preserves preferred web content and simulates every fallback without progression", () => {
    expect(sextantAuthoringSchema.parse(requirementFixture).requirements).toHaveLength(1);
    for (const outcome of ["UNAVAILABLE", "DENIED", "DEGRADED", "ACCESSIBLE_ALTERNATIVE"] as const)
      expect(simulateSextantRequirement(requirementFixture, "sextant.magnetic.context", outcome)).toMatchObject({
        state: "FALLBACK",
        canonicalProgression: false,
        physicalQualified: false,
        fallbacks: [{ id: "screen.clue", text: "Read the clue on screen" }],
      });
  });
  it.each([
    { rawMedia: "forbidden" },
    { requirements: [{ ...requirementFixture.requirements[0], capabilityId: "navigator.bluetooth" }] },
    { requirements: [{ ...requirementFixture.requirements[0], importance: "REQUIRED_RESTRICTED" }] },
    { fallbacks: [] },
    { requirements: [{ ...requirementFixture.requirements[0], userPurposeCopy: "" }] },
    {
      requirements: [
        { ...requirementFixture.requirements[0], minimumQuality: "LOW", evidenceUse: "CONSUMER_REQUALIFIED" },
      ],
    },
  ])("rejects unsafe/incompatible authored contracts %j", (change) =>
    expect(sextantAuthoringSchema.safeParse({ ...requirementFixture, ...change }).success).toBe(false),
  );
});

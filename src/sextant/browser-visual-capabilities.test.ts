// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import {
  browserVisualCapabilities,
  browserVisualCapabilityPolicy,
  type BrowserCameraCapabilitySnapshot,
  type AuthorizedVideoTrack,
} from "./browser-visual-capabilities";
const broker = (): BrowserCameraCapabilitySnapshot => ({
  supported: true,
  permission: "GRANTED",
  availability: "READY",
  generation: 3,
  leaseId: "ephemeral-current-lease",
});
const context = () => ({
  providerId: "sextant.browser-video",
  providerVersion: "1",
  ephemeralSourceId: "ephemeral-source",
  ephemeralGroupId: null,
  leaseId: "ephemeral-current-lease" as string | null,
  leaseGeneration: 3,
});
const track = () => ({
  kind: "video",
  readyState: "live",
  getCapabilities: vi.fn(() => ({ width: { min: 1, max: 1920 }, exposureMode: ["continuous"], torch: true })),
  getSettings: vi.fn(() => ({
    width: 1280,
    height: 720,
    frameRate: 29.97,
    deviceId: "must-not-escape",
    groupId: "must-not-escape",
  })),
});
describe("read-only already-authorized browser visual capabilities", () => {
  it("recognizes a declared compensation range without requiring exposure-mode metadata", () => {
    const t: AuthorizedVideoTrack = {
      kind: "video",
      readyState: "live",
      getCapabilities: () => ({ exposureCompensation: { min: -3, max: 3, step: 0.5 } }),
      getSettings: () => ({ width: 913, height: 517 }),
    };
    expect(browserVisualCapabilities(broker(), t, context()).descriptor.controls.exposure).toBe("SUPPORTED");
    const malformed = { ...t, getCapabilities: () => ({ exposureCompensation: { min: NaN, max: 3 } }) };
    expect(browserVisualCapabilities(broker(), malformed, context()).descriptor.controls.exposure).toBe("UNKNOWN");
  });
  it("reads actual negotiated regular-camera settings while making no infrared or LED claim", () => {
    const t = track(),
      r = browserVisualCapabilities(broker(), t, context());
    expect(r.negotiated.width).toBe(1280);
    expect(r.negotiated.height).toBe(720);
    expect(r.negotiated.frameRate).toBe(29.97);
    expect(r.descriptor.modality).toBe("COLOR");
    expect(r.descriptor.controls.exposure).toBe("SUPPORTED");
    expect(r.descriptor.controls.directInfraredLed).toBe("UNKNOWN");
    expect(r.descriptor.controls.driverManagedIllumination).toBe("UNKNOWN");
    expect(r.descriptor.consumerQualifiedProfile).toBeUndefined();
    expect(r.descriptor.ephemeralGroupId).toBeNull();
    expect(r.descriptor.access).toBe("AVAILABLE");
    expect(r.descriptor.streaming).toBe("STREAMING");
    expect(JSON.stringify(r)).not.toContain("must-not-escape");
    expect(t.getCapabilities).toHaveBeenCalledTimes(1);
    expect(t.getSettings).toHaveBeenCalledTimes(1);
  });
  it.each(["PERMISSION_DENIED", "CAMERA_BUSY", "SUSPENDED", "DISABLED", "REQUESTING", "UNSUPPORTED"] as const)(
    "preserves %s and does not query or open a supplied track",
    (availability) => {
      const b = broker();
      b.availability = availability;
      if (availability === "PERMISSION_DENIED") b.permission = "DENIED";
      const t = track(),
        r = browserVisualCapabilities(b, t, context());
      expect(t.getCapabilities).not.toHaveBeenCalled();
      expect(t.getSettings).not.toHaveBeenCalled();
      expect(r.descriptor.streaming).not.toBe("STREAMING");
      expect(r.negotiated.width).toBeNull();
      if (availability === "CAMERA_BUSY") expect(r.descriptor.access).toBe("BUSY");
      if (availability === "PERMISSION_DENIED") expect(r.descriptor.permission).toBe("DENIED");
    },
  );
  it.each(["leaseId", "leaseGeneration"] as const)("rejects stale context %s before any track query", (key) => {
    const c = context();
    if (key === "leaseId") c.leaseId = "old-lease";
    else c.leaseGeneration--;
    const t = track(),
      r = browserVisualCapabilities(broker(), t, c);
    expect(r.currentAuthorizedLease).toBe(false);
    expect(r.descriptor.access).toBe("UNAVAILABLE");
    expect(t.getCapabilities).not.toHaveBeenCalled();
    expect(t.getSettings).not.toHaveBeenCalled();
  });
  it("never reads ended/non-video tracks or infers a modality from a device label", () => {
    const t = track();
    Object.defineProperty(t, "label", {
      get() {
        throw Error("labels forbidden");
      },
    });
    const r = browserVisualCapabilities(broker(), t, context());
    expect(r.descriptor.modality).toBe("COLOR");
    t.readyState = "ended";
    t.getSettings.mockClear();
    t.getCapabilities.mockClear();
    expect(browserVisualCapabilities(broker(), t, context()).descriptor.streaming).toBe("STOPPED");
    expect(t.getSettings).not.toHaveBeenCalled();
    expect(t.getCapabilities).not.toHaveBeenCalled();
    expect(
      browserVisualCapabilities(broker(), { ...t, readyState: "live", kind: "audio" }, context()).descriptor.detected,
    ).toBe("UNKNOWN");
  });
  it("keeps unsupported or missing capability-query metadata UNKNOWN and independent from stream availability", () => {
    const t: AuthorizedVideoTrack = {
      kind: "video",
      readyState: "live",
      getCapabilities: () => {
        throw Error("not exposed");
      },
      getSettings: () => ({ width: 853, height: 481, frameRate: 17 }),
    };
    const r = browserVisualCapabilities(broker(), t, context());
    expect(r.descriptor.access).toBe("AVAILABLE");
    expect(r.descriptor.controls.exposure).toBe("UNKNOWN");
    expect(r.capabilitiesAvailable).toBe(false);
    expect(r.negotiated.width).toBe(853);
    const missing = browserVisualCapabilities(broker(), { kind: "video", readyState: "live" }, context());
    expect(missing.settingsAvailable).toBe(false);
    expect(missing.negotiated.width).toBeNull();
  });
  it("accepts only bounded actual dimensions/rates and never forwards an unknown settings object", () => {
    const r = browserVisualCapabilities(
      broker(),
      {
        kind: "video",
        readyState: "live",
        getSettings: () => ({ width: Infinity, height: 100000, frameRate: -1 }),
        getCapabilities: () => ({ exposureMode: [] }),
      },
      context(),
    );
    expect(r.negotiated.width).toBeNull();
    expect(r.negotiated.height).toBeNull();
    expect(r.negotiated.frameRate).toBeNull();
    expect(r.descriptor.controls.exposure).toBe("UNSUPPORTED");
  });
  it("does not interpret API support alone as detected or accessible hardware", () => {
    const b = broker();
    b.permission = "UNKNOWN";
    b.availability = "DISABLED";
    b.leaseId = null;
    const c = context();
    c.leaseId = null;
    const r = browserVisualCapabilities(b, null, c);
    expect(r.descriptor.detected).toBe("UNKNOWN");
    expect(r.descriptor.permission).toBe("UNKNOWN");
    expect(r.descriptor.access).toBe("UNAVAILABLE");
    expect(r.descriptor.controls.directInfraredLed).toBe("UNKNOWN");
  });
  it("supports explicit bounded consumer policy without a fixed camera resolution or cadence", () => {
    const r = browserVisualCapabilities(broker(), track(), context(), {
      ...browserVisualCapabilityPolicy,
      maximumDimension: 1000,
      maximumDeclaredFrameRate: 20,
    });
    expect(r.negotiated.width).toBeNull();
    expect(r.negotiated.height).toBe(720);
    expect(r.negotiated.frameRate).toBeNull();
    expect(() =>
      browserVisualCapabilities(broker(), track(), context(), {
        ...browserVisualCapabilityPolicy,
        maximumDimension: 0,
      }),
    ).toThrow();
  });
  it("does not query unsupported broker state and does not treat unknown exposure tokens as proven control support", () => {
    const b = broker();
    b.supported = false;
    const t = track();
    expect(browserVisualCapabilities(b, t, context()).descriptor.access).toBe("UNSUPPORTED");
    expect(t.getCapabilities).not.toHaveBeenCalled();
    const unknown = browserVisualCapabilities(
      broker(),
      { kind: "video", readyState: "live", getCapabilities: () => ({ exposureMode: ["unrecognized-mode"] }) },
      context(),
    );
    expect(unknown.descriptor.controls.exposure).toBe("UNKNOWN");
  });
});

/** Synthetic fixture helpers. These imports are explicit and never automatic production registration. */
import type { Observation } from "./contracts";
import type { NfcReader, BleDevice, WebBluetooth, SecurePeer } from "./nearby";
import { NearbySessions } from "./nearby";
import { SextantMediaCapabilities, type MediaResource } from "./media-capability";
export function fieldObservation(
  id: string,
  value: unknown,
  at: number,
  changes: Partial<Observation> = {},
): Observation {
  return {
    observationId: `fixture-${at}`,
    capabilityId: id,
    semanticVersion: 1,
    value,
    units: id.includes("pressure") ? "hPa" : "microtesla",
    referenceFrame: id.includes("pressure") ? "NONE" : "DEVICE",
    timestampMonotonic: at,
    ageMs: 0,
    sequence: Math.floor(at / 100),
    discontinuity: false,
    sourceClass: "SIMULATED",
    providerIdDiagnostic: "synthetic.field-v1",
    confidence: 0.8,
    calibrationState: "GOOD",
    qualityClass: "MEDIUM",
    provenanceRoot: "synthetic.field-v1@1",
    syntheticFlag: true,
    simulationIdentity: "sextant-phase3-v1",
    lifecycleState: "FOREGROUND_ONLY",
    warnings: [],
    ...changes,
  };
}
export const magneticObservation = (magnitude: number, at: number, changes: Partial<Observation> = {}) =>
  fieldObservation("sextant.magnetic.field", { x: magnitude, y: 0, z: 0 }, at, changes);
export const pressureObservation = (pressure: number, at: number, changes: Partial<Observation> = {}) =>
  fieldObservation("sextant.pressure.observation", pressure, at, changes);
export const nearbyPurpose = {
  consumerId: "lab",
  surfaceId: "lab-surface",
  purpose: "Read the field reference fixture",
  consent: true,
  userInitiated: true,
  expiresAt: 10000,
};
export const mediaPurpose = { ...nearbyPurpose, visible: true as const };
export function peerContract(changes: Partial<SecurePeer> = {}): SecurePeer {
  return {
    version: 1,
    peerSessionId: "peer-fixture-session",
    owner: "CROSSDECK",
    consumerId: nearbyPurpose.consumerId,
    surfaceId: nearbyPurpose.surfaceId,
    purpose: nearbyPurpose.purpose,
    nonce: "nonce-fixture-test",
    expiresAt: 9000,
    outOfBand: "AUTHENTICATED_NETWORK",
    securityMode: "PLATFORM_SECURE_RANGING",
    ...changes,
  };
}
export function phase3Fixture() {
  let clock = 0,
    stops = 0,
    disconnected = 0,
    aborted = false;
  const sessions = new NearbySessions(() => clock);
  const media = new SextantMediaCapabilities(
    { secureContext: true, camera: true, microphone: true, captureConstraints: ["width", "height", "facingMode"] },
    () => clock,
  );
  const resourceEvents = new Set<() => void>();
  const resource: MediaResource = {
    stop: () => {
      stops++;
    },
    onEnded: (fn) => {
      resourceEvents.add(fn);
      return () => resourceEvents.delete(fn);
    },
  };
  const radioListeners = new Map<string, Set<EventListener>>();
  const reader: NfcReader = {
    scan: async ({ signal }) => {
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
        },
        { once: true },
      );
    },
    addEventListener: (type, fn) => {
      if (!radioListeners.has(type)) radioListeners.set(type, new Set());
      radioListeners.get(type)!.add(fn);
    },
    removeEventListener: (type, fn) => {
      radioListeners.get(type)?.delete(fn);
    },
  };
  const deviceEvents = new Map<string, Set<EventListener>>();
  const device: BleDevice = {
    gatt: {
      connected: false,
      connect: async () => {
        device.gatt!.connected = true;
        return {
          getPrimaryService: async () => ({
            getCharacteristic: async () => ({
              readValue: async () => new DataView(new Uint8Array([1, 2]).buffer),
              writeValue: async () => {},
            }),
          }),
        };
      },
      disconnect: () => {
        disconnected++;
        device.gatt!.connected = false;
      },
    },
    addEventListener: (type, fn) => {
      if (!deviceEvents.has(type)) deviceEvents.set(type, new Set());
      deviceEvents.get(type)!.add(fn);
    },
    removeEventListener: (type, fn) => {
      deviceEvents.get(type)?.delete(fn);
    },
  };
  const bluetooth: WebBluetooth = { requestDevice: async () => device };
  return {
    sessions,
    media,
    resource,
    reader,
    device,
    bluetooth,
    now: () => clock,
    setTime: (value: number) => {
      clock = value;
    },
    trackEnd: () => {
      for (const fn of [...resourceEvents]) fn();
    },
    disconnect: () => {
      for (const fn of [...(deviceEvents.get("gattserverdisconnected") ?? [])]) fn(new Event("gattserverdisconnected"));
    },
    nfc: (recordType = "text", data = new Uint8Array([65])) => {
      const event = new Event("reading");
      Object.assign(event, {
        serialNumber: "PRIVATE_FIXTURE_ID",
        message: { records: [{ recordType, data: new DataView(data.buffer, data.byteOffset, data.byteLength) }] },
      });
      for (const fn of [...(radioListeners.get("reading") ?? [])]) fn(event);
    },
    stats: () => ({
      stops,
      disconnected,
      aborted,
      trackListeners: resourceEvents.size,
      radioListeners: [...radioListeners.values()].reduce((n, s) => n + s.size, 0),
      deviceListeners: [...deviceEvents.values()].reduce((n, s) => n + s.size, 0),
    }),
  };
}
export const blePolicy = {
  services: ["12345678-1234-1234-1234-123456789abc"],
  applicationSecurity: "PUBLIC_DATA_ONLY",
  fallback: "Use the screen clue",
};
export const requirementFixture = {
  version: 1,
  requirements: [
    {
      capabilityId: "sextant.magnetic.context",
      semanticVersionRange: { minimum: 1, maximum: 1 },
      importance: "PREFERRED",
      minimumQuality: "MEDIUM",
      fallbackIds: ["screen.clue"],
      accessibilityAlternative: "Read the screen clue",
      userPurposeCopy: "Find the weak enclosed magnetic prop",
      foregroundOnly: true,
      drydockScenarioRequirements: ["UNAVAILABLE", "DENIED", "DEGRADED", "ACCESSIBLE_ALTERNATIVE"],
      evidenceUse: "LOCAL_GUIDANCE",
    },
  ],
  fallbacks: [{ id: "screen.clue", text: "Read the clue on screen" }],
  audience: "GENERAL",
  prePlayDisclosure: "",
  targetProfile: "WEB_BASELINE",
};

import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { landfallFixture } from "./fixtures";
import { NativeLandfallNearbyInteractionProvider } from "./native-nearby-interaction";

let provider: NativeLandfallNearbyInteractionProvider;
let operations: string[];
let now: number;
const ready = { state: "READY", discoveryToken: "AQI=" };
const configuration = () => ({ peerId: "peer-1", discoveryToken: "AwQ=", expiresAt: now + 30000 });
const emit = (detail: unknown) => window.dispatchEvent(new CustomEvent("landfall-native-event", { detail }));
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  operations = [];
  now = 100000;
  window.LandfallNative = {
    version: 1,
    platform: "IOS",
    request: async (raw) => {
      const message = JSON.parse(raw);
      operations.push(message.operation);
      return message.operation === "NI_PREPARE" ? ready : { state: "INITIALIZING", accepted: true };
    },
  };
  provider = new NativeLandfallNearbyInteractionProvider(landfallFixture.worldspaces[0], () => now);
});
afterEach(async () => {
  await provider.stop();
  delete window.LandfallNative;
  vi.unstubAllGlobals();
});
it("requires a physical world, explicit action and an Apple companion", async () => {
  expect(() => new NativeLandfallNearbyInteractionProvider(landfallFixture.worldspaces[1])).toThrow(
    "PHYSICAL_WORLDSPACE",
  );
  await expect(provider.prepare(false)).rejects.toThrow("CONSENT_REQUIRED");
  expect(operations).toEqual([]);
  window.LandfallNative!.platform = "ANDROID";
  expect(await provider.prepare(true)).toBeNull();
  expect(provider.snapshot().state).toBe("UNSUPPORTED");
  expect(operations).toEqual([]);
});
it("keeps real native range reports as untrusted hints without exposing tokens or distance", async () => {
  expect(await provider.prepare(true)).toEqual(ready);
  const listener = vi.fn();
  await provider.start(configuration(), listener);
  const range = {
    type: "nearby",
    family: "UWB",
    platform: "IOS",
    id: "range-1",
    peerId: "peer-1",
    observedAt: now,
    distanceMeters: 0.2,
    uncertaintyMeters: null,
    authenticated: false,
    sessionProtected: false,
  };
  emit({ ...range, authenticated: true });
  emit({ ...range, peerId: "other" });
  emit({ ...range, observedAt: now - 10001 });
  expect(provider.snapshot().rangeAvailable).toBe(false);
  emit(range);
  expect(provider.snapshot()).toEqual({
    state: "UNTRUSTED",
    rangeAvailable: true,
    uncertainty: "UNKNOWN",
    peerVerified: false,
    canComplete: false,
  });
  const count = listener.mock.calls.length;
  emit(range);
  expect(listener).toHaveBeenCalledTimes(count);
  expect(JSON.stringify(listener.mock.calls)).not.toMatch(/distanceMeters|discoveryToken|peer-1|0\.2/);
  now += 10001;
  expect(provider.snapshot().rangeAvailable).toBe(false);
});
it("rejects expired pairing and archive payloads before native start", async () => {
  await provider.prepare(true);
  for (const invalid of [
    { ...configuration(), expiresAt: now },
    { ...configuration(), expiresAt: now + 300001 },
    { ...configuration(), discoveryToken: "AwQ=\n" },
    { ...configuration(), authenticated: true },
  ])
    await expect(provider.start(invalid, vi.fn())).rejects.toThrow();
  expect(operations).not.toContain("NI_START");
  now += 60000;
  expect(provider.snapshot().state).toBe("EXPIRED");
  await expect(provider.start(configuration(), vi.fn())).rejects.toThrow("NOT_PREPARED");
});
it("clears preparation on background and ignores delayed range reports", async () => {
  await provider.prepare(true);
  emit({ type: "lifecycle", state: "BACKGROUND" });
  await Promise.resolve();
  expect(operations.at(-1)).toBe("NI_STOP");
  await expect(provider.start(configuration(), vi.fn())).rejects.toThrow("NOT_PREPARED");
  expect(provider.snapshot().rangeAvailable).toBe(false);
});
it("does not let an old native expiry overwrite a newer preparation", async () => {
  await provider.prepare(true);
  await provider.start(configuration(), vi.fn());
  let release!: () => void;
  window.LandfallNative!.request = async (raw) =>
    JSON.parse(raw).operation === "NI_STOP"
      ? new Promise((resolve) => {
          release = () => resolve({ accepted: true });
        })
      : ready;
  emit({ type: "nearby-state", family: "UWB", platform: "IOS", state: "EXPIRED" });
  window.LandfallNative!.request = async (raw) =>
    JSON.parse(raw).operation === "NI_PREPARE" ? ready : { accepted: true };
  await provider.prepare(true);
  release();
  await Promise.resolve();
  await Promise.resolve();
  expect(provider.snapshot().state).toBe("READY");
});

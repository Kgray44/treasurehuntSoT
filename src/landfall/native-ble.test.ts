import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeLandfallBleProvider } from "./native-ble";
import { landfallFixture } from "./fixtures";
let calls: { operation: string; payload: Record<string, unknown> }[], provider: NativeLandfallBleProvider;
const emit = (detail: unknown) => window.dispatchEvent(new CustomEvent("landfall-native-event", { detail }));
const sample = (scanId: unknown, fields: Record<string, unknown> = {}) => ({
  type: "nearby",
  family: "BLE",
  protocol: "GENERIC",
  scanId,
  peerId: "a".repeat(64),
  observedAt: Date.now(),
  rssi: -50,
  authenticated: false,
  ...fields,
});
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  calls = [];
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      calls.push(value);
      return value.operation === "BLE_START" ? { state: "GRANTED" } : { accepted: true };
    }),
  };
  provider = new NativeLandfallBleProvider(landfallFixture.worldspaces[0], () => Date.now());
});
afterEach(async () => {
  await provider.stop();
  delete window.LandfallNative;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("native bounded unverified Bluetooth discovery", () => {
  it("has no automatic permission/radio request, requires deliberate physical acquisition", async () => {
    expect(calls).toEqual([]);
    await expect(provider.start(false, vi.fn())).rejects.toThrow("CONSENT_REQUIRED");
    expect(calls).toEqual([]);
    expect(() => new NativeLandfallBleProvider({ ...landfallFixture.worldspaces[0], kind: "VIRTUAL" })).toThrow(
      "PHYSICAL",
    );
    delete window.LandfallNative;
    expect(await provider.start(true, vi.fn())).toBe("UNAVAILABLE");
  });
  it("binds samples to this scan, rejects identity claims/raw fields and keeps RSSI untrusted", async () => {
    const update = vi.fn();
    await provider.start(true, update);
    const scanId = calls.find((value) => value.operation === "BLE_START")!.payload.scanId;
    for (const invalid of [
      sample(crypto.randomUUID()),
      sample(scanId, { authenticated: true }),
      sample(scanId, { address: "raw" }),
      sample(scanId, { observedAt: Date.now() - 6000 }),
      sample(scanId, { rssi: 127 }),
    ])
      emit(invalid);
    expect(update).toHaveBeenCalledOnce();
    emit(sample(scanId));
    expect(update.mock.lastCall![0]).toEqual({
      state: "UNTRUSTED",
      unverifiedPeers: 1,
      band: "STRONG_SIGNAL",
      protocols: ["GENERIC"],
      peerVerified: false,
      physicalPresence: "NOT_PROVEN",
      canComplete: false,
    });
    expect(JSON.stringify(provider.snapshot())).not.toContain("a".repeat(64));
    await provider.stop();
    emit(sample(scanId));
    expect(update).toHaveBeenCalledTimes(2);
    expect(calls.find((value) => value.operation === "BLE_STOP")!.payload).toEqual({ scanId });
  });
  it("expires signals, bounds peers, and releases acquisition at the native-independent 30-second deadline", async () => {
    vi.useFakeTimers();
    const update = vi.fn();
    await provider.start(true, update);
    const scanId = calls.find((value) => value.operation === "BLE_START")!.payload.scanId;
    for (let index = 0; index < 40; index++) emit(sample(scanId, { peerId: index.toString(16).padStart(64, "0") }));
    expect(provider.snapshot().unverifiedPeers).toBe(32);
    await vi.advanceTimersByTimeAsync(6000);
    expect(update.mock.lastCall![0].state).toBe("STALE");
    await vi.advanceTimersByTimeAsync(24000);
    expect(update.mock.lastCall![0].state).toBe("EXPIRED");
    expect(provider.snapshot().unverifiedPeers).toBe(0);
    expect(calls.filter((value) => value.operation === "BLE_STOP")).toHaveLength(1);
  });
  it("stops for background and power without adopting late start replies or automatically resuming", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    window.LandfallNative!.request = vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      calls.push(value);
      return value.operation === "BLE_START"
        ? new Promise((done) => {
            resolve = done;
          })
        : { accepted: true };
    });
    const update = vi.fn(),
      start = provider.start(true, update);
    await vi.waitFor(() => expect(calls.some((value) => value.operation === "BLE_START")).toBe(true));
    emit({ type: "lifecycle", state: "BACKGROUND" });
    resolve({ state: "GRANTED" });
    expect(await start).toBe("UNAVAILABLE");
    expect(update.mock.lastCall![0].state).toBe("STOPPED");
    emit({ type: "lifecycle", state: "FOREGROUND" });
    expect(calls.filter((value) => value.operation === "BLE_START")).toHaveLength(1);
    window.LandfallNative!.request = vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      calls.push(value);
      return { state: "GRANTED", accepted: true };
    });
    await provider.start(true, update);
    emit({
      type: "power",
      power: { state: "READY", lowPower: true, thermalPressure: false, critical: false, observedAt: Date.now() },
    });
    expect(update.mock.lastCall![0].state).toBe("STOPPED");
  });
});

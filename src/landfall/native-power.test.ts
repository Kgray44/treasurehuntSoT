import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readNativeLandfallPower, subscribeNativeLandfallPower } from "./native-bridge";
const frame = () => ({
  state: "READY",
  lowPower: false,
  thermalPressure: false,
  critical: false,
  observedAt: Date.now(),
});
describe("OS power state bridge", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => {
    delete window.LandfallNative;
  });
  it("reads a categorical native snapshot and never interprets unconfigured hosts as healthy", async () => {
    expect(await readNativeLandfallPower()).toBeNull();
    const value = frame();
    window.LandfallNative = {
      platform: "ANDROID",
      version: 1,
      request: async (text) => {
        expect(JSON.parse(text).operation).toBe("POWER_STATE");
        return value;
      },
    };
    expect(await readNativeLandfallPower()).toEqual(value);
  });
  it("rejects stale, future, malformed and inconsistent thermal frames", async () => {
    for (const value of [
      { ...frame(), observedAt: Date.now() - 31000 },
      { ...frame(), observedAt: Date.now() + 2000 },
      { ...frame(), lowPower: "true" },
      { ...frame(), critical: true },
      { ...frame(), rawDeviceIdentifier: "foreign" },
    ]) {
      window.LandfallNative = { platform: "IOS", version: 1, request: async () => value };
      expect(await readNativeLandfallPower()).toBeNull();
    }
  });
  it("delivers fresh power changes and removes its listener on disposal", () => {
    const listener = vi.fn();
    const dispose = subscribeNativeLandfallPower(listener);
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", { detail: { type: "power", power: { ...frame(), lowPower: true } } }),
    );
    expect(listener).toHaveBeenCalledOnce();
    dispose();
    window.dispatchEvent(new CustomEvent("landfall-native-event", { detail: { type: "power", power: frame() } }));
    expect(listener).toHaveBeenCalledOnce();
  });
});

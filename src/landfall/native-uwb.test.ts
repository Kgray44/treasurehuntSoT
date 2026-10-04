import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeLandfallUwbProvider } from "./native-uwb";
import { landfallFixture } from "./fixtures";

let provider: NativeLandfallUwbProvider | undefined;
let operations: string[];
let now: number;
const ready = {
  state: "READY",
  role: "CONTROLLER",
  address: "AQI=",
  security: "PROVISIONED_STS",
  channel: 9,
  preamble: 10,
};
const config = () => ({
  peerId: "peer-1",
  sessionId: 1,
  security: "PROVISIONED_STS" as const,
  sessionKey: "AAAAAAAAAAAAAAAAAAAAAA==",
  peerAddress: "AwQ=",
  channel: 9 as const,
  preamble: 10,
  expiresAt: now + 30000,
});
const send = (value: unknown) => window.dispatchEvent(new CustomEvent("landfall-native-event", { detail: value }));
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  operations = [];
  now = 100000;
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: async (raw) => {
      const message = JSON.parse(raw);
      operations.push(message.operation);
      return message.operation === "UWB_PREPARE" ? ready : { state: "INITIALIZING", accepted: true };
    },
  };
  provider = new NativeLandfallUwbProvider(landfallFixture.worldspaces[0], () => now);
});
afterEach(async () => {
  await provider?.stop();
  delete window.LandfallNative;
  vi.unstubAllGlobals();
});
describe("native UWB software path", () => {
  it("does not touch a radio for a virtual world or without a deliberate action", async () => {
    expect(() => new NativeLandfallUwbProvider(landfallFixture.worldspaces[1])).toThrow("PHYSICAL_WORLDSPACE");
    await expect(provider!.prepare("CONTROLLER", false)).rejects.toThrow("CONSENT_REQUIRED");
    expect(operations).toEqual([]);
  });
  it("keeps protected ranges untrusted and discards forged, wrong-peer, stale and duplicate reports", async () => {
    const updates = vi.fn();
    expect(await provider!.prepare("CONTROLLER", true)).toEqual(ready);
    await provider!.start(config(), updates);
    const range = {
      type: "nearby",
      family: "UWB",
      id: "range-1",
      peerId: "peer-1",
      observedAt: now,
      distanceMeters: 0.1,
      uncertaintyMeters: null,
      authenticated: false,
      sessionProtected: true,
    };
    send({ ...range, authenticated: true });
    send({ ...range, peerId: "unknown" });
    send({ ...range, observedAt: now - 10001 });
    expect(provider!.snapshot().rangeAvailable).toBe(false);
    send(range);
    expect(provider!.snapshot()).toEqual({
      state: "UNTRUSTED",
      rangeAvailable: true,
      uncertainty: "UNKNOWN",
      peerVerified: false,
      canComplete: false,
    });
    const count = updates.mock.calls.length;
    send(range);
    expect(updates).toHaveBeenCalledTimes(count);
    now += 10001;
    expect(provider!.snapshot().rangeAvailable).toBe(false);
    expect(JSON.stringify(updates.mock.calls)).not.toMatch(/distanceMeters|sessionKey|peer-1|address/);
  });
  it("rejects expired, overlong or insecure pairings before invoking start", async () => {
    await provider!.prepare("CONTROLLER", true);
    await expect(provider!.start({ ...config(), expiresAt: now }, vi.fn())).rejects.toThrow("PAIRING_EXPIRED");
    await expect(provider!.start({ ...config(), expiresAt: now + 300001 }, vi.fn())).rejects.toThrow("PAIRING_EXPIRED");
    await expect(provider!.start({ ...config(), sessionKey: "short" }, vi.fn())).rejects.toThrow();
    expect(operations).not.toContain("UWB_START");
  });
  it("stops on background and ignores reports after disposal", async () => {
    await provider!.prepare("CONTROLLER", true);
    await provider!.start(config(), vi.fn());
    send({ type: "lifecycle", state: "BACKGROUND" });
    await Promise.resolve();
    expect(operations.at(-1)).toBe("UWB_STOP");
    expect(provider!.snapshot().rangeAvailable).toBe(false);
  });
  it("keeps absent platform support truthful", async () => {
    window.LandfallNative!.request = async () => ({ state: "UNSUPPORTED" });
    expect(await provider!.prepare("CONTROLLER", true)).toBeNull();
    expect(provider!.snapshot().state).toBe("UNSUPPORTED");
  });
});

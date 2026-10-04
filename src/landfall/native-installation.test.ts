import { generateKeyPairSync, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeLandfallInstallationProvider } from "./native-installation";
import { LandfallInstallationSigner } from "./installation-token-server";
const pair = generateKeyPairSync("ed25519"),
  now = 1000000;
const scope = { taleId: "fixture", publishedVersionId: "lab-pin", worldspaceId: "town", waypointId: "town-arrival" };
const signer = new LandfallInstallationSigner(
  { keyId: "lab-key", privateKey: pair.privateKey, publicKey: pair.publicKey },
  () => now,
);
let calls: { operation: string; payload: Record<string, unknown> }[], provider: NativeLandfallInstallationProvider;
const emit = (detail: unknown) => window.dispatchEvent(new CustomEvent("landfall-native-event", { detail }));
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  calls = [];
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: vi.fn(async (raw: string) => {
      const value = JSON.parse(raw);
      calls.push(value);
      return value.operation === "INTERACTION_STOP" ? { accepted: true } : { state: "GRANTED" };
    }),
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    pair.publicKey.export({ format: "jwk" }) as JsonWebKey,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  provider = new NativeLandfallInstallationProvider({
    scope,
    installations: [{ id: "lab-installation", medium: "QR" }],
    keys: new Map([["lab-key", key]]),
    now: () => now,
  });
});
afterEach(async () => {
  await provider.clear();
  delete window.LandfallNative;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const token = () => signer.issue({ ...scope, id: "lab-installation", medium: "QR" }).token;
const event = (scanId: unknown, value = token()) => ({ type: "interaction", medium: "QR", scanId, token: value });
describe("deliberate native installation acquisition", () => {
  it("starts no camera or location on construction, and blocks unsupported media", async () => {
    expect(calls).toEqual([]);
    expect(await provider.scan("NFC", vi.fn())).toBe("UNAVAILABLE");
    expect(calls).toEqual([]);
  });
  it("ignores unbound callbacks and stops before verifying a matching one without completion authority", async () => {
    const result = vi.fn();
    await provider.scan("QR", result);
    const scanId = calls.find((item) => item.operation === "QR_SCAN")!.payload.scanId;
    emit(event(crypto.randomUUID()));
    emit({ ...event(scanId), url: "https://untrusted.example.test" });
    await Promise.resolve();
    expect(result).not.toHaveBeenCalled();
    emit(event(scanId));
    await vi.waitFor(() =>
      expect(result).toHaveBeenCalledWith({
        state: "VERIFIED",
        installationId: "lab-installation",
        physicalPresence: "NOT_PROVEN",
        canComplete: false,
      }),
    );
    expect(calls.at(-1)?.operation).toBe("INTERACTION_STOP");
    expect(calls.at(-1)?.payload).toEqual({ scanId });
    emit(event(scanId));
    await Promise.resolve();
    expect(result).toHaveBeenCalledOnce();
    expect(calls.some((item) => item.operation.startsWith("LOCATION"))).toBe(false);
  });
  it("clears listeners on background, never resumes automatically and ignores old scan identities", async () => {
    const result = vi.fn();
    await provider.scan("QR", result);
    const scanId = calls.find((item) => item.operation === "QR_SCAN")!.payload.scanId;
    emit({ type: "lifecycle", state: "BACKGROUND" });
    await vi.waitFor(() => expect(result).toHaveBeenCalledWith(expect.objectContaining({ state: "STOPPED" })));
    emit(event(scanId));
    emit({ type: "lifecycle", state: "FOREGROUND" });
    expect(calls.filter((item) => item.operation === "QR_SCAN")).toHaveLength(1);
    expect(result).toHaveBeenCalledOnce();
  });
  it("expires or explicitly cancels one-shot acquisition and rejects stale callbacks", async () => {
    vi.useFakeTimers();
    const result = vi.fn();
    await provider.scan("QR", result);
    const scanId = calls.find((item) => item.operation === "QR_SCAN")!.payload.scanId;
    await vi.advanceTimersByTimeAsync(30000);
    expect(result).toHaveBeenCalledWith(expect.objectContaining({ state: "EXPIRED" }));
    emit(event(scanId));
    expect(result).toHaveBeenCalledOnce();
    await provider.scan("QR", result);
    const next = calls.filter((item) => item.operation === "QR_SCAN").at(-1)!.payload.scanId;
    emit({ type: "interaction-ended", medium: "QR", scanId: next });
    expect(result).toHaveBeenLastCalledWith(expect.objectContaining({ state: "STOPPED" }));
  });
  it("verifies bounded signed text offline while retaining duplicate suppression and no physical-presence claim", async () => {
    expect(await provider.verify(token(), "QR")).toMatchObject({
      state: "VERIFIED",
      physicalPresence: "NOT_PROVEN",
      canComplete: false,
    });
    expect(await provider.verify(token(), "QR")).toMatchObject({ state: "DUPLICATE" });
    expect(await provider.verify(token(), "NFC")).toMatchObject({ state: "INVALID" });
    expect(await provider.verify("https://untrusted.example.test", "QR")).toMatchObject({ state: "INVALID" });
    expect(calls).toEqual([]);
  });
  it("carries the original stop identity across a replaced objective instead of cancelling its new scanner", async () => {
    let activeId: unknown = null;
    let release: (() => void) | undefined;
    window.LandfallNative!.request = vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      calls.push(value);
      if (value.operation === "QR_SCAN") {
        activeId = value.payload.scanId;
        return { state: "GRANTED" };
      }
      await new Promise<void>((done) => {
        release = done;
      });
      if (value.payload.scanId === activeId) activeId = null;
      return { accepted: true };
    });
    await provider.scan("QR", vi.fn());
    const oldId = activeId,
      stopping = provider.stop();
    await vi.waitFor(() => expect(release).toBeDefined());
    const next = new NativeLandfallInstallationProvider({
      scope,
      installations: [{ id: "lab-installation", medium: "QR" }],
      keys: new Map(),
    });
    await next.scan("QR", vi.fn());
    const newId = activeId;
    expect(newId).not.toBe(oldId);
    release!();
    await stopping;
    expect(activeId).toBe(newId);
    release = undefined;
    const clearing = next.stop();
    await vi.waitFor(() => {
      expect(calls.at(-1)?.operation).toBe("INTERACTION_STOP");
      expect(calls.at(-1)?.payload.scanId).toBe(newId);
      expect(release).toBeDefined();
    });
    release!();
    await clearing;
    expect(activeId).toBeNull();
  });
});

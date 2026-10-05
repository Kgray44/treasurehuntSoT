import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ present: true, request: vi.fn() }));
vi.mock("@/landfall/native-bridge", () => ({
  landfallNativeHost: () => (bridge.present ? { platform: "ANDROID" } : null),
  landfallNativeRequest: bridge.request,
}));
import {
  persistNativeLandfallLease,
  removeNativeLandfallLease,
  restoreNativeLandfallLeases,
} from "./native-private-store";

const key = "landfall-offline-lease-v2:synthetic-session";
describe("native restart authorization metadata", () => {
  let records: Map<string, string>;
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    sessionStorage.clear();
    bridge.present = true;
    records = new Map();
    bridge.request
      .mockReset()
      .mockImplementation(async (operation: string, payload?: { key: string; value?: string }) => {
        if (operation === "PRIVATE_STORE_PUT") {
          records.set(payload!.key, payload!.value!);
          return { accepted: true };
        }
        if (operation === "PRIVATE_STORE_GET") return { value: records.get(payload!.key) ?? null };
        if (operation === "PRIVATE_STORE_LIST") return { keys: [...records.keys()] };
        if (operation === "PRIVATE_STORE_DELETE") {
          records.delete(payload!.key);
          return { accepted: true };
        }
        throw new Error("UNEXPECTED_NATIVE_OPERATION");
      });
  });
  it("restores a Unicode descriptor after the JavaScript session storage is lost", async () => {
    const value = JSON.stringify({ synthetic: "航海 🧭".repeat(1800) });
    expect(await persistNativeLandfallLease(key, value, Date.now() + 60000)).toBe(true);
    expect(records.size).toBeGreaterThan(2);
    expect(sessionStorage.getItem(key)).toBeNull();
    await restoreNativeLandfallLeases();
    expect(sessionStorage.getItem(key)).toBe(value);
  });
  it.each(["tamper", "missing", "expired"])(
    "fails closed on a %s descriptor without suppressing other leases",
    async (fault) => {
      const other = "landfall-offline-identity-v2";
      await persistNativeLandfallLease(key, "private synthetic authorization", Date.now() + 60000);
      await persistNativeLandfallLease(other, "synthetic identity", Date.now() + 60000);
      if (fault === "tamper") records.set(key + ":chunk:0", btoa("forged authorization"));
      if (fault === "missing") records.delete(key + ":chunk:0");
      if (fault === "expired")
        records.set(key, JSON.stringify({ ...JSON.parse(records.get(key)!), expiresAt: Date.now() - 1 }));
      await restoreNativeLandfallLeases();
      expect(sessionStorage.getItem(key)).toBeNull();
      expect(sessionStorage.getItem(other)).toBe("synthetic identity");
    },
  );
  it("skips malformed metadata and removes surplus chunks after a smaller replacement", async () => {
    records.set("landfall-region-lease-v1:malformed", "{not json");
    await persistNativeLandfallLease(key, "x".repeat(20000), Date.now() + 60000);
    await persistNativeLandfallLease(key, "small replacement", Date.now() + 60000);
    expect([...records.keys()].filter((name) => name.startsWith(key + ":chunk:"))).toEqual([key + ":chunk:0"]);
    await restoreNativeLandfallLeases();
    expect(sessionStorage.getItem(key)).toBe("small replacement");
  });
  it("serializes removal before a later authorized replacement", async () => {
    await persistNativeLandfallLease(key, "old", Date.now() + 60000);
    const removed = removeNativeLandfallLease(key);
    const replaced = persistNativeLandfallLease(key, "new", Date.now() + 60000);
    await Promise.all([removed, replaced]);
    await restoreNativeLandfallLeases();
    expect(sessionStorage.getItem(key)).toBe("new");
  });
  it("does not commit or restore after revocation while a native chunk write is in flight", async () => {
    let finish!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    bridge.request.mockImplementationOnce(async (_operation: string, payload: { key: string; value: string }) => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      records.set(payload.key, payload.value);
      return { accepted: true };
    });
    const saving = persistNativeLandfallLease(key, "x".repeat(10000), Date.now() + 60000);
    await entered;
    window.dispatchEvent(new Event("landfall-offline-cleared"));
    finish();
    expect(await saving).toBe(false);
    expect(records.has(key)).toBe(false);
    await restoreNativeLandfallLeases();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("rejects foreign keys, empty or oversized metadata, excessive expiry and missing native hosts", async () => {
    for (const [name, value, expiry] of [
      ["private-anything", "synthetic", Date.now() + 60000],
      [key, "", Date.now() + 60000],
      [key, "x".repeat(512 * 1024 + 1), Date.now() + 60000],
      [key, "synthetic", Date.now() + 86410000],
    ] as const)
      expect(await persistNativeLandfallLease(name, value, expiry)).toBe(false);
    bridge.present = false;
    expect(await persistNativeLandfallLease(key, "synthetic", Date.now() + 60000)).toBe(false);
    expect(bridge.request).not.toHaveBeenCalled();
  });
});

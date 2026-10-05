import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLandfallNativeDriver } from "@/landfall/native-bridge";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  delete window.LandfallNative;
});
it("passive native permission inspection is separate from the deliberate prompt operation", async () => {
  const operations: string[] = [];
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: async (message) => {
      const operation = JSON.parse(message).operation;
      operations.push(operation);
      return { state: operation === "LOCATION_PERMISSION_STATE" ? "DENIED" : "GRANTED" };
    },
  };
  const driver = createLandfallNativeDriver()!;
  expect(await driver.readPermission!()).toBe("DENIED");
  expect(operations).toEqual(["LOCATION_PERMISSION_STATE"]);
  expect(await driver.permission()).toBe("GRANTED");
  expect(operations).toEqual(["LOCATION_PERMISSION_STATE", "LOCATION_PERMISSION"]);
});
it("a malformed passive native reply cannot turn a missing grant into success", async () => {
  window.LandfallNative = { version: 1, platform: "IOS", request: async () => ({ state: "probably granted" }) };
  await expect(createLandfallNativeDriver()!.readPermission!()).rejects.toThrow();
});

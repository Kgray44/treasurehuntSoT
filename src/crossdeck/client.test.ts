// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { afterEach, expect, it, vi } from "vitest";
import { createCrossdeckId } from "./client";

afterEach(() => vi.unstubAllGlobals());

it("retains the secure-context native UUID provider", () => {
  const randomUUID = vi.fn().mockReturnValue("aabbccdd-1111-4222-8333-123456789abc");
  vi.stubGlobal("crypto", { randomUUID });
  expect(createCrossdeckId()).toBe("aabbccdd-1111-4222-8333-123456789abc");
  expect(randomUUID).toHaveBeenCalledOnce();
});

it("supports local HTTP's cryptographic provider with valid distinct version-4 identifiers", () => {
  const getRandomValues = vi.fn(globalThis.crypto.getRandomValues.bind(globalThis.crypto));
  vi.stubGlobal("crypto", { getRandomValues });
  const first = createCrossdeckId(),
    second = createCrossdeckId();
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  expect(first).toMatch(uuid);
  expect(second).toMatch(uuid);
  expect(first).not.toBe(second);
  expect(getRandomValues).toHaveBeenCalledTimes(2);
});

it("fails closed without cryptographic randomness", () => {
  vi.stubGlobal("crypto", {});
  expect(() => createCrossdeckId()).toThrow("secure device identifiers");
});

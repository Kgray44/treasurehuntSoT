import { describe, expect, it, vi } from "vitest";
import { readOwnedLandfallAuthorityCounts } from "./authority-counts-read";
const timeout = () => new Error("LANDFALL_LAB_AUTHORITY_TIMEOUT");
describe("owned native lab authority counts transport", () => {
  it("returns a successful fresh count without retry", async () => {
    const request = vi.fn(async () => ({ canonicalProgressionEvents: 1 }));
    const delay = vi.fn(async () => {});
    await expect(readOwnedLandfallAuthorityCounts({ ownedChildAlive: () => true, request, delay })).resolves.toEqual({
      canonicalProgressionEvents: 1,
    });
    expect(request.mock.calls).toEqual([["counts"]]);
    expect(delay).not.toHaveBeenCalled();
  });
  it("dispatches one new read after a deadline without replaying other operations", async () => {
    const request = vi
      .fn<(operation: "counts") => Promise<{ canonicalProgressionEvents: number }>>()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce({ canonicalProgressionEvents: 2 });
    const delay = vi.fn(async () => {});
    await expect(readOwnedLandfallAuthorityCounts({ ownedChildAlive: () => true, request, delay })).resolves.toEqual({
      canonicalProgressionEvents: 2,
    });
    expect(request.mock.calls).toEqual([["counts"], ["counts"]]);
    expect(delay).toHaveBeenCalledExactlyOnceWith(250);
  });
  it("rejects a second deadline instead of fabricating a count", async () => {
    const request = vi.fn(async () => {
      throw timeout();
    });
    await expect(
      readOwnedLandfallAuthorityCounts({ ownedChildAlive: () => true, request, delay: async () => {} }),
    ).rejects.toThrow("LANDFALL_LAB_AUTHORITY_TIMEOUT");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("never retries a database or domain rejection", async () => {
    const request = vi.fn(async () => {
      throw new Error("LANDFALL_WRONG_WORLDSPACE");
    });
    const delay = vi.fn(async () => {});
    await expect(readOwnedLandfallAuthorityCounts({ ownedChildAlive: () => true, request, delay })).rejects.toThrow(
      "LANDFALL_WRONG_WORLDSPACE",
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
  it("refuses an exited child before making a request", async () => {
    const request = vi.fn(async () => 0);
    await expect(
      readOwnedLandfallAuthorityCounts({ ownedChildAlive: () => false, request, delay: async () => {} }),
    ).rejects.toThrow("LANDFALL_LAB_AUTHORITY_EXITED");
    expect(request).not.toHaveBeenCalled();
  });
  it("does not redispatch after ownership/liveness is lost during backoff", async () => {
    let alive = true;
    const request = vi.fn(async () => {
      throw timeout();
    });
    await expect(
      readOwnedLandfallAuthorityCounts({
        ownedChildAlive: () => alive,
        request,
        delay: async () => {
          alive = false;
        },
      }),
    ).rejects.toThrow("LANDFALL_LAB_AUTHORITY_EXITED");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

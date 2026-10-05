import { describe, expect, it } from "vitest";
import { qualifyNearbyPairLease } from "./nearby-pairing-lease";
const response = { expiresAt: 2_000_000_000_000, remainingMs: 45000 };
describe("clock-independent bounded nearby pairing lease", () => {
  it("handles device wall-clock skew and deducts the complete request interval", () => {
    for (const wall of [1_000_000, 2_000_003_600_000, 1_999_996_400_000]) {
      const lease = qualifyNearbyPairLease(response, 100, 1100, wall);
      expect(lease.nativeExpiresAt).toBe(wall + 44000);
      expect(lease.monotonicExpiresAt).toBe(45100);
      expect(lease.serverExpiresAt).toBe(response.expiresAt);
    }
  });
  it("cannot extend a prepared exchange on repeated reads or a changed server expiry", () => {
    const lease = qualifyNearbyPairLease(response, 0, 0, 100000);
    expect(qualifyNearbyPairLease(response, 9990, 10000, 110000, lease).remainingMs).toBe(35000);
    expect(() =>
      qualifyNearbyPairLease({ ...response, expiresAt: response.expiresAt + 1 }, 9990, 10000, 110000, lease),
    ).toThrow("PAIR_CHANGED");
    expect(() => qualifyNearbyPairLease(response, 45000, 45000, 145000, lease)).toThrow("PAIR_CHANGED");
  });
  it("rejects expired in-flight requests, monotonic rollback and unbounded durations", () => {
    expect(() => qualifyNearbyPairLease(response, 0, 45000, 100000)).toThrow("PAIR_CHANGED");
    expect(() => qualifyNearbyPairLease(response, 100, 99, 100000)).toThrow("PAIR_CHANGED");
    const previous = qualifyNearbyPairLease(response, 100, 1000, 100000);
    expect(() => qualifyNearbyPairLease(response, 980, 990, 100000, previous)).toThrow("PAIR_CHANGED");
    for (const remainingMs of [0, 45001, NaN, Infinity, 0.5])
      expect(() => qualifyNearbyPairLease({ ...response, remainingMs }, 0, 0, 100000)).toThrow();
    expect(() => qualifyNearbyPairLease(response, 0, 0, Number.MAX_SAFE_INTEGER)).toThrow("PAIR_CHANGED");
  });
});

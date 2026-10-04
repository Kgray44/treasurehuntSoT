import { describe, expect, it } from "vitest";
import { nativePairingLeaseClockBand } from "./native-pairing-diagnostics";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence
describe("private native pairing clock evidence", () => {
  it("distinguishes a lease rejected by the actual client clock boundary", () => {
    expect(nativePairingLeaseClockBand(100000, 54999)).toBe("BEYOND_CLIENT_45S");
    expect(nativePairingLeaseClockBand(100000, 55000)).toBe("WITHIN_CLIENT_45S");
    expect(nativePairingLeaseClockBand(100000, 100000)).toBe("EXPIRED");
  });
  it("never exports unvalidated values or private response content", () => {
    for (const value of [
      null,
      undefined,
      "private-claim",
      { expiresAt: 100000, key: "private" },
      NaN,
      Infinity,
      -1,
      0.5,
    ]) {
      expect(nativePairingLeaseClockBand(value, 55000)).toBe("UNOBSERVED");
      expect(nativePairingLeaseClockBand(100000, value)).toBe("UNOBSERVED");
    }
  });
});

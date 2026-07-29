import { describe, expect, it } from "vitest";
import {
  assertProtectedMediaKeyAvailable,
  verifyProtectedMediaKeyRetirement,
} from "@/private-content/media/key-lifecycle";

describe("protected media key lifecycle", () => {
  it("fails closed for an unknown derivative key version", () => {
    expect(() => assertProtectedMediaKeyAvailable({ knownVersions: ["v2"], requiredVersion: "v1" })).toThrow(
      expect.objectContaining({ code: "PROTECTED_MEDIA_KEY_UNAVAILABLE" }),
    );
  });

  it("does not retire a key still needed by derivative or backup evidence", () => {
    expect(() =>
      verifyProtectedMediaKeyRetirement({
        candidateVersion: "v1",
        activeVersion: "v2",
        derivativeReferences: 1,
        backupReferences: 0,
        restoreVerified: true,
        explicitlyApproved: true,
      }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_KEY_RETIREMENT_BLOCKED" }));
    expect(
      verifyProtectedMediaKeyRetirement({
        candidateVersion: "v1",
        activeVersion: "v2",
        derivativeReferences: 0,
        backupReferences: 0,
        restoreVerified: true,
        explicitlyApproved: true,
      }),
    ).toMatchObject({ state: "RETIREMENT_ALLOWED" });
  });
});

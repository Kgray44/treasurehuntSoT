import { describe, expect, it } from "vitest";
import { RotatingLocalPrivateKeyProvider } from "@/private-content/key-provider";
import { planPrivateKeyRotation, rewrapPrivateKeys, verifyPrivateKeyRetirement } from "@/private-content/key-lifecycle";
describe("Phase 3 local key lifecycle", () => {
  it("plans, rewraps, resumes, and guards retirement", async () => {
    const provider = new RotatingLocalPrivateKeyProvider({ v1: Buffer.alloc(32, 1), v2: Buffer.alloc(32, 2) }, "v2");
    const old = new RotatingLocalPrivateKeyProvider({ v1: Buffer.alloc(32, 1) }, "v1");
    const wrapped = await old.wrap(Buffer.alloc(32, 7));
    const source = { ...wrapped, provider: "local-development-keyring" };
    expect(planPrivateKeyRotation({ activeVersion: "v2", wrapped: [source] })).toMatchObject({
      planned: 1,
      dryRun: true,
    });
    const result = await rewrapPrivateKeys({ wrapped: [source], provider, activeVersion: "v2" });
    expect(result).toMatchObject({ state: "COMPLETED", completed: 1 });
    expect(result.rewritten[0]?.keyVersion).toBe("v2");
    expect(
      verifyPrivateKeyRetirement({
        candidateVersion: "v1",
        activeVersion: "v2",
        liveReferences: 0,
        backupReferences: 0,
        restoreVerified: true,
        explicitlyApproved: true,
      }),
    ).toMatchObject({ state: "RETIREMENT_ALLOWED" });
    expect(() =>
      verifyPrivateKeyRetirement({
        candidateVersion: "v1",
        activeVersion: "v2",
        liveReferences: 1,
        backupReferences: 0,
        restoreVerified: true,
        explicitlyApproved: true,
      }),
    ).toThrow();
  });
});

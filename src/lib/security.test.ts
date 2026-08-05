import { describe, expect, it } from "vitest";
import { gmCapabilityAllowedWithinWorkspaceLock } from "./security";

const fullCapabilityUser = {
  role: "CANONICAL",
  capabilities: JSON.stringify(["ADMIN", "CAPTAIN", "CREATE_TALES", "MANAGE_ASSETS", "PUBLISH_TALES"]),
};

describe("server-authoritative staff workspace lock", () => {
  it("homeport.owner-correction.round1.same-chronicle-denial blocks Captain and Creator operations, including for an administrator", () => {
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "CAPTAIN", true)).toBe(false);
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "CREATE_TALES", true)).toBe(false);
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "PUBLISH_TALES", true)).toBe(false);
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "MANAGE_ASSETS", true)).toBe(false);
  });

  it("preserves unrelated administrator operations and restores staff capabilities after the lock clears", () => {
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "ADMIN", true)).toBe(true);
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "CAPTAIN", false)).toBe(true);
    expect(gmCapabilityAllowedWithinWorkspaceLock(fullCapabilityUser, "CREATE_TALES", false)).toBe(true);
  });
});

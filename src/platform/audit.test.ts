import { describe, expect, it } from "vitest";
import { safeAuditMetadata } from "@/platform/audit";

describe("platform audit redaction", () => {
  it("drops secret-bearing fields and bounds human-readable values", () => {
    const result = safeAuditMetadata({
      versionId: "version-1",
      playerCount: 2,
      invitationToken: "raw-token",
      playerPin: "1234",
      contentSnapshot: "private authored content",
      note: "x".repeat(500),
    });
    expect(result).toEqual({ versionId: "version-1", playerCount: 2 });
    expect(JSON.stringify(result)).not.toContain("raw-token");
    expect(JSON.stringify(result)).not.toContain("1234");
  });
});

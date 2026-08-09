import { describe, expect, it } from "vitest";
import { administrativeAuditData, sanitizeAdministrativeMetadata } from "./audit";

describe("Admiralty audit privacy", () => {
  it("recursively removes sensitive keys and bounds retained values", () => {
    const sanitized = sanitizeAdministrativeMetadata({
      reason: "support".repeat(100),
      nested: {
        passwordHash: "never",
        sessionToken: "never",
        privateNote: "never",
        safeState: "ACTIVE",
        deeper: { providerSecretKey: "never", count: 2 },
      },
      events: Array.from({ length: 30 }, (_, index) => ({ index, payload: "never" })),
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/never|password|token|private|payload|secret/iu);
    expect((sanitized.reason as string).length).toBeLessThanOrEqual(240);
    expect(sanitized).toMatchObject({ nested: { safeState: "ACTIVE", deeper: { count: 2 } } });
    expect(sanitized.events).toHaveLength(20);
  });

  it("keeps one supplied correlation ID and bounded authorization evidence", () => {
    const data = administrativeAuditData({
      actorAccountId: "account-a",
      actorRole: "SUPPORT_OPERATOR",
      capability: "SUPPORT_USE",
      action: "ADMIRALTY_SUPPORT_SCOPE_READ",
      targetType: "UserAccount",
      targetId: "account-b",
      reason: "Investigate session timing",
      authorizationBasis: "ROLE_CAPABILITY;SUPPORT_GRANT",
      supportGrantId: "grant-a",
      correlationId: "correlation-a",
      detail: { scope: "SESSION_DIAGNOSTICS", rawSessionToken: "never" },
    });
    expect(data).toMatchObject({ actorType: "SUPPORT_OPERATOR", correlationId: "correlation-a" });
    expect(JSON.parse(data.metadata)).toMatchObject({
      capability: "SUPPORT_USE",
      supportGrantId: "grant-a",
      detail: { scope: "SESSION_DIAGNOSTICS" },
    });
    expect(data.metadata).not.toContain("never");
  });
});

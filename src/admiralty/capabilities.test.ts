import { describe, expect, it } from "vitest";
import { operatorFromCanonicalSession } from "./authorization";
import { resolveAdmiraltyCapability } from "./capabilities";
import { admiraltyRegistrySummary, validateAdmiraltyRegistry } from "./registry";

const assignment = (role: string, extra: Record<string, unknown> = {}) => ({
  role,
  scopeType: "GLOBAL",
  scopeId: null,
  revokedAt: null,
  ...extra,
});

describe("Admiralty capability authority", () => {
  it("expands named administrator capabilities without a god-mode boolean", () => {
    const decision = resolveAdmiraltyCapability([assignment("ADMINISTRATOR")], "SUPPORT_USE");
    expect(decision).toMatchObject({ allowed: true, reason: "ROLE_CAPABILITY", roles: ["ADMINISTRATOR"] });
    expect(decision.capabilities).toContain("AUDIT_OBSERVE");
    expect(decision.capabilities).not.toContain("BREAK_GLASS");
  });

  it.each(["PLAYER", "CAPTAIN", "CREATOR"])("denies ordinary %s-only accounts", (role) => {
    expect(resolveAdmiraltyCapability([assignment(role)], "PLATFORM_OBSERVE")).toMatchObject({
      allowed: false,
      reason: "CAPABILITY_NOT_GRANTED",
    });
  });

  it("denies revoked roles, unknown capabilities, and scope mismatches", () => {
    expect(
      resolveAdmiraltyCapability([assignment("ADMINISTRATOR", { revokedAt: new Date() })], "PLATFORM_OBSERVE"),
    ).toMatchObject({ allowed: false, reason: "NO_ACTIVE_ROLE" });
    expect(resolveAdmiraltyCapability([assignment("ADMINISTRATOR")], "INVENTED_POWER")).toMatchObject({
      allowed: false,
      reason: "UNKNOWN_CAPABILITY",
    });
    expect(
      resolveAdmiraltyCapability(
        [assignment("SUPPORT_OPERATOR", { scopeType: "ACCOUNT", scopeId: "account-a" })],
        "SUPPORT_USE",
        { scopeType: "ACCOUNT", scopeId: "account-b" },
      ),
    ).toMatchObject({ allowed: false, reason: "SCOPE_MISMATCH" });
  });

  it("deduplicates duplicate role rows and honors an exact scoped role", () => {
    const assignments = [
      assignment("SUPPORT_OPERATOR", { scopeType: "ACCOUNT", scopeId: "account-a" }),
      assignment("SUPPORT_OPERATOR", { scopeType: "ACCOUNT", scopeId: "account-a" }),
    ];
    expect(
      resolveAdmiraltyCapability(assignments, "SUPPORT_USE", { scopeType: "ACCOUNT", scopeId: "account-a" }),
    ).toMatchObject({ allowed: true, roles: ["SUPPORT_OPERATOR"] });
  });

  it("rechecks current active roles before constructing an operator", () => {
    const session = {
      id: "session-a",
      accountId: "account-a",
      csrfToken: "csrf",
      expiresAt: new Date(Date.now() + 60_000),
      account: {
        profile: { displayName: "Synthetic Operator" },
        roles: [assignment("ADMINISTRATOR", { revokedAt: new Date() })],
      },
    };
    expect(() => operatorFromCanonicalSession(session as never)).toThrow("Administrative access is not available");
  });

  it("validates the complete 92-entry v1.2 floor and dormant truth labels", () => {
    expect(validateAdmiraltyRegistry()).toEqual({ valid: true, problems: [] });
    expect(admiraltyRegistrySummary()).toMatchObject({
      total: 92,
      byCategory: {
        PLATFORM_OVERVIEW: 19,
        ACCOUNTS_AND_PEOPLE: 13,
        CHRONICLE_ADMINISTRATION: 12,
        COMMUNITY_ADMINISTRATION: 12,
        SYSTEM_CONFIGURATION: 27,
        AUDIT: 9,
      },
    });
    expect(admiraltyRegistrySummary().dormant).toBeGreaterThan(0);
  });
});

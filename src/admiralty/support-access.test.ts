import { describe, expect, it } from "vitest";
import { supportRequestSchema, supportTideglassDiagnosticSchema } from "./schemas";
import { authorizeSupportGrantRecord } from "./support-access";

const now = new Date("2026-08-09T12:00:00.000Z");
const grant = (overrides: Record<string, unknown> = {}) => ({
  operatorAccountId: "operator-a",
  targetAccountId: "target-a",
  grantedScopes: JSON.stringify(["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"]),
  status: "ACTIVE",
  expiresAt: new Date(now.getTime() + 60_000),
  revokedAt: null,
  request: { status: "APPROVED" },
  ...overrides,
});

describe("Support Access grant authorization", () => {
  it("allows only the exact operator, target, and scope on an active grant", () => {
    expect(
      authorizeSupportGrantRecord(grant(), "operator-a", { targetAccountId: "target-a", scope: "ACCOUNT_STATE" }, now),
    ).toBe(true);
  });

  it.each([
    ["wrong operator", grant(), "operator-b", "target-a", "ACCOUNT_STATE", "SUPPORT_GRANT_SCOPE_DENIED"],
    ["wrong target", grant(), "operator-a", "target-b", "ACCOUNT_STATE", "SUPPORT_GRANT_SCOPE_DENIED"],
    ["wrong scope", grant(), "operator-a", "target-a", "AUTH_EVENTS", "SUPPORT_GRANT_SCOPE_DENIED"],
    [
      "expired",
      grant({ expiresAt: new Date(now.getTime() - 1) }),
      "operator-a",
      "target-a",
      "ACCOUNT_STATE",
      "SUPPORT_GRANT_EXPIRED",
    ],
    [
      "revoked",
      grant({ status: "REVOKED", revokedAt: now }),
      "operator-a",
      "target-a",
      "ACCOUNT_STATE",
      "SUPPORT_GRANT_REVOKED",
    ],
    [
      "denied request",
      grant({ request: { status: "DENIED" } }),
      "operator-a",
      "target-a",
      "ACCOUNT_STATE",
      "SUPPORT_GRANT_REQUIRED",
    ],
  ])("denies %s", (_name, record, operator, target, scope, code) => {
    expect(() =>
      authorizeSupportGrantRecord(
        record as never,
        operator as string,
        { targetAccountId: target as string, scope: scope as never },
        now,
      ),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("makes credential, token, key, and private-content categories unrepresentable", () => {
    for (const scope of [
      "PASSWORDS",
      "RAW_PASSWORD_HASHES",
      "RAW_SESSION_TOKENS",
      "OAUTH_PROVIDER_TOKENS",
      "PROVIDER_SECRET_KEYS",
      "ENCRYPTION_MASTER_KEYS",
      "PRIVATE_CHRONICLE_PROSE",
    ])
      expect(
        supportRequestSchema.safeParse({
          targetAccountId: "target-a",
          purpose: "Synthetic support purpose",
          requestedScopes: [scope],
        }).success,
      ).toBe(false);
  });

  it("requires exact identities for a governed Tideglass diagnostic request", () => {
    expect(
      supportTideglassDiagnosticSchema.safeParse({
        grantId: "grant-a",
        targetAccountId: "target-a",
        chronicleId: "chronicle-a",
        sourceEditionId: "edition-a",
        targetEditionId: "edition-b",
      }).success,
    ).toBe(true);
    expect(
      supportTideglassDiagnosticSchema.safeParse({
        grantId: "grant-a",
        targetAccountId: "target-a",
        chronicleId: "chronicle-a",
        sourceEditionId: "edition-a",
        targetEditionId: "edition-b",
        rawSnapshot: "forbidden",
      }).success,
    ).toBe(false);
  });
});

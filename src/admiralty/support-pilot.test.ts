import { describe, expect, it } from "vitest";
import { supportCaseCreateSchema, supportRequestSchema } from "./schemas";
import {
  createSupportExecutionCapability,
  deriveSupportDiagnosis,
  deterministicDiagnosticReceipt,
  parseSupportScopes,
  requireSupportExecutionScope,
  sanitizeSupportNarrative,
  supportPilotRiskCeiling,
  type ParentSupportGrant,
  type SupportCaseGrantBinding,
  type SupportExecutionCapability,
  type SupportPilotObservation,
} from "./support-pilot";

const now = new Date("2026-08-27T15:00:00.000Z");
const supportCase: SupportCaseGrantBinding = {
  id: "case-synthetic-a",
  requestingOperatorId: "operator-synthetic-a",
  targetAccountId: "target-synthetic-a",
  supportAccessRequestId: "request-synthetic-a",
};
const grant = (overrides: Partial<ParentSupportGrant> = {}): ParentSupportGrant => ({
  id: "grant-synthetic-a",
  requestId: "request-synthetic-a",
  operatorAccountId: "operator-synthetic-a",
  targetAccountId: "target-synthetic-a",
  grantedScopes: JSON.stringify(["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"]),
  status: "ACTIVE",
  expiresAt: new Date(now.getTime() + 30 * 60_000),
  revokedAt: null,
  request: { status: "APPROVED" },
  ...overrides,
});

function observation(overrides: Partial<SupportPilotObservation> = {}): SupportPilotObservation {
  return {
    scope: "ACCOUNT_STATE",
    domain: "Wayfarer",
    dataClassification: "ACCOUNT_PRIVATE",
    sourceType: "WayfarerSupportRead.Account",
    sourceId: "target-synthetic-a",
    sourceDigest: "b".repeat(64),
    safeSummary: "A bounded synthetic account state was observed.",
    facts: { accountStatus: "ACTIVE", accountLocked: false },
    ...overrides,
  };
}

describe("Support Pilot S1 execution capability", () => {
  it("derives a short-lived read-only capability only from the exact approved case and grant", () => {
    const capability = createSupportExecutionCapability(supportCase, grant(), "operator-synthetic-a", now);
    expect(capability).toMatchObject({
      supportCaseId: supportCase.id,
      parentSupportGrantId: "grant-synthetic-a",
      operatorAccountId: "operator-synthetic-a",
      targetAccountId: "target-synthetic-a",
      scopes: ["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"],
      riskCeiling: supportPilotRiskCeiling,
    });
    expect(capability.expiresAt.getTime()).toBe(now.getTime() + 10 * 60_000);
  });

  it.each([
    ["expired grant", grant({ expiresAt: new Date(now.getTime() - 1) }), "SUPPORT_GRANT_EXPIRED"],
    ["revoked grant", grant({ status: "REVOKED", revokedAt: now }), "SUPPORT_GRANT_REVOKED"],
    ["missing consent", grant({ request: { status: "REQUESTED" } }), "SUPPORT_GRANT_REQUIRED"],
    ["foreign operator", grant({ operatorAccountId: "other-operator" }), "SUPPORT_GRANT_SCOPE_DENIED"],
    ["foreign target", grant({ targetAccountId: "other-target" }), "SUPPORT_GRANT_SCOPE_DENIED"],
    ["foreign support case", grant({ requestId: "other-request" }), "SUPPORT_GRANT_SCOPE_DENIED"],
  ])("fails closed for %s", (_name, parent, code) => {
    expect(() => createSupportExecutionCapability(supportCase, parent, "operator-synthetic-a", now)).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it("keeps unapproved diagnostic domains out of the derived capability", () => {
    const capability = createSupportExecutionCapability(supportCase, grant(), "operator-synthetic-a", now);
    expect(() => requireSupportExecutionScope(capability, "VOYAGE_MEMBERSHIP")).toThrow(
      expect.objectContaining({ code: "SUPPORT_GRANT_SCOPE_DENIED" }),
    );
    expect(() => requireSupportExecutionScope(capability, "RUNTIME_STATUS")).toThrow(
      expect.objectContaining({ code: "SUPPORT_GRANT_SCOPE_DENIED" }),
    );
  });

  it("makes private content and credentials unrepresentable in case consent", () => {
    for (const forbidden of ["PRIVATE_CHRONICLE_CONTENT", "PRIVATE_MEDIA", "SECRETS", "PASSWORDS", "RAW_LOGS"])
      expect(
        supportCaseCreateSchema.safeParse({
          targetAccountId: "target-synthetic-a",
          title: "Synthetic diagnostic case",
          summary: "A synthetic case summary that is long enough.",
          requestedScopes: [forbidden],
        }).success,
      ).toBe(false);
    expect(
      supportRequestSchema.safeParse({
        targetAccountId: "target-synthetic-a",
        purpose: "Synthetic support request purpose.",
        requestedScopes: ["OAUTH_PROVIDER_TOKENS"],
      }).success,
    ).toBe(false);
  });
});

describe("Support Pilot S1 evidence and diagnosis", () => {
  it("creates a deterministic source-bound receipt without retaining the projection payload", () => {
    const capability: SupportExecutionCapability = createSupportExecutionCapability(
      supportCase,
      grant(),
      "operator-synthetic-a",
      now,
    );
    const first = deterministicDiagnosticReceipt({
      caseId: supportCase.id,
      executionGrantId: "execution-synthetic-a",
      scopes: capability.scopes,
      observations: [observation()],
      findings: [],
    });
    const second = deterministicDiagnosticReceipt({
      caseId: supportCase.id,
      executionGrantId: "execution-synthetic-a",
      scopes: [...capability.scopes].reverse(),
      observations: [observation()],
      findings: [],
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toBe(first);
  });

  it("redacts secret-looking case prose and preserves a bounded human-readable record", () => {
    expect(sanitizeSupportNarrative("Customer supplied password: cannot-be-recorded; session token=never-store")).toBe(
      "Customer supplied [redacted] session [redacted]",
    );
  });

  it("produces an information-only proposal and never a command when evidence identifies an account restriction", () => {
    const result = deriveSupportDiagnosis([
      observation({ facts: { accountStatus: "SUSPENDED", accountLocked: false } }),
    ]);
    expect(result.findings[0]).toMatchObject({ code: "ACCOUNT_ACCESS_RESTRICTION", confidence: "HIGH" });
    expect(result.diagnosis.proposal).toMatchObject({
      proposalType: "REVIEW_ACCOUNT_LIFECYCLE",
      state: "INFORMATION_ONLY",
      requiresAdministrator: true,
    });
    expect(Object.keys(result.diagnosis.proposal)).not.toContain("execute");
  });

  it("does not infer a repair from inconclusive sanitized evidence", () => {
    const result = deriveSupportDiagnosis([observation()]);
    expect(result.diagnosis.primaryCause).toBe("INSUFFICIENT_SANITIZED_EVIDENCE");
    expect(result.diagnosis.proposal.proposalType).toBe("REQUEST_ADDITIONAL_CONSENT");
  });

  it("parses only registered diagnostic scopes", () => {
    expect(parseSupportScopes(JSON.stringify(["ACCOUNT_STATE", "PASSWORDS", "VOYAGE_MEMBERSHIP"]))).toEqual([
      "ACCOUNT_STATE",
      "VOYAGE_MEMBERSHIP",
    ]);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupportCaseConsole } from "./SupportCaseConsole";

describe("SupportCaseConsole", () => {
  afterEach(cleanup);

  it("makes the read-only diagnostic boundary, evidence, and information-only proposal understandable", () => {
    render(
      <SupportCaseConsole
        csrfToken="csrf-synthetic"
        canDiagnose
        initialCases={[
          {
            id: "case-synthetic-a",
            caseNumber: "S1-CASEA",
            targetAccountId: "target-synthetic-a",
            title: "Synthetic account access case",
            safeSummary: "Synthetic account access diagnostics are requested.",
            status: "DIAGNOSED",
            openedAt: "2026-08-27T15:00:00.000Z",
            correlationId: "correlation-synthetic-a",
            requestedScopes: ["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"],
            consent: {
              requestId: "request-synthetic-a",
              status: "APPROVED",
              expiresAt: "2026-08-27T16:00:00.000Z",
              grantId: "grant-synthetic-a",
              grantStatus: "ACTIVE",
              grantExpiresAt: "2026-08-27T15:30:00.000Z",
            },
            latestExecution: {
              id: "session-synthetic-a",
              status: "COMPLETE",
              startedAt: "2026-08-27T15:05:00.000Z",
              completedAt: "2026-08-27T15:05:02.000Z",
              deniedAccessCount: 0,
              redactionCount: 2,
              receiptDigest: "a".repeat(64),
              diagnosis: {
                primaryCause: "NO_ACTIVE_SESSION",
                confidence: "MEDIUM",
                uncertainty: "Client conditions remain unknown.",
                unresolvedQuestions: "[]",
              },
              findings: [
                {
                  code: "NO_ACTIVE_SESSION",
                  summary: "No active synthetic session was found.",
                  confidence: "MEDIUM",
                  uncertainty: "Client conditions remain unknown.",
                },
              ],
              repairProposals: [
                {
                  proposalType: "REAUTHENTICATE_ACCOUNT",
                  summary: "Ask the account owner to sign in again.",
                  requiredUserConsent: true,
                  requiresAdministrator: true,
                  state: "INFORMATION_ONLY",
                },
              ],
              evidenceReferences: [
                {
                  sourceDomain: "Wayfarer",
                  sourceReference: "SupportAccess.SESSION_DIAGNOSTICS:target-synthetic-a",
                  dataClassification: "ACCOUNT_PRIVATE",
                  digest: "b".repeat(64),
                  redacted: true,
                },
              ],
            },
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Open a read-only support case" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirm privileged work" })).toBeVisible();
    expect(
      screen.getByText(/It never changes account, Voyage, Community, job, session, configuration, or platform state/u),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Run read-only diagnosis" })).toBeVisible();
    expect(screen.getByText(/Proposed next action \(INFORMATION_ONLY\)/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: /repair|apply|execute/u })).not.toBeInTheDocument();
  });
});

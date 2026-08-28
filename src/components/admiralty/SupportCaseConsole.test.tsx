import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupportCaseConsole } from "./SupportCaseConsole";

describe("SupportCaseConsole", () => {
  afterEach(cleanup);

  it("keeps diagnosis read-only while distinguishing information-only and registered repair states", () => {
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
            closedAt: null,
            correlationId: "correlation-synthetic-a",
            requestedScopes: ["ACCOUNT_STATE", "SESSION_DIAGNOSTICS"],
            requestedRepairIds: [],
            consent: {
              requestId: "request-synthetic-a",
              status: "APPROVED",
              expiresAt: "2026-08-27T16:00:00.000Z",
              grantId: "grant-synthetic-a",
              grantStatus: "ACTIVE",
              grantExpiresAt: "2026-08-27T15:30:00.000Z",
              grantedRepairIds: [],
              maximumRiskClass: "R0",
            },
            latestExecution: {
              id: "session-synthetic-a",
              status: "COMPLETE",
              startedAt: "2026-08-27T15:05:00.000Z",
              completedAt: "2026-08-27T15:05:02.000Z",
              deniedAccessCount: 0,
              redactionCount: 2,
              receiptDigest: "a".repeat(64),
              supportExecutionGrant: null,
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
                  id: "proposal-synthetic-a",
                  proposalType: "REAUTHENTICATE_ACCOUNT",
                  repairId: null,
                  targetType: null,
                  targetId: null,
                  targetRevision: null,
                  proposalRevision: null,
                  preview: null,
                  summary: "Ask the account owner to sign in again.",
                  requiredUserConsent: true,
                  requiresAdministrator: true,
                  state: "INFORMATION_ONLY",
                  requiresHumanApproval: false,
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
    expect(screen.getByRole("heading", { name: "Open a governed support case" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirm privileged work" })).toBeVisible();
    expect(screen.getByText(/Diagnosis remains read-only/u)).toBeVisible();
    expect(screen.getByRole("button", { name: "Run read-only diagnosis" })).toBeVisible();
    expect(screen.getByText(/Proposed next action \(INFORMATION_ONLY\)/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Execute registered repair" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Close this case" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close case and revoke remaining access" })).toBeVisible();
  });
});

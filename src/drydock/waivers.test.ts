import { describe, expect, it } from "vitest";
import { createDrydockIssue } from "@/drydock/issues";
import { createDrydockRuleWaiver, evaluateDrydockWaiver } from "@/drydock/waivers";

describe("Drydock waiver foundation", () => {
  const warning = createDrydockIssue({
    code: "DRYDOCK_STATE_PROOF_INCOMPLETE",
    category: "STATE",
    severity: "WARNING",
    ruleVersion: 1,
    location: {},
    message: "Bound reached.",
  });
  const waiver = createDrydockRuleWaiver({
    issueId: warning.id,
    ruleCode: warning.code,
    ruleVersion: 1,
    sourceChecksum: "source-a",
    rationale: "Bounded review accepted.",
    authorizedBy: "creator-1",
    authorizedAt: "2026-08-10T00:00:00.000Z",
  });
  it("permits only a current reviewable warning", () =>
    expect(evaluateDrydockWaiver({ waiver, issue: warning, sourceChecksum: "source-a" })).toEqual({ allowed: true }));
  it("rejects stale source and non-waivable errors", () => {
    expect(evaluateDrydockWaiver({ waiver, issue: warning, sourceChecksum: "source-b" })).toEqual({
      allowed: false,
      code: "STALE_SOURCE",
    });
    const error = createDrydockIssue({
      code: "DRYDOCK_GRAPH_UNREACHABLE",
      category: "GRAPH",
      severity: "ERROR",
      ruleVersion: 1,
      location: { blockId: "b" },
      message: "Missing path.",
    });
    expect(
      evaluateDrydockWaiver({
        waiver: { ...waiver, issueId: error.id, ruleCode: error.code },
        issue: error,
        sourceChecksum: "source-a",
      }),
    ).toEqual({ allowed: false, code: "NON_WAIVABLE" });
  });
});

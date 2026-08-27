import { describe, expect, it } from "vitest";
import {
  authorizeRegisteredSupportRepair,
  authorizeSupportRepair,
  type SupportRepairAuthority,
} from "./support-repair-policy";
import { getRegisteredSupportRepair, type SupportRepairDefinition } from "./support-repair-registry";

const now = new Date("2026-08-27T18:00:00.000Z");
const authority = (overrides: Partial<SupportRepairAuthority> = {}): SupportRepairAuthority => ({
  caseStatus: "DIAGNOSED",
  caseRevision: 4,
  supportCaseId: "case-synthetic-a",
  operatorAccountId: "operator-synthetic-a",
  targetAccountId: "target-synthetic-a",
  parentGrantActive: true,
  parentGrantRepairIds: [
    "wayfarer.profile.reconcile",
    "wayfarer.session.revoke-stale",
    "one-voyage.membership.reconcile",
  ],
  parentGrantScopes: ["PROFILE_DIAGNOSTICS", "SESSION_DIAGNOSTICS", "VOYAGE_MEMBERSHIP"],
  riskCeiling: "R3",
  administratorCapabilities: ["ACCOUNT_OPERATE", "VOYAGE_OPERATE"],
  recentAssurance: true,
  budget: {
    remainingCommands: 2,
    remainingAffectedRecords: 4,
    maximumDomains: 2,
    usedDomains: [],
    expiresAt: new Date(now.getTime() + 60_000),
  },
  ...overrides,
});

function repair(id: string) {
  const value = getRegisteredSupportRepair(id);
  if (!value) throw new Error(`Missing synthetic registry repair ${id}`);
  return value;
}

describe("Support Pilot S2 repair policy", () => {
  it("permits registered R1 and R2 commands only within their exact grant", () => {
    expect(
      authorizeSupportRepair({
        authority: authority(),
        repairId: "wayfarer.profile.reconcile",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }).remainingAfter,
    ).toEqual({ remainingCommands: 1, remainingAffectedRecords: 3 });
    expect(
      authorizeSupportRepair({
        authority: authority(),
        repairId: "wayfarer.session.revoke-stale",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 2,
        now,
      }).repair.riskClass,
    ).toBe("R2");
  });

  it("permits R3 only when the owner granted the exact command, scope, capability, and ceiling", () => {
    expect(
      authorizeSupportRepair({
        authority: authority(),
        repairId: "one-voyage.membership.reconcile",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 2,
        now,
      }).repair.riskClass,
    ).toBe("R3");
    expect(() =>
      authorizeSupportRepair({
        authority: authority({ parentGrantRepairIds: ["wayfarer.profile.reconcile"] }),
        repairId: "one-voyage.membership.reconcile",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/did not approve/u);
  });

  it("fails closed for unregistered commands, RX, R4 without human approval, missing scope/capability, and a low ceiling", () => {
    expect(() =>
      authorizeSupportRepair({
        authority: authority(),
        repairId: "sql.execute.drop-all",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/not registered/u);
    const r4 = {
      ...repair("wayfarer.session.revoke-stale"),
      id: "synthetic.r4",
      riskClass: "R4",
      autonomousExecutionAllowed: false,
    } as SupportRepairDefinition;
    expect(() =>
      authorizeRegisteredSupportRepair({
        authority: authority({ parentGrantRepairIds: ["synthetic.r4"], riskCeiling: "R4" }),
        repair: r4,
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/human approval/u);
    const rx = { ...r4, id: "synthetic.rx", riskClass: "RX" } as SupportRepairDefinition;
    expect(() =>
      authorizeRegisteredSupportRepair({
        authority: authority({ parentGrantRepairIds: ["synthetic.rx"], riskCeiling: "RX" }),
        repair: rx,
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
        requiresHumanApproval: true,
      }),
    ).toThrow(/permanently prohibited/u);
    expect(() =>
      authorizeSupportRepair({
        authority: authority({ parentGrantScopes: [] }),
        repairId: "wayfarer.profile.reconcile",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/required support scope/u);
    expect(() =>
      authorizeSupportRepair({
        authority: authority({ administratorCapabilities: [] }),
        repairId: "wayfarer.profile.reconcile",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/lacks the required/u);
    expect(() =>
      authorizeSupportRepair({
        authority: authority({ riskCeiling: "R1" }),
        repairId: "wayfarer.session.revoke-stale",
        targetAccountId: "target-synthetic-a",
        requestedAffectedRecords: 1,
        now,
      }),
    ).toThrow(/risk ceiling/u);
  });

  it("enforces expiry, assurance, command, record, domain, and case budgets", () => {
    const cases: Array<[Partial<SupportRepairAuthority>, RegExp]> = [
      [{ parentGrantActive: false }, /no longer active/u],
      [{ recentAssurance: false }, /Recent privileged assurance/u],
      [{ budget: { ...authority().budget, remainingCommands: 0 } }, /budget is exhausted/u],
      [{ budget: { ...authority().budget, remainingAffectedRecords: 0 } }, /budget is exhausted/u],
      [{ budget: { ...authority().budget, maximumDomains: 0 } }, /domain budget/u],
      [{ caseStatus: "CANCELLED" }, /no longer active/u],
    ];
    for (const [overrides, message] of cases)
      expect(() =>
        authorizeSupportRepair({
          authority: authority(overrides),
          repairId: "wayfarer.profile.reconcile",
          targetAccountId: "target-synthetic-a",
          requestedAffectedRecords: 1,
          now,
        }),
      ).toThrow(message);
  });
});

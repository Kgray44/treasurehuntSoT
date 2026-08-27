import type { AdmiraltyCapabilityId } from "./capabilities";
import { AdmiraltyError } from "./errors";
import {
  getRegisteredSupportRepair,
  isSupportRiskClass,
  supportRiskAtOrBelow,
  type SupportRepairDefinition,
  type SupportRiskClass,
} from "./support-repair-registry";
import type { SupportAccessScope } from "./schemas";

export type SupportRepairBudget = Readonly<{
  remainingCommands: number;
  remainingAffectedRecords: number;
  maximumDomains: number;
  usedDomains: readonly string[];
  expiresAt: Date;
}>;

export type SupportRepairAuthority = Readonly<{
  caseStatus: string;
  caseRevision: number;
  supportCaseId: string;
  operatorAccountId: string;
  targetAccountId: string;
  parentGrantActive: boolean;
  parentGrantRepairIds: readonly string[];
  parentGrantScopes: readonly SupportAccessScope[];
  riskCeiling: SupportRiskClass;
  administratorCapabilities: readonly AdmiraltyCapabilityId[];
  recentAssurance: boolean;
  budget: SupportRepairBudget;
}>;

export type SupportRepairAuthorization = Readonly<{
  repair: SupportRepairDefinition;
  remainingAfter: Pick<SupportRepairBudget, "remainingCommands" | "remainingAffectedRecords">;
}>;

const terminalCaseStates = new Set([
  "CANCELLED",
  "CONSENT_DENIED",
  "CONSENT_REVOKED",
  "EXPIRED",
  "CLOSED",
  "VERIFIED_RESOLVED",
  "VERIFICATION_INCONCLUSIVE",
]);

/** Pure fail-closed policy used before a proposal is persisted and again inside execution. */
export function authorizeSupportRepair(input: {
  authority: SupportRepairAuthority;
  repairId: string;
  targetAccountId: string;
  requestedAffectedRecords: number;
  now?: Date;
  requiresHumanApproval?: boolean;
}): SupportRepairAuthorization {
  const repair = getRegisteredSupportRepair(input.repairId);
  if (!repair)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_UNREGISTERED",
      "This repair is not registered for Support Pilot execution.",
      403,
    );
  return authorizeRegisteredSupportRepair({ ...input, repair });
}

export function authorizeRegisteredSupportRepair(input: {
  authority: SupportRepairAuthority;
  repair: SupportRepairDefinition;
  targetAccountId: string;
  requestedAffectedRecords: number;
  now?: Date;
  requiresHumanApproval?: boolean;
}): SupportRepairAuthorization {
  const now = input.now ?? new Date();
  const repair = input.repair;
  if (repair.riskClass === "RX")
    throw new AdmiraltyError("SUPPORT_REPAIR_PROHIBITED", "This repair class is permanently prohibited.", 403);
  if (terminalCaseStates.has(input.authority.caseStatus))
    throw new AdmiraltyError("SUPPORT_CASE_INACTIVE", "This support case is no longer active.", 409);
  if (!input.authority.parentGrantActive || input.authority.budget.expiresAt.getTime() <= now.getTime())
    throw new AdmiraltyError("SUPPORT_GRANT_EXPIRED", "The delegated repair grant is no longer active.", 403);
  if (input.targetAccountId !== input.authority.targetAccountId)
    throw new AdmiraltyError(
      "SUPPORT_GRANT_SCOPE_DENIED",
      "The delegated repair grant does not authorize this target.",
      403,
    );
  if (!input.authority.parentGrantRepairIds.includes(repair.id))
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_CONSENT_DENIED",
      "The account owner did not approve this exact repair.",
      403,
    );
  if (!repair.requiredSupportScopes.every((scope) => input.authority.parentGrantScopes.includes(scope)))
    throw new AdmiraltyError(
      "SUPPORT_GRANT_SCOPE_DENIED",
      "The grant does not include every required support scope.",
      403,
    );
  if (
    !isSupportRiskClass(input.authority.riskCeiling) ||
    !supportRiskAtOrBelow(repair.riskClass, input.authority.riskCeiling)
  )
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_RISK_DENIED",
      "The selected risk ceiling does not permit this repair.",
      403,
    );
  if (
    !repair.requiredAdministratorCapabilities.every((capability) =>
      input.authority.administratorCapabilities.includes(capability),
    )
  )
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_CAPABILITY_DENIED",
      "The operator lacks the required Administrator capability.",
      403,
    );
  if (repair.reauthenticationRequired && !input.authority.recentAssurance)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_ASSURANCE_REQUIRED",
      "Recent privileged assurance is required for this repair.",
      403,
    );
  if (repair.riskClass === "R4" && !input.requiresHumanApproval)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_HUMAN_APPROVAL_REQUIRED",
      "This high-risk repair requires explicit human approval.",
      403,
    );
  if (!repair.autonomousExecutionAllowed && !input.requiresHumanApproval)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_HUMAN_APPROVAL_REQUIRED",
      "This repair is not eligible for autonomous execution.",
      403,
    );
  if (!Number.isInteger(input.requestedAffectedRecords) || input.requestedAffectedRecords < 1)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_BUDGET_DENIED",
      "The repair must declare a bounded affected-record count.",
      400,
    );
  if (input.requestedAffectedRecords > repair.maximumAffectedRecords)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_BUDGET_DENIED",
      "The repair exceeds its registered affected-record limit.",
      403,
    );
  if (
    input.authority.budget.remainingCommands < 1 ||
    input.authority.budget.remainingAffectedRecords < input.requestedAffectedRecords
  )
    throw new AdmiraltyError("SUPPORT_REPAIR_BUDGET_DENIED", "The delegated repair budget is exhausted.", 403);
  if (
    !input.authority.budget.usedDomains.includes(repair.owningSubsystem) &&
    input.authority.budget.usedDomains.length >= input.authority.budget.maximumDomains
  )
    throw new AdmiraltyError("SUPPORT_REPAIR_BUDGET_DENIED", "The delegated domain budget is exhausted.", 403);
  return {
    repair,
    remainingAfter: {
      remainingCommands: input.authority.budget.remainingCommands - 1,
      remainingAffectedRecords: input.authority.budget.remainingAffectedRecords - input.requestedAffectedRecords,
    },
  };
}

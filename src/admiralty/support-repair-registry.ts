import type { AdmiraltyCapabilityId } from "./capabilities";
import type { SupportAccessScope } from "./schemas";

export const supportRiskClasses = ["R0", "R1", "R2", "R3", "R4", "RX"] as const;
export type SupportRiskClass = (typeof supportRiskClasses)[number];

export const supportRepairRegistrySchemaVersion = "2.0.0";

export type SupportRepairDefinition = Readonly<{
  id: string;
  schemaVersion: string;
  owningSubsystem: "Wayfarer" | "OneVoyage";
  riskClass: SupportRiskClass;
  requiredSupportScopes: readonly SupportAccessScope[];
  requiredAdministratorCapabilities: readonly AdmiraltyCapabilityId[];
  reauthenticationRequired: boolean;
  userConsentRequired: boolean;
  supportsPreview: true;
  idempotency: "OWNER_RECEIPT" | "RECONCILE_BEFORE_RETRY";
  maximumAffectedRecords: number;
  mutationPreview: string;
  preconditionContract: string;
  verificationContract: string;
  rollbackOrCompensation: "NONE_REQUIRED" | "OWNER_COMPENSATION";
  auditCategory: string;
  autonomousExecutionAllowed: boolean;
  targetType: "PlayerProfile" | "AccountSession" | "PlaythroughMembership";
}>;

/**
 * The Support Pilot is deliberately smaller than the possible repair surface.
 * A repair is present here only once its owning subsystem provides a bounded,
 * canonical operation.  The registry is code, not case data: user text cannot
 * add, alter, or elevate a command during a live support case.
 */
export const supportRepairRegistry = [
  {
    id: "wayfarer.profile.reconcile",
    schemaVersion: supportRepairRegistrySchemaVersion,
    owningSubsystem: "Wayfarer",
    riskClass: "R1",
    requiredSupportScopes: ["PROFILE_DIAGNOSTICS"],
    requiredAdministratorCapabilities: ["ACCOUNT_OPERATE"],
    reauthenticationRequired: true,
    userConsentRequired: true,
    supportsPreview: true,
    idempotency: "RECONCILE_BEFORE_RETRY",
    maximumAffectedRecords: 2,
    mutationPreview:
      "Rebuild the canonical profile-preferences compatibility projection from already-authorized profile state.",
    preconditionContract:
      "The target account has an active canonical Player Profile and its current revision matches the proposal.",
    verificationContract:
      "The owner profile projection is readable and its preference representation validates against schema V1.",
    rollbackOrCompensation: "NONE_REQUIRED",
    auditCategory: "SUPPORT_REPAIR_PROFILE_RECONCILE",
    autonomousExecutionAllowed: true,
    targetType: "PlayerProfile",
  },
  {
    id: "wayfarer.session.revoke-stale",
    schemaVersion: supportRepairRegistrySchemaVersion,
    owningSubsystem: "Wayfarer",
    riskClass: "R2",
    requiredSupportScopes: ["SESSION_DIAGNOSTICS"],
    requiredAdministratorCapabilities: ["ACCOUNT_OPERATE"],
    reauthenticationRequired: true,
    userConsentRequired: true,
    supportsPreview: true,
    idempotency: "RECONCILE_BEFORE_RETRY",
    maximumAffectedRecords: 2,
    mutationPreview: "Revoke one stale, still-authenticating account session and its active privileged assurances.",
    preconditionContract:
      "The exact session belongs to the consented account, remains active, and has been inactive for at least 30 days.",
    verificationContract: "The target session is revoked and no active privileged assurance remains bound to it.",
    rollbackOrCompensation: "NONE_REQUIRED",
    auditCategory: "SUPPORT_REPAIR_STALE_SESSION_REVOKE",
    autonomousExecutionAllowed: true,
    targetType: "AccountSession",
  },
  {
    id: "one-voyage.membership.reconcile",
    schemaVersion: supportRepairRegistrySchemaVersion,
    owningSubsystem: "OneVoyage",
    riskClass: "R3",
    requiredSupportScopes: ["VOYAGE_MEMBERSHIP"],
    requiredAdministratorCapabilities: ["VOYAGE_OPERATE"],
    reauthenticationRequired: true,
    userConsentRequired: true,
    supportsPreview: true,
    idempotency: "OWNER_RECEIPT",
    maximumAffectedRecords: 2,
    mutationPreview:
      "Normalize one internally inconsistent removed membership and disconnect its stale presence records.",
    preconditionContract:
      "The membership belongs to the consented account and has a removal timestamp while its lifecycle status is not REMOVED.",
    verificationContract: "The membership status is REMOVED and no connected presence record remains for it.",
    rollbackOrCompensation: "NONE_REQUIRED",
    auditCategory: "SUPPORT_REPAIR_MEMBERSHIP_RECONCILE",
    autonomousExecutionAllowed: true,
    targetType: "PlaythroughMembership",
  },
] as const satisfies readonly SupportRepairDefinition[];

export type RegisteredSupportRepairId = (typeof supportRepairRegistry)[number]["id"];

export function getRegisteredSupportRepair(id: string): SupportRepairDefinition | null {
  return supportRepairRegistry.find((repair) => repair.id === id) ?? null;
}

export function isSupportRiskClass(value: string): value is SupportRiskClass {
  return (supportRiskClasses as readonly string[]).includes(value);
}

export function supportRiskRank(value: SupportRiskClass) {
  return supportRiskClasses.indexOf(value);
}

export function supportRiskAtOrBelow(value: SupportRiskClass, ceiling: SupportRiskClass) {
  return supportRiskRank(value) <= supportRiskRank(ceiling);
}

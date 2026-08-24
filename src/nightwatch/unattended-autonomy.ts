/**
 * Policy vocabulary for bounded unattended engineering. This module decides
 * whether a finding may continue; it never verifies evidence or authorizes a
 * protected merge. Those remain Sounding Line responsibilities.
 */
export const delegatedActionClasses = [
  "focused-code-repair",
  "task-owned-test-repair",
  "generated-state-regeneration",
  "document-index-regeneration",
  "policy-identity-reconciliation",
  "candidate-base-reconciliation",
  "task-owned-fixture-repair",
  "task-owned-configuration-repair",
  "approved-dependency-refresh",
  "safe-rebase-reconciliation",
  "candidate-metadata-repair",
  "post-merge-verification",
  "strategy-continuation",
  "shared-maintenance-repair",
] as const;

export const hardStopActionClasses = [
  "destructive-production-mutation",
  "user-data-deletion",
  "history-rewrite",
  "branch-protection-weakening",
  "verification-authority-weakening",
  "secret-custody",
  "external-monetary-spend",
  "irreversible-infrastructure-destruction",
  "administrative-privilege-grant",
  "material-product-scope-expansion",
  "governing-requirement-conflict",
  "material-product-policy-decision",
  "security-or-privacy-judgment",
] as const;

export type DelegatedActionClass = (typeof delegatedActionClasses)[number];
export type HardStopActionClass = (typeof hardStopActionClasses)[number];
export type AutonomyActionClass = DelegatedActionClass | HardStopActionClass;
export type OwnerRequiredRouting = "AUTO_DELEGATED" | "DELEGATED_WITH_BUDGET" | "TRUE_OWNER_REQUIRED";

export interface AutonomyBudgets {
  maxAttemptsPerUnchangedStrategy: number;
  maxDistinctStrategiesPerRootCause: number;
  maxControlPlaneRepairCandidates: number;
  maxReconciliations: number;
  maxWallClockMs: number;
  maxRepeatedIdenticalFindings: number;
  maxMaintenanceDepth: number;
}

export interface StandingDelegationEnvelope {
  schemaVersion: 1;
  objectiveId: string;
  executionProfile: "UNATTENDED_CONTINUATION";
  authorizedRepositories: string[];
  authorizedProjects: string[];
  allowedActionClasses: DelegatedActionClass[];
  hardStopActionClasses: HardStopActionClass[];
  budgets: AutonomyBudgets;
  allowSharedMaintenance: boolean;
  expiresAt: string | null;
  completionState: "ACTIVE" | "COMPLETED" | "REVOKED";
  auditIdentity: string;
}

export interface AutonomyRouteInput {
  actionClass: AutonomyActionClass;
  project: string;
  inScope: boolean;
  reversible: boolean;
  sharedMaintenance?: boolean;
  externalCost?: boolean;
  productionMutation?: boolean;
  now?: string;
}

export interface AutonomyRoute {
  routing: OwnerRequiredRouting;
  reason: string;
  actionClass: AutonomyActionClass;
  budgeted: boolean;
}

export const defaultAutonomyBudgets: Readonly<AutonomyBudgets> = {
  // One unchanged strategy is sufficient evidence; a retry must change a
  // semantic precondition or the strategy itself.
  maxAttemptsPerUnchangedStrategy: 1,
  maxDistinctStrategiesPerRootCause: 3,
  // One independently governed Bosun repair prevents a repair-of-repair tree.
  maxControlPlaneRepairCandidates: 1,
  maxReconciliations: 1,
  maxWallClockMs: 6 * 60 * 60 * 1_000,
  maxRepeatedIdenticalFindings: 2,
  maxMaintenanceDepth: 1,
};

const automaticActions = new Set<DelegatedActionClass>([
  "generated-state-regeneration",
  "document-index-regeneration",
  "policy-identity-reconciliation",
  "candidate-base-reconciliation",
  "candidate-metadata-repair",
  "post-merge-verification",
]);

const isHardStop = (value: AutonomyActionClass): value is HardStopActionClass =>
  (hardStopActionClasses as readonly string[]).includes(value);

export function createStandingDelegation(input: {
  objectiveId: string;
  auditIdentity: string;
  project: string;
  repository?: string;
  allowedActionClasses?: DelegatedActionClass[];
  budgets?: Partial<AutonomyBudgets>;
  expiresAt?: string | null;
}): StandingDelegationEnvelope {
  return {
    schemaVersion: 1,
    objectiveId: input.objectiveId,
    executionProfile: "UNATTENDED_CONTINUATION",
    authorizedRepositories: [input.repository ?? "Kgray44/treasurehuntSoT"],
    authorizedProjects: [input.project],
    allowedActionClasses: [...(input.allowedActionClasses ?? delegatedActionClasses)],
    hardStopActionClasses: [...hardStopActionClasses],
    budgets: { ...defaultAutonomyBudgets, ...(input.budgets ?? {}) },
    allowSharedMaintenance: true,
    expiresAt: input.expiresAt ?? null,
    completionState: "ACTIVE",
    auditIdentity: input.auditIdentity,
  };
}

export function validateStandingDelegation(envelope: StandingDelegationEnvelope): StandingDelegationEnvelope {
  if (envelope.schemaVersion !== 1 || !envelope.objectiveId.trim() || !envelope.auditIdentity.trim())
    throw new Error("UNATTENDED_DELEGATION_INVALID");
  if (envelope.executionProfile !== "UNATTENDED_CONTINUATION" || envelope.completionState === "REVOKED")
    throw new Error("UNATTENDED_DELEGATION_INACTIVE");
  if (!envelope.authorizedRepositories.length || !envelope.authorizedProjects.length)
    throw new Error("UNATTENDED_DELEGATION_SCOPE_REQUIRED");
  if (!envelope.allowedActionClasses.length)
    throw new Error("UNATTENDED_DELEGATION_ACTIONS_REQUIRED");
  for (const action of envelope.allowedActionClasses)
    if (!(delegatedActionClasses as readonly string[]).includes(action)) throw new Error("UNATTENDED_DELEGATION_ACTION_UNKNOWN");
  for (const action of envelope.hardStopActionClasses)
    if (!(hardStopActionClasses as readonly string[]).includes(action)) throw new Error("UNATTENDED_HARD_STOP_UNKNOWN");
  for (const [name, value] of Object.entries(envelope.budgets))
    if (!Number.isFinite(value) || value < 1) throw new Error(`UNATTENDED_DELEGATION_BUDGET_INVALID:${name}`);
  // An unchanged strategy is a blind retry. The envelope can tighten other
  // bounds but may never authorize a second identical attempt.
  if (envelope.budgets.maxAttemptsPerUnchangedStrategy !== 1)
    throw new Error("UNATTENDED_DELEGATION_UNCHANGED_STRATEGY_RETRY_FORBIDDEN");
  return envelope;
}

export function routeUnattendedAction(
  envelope: StandingDelegationEnvelope | null,
  input: AutonomyRouteInput,
): AutonomyRoute {
  if (!envelope) return { routing: "TRUE_OWNER_REQUIRED", reason: "STANDING_DELEGATION_MISSING", actionClass: input.actionClass, budgeted: false };
  validateStandingDelegation(envelope);
  const now = Date.parse(input.now ?? new Date().toISOString());
  if (envelope.completionState !== "ACTIVE" || (envelope.expiresAt && now >= Date.parse(envelope.expiresAt)))
    return { routing: "TRUE_OWNER_REQUIRED", reason: "STANDING_DELEGATION_EXPIRED", actionClass: input.actionClass, budgeted: false };
  if (isHardStop(input.actionClass) || envelope.hardStopActionClasses.includes(input.actionClass as HardStopActionClass))
    return { routing: "TRUE_OWNER_REQUIRED", reason: "EXPLICIT_HARD_STOP", actionClass: input.actionClass, budgeted: false };
  if (!input.inScope || input.externalCost || input.productionMutation || !input.reversible)
    return { routing: "TRUE_OWNER_REQUIRED", reason: "DELEGATION_RISK_OR_SCOPE_BOUNDARY", actionClass: input.actionClass, budgeted: false };
  const projectAllowed = envelope.authorizedProjects.includes(input.project);
  if (!projectAllowed && !(input.sharedMaintenance && envelope.allowSharedMaintenance))
    return { routing: "TRUE_OWNER_REQUIRED", reason: "DELEGATION_PROJECT_SCOPE_EXCEEDED", actionClass: input.actionClass, budgeted: false };
  if (!envelope.allowedActionClasses.includes(input.actionClass as DelegatedActionClass))
    return { routing: "TRUE_OWNER_REQUIRED", reason: "ACTION_CLASS_NOT_DELEGATED", actionClass: input.actionClass, budgeted: false };
  if (automaticActions.has(input.actionClass as DelegatedActionClass))
    return { routing: "AUTO_DELEGATED", reason: "SAFE_DETERMINISTIC_ACTION_DELEGATED", actionClass: input.actionClass, budgeted: false };
  return { routing: "DELEGATED_WITH_BUDGET", reason: "SAFE_BOUNDED_ACTION_DELEGATED", actionClass: input.actionClass, budgeted: true };
}

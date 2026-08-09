import roleRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Role_Capability_Registry.json";

export const ADMIRALTY_CAPABILITIES = [
  "PLATFORM_OBSERVE",
  "SUPPORT_REQUEST",
  "SUPPORT_USE",
  "ACCOUNT_OBSERVE",
  "ACCOUNT_OPERATE",
  "SECURITY_OBSERVE",
  "SECURITY_OPERATE",
  "CHRONICLE_OBSERVE",
  "CHRONICLE_OPERATE",
  "VOYAGE_OBSERVE",
  "VOYAGE_OPERATE",
  "COMMUNITY_OBSERVE",
  "COMMUNITY_MODERATE",
  "CONTENT_OBSERVE",
  "CONTENT_OPERATE",
  "JOBS_OBSERVE",
  "JOBS_OPERATE",
  "CONFIG_OBSERVE",
  "CONFIG_OPERATE",
  "RELEASE_OBSERVE",
  "RELEASE_OPERATE",
  "AUDIT_OBSERVE",
  "BREAK_GLASS",
] as const;

export type AdmiraltyCapabilityId = (typeof ADMIRALTY_CAPABILITIES)[number];
export type AdmiraltyScope = Readonly<{ scopeType: string; scopeId: string }>;
export type AdmiraltyRoleAssignment = Readonly<{
  role: string;
  scopeType: string;
  scopeId: string | null;
  revokedAt?: Date | string | null;
}>;
export type AdmiraltyAuthorizationDecision = Readonly<{
  allowed: boolean;
  capability: AdmiraltyCapabilityId | string;
  reason: "ROLE_CAPABILITY" | "UNKNOWN_CAPABILITY" | "NO_ACTIVE_ROLE" | "CAPABILITY_NOT_GRANTED" | "SCOPE_MISMATCH";
  roles: readonly string[];
  capabilities: readonly AdmiraltyCapabilityId[];
}>;

const capabilityIds = new Set<string>(ADMIRALTY_CAPABILITIES);
const roleCapabilities = new Map(
  roleRegistry.roles.map((role) => [
    role.id,
    role.capabilities.filter((capability): capability is AdmiraltyCapabilityId => capabilityIds.has(capability)),
  ]),
);

export function isAdmiraltyCapability(value: string): value is AdmiraltyCapabilityId {
  return capabilityIds.has(value);
}

function assignmentApplies(assignment: AdmiraltyRoleAssignment, scope?: AdmiraltyScope) {
  if (assignment.revokedAt) return false;
  if (assignment.scopeType === "GLOBAL" && !assignment.scopeId) return true;
  return Boolean(scope && assignment.scopeType === scope.scopeType && assignment.scopeId === scope.scopeId);
}

export function resolveAdmiraltyCapability(
  assignments: readonly AdmiraltyRoleAssignment[],
  capability: AdmiraltyCapabilityId | string,
  scope?: AdmiraltyScope,
): AdmiraltyAuthorizationDecision {
  if (!isAdmiraltyCapability(capability))
    return { allowed: false, capability, reason: "UNKNOWN_CAPABILITY", roles: [], capabilities: [] };

  const active = assignments.filter((assignment) => !assignment.revokedAt);
  const applicable = active.filter((assignment) => assignmentApplies(assignment, scope));
  const roles = [...new Set(applicable.map((assignment) => assignment.role))].sort();
  const capabilities = [
    ...new Set(roles.flatMap((role) => roleCapabilities.get(role) ?? [])),
  ].sort() as AdmiraltyCapabilityId[];
  if (!active.length) return { allowed: false, capability, reason: "NO_ACTIVE_ROLE", roles, capabilities };
  if (!applicable.length) return { allowed: false, capability, reason: "SCOPE_MISMATCH", roles, capabilities };
  return {
    allowed: capabilities.includes(capability),
    capability,
    reason: capabilities.includes(capability) ? "ROLE_CAPABILITY" : "CAPABILITY_NOT_GRANTED",
    roles,
    capabilities,
  };
}

export function roleCapabilityRegistry() {
  return roleRegistry;
}

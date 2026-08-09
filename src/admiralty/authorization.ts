import { requireWayfarerAccount, verifyWayfarerCsrf } from "@/wayfarer/http";
import { resolveAdmiraltyCapability, type AdmiraltyCapabilityId, type AdmiraltyScope } from "./capabilities";
import { AdmiraltyError } from "./errors";

type CanonicalSession = NonNullable<Awaited<ReturnType<typeof requireWayfarerAccount>>>;

export type AdmiraltyCurrentOperator = Readonly<{
  accountId: string;
  accountSessionId: string;
  displayName: string;
  roles: readonly string[];
  capabilities: readonly AdmiraltyCapabilityId[];
  csrfToken: string;
  sessionExpiresAt: Date;
  authorizationBasis: string;
}>;

export function operatorFromCanonicalSession(
  session: CanonicalSession,
  capability: AdmiraltyCapabilityId = "PLATFORM_OBSERVE",
  scope?: AdmiraltyScope,
) {
  const decision = resolveAdmiraltyCapability(session.account.roles, capability, scope);
  if (!decision.allowed)
    throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "Administrative access is not available.", 403);
  return {
    accountId: session.accountId,
    accountSessionId: session.id,
    displayName: session.account.profile?.displayName ?? "Voyagewright operator",
    roles: decision.roles,
    capabilities: decision.capabilities,
    csrfToken: session.csrfToken,
    sessionExpiresAt: session.expiresAt,
    authorizationBasis: `${decision.reason}:${decision.roles.join(",")}`,
  } satisfies AdmiraltyCurrentOperator;
}

export async function requireAdmiraltyOperator(
  capability: AdmiraltyCapabilityId = "PLATFORM_OBSERVE",
  options: { request?: Request; scope?: AdmiraltyScope } = {},
) {
  const session = await requireWayfarerAccount();
  if (!session) throw new AdmiraltyError("ADMIRALTY_AUTH_REQUIRED", "Sign in again to continue.", 401);
  if (options.request && !verifyWayfarerCsrf(session, options.request))
    throw new AdmiraltyError("ADMIRALTY_CSRF_INVALID", "The request could not be verified.", 403);
  return operatorFromCanonicalSession(session, capability, options.scope);
}

export const CURRENT_USER_CONTEXT_VERSION = "homeport.current-user.v1" as const;

export type HomeportCapability = "player" | "captain" | "creator" | "moderator" | "administrator";
export type HomeportWorkspace = "public" | "account" | "player" | "captain" | "creator" | "community";

export type CurrentUserCapabilities = Readonly<{
  canUsePlayer: boolean;
  canUseCaptain: boolean;
  canUseCreator: boolean;
  canModerate: boolean;
  isAdministrator: boolean;
}>;

type CurrentUserBase = Readonly<{
  contextVersion: typeof CURRENT_USER_CONTEXT_VERSION;
  authenticated: boolean;
}>;

export type AuthenticatedCurrentUser = CurrentUserBase &
  Readonly<{
    status: "authenticated";
    authenticated: true;
    user: {
      accountId: string;
      profileId?: string;
      displayName: string;
      initials: string;
      handle?: string;
    };
    capabilities: CurrentUserCapabilities;
    workspaces: readonly HomeportWorkspace[];
    session: { id: string; expiresAt: string };
    csrfToken: string;
    revision: string;
  }>;

export type CurrentUserContext =
  | AuthenticatedCurrentUser
  | (CurrentUserBase & { status: "anonymous"; authenticated: false })
  | (CurrentUserBase & { status: "expired" | "revoked" | "invalid"; authenticated: false })
  | (CurrentUserBase & {
      status: "restricted";
      authenticated: false;
      reason: "locked" | "suspended" | "account-status";
    })
  | (CurrentUserBase & {
      status: "unavailable";
      authenticated: false;
      correlationId: string;
      retryable: true;
    });

export type CurrentUserClientState = CurrentUserContext | { status: "loading"; authenticated: false };

export type CapabilityDecision =
  | { status: "allowed"; context: AuthenticatedCurrentUser }
  | { status: "auth-required" }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "invalid" }
  | { status: "permission-denied"; capability: HomeportCapability; context: AuthenticatedCurrentUser }
  | { status: "account-restricted"; reason: "locked" | "suspended" | "account-status" }
  | { status: "unavailable"; correlationId: string; retryable: true };

export const anonymousCurrentUser: CurrentUserContext = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "anonymous",
  authenticated: false,
};

export function capabilityAllowed(context: AuthenticatedCurrentUser, capability: HomeportCapability) {
  switch (capability) {
    case "player":
      return context.capabilities.canUsePlayer;
    case "captain":
      return context.capabilities.canUseCaptain;
    case "creator":
      return context.capabilities.canUseCreator;
    case "moderator":
      return context.capabilities.canModerate;
    case "administrator":
      return context.capabilities.isAdministrator;
  }
}

export function decideCapability(context: CurrentUserContext, capability: HomeportCapability): CapabilityDecision {
  switch (context.status) {
    case "authenticated":
      return capabilityAllowed(context, capability)
        ? { status: "allowed", context }
        : { status: "permission-denied", capability, context };
    case "anonymous":
      return { status: "auth-required" };
    case "expired":
      return { status: "expired" };
    case "revoked":
    case "invalid":
      return { status: context.status };
    case "restricted":
      return { status: "account-restricted", reason: context.reason };
    case "unavailable":
      return { status: "unavailable", correlationId: context.correlationId, retryable: true };
  }
}

export function isCurrentUserContext(value: unknown): value is CurrentUserContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CurrentUserContext>;
  if (candidate.contextVersion !== CURRENT_USER_CONTEXT_VERSION || typeof candidate.status !== "string") return false;
  if (candidate.status === "authenticated") {
    const authenticated = candidate as Partial<AuthenticatedCurrentUser>;
    return Boolean(
      authenticated.authenticated === true &&
        authenticated.user &&
        typeof authenticated.user.displayName === "string" &&
        authenticated.capabilities &&
        authenticated.session &&
        typeof authenticated.csrfToken === "string" &&
        typeof authenticated.revision === "string",
    );
  }
  return ["anonymous", "expired", "revoked", "invalid", "restricted", "unavailable"].includes(candidate.status);
}

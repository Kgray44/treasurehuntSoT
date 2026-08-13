import type { CurrentUserClientState } from "@/homeport/current-user";

export type WorkspaceId = "public" | "player" | "captain" | "creator" | "account" | "community" | "development";

export type ShellMode =
  | "GATEWAY_STANDARD"
  | "PUBLIC_STANDARD"
  | "WORKSPACE_STANDARD"
  | "COMPACT"
  | "IMMERSIVE"
  | "AUTHENTICATION"
  | "TOKENIZED"
  | "DEVELOPMENT";

export type NavigationLayer = "GLOBAL" | "WORKSPACE" | "ACCOUNT" | "CONTEXTUAL";
export type NavigationPresentation = "desktop" | "mobile";
export type NavigationCapability = "player" | "captain" | "creator" | "moderator" | "administrator" | "admiralty";
export type NavigationOwner =
  | "project-homeport"
  | "true-north"
  | "wayfarer"
  | "one-voyage"
  | "harborlight"
  | "sealed-hold"
  | "admiralty"
  | "tideglass";
export type NavigationPlacement = "primary" | "drawer" | "account" | "contextual" | "hidden";
export type NavigationStatus = "active" | "contextual" | "compatibility" | "development";
export type AccountGroup = "identity" | "personal" | "workspace" | "action";

export type ActiveMatchPolicy =
  | Readonly<{ type: "EXACT" }>
  | Readonly<{ type: "SECTION" }>
  | Readonly<{ type: "DYNAMIC_FAMILY"; pattern: string }>
  | Readonly<{ type: "ALIAS_OF"; canonicalItemId: string; pattern: string }>
  | Readonly<{ type: "NEVER_ACTIVE" }>;

export type NavigationProjectionContext = Readonly<{
  pathname: string;
  shellMode: ShellMode;
  currentUser: CurrentUserClientState;
  workspace: WorkspaceId;
  presentation: NavigationPresentation;
}>;

export type NavigationHrefResolver = (context: NavigationProjectionContext) => string;

export type NavigationItem = Readonly<{
  id: string;
  layer: NavigationLayer;
  label: string;
  shortLabel?: string;
  href: string | NavigationHrefResolver | null;
  description?: string;
  owner: NavigationOwner;
  requiredCapabilities?: readonly NavigationCapability[];
  requiresAuthentication?: boolean;
  anonymousOnly?: boolean;
  authenticatedOnly?: boolean;
  shellModes: readonly ShellMode[];
  desktop: NavigationPlacement;
  mobile: NavigationPlacement;
  activeMatch: ActiveMatchPolicy;
  parentId?: string;
  accountGroup?: AccountGroup;
  contextPatterns?: readonly string[];
  action?: "sign-out";
  order: number;
  currentStatus: NavigationStatus;
}>;

export type ProjectedNavigationItem = Omit<NavigationItem, "href"> & Readonly<{ href: string | null }>;

export type RouteShellDefinition = Readonly<{
  id: string;
  pattern: string;
  workspace: WorkspaceId;
  shellMode: ShellMode;
  owner: NavigationOwner;
  reason: string;
  canonicalRoute?: string;
  exitTarget?: string;
  activeFamily?: string;
}>;

export type NavigationProjection = Readonly<{
  globalItems: readonly ProjectedNavigationItem[];
  workspaceItems: readonly ProjectedNavigationItem[];
  accountItems: readonly ProjectedNavigationItem[];
  contextualItems: readonly ProjectedNavigationItem[];
  activeGlobalItem: ProjectedNavigationItem | null;
  activeWorkspaceItem: ProjectedNavigationItem | null;
  activeAccountItem: ProjectedNavigationItem | null;
  availableWorkspaceItems: readonly ProjectedNavigationItem[];
  functionalDestinationIds: readonly string[];
}>;

/** Bounded compatibility response for the legacy `/api/shell/context` reader. */
export type ShellContext = Readonly<{
  authenticated: boolean;
  canUsePlayer: boolean;
  canUseCaptain: boolean;
  canUseCreator: boolean;
  isAdministrator: boolean;
  profile: Readonly<{ displayName: string; initials: string; handle?: string }> | null;
}>;

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceId;
  label: string;
  homeHref: string;
}>;

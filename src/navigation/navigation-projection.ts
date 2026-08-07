import { navigationRegistry } from "./registry";
import { activeNavigationItem, resolveAliasTarget, routePatternMatches } from "./route-matching";
import type {
  NavigationCapability,
  NavigationItem,
  NavigationLayer,
  NavigationProjection,
  NavigationProjectionContext,
  ProjectedNavigationItem,
} from "./types";

function hasCapability(capability: NavigationCapability, context: NavigationProjectionContext) {
  if (context.currentUser.status !== "authenticated") return false;
  switch (capability) {
    case "player":
      return context.currentUser.capabilities.canUsePlayer;
    case "captain":
      return context.currentUser.capabilities.canUseCaptain;
    case "creator":
      return context.currentUser.capabilities.canUseCreator;
    case "moderator":
      return context.currentUser.capabilities.canModerate;
    case "administrator":
      return context.currentUser.capabilities.isAdministrator;
  }
}

function resolvesForUser(item: NavigationItem, context: NavigationProjectionContext) {
  const authenticated = context.currentUser.status === "authenticated";
  const anonymousAccountState = ["anonymous", "expired", "revoked", "invalid"].includes(context.currentUser.status);
  if (item.requiresAuthentication && !authenticated) return false;
  if (item.authenticatedOnly && !authenticated) return false;
  if (item.anonymousOnly && !anonymousAccountState) return false;
  return (item.requiredCapabilities ?? []).every((capability) => hasCapability(capability, context));
}

function hasPlacement(item: NavigationItem, context: NavigationProjectionContext) {
  const placement = context.presentation === "desktop" ? item.desktop : item.mobile;
  return placement !== "hidden";
}

function matchesContext(item: NavigationItem, pathname: string) {
  if (!item.contextPatterns) return true;
  return item.contextPatterns.some((pattern) => routePatternMatches(pathname, pattern));
}

function resolveItem(item: NavigationItem, context: NavigationProjectionContext): ProjectedNavigationItem {
  return { ...item, href: typeof item.href === "function" ? item.href(context) : item.href };
}

function layerItems(layer: NavigationLayer, context: NavigationProjectionContext) {
  return navigationRegistry
    .filter((item) => item.layer === layer)
    .filter((item) =>
      (item.shellModes as readonly NavigationProjectionContext["shellMode"][]).includes(context.shellMode),
    )
    .filter((item) => hasPlacement(item, context))
    .filter((item) => resolvesForUser(item, context))
    .filter((item) => matchesContext(item, context.pathname))
    .map((item) => resolveItem(item, context))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function activeWithAlias(pathname: string, items: readonly ProjectedNavigationItem[]) {
  const aliasTarget = resolveAliasTarget(pathname, navigationRegistry);
  if (aliasTarget) return items.find((item) => item.id === aliasTarget) ?? null;
  return activeNavigationItem(pathname, items);
}

export function projectNavigation(context: NavigationProjectionContext): NavigationProjection {
  const globalItems = layerItems("GLOBAL", context);
  const workspaceItems = layerItems("WORKSPACE", context).filter((item) => {
    if (context.workspace === "account") return false;
    if (context.workspace === "community" || context.workspace === "public" || context.workspace === "development")
      return false;
    return item.id.startsWith(`workspace-${context.workspace}-`);
  });
  const accountItems = layerItems("ACCOUNT", context);
  const contextualItems = layerItems("CONTEXTUAL", context);
  const availableWorkspaceItems = accountItems.filter((item) => item.accountGroup === "workspace");
  const allFunctional = [...globalItems, ...workspaceItems, ...accountItems, ...contextualItems]
    .filter((item) => item.href !== null)
    .map((item) => item.id);

  return {
    globalItems,
    workspaceItems,
    accountItems,
    contextualItems,
    activeGlobalItem: activeWithAlias(context.pathname, globalItems),
    activeWorkspaceItem: activeWithAlias(context.pathname, workspaceItems),
    activeAccountItem: activeWithAlias(context.pathname, accountItems),
    availableWorkspaceItems,
    functionalDestinationIds: [...new Set(allFunctional)].sort(),
  };
}

export function functionalDestinationIds(context: NavigationProjectionContext) {
  return projectNavigation(context).functionalDestinationIds;
}

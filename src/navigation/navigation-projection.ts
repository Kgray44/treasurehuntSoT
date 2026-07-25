import { activeNavigationItem } from "./route-matching";
import { workspaceRegistry } from "./registry";
import type { NavigationItem, ShellCapabilities, ShellMode, WorkspaceId } from "./types";

function hasCapability(item: NavigationItem, capabilities: ShellCapabilities) {
  if (!item.authenticated && !item.capability) return true;
  if (!capabilities.authenticated) return false;
  switch (item.capability) {
    case "player":
      return capabilities.canUsePlayer;
    case "captain":
      return capabilities.canUseCaptain;
    case "creator":
      return capabilities.canUseCreator;
    case "administrator":
      return capabilities.isAdministrator;
    default:
      return true;
  }
}

export function projectWorkspaceNavigation(
  workspace: WorkspaceId,
  capabilities: ShellCapabilities,
  shellMode: ShellMode,
): readonly NavigationItem[] {
  return workspaceRegistry[workspace].items
    .filter((item) => hasCapability(item, capabilities))
    .filter(
      (item) =>
        shellMode !== "immersive-player" || item.immersivePolicy === "compact" || item.immersivePolicy === "visible",
    )
    .sort((left, right) => left.desktopOrder - right.desktopOrder || left.id.localeCompare(right.id));
}

export function resolveActiveWorkspaceItem(pathname: string, items: readonly NavigationItem[]) {
  return activeNavigationItem(pathname, items);
}

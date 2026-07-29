export type WorkspaceId = "public" | "player" | "captain" | "creator" | "account" | "community";

export type ShellMode =
  | "standard"
  | "compact"
  | "immersive-player"
  | "immersive-captain"
  | "authentication"
  | "gateway";

export type NavigationLevel = "universal" | "workspace" | "context";

export type NavigationMatch = { type: "exact" } | { type: "prefix" } | { type: "pattern"; pattern: string };

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  aliases?: readonly string[];
  match: NavigationMatch;
  capability?: "player" | "captain" | "creator" | "administrator";
  authenticated?: boolean;
  iconKey?: string;
  badgeKey?: string;
  desktopOrder: number;
  mobileOrder: number;
  immersivePolicy?: "visible" | "compact" | "hidden";
}>;

export type RouteShellDefinition = Readonly<{
  id: string;
  pattern: string;
  workspace: WorkspaceId;
  shellMode: ShellMode;
  context?: string;
  canonicalRoute?: string;
}>;

export type ShellCapabilities = Readonly<{
  authenticated: boolean;
  canUsePlayer: boolean;
  canUseCaptain: boolean;
  canUseCreator: boolean;
  isAdministrator: boolean;
}>;

export type ShellProfile = Readonly<{
  displayName: string;
  initials: string;
  handle?: string;
}>;

export type ShellContext = Readonly<
  ShellCapabilities & {
    profile: ShellProfile | null;
  }
>;

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceId;
  label: string;
  homeHref: string;
  items: readonly NavigationItem[];
}>;

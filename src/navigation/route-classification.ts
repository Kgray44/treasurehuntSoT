import type { RouteShellDefinition, ShellMode, WorkspaceId } from "./types";
import { routePatternMatches } from "./route-matching";

export const routeShellDefinitions: readonly RouteShellDefinition[] = [
  { id: "gateway", pattern: "/", workspace: "public", shellMode: "gateway" },
  { id: "account-security", pattern: "/account/*", workspace: "account", shellMode: "standard" },
  { id: "passport", pattern: "/passport", workspace: "account", shellMode: "standard" },
  { id: "auth", pattern: "/sign-in", workspace: "public", shellMode: "authentication" },
  { id: "auth-player", pattern: "/player/sign-in", workspace: "player", shellMode: "authentication" },
  { id: "auth-captain", pattern: "/captain/sign-in", workspace: "captain", shellMode: "authentication" },
  { id: "auth-studio", pattern: "/studio/sign-in", workspace: "creator", shellMode: "authentication" },
  { id: "auth-register", pattern: "/register", workspace: "public", shellMode: "authentication" },
  { id: "auth-reset", pattern: "/forgot-password", workspace: "public", shellMode: "authentication" },
  { id: "auth-reset-confirm", pattern: "/reset-password", workspace: "public", shellMode: "authentication" },
  { id: "auth-verification", pattern: "/verify-email", workspace: "public", shellMode: "authentication" },
  {
    id: "immersive-player-journal",
    pattern: "/player/playthroughs/:id/journal",
    workspace: "player",
    shellMode: "immersive-player",
  },
  {
    id: "immersive-player-voyage",
    pattern: "/player/playthroughs/:id",
    workspace: "player",
    shellMode: "immersive-player",
  },
  {
    id: "immersive-player-session",
    pattern: "/play/:slug/session/:id",
    workspace: "player",
    shellMode: "immersive-player",
  },
  {
    id: "compact-quartermaster",
    pattern: "/quartermaster",
    workspace: "captain",
    shellMode: "compact",
    canonicalRoute: "/captain/library",
  },
  {
    id: "compact-quartermaster-workspace",
    pattern: "/quartermaster/:workspace",
    workspace: "captain",
    shellMode: "compact",
    canonicalRoute: "/captain/library",
  },
  { id: "compact-captain-session", pattern: "/captain/sessions/:id", workspace: "captain", shellMode: "compact" },
  { id: "community", pattern: "/community/*", workspace: "community", shellMode: "standard" },
  { id: "community-root", pattern: "/community", workspace: "community", shellMode: "standard" },
  { id: "captain", pattern: "/captain/*", workspace: "captain", shellMode: "standard" },
  {
    id: "captain-root",
    pattern: "/captain",
    workspace: "captain",
    shellMode: "standard",
    canonicalRoute: "/captain/library",
  },
  { id: "creator", pattern: "/studio/*", workspace: "creator", shellMode: "standard" },
  {
    id: "creator-root",
    pattern: "/studio",
    workspace: "creator",
    shellMode: "standard",
    canonicalRoute: "/studio/library",
  },
  { id: "player", pattern: "/player/*", workspace: "player", shellMode: "standard" },
  { id: "player-root", pattern: "/player", workspace: "player", shellMode: "standard" },
  { id: "dev", pattern: "/dev/*", workspace: "public", shellMode: "compact" },
];

const rank = (definition: RouteShellDefinition) => definition.pattern.replace(/[:*][^/]*/g, "").length;

export function classifyRoute(pathname: string): RouteShellDefinition {
  const matches = routeShellDefinitions.filter((definition) => routePatternMatches(pathname, definition.pattern));
  return (
    [...matches].sort((left, right) => rank(right) - rank(left))[0] ?? {
      id: "public-default",
      pattern: "*",
      workspace: "public" as WorkspaceId,
      shellMode: "standard" as ShellMode,
    }
  );
}

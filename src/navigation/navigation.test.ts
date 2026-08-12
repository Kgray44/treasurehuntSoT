import { describe, expect, it } from "vitest";
import { CURRENT_USER_CONTEXT_VERSION, type CurrentUserClientState } from "@/homeport/current-user";
import {
  allNavigationItems,
  classifyRoute,
  functionalDestinationIds,
  navigationItemMatches,
  navigationRegistry,
  projectNavigation,
  routeShellDefinitions,
  type NavigationPresentation,
  type ShellMode,
  type WorkspaceId,
} from ".";

const anonymous: CurrentUserClientState = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "anonymous",
  authenticated: false,
};

const loading: CurrentUserClientState = { status: "loading", authenticated: false };

const unavailable: CurrentUserClientState = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "unavailable",
  authenticated: false,
  correlationId: "test-unavailable",
  retryable: true,
};

const restricted: CurrentUserClientState = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "restricted",
  authenticated: false,
  reason: "suspended",
};

function authenticated(
  capabilities: Partial<{
    canUsePlayer: boolean;
    canUseCaptain: boolean;
    canUseCreator: boolean;
    canModerate: boolean;
    isAdministrator: boolean;
    canUseAdmiralty: boolean;
  }> = {},
  handle: string | null = "mara",
): CurrentUserClientState {
  return {
    contextVersion: CURRENT_USER_CONTEXT_VERSION,
    status: "authenticated",
    authenticated: true,
    user: {
      accountId: "account-test",
      profileId: "profile-test",
      displayName: "Mara Tide",
      initials: "MT",
      ...(handle ? { handle } : {}),
    },
    capabilities: {
      canUsePlayer: false,
      canUseCaptain: false,
      canUseCreator: false,
      canModerate: false,
      isAdministrator: false,
      ...capabilities,
    },
    emailVerification: { status: "verified" },
    workspaces: ["public", "account"],
    session: { id: "session-test", expiresAt: "2030-01-01T00:00:00.000Z" },
    csrfToken: "csrf-test",
    revision: "revision-test",
  };
}

function projection(
  pathname: string,
  shellMode: ShellMode,
  workspace: WorkspaceId,
  currentUser: CurrentUserClientState,
  presentation: NavigationPresentation = "desktop",
) {
  return projectNavigation({ pathname, shellMode, workspace, currentUser, presentation });
}

describe("Homeport Phase 2 navigation authority", () => {
  it("homeport.navigation.one-authority has unique stable IDs, governed layers, owners, and placements", () => {
    expect(new Set(allNavigationItems.map((item) => item.id)).size).toBe(allNavigationItems.length);
    expect(new Set(allNavigationItems.map((item) => item.layer))).toEqual(
      new Set(["GLOBAL", "WORKSPACE", "ACCOUNT", "CONTEXTUAL"]),
    );
    for (const item of navigationRegistry) {
      expect(item.id).toMatch(/^[a-z][a-z0-9-]+$/u);
      expect(item.label.trim()).not.toBe("");
      expect(item.owner).toBeTruthy();
      expect(item.shellModes.length).toBeGreaterThan(0);
      expect(item.desktop).toBeTruthy();
      expect(item.mobile).toBeTruthy();
      if (typeof item.href === "string") expect(item.href).toMatch(/^\//u);
    }
    expect(navigationRegistry.filter((item) => item.id === "global-community-harbor")).toHaveLength(1);
  });

  it("homeport.shell.mode-classification represents all eight modes and keeps APIs out of the page registry", () => {
    const cases: Array<[string, ShellMode]> = [
      ["/", "GATEWAY_STANDARD"],
      ["/tales", "PUBLIC_STANDARD"],
      ["/community/guides/example", "PUBLIC_STANDARD"],
      ["/player/library", "WORKSPACE_STANDARD"],
      ["/captain/sessions/session-1", "COMPACT"],
      ["/player/playthroughs/voyage-1/journal", "IMMERSIVE"],
      ["/sign-in", "AUTHENTICATION"],
      ["/player/sign-in", "AUTHENTICATION"],
      ["/reset-password", "TOKENIZED"],
      ["/player/invitation", "TOKENIZED"],
      ["/dev/animations", "DEVELOPMENT"],
    ];
    for (const [pathname, mode] of cases) expect(classifyRoute(pathname).shellMode).toBe(mode);
    expect(new Set(routeShellDefinitions.map((definition) => definition.shellMode))).toEqual(
      new Set([
        "GATEWAY_STANDARD",
        "PUBLIC_STANDARD",
        "WORKSPACE_STANDARD",
        "COMPACT",
        "IMMERSIVE",
        "AUTHENTICATION",
        "TOKENIZED",
        "DEVELOPMENT",
      ]),
    );
    expect(routeShellDefinitions.some((definition) => definition.pattern.startsWith("/api"))).toBe(false);
    expect(
      routeShellDefinitions
        .filter((definition) => definition.shellMode === "COMPACT" || definition.shellMode === "IMMERSIVE")
        .every((definition) => definition.exitTarget?.startsWith("/")),
    ).toBe(true);
  });

  it("homeport.shell.gateway-anonymous-state projects global destinations and only anonymous account actions", () => {
    const result = projection("/", "GATEWAY_STANDARD", "public", anonymous);
    expect(result.globalItems.map((item) => [item.id, item.label])).toEqual([
      ["global-home", "Home"],
      ["global-explore-chronicles", "Explore Chronicles"],
      ["global-community-harbor", "Community Harbor"],
    ]);
    expect(result.accountItems.map((item) => item.id)).toEqual([
      "account-create",
      "account-sign-in",
      "account-forgot-password",
    ]);
    expect(result.activeGlobalItem?.id).toBe("global-home");
    expect(result.workspaceItems).toEqual([]);
  });

  it("homeport.shell.account-loading and context-unavailable never project anonymous or capability items", () => {
    for (const state of [loading, unavailable, restricted]) {
      const result = projection("/player/library", "WORKSPACE_STANDARD", "player", state);
      expect(result.globalItems.map((item) => item.id)).toEqual([
        "global-home",
        "global-explore-chronicles",
        "global-community-harbor",
      ]);
      expect(result.accountItems).toEqual([]);
      expect(result.workspaceItems).toEqual([]);
    }
  });

  it("homeport.navigation.permission-aware projects only server-granted workspace capabilities", () => {
    const player = projection("/player/library", "WORKSPACE_STANDARD", "player", authenticated({ canUsePlayer: true }));
    expect(player.workspaceItems.map((item) => item.id)).toEqual(["workspace-player-home"]);
    expect(player.availableWorkspaceItems.map((item) => item.id)).toEqual([
      "account-all-workspaces",
      "account-workspace-player",
    ]);

    const full = projection(
      "/captain/library",
      "WORKSPACE_STANDARD",
      "captain",
      authenticated({ canUsePlayer: true, canUseCaptain: true, canUseCreator: true, canModerate: true }),
    );
    expect(full.workspaceItems.map((item) => item.id)).toEqual([
      "workspace-captain-voyages",
      "workspace-captain-invitations",
    ]);
    expect(full.availableWorkspaceItems.map((item) => item.id)).toEqual([
      "account-all-workspaces",
      "account-workspace-player",
      "account-workspace-captain",
      "account-workspace-creator",
      "account-workspace-moderator",
    ]);
    expect(full.workspaceItems.find((item) => item.id === "workspace-captain-invitations")?.href).toBe(
      "/captain/library?tab=invitations",
    );
  });

  it("homeport.navigation.no-client-authority does not derive capabilities from protected pathnames", () => {
    const result = projection("/studio/library", "WORKSPACE_STANDARD", "creator", anonymous);
    expect(result.workspaceItems).toEqual([]);
    expect(result.accountItems.some((item) => item.id.includes("workspace"))).toBe(false);
  });

  it("homeport.navigation.personal-harbor-entry is role-neutral and never exposes private identity data", () => {
    const withHandle = projection(
      "/player/library",
      "WORKSPACE_STANDARD",
      "player",
      authenticated({ canUsePlayer: true }),
    );
    expect(withHandle.accountItems.find((item) => item.id === "account-view-profile")?.href).toBe(
      "/account/profile/view",
    );

    const withoutHandle = projection(
      "/player/library",
      "WORKSPACE_STANDARD",
      "player",
      authenticated({ canUsePlayer: true }, null),
    );
    expect(withoutHandle.accountItems.find((item) => item.id === "account-view-profile")?.href).toBe(
      "/account/profile/view",
    );
    expect(JSON.stringify(withoutHandle.accountItems)).not.toContain("email");
  });

  it("homeport.navigation.personal-destination-reachability maps every governed personal item to a real current route", () => {
    const result = projection("/passport", "WORKSPACE_STANDARD", "account", authenticated({ canUsePlayer: true }));
    expect(
      result.accountItems.filter((item) => item.accountGroup === "personal").map((item) => [item.id, item.href]),
    ).toEqual([
      ["account-personal-harbor", "/account"],
      ["account-passport", "/passport"],
      ["account-preferences", "/account/preferences"],
      ["account-privacy", "/account/privacy"],
      ["account-history", "/passport/history"],
      ["account-artifacts", "/passport/artifacts"],
      ["account-security-sessions", "/account/security"],
      ["account-sessions", "/account/sessions"],
      ["account-support-access", "/account/support-access"],
    ]);
  });

  it("homeport.navigation.desktop-mobile-set-equality preserves functional IDs for equivalent state", () => {
    const state = authenticated({
      canUsePlayer: true,
      canUseCaptain: true,
      canUseCreator: true,
      canModerate: true,
      isAdministrator: true,
    });
    const input = {
      pathname: "/player/library",
      shellMode: "WORKSPACE_STANDARD" as const,
      workspace: "player" as const,
      currentUser: state,
    };
    expect(functionalDestinationIds({ ...input, presentation: "desktop" })).toEqual(
      functionalDestinationIds({ ...input, presentation: "mobile" }),
    );
  });

  it("projects Admiralty only for an explicitly authorized operator", () => {
    const ordinary = projection("/account", "WORKSPACE_STANDARD", "account", authenticated());
    const operator = projection("/account", "WORKSPACE_STANDARD", "account", authenticated({ canUseAdmiralty: true }));
    expect(ordinary.accountItems.some((item) => item.id === "account-workspace-admiralty")).toBe(false);
    expect(operator.accountItems.find((item) => item.id === "account-workspace-admiralty")?.href).toBe("/admin");
    expect(classifyRoute("/admin/people/account-1")).toMatchObject({ owner: "admiralty", shellMode: "TOKENIZED" });
  });

  it("homeport.shell.active-state handles exact, section, dynamic, aliases, and false prefixes", () => {
    expect(projection("/community", "PUBLIC_STANDARD", "community", anonymous).activeGlobalItem?.id).toBe(
      "global-community-harbor",
    );
    expect(projection("/community/artifacts", "PUBLIC_STANDARD", "community", anonymous).activeGlobalItem?.id).toBe(
      "global-community-harbor",
    );
    expect(projection("/tales", "PUBLIC_STANDARD", "public", anonymous).activeGlobalItem?.id).toBe(
      "global-explore-chronicles",
    );
    expect(
      projection("/player", "WORKSPACE_STANDARD", "player", authenticated({ canUsePlayer: true })).activeWorkspaceItem
        ?.id,
    ).toBe("workspace-player-home");
    expect(
      projection("/captain", "WORKSPACE_STANDARD", "captain", authenticated({ canUseCaptain: true }))
        .activeWorkspaceItem?.id,
    ).toBe("workspace-captain-voyages");
    expect(navigationItemMatches("/player-sign-in", { href: "/player", activeMatch: { type: "SECTION" } })).toBe(false);
    expect(projection("/captain/sign-in", "AUTHENTICATION", "captain", anonymous).activeWorkspaceItem).toBeNull();
  });

  it("homeport.navigation.contextual-parent provides stable Community, personal, compact, immersive, and development exits", () => {
    expect(projection("/community/guides/example", "PUBLIC_STANDARD", "community", anonymous).contextualItems).toEqual(
      [],
    );
    expect(
      projection("/profile/mara", "PUBLIC_STANDARD", "account", authenticated()).contextualItems.map(
        (item) => item.href,
      ),
    ).toEqual(["/account"]);
    for (const ordinaryPersonalRoute of [
      "/account",
      "/account/personal-information",
      "/account/preferences",
      "/account/privacy",
      "/account/security",
      "/account/data",
      "/passport",
      "/passport/history",
      "/passport/artifacts",
    ]) {
      expect(projection(ordinaryPersonalRoute, "PUBLIC_STANDARD", "account", authenticated()).contextualItems).toEqual(
        [],
      );
    }
    expect(
      projection(
        "/captain/sessions/session-1",
        "COMPACT",
        "captain",
        authenticated({ canUseCaptain: true }),
      ).contextualItems.map((item) => item.href),
    ).toEqual(["/captain/library"]);
    expect(
      projection(
        "/player/playthroughs/voyage-1/journal",
        "IMMERSIVE",
        "player",
        authenticated({ canUsePlayer: true }),
      ).contextualItems.map((item) => item.href),
    ).toEqual(["/player/library"]);
    expect(projection("/dev/animations", "DEVELOPMENT", "development", anonymous).contextualItems[0]?.href).toBe("/");
  });
});

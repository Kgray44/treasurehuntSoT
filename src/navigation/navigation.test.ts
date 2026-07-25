import { describe, expect, it } from "vitest";
import {
  activeNavigationItem,
  allNavigationItems,
  classifyRoute,
  enabledNavigationExtensions,
  projectWorkspaceNavigation,
  workspaceRegistry,
  type ShellCapabilities,
} from ".";

const anonymous: ShellCapabilities = {
  authenticated: false,
  canUsePlayer: false,
  canUseCaptain: false,
  canUseCreator: false,
  isAdministrator: false,
};

const combined: ShellCapabilities = {
  authenticated: true,
  canUsePlayer: true,
  canUseCaptain: true,
  canUseCreator: true,
  isAdministrator: false,
};

describe("True North navigation registry", () => {
  it("keeps IDs unique and ordering deterministic", () => {
    expect(new Set(allNavigationItems.map((item) => item.id)).size).toBe(allNavigationItems.length);
    for (const workspace of Object.values(workspaceRegistry)) {
      const projection = projectWorkspaceNavigation(workspace.id, combined, "standard");
      expect(projection.map((item) => item.desktopOrder)).toEqual(
        [...projection.map((item) => item.desktopOrder)].sort((a, b) => a - b),
      );
      expect(projection.map((item) => item.label)).toEqual(
        projectWorkspaceNavigation(workspace.id, combined, "standard").map((item) => item.label),
      );
    }
  });

  it("classifies account, Community, Captain, and immersive Player routes explicitly", () => {
    expect(classifyRoute("/passport")).toMatchObject({ workspace: "account", shellMode: "standard" });
    expect(classifyRoute("/account/security")).toMatchObject({ workspace: "account", shellMode: "standard" });
    expect(classifyRoute("/community/districts/guides")).toMatchObject({
      workspace: "community",
      shellMode: "standard",
    });
    expect(classifyRoute("/quartermaster")).toMatchObject({ workspace: "captain", shellMode: "compact" });
    expect(classifyRoute("/player/playthroughs/voyage-1/journal")).toMatchObject({
      workspace: "player",
      shellMode: "immersive-player",
    });
  });

  it("projects the same Player definitions to desktop and mobile while hiding prohibited immersive destinations", () => {
    const standard = projectWorkspaceNavigation("player", combined, "standard");
    const immersive = projectWorkspaceNavigation("player", combined, "immersive-player");
    expect(standard.map((item) => item.label)).toEqual(["My Voyages", "Explore Chronicles", "Chronicle Passport"]);
    expect(immersive.map((item) => item.label)).toEqual(["My Voyages", "Chronicle Passport"]);
    expect(immersive.some((item) => item.href.startsWith("/captain") || item.href.startsWith("/studio"))).toBe(false);
    expect(immersive.map((item) => item.desktopOrder)).toEqual(immersive.map((item) => item.mobileOrder));
  });

  it("filters capability-protected entries and resolves aliases to a stable active owner", () => {
    expect(projectWorkspaceNavigation("captain", anonymous, "standard")).toHaveLength(1);
    const captainItems = projectWorkspaceNavigation("captain", combined, "standard");
    expect(activeNavigationItem("/captain", captainItems)?.id).toBe("captain-voyages");
    expect(activeNavigationItem("/captain/invitations", captainItems)?.id).toBe("captain-invitations");
    expect(classifyRoute("/captain").canonicalRoute).toBe("/captain/library");
  });

  it("keeps unavailable Community and private-operations destinations disabled rather than inventing links", () => {
    expect(enabledNavigationExtensions()).toEqual([]);
    expect(workspaceRegistry.creator.items.some((item) => item.href.endsWith("/operations"))).toBe(false);
  });
});

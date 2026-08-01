import { describe, expect, it } from "vitest";
import { CURRENT_USER_CONTEXT_VERSION, type AuthenticatedCurrentUser } from "./current-user";
import { authorizedReturnTo, safeReturnTo } from "./return-to";

const playerContext: AuthenticatedCurrentUser = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "authenticated",
  authenticated: true,
  user: { accountId: "account-1", profileId: "profile-1", displayName: "Mara", initials: "M" },
  capabilities: {
    canUsePlayer: true,
    canUseCaptain: false,
    canUseCreator: false,
    canModerate: false,
    isAdministrator: false,
  },
  workspaces: ["public", "account", "community", "player"],
  session: { id: "session-1", expiresAt: new Date(Date.now() + 60_000).toISOString() },
  csrfToken: "csrf",
  revision: "revision-1",
};

describe("Project Homeport safe return contract", () => {
  it("homeport.return-to.safe accepts one local relative destination", () => {
    expect(safeReturnTo("/player/library?view=active#top", "/fallback")).toBe("/player/library?view=active#top");
  });

  it.each([
    "https://attacker.invalid/path",
    "//attacker.invalid/path",
    "javascript:alert(1)",
    "/\\attacker.invalid",
    "/%2fattacker.invalid",
    "/%252f%252fattacker.invalid",
    "/%3Ajavascript",
    "/path\u0000tail",
    `/${"a".repeat(2050)}`,
  ])("homeport.return-to.safe rejects unsafe value %s", (value) => {
    expect(safeReturnTo(value, "/fallback")).toBe("/fallback");
  });

  it("homeport.current-user.no-client-authority rejects a server-denied workspace return", () => {
    expect(authorizedReturnTo("/captain/library", playerContext, "/player/library")).toBe("/player/library");
    expect(authorizedReturnTo("/player/library", playerContext, "/")).toBe("/player/library");
  });
});

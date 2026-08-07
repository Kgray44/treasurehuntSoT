import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_USER_CONTEXT_VERSION } from "@/homeport/current-user";
import { GET } from "./route";

const resolveCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/homeport/current-user.server", () => ({ resolveCurrentUser }));

describe("GET /api/shell/context compatibility projection", () => {
  beforeEach(() => resolveCurrentUser.mockReset());

  it("returns the anonymous projection without canonical authentication", async () => {
    resolveCurrentUser.mockResolvedValue({
      contextVersion: CURRENT_USER_CONTEXT_VERSION,
      status: "anonymous",
      authenticated: false,
    });
    expect(await (await GET()).json()).toEqual({
      authenticated: false,
      canUsePlayer: false,
      canUseCaptain: false,
      canUseCreator: false,
      isAdministrator: false,
      profile: null,
    });
  });

  it("returns the bounded legacy shell shape from canonical context", async () => {
    resolveCurrentUser.mockResolvedValue({
      contextVersion: CURRENT_USER_CONTEXT_VERSION,
      status: "authenticated",
      authenticated: true,
      user: { accountId: "hidden", profileId: "hidden", displayName: "Mara Tide", initials: "MT", handle: "mara" },
      capabilities: {
        canUsePlayer: true,
        canUseCaptain: true,
        canUseCreator: true,
        canModerate: false,
        isAdministrator: false,
      },
      workspaces: ["public", "account", "player", "captain", "creator"],
      session: { id: "hidden", expiresAt: "2030-01-01T00:00:00.000Z" },
      csrfToken: "hidden",
    });
    const body = await (await GET()).json();
    expect(body).toEqual({
      authenticated: true,
      canUsePlayer: true,
      canUseCaptain: true,
      canUseCreator: true,
      isAdministrator: false,
      profile: { displayName: "Mara Tide", initials: "MT", handle: "mara" },
    });
    expect(JSON.stringify(body)).not.toMatch(/session|token|csrf|accountId|email|provider/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireWayfarerAccount = vi.hoisted(() => vi.fn());
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount }));

describe("GET /api/shell/context", () => {
  beforeEach(() => requireWayfarerAccount.mockReset());

  it("returns the anonymous projection without a profile", async () => {
    requireWayfarerAccount.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: false,
      canUsePlayer: false,
      canUseCaptain: false,
      canUseCreator: false,
      isAdministrator: false,
      profile: null,
    });
  });

  it("returns bounded presentation and capability booleans without sensitive session fields", async () => {
    requireWayfarerAccount.mockResolvedValue({
      id: "session-should-not-leak",
      csrfToken: "csrf-should-not-leak",
      accountId: "account-should-not-leak",
      account: {
        roles: [{ role: "PLAYER" }, { role: "CAPTAIN" }, { role: "CREATOR" }],
        profile: { displayName: "Mara Tide", handle: "mara" },
      },
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

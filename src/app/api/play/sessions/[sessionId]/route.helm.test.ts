import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  state: vi.fn(),
  interact: vi.fn(),
  csrf: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("@/platform/auth", () => ({
  authorizeTaleSessionPlayer: mocks.authorize,
  verifyPlayerCsrf: mocks.csrf,
}));
vi.mock("@/chronicle/progression", () => ({
  getTaleSessionState: mocks.state,
  interactWithTaleSession: mocks.interact,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({}),
}));
vi.mock("@/chronicle/api", () => ({
  apiError: () => Response.json({ error: "request failed" }, { status: 400 }),
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ sessionId: "voyage-1" }) };

describe("Project Helm Phase 1 Player Voyage projection boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.mockResolvedValue({
      id: "voyage-1",
      currentBlock: { id: "block-1", body: "Player-safe narrative" },
    });
  });

  it("uses the same Player projection when the membership account also has Captain authority", async () => {
    mocks.authorize.mockResolvedValue({
      kind: "identity",
      playerId: "profile-1",
      identitySessionId: "session-1",
      csrfToken: "csrf-1",
      capabilities: ["PLAYER", "CAPTAIN"],
      captainAccountId: "account-1",
    });

    const response = await GET(new Request("https://example.test/api/play/sessions/voyage-1"), context);

    expect(response.status).toBe(200);
    expect(mocks.state).toHaveBeenCalledWith("voyage-1", undefined, false, true);
    expect(await response.json()).toEqual({
      id: "voyage-1",
      currentBlock: { id: "block-1", body: "Player-safe narrative" },
      csrfToken: "csrf-1",
    });
  });

  it("does not project Voyage state from authority without an ordinary Player membership", async () => {
    mocks.authorize.mockResolvedValue(null);

    const response = await GET(new Request("https://example.test/api/play/sessions/voyage-1"), context);

    expect(response.status).toBe(401);
    expect(mocks.state).not.toHaveBeenCalled();
  });
});

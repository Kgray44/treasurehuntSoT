import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  csrf: vi.fn(),
  rate: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/platform/auth", () => ({
  requirePlayerIdentity: mocks.identity,
  verifyPlayerCsrf: mocks.csrf,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({ "retry-after": "1" }),
}));
vi.mock("@/platform/libraries", () => ({
  getPlayerJournalReadingState: vi.fn(),
  updatePlayerJournalReadingState: mocks.update,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ playthroughId: "voyage-1" }) };

describe("player journal reading-state route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ playerProfileId: "player-1", csrfToken: "csrf-1" });
    mocks.csrf.mockResolvedValue(true);
    mocks.rate.mockReturnValue({ allowed: true, remaining: 89, resetAt: Date.now() + 60_000 });
  });

  it("returns a bounded client error for an empty or aborted JSON body", async () => {
    const response = await POST(
      new Request("https://example.test/api/player/playthroughs/voyage-1/journal-state", {
        method: "POST",
        headers: { "x-csrf-token": "csrf-1", "content-type": "application/json" },
        body: "",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid journal reading state." });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

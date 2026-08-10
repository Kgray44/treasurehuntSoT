import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ParticipationError extends Error {
    constructor(
      message: string,
      readonly code: "VOYAGE_UNAVAILABLE" | "TERMINAL_VOYAGE" | "STALE_STATE",
    ) {
      super(message);
    }
  }
  return {
    ParticipationError,
    authorization: vi.fn(),
    csrf: vi.fn(),
    rate: vi.fn(),
    get: vi.fn(),
    change: vi.fn(),
  };
});

vi.mock("@/chronicle/captain-authorization", () => ({ requireCaptainSession: mocks.authorization }));
vi.mock("@/wayfarer/http", () => ({ verifyWayfarerCsrf: mocks.csrf }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({ "retry-after": "1" }),
}));
vi.mock("@/helm/captain-participation", () => ({
  CaptainParticipationError: mocks.ParticipationError,
  captainParticipationMutationSchema: {
    safeParse: (value: unknown) => {
      const candidate = value as Record<string, unknown> | null;
      return candidate &&
        ["CAPTAIN_ONLY", "CAPTAIN_AND_PLAYER"].includes(String(candidate.mode)) &&
        Number.isInteger(candidate.expectedVersion) &&
        typeof candidate.idempotencyKey === "string" &&
        candidate.idempotencyKey.length >= 8
        ? { success: true, data: candidate }
        : { success: false };
    },
  },
  getCaptainParticipation: mocks.get,
  changeCaptainParticipation: mocks.change,
}));
vi.mock("@/chronicle/api", () => ({
  apiError: () => Response.json({ error: "request failed" }, { status: 400 }),
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ playthroughId: "voyage-1" }) };
const authorization = {
  session: { accountId: "account-1", csrfToken: "csrf-1" },
  actor: { accountId: "account-1", legacyGameMasterId: null },
  playthrough: { id: "voyage-1" },
};

describe("Project Helm Phase 1 participation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue(authorization);
    mocks.csrf.mockReturnValue(true);
    mocks.rate.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 });
    mocks.get.mockResolvedValue({ voyageId: "voyage-1", participationMode: "CAPTAIN_ONLY" });
    mocks.change.mockResolvedValue({
      idempotent: false,
      participation: { voyageId: "voyage-1", participationMode: "CAPTAIN_AND_PLAYER" },
    });
  });

  it("denies direct IDOR access before reading or mutating participation", async () => {
    mocks.authorization.mockResolvedValue(null);
    const response = await GET(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation"),
      context,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "This Voyage is unavailable.",
      code: "VOYAGE_UNAVAILABLE",
    });
    expect(mocks.get).not.toHaveBeenCalled();

    const mutation = await POST(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation", {
        method: "POST",
        body: JSON.stringify({
          mode: "CAPTAIN_AND_PLAYER",
          expectedVersion: 2,
          idempotencyKey: "idor-request-1",
        }),
      }),
      context,
    );
    expect(mutation.status).toBe(403);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("returns only the bounded participation projection and CSRF token to an authorized Captain", async () => {
    const response = await GET(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation"),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      participation: { voyageId: "voyage-1", participationMode: "CAPTAIN_ONLY" },
      csrfToken: "csrf-1",
    });
    expect(mocks.get).toHaveBeenCalledWith("voyage-1", authorization.actor);
  });

  it("requires CSRF and rejects malformed mode input without mutation", async () => {
    mocks.csrf.mockReturnValue(false);
    const noCsrf = await POST(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation", {
        method: "POST",
        body: JSON.stringify({ mode: "CAPTAIN_AND_PLAYER", expectedVersion: 2, idempotencyKey: "request-1" }),
      }),
      context,
    );
    expect(noCsrf.status).toBe(403);
    mocks.csrf.mockReturnValue(true);
    const malformed = await POST(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation", {
        method: "POST",
        body: JSON.stringify({ mode: "HELM_ADMIN", expectedVersion: 2, idempotencyKey: "request-2" }),
      }),
      context,
    );
    expect(malformed.status).toBe(400);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("passes only the authorized actor and bounded mutation to the domain service", async () => {
    const requestBody = {
      mode: "CAPTAIN_AND_PLAYER",
      expectedVersion: 2,
      idempotencyKey: "helm-request-1",
    };
    const response = await POST(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation", {
        method: "POST",
        headers: { "x-csrf-token": "csrf-1", "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.change).toHaveBeenCalledWith("voyage-1", authorization.actor, requestBody);
  });

  it("returns a truthful blocked state without exposing internal data", async () => {
    mocks.change.mockRejectedValue(
      new mocks.ParticipationError("This completed Voyage cannot change Player participation.", "TERMINAL_VOYAGE"),
    );
    const response = await POST(
      new Request("https://example.test/api/captain/playthroughs/voyage-1/participation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "CAPTAIN_AND_PLAYER",
          expectedVersion: 2,
          idempotencyKey: "helm-request-2",
        }),
      }),
      context,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "This completed Voyage cannot change Player participation.",
      code: "TERMINAL_VOYAGE",
    });
  });
});

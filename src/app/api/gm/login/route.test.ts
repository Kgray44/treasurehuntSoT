import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findUnique: vi.fn(),
  createAttempt: vi.fn(),
  createSession: vi.fn(),
  hashToken: vi.fn(),
  compare: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("@/lib/db", () => ({
  db: {
    loginAttempt: { count: mocks.count, create: mocks.createAttempt },
    gameMasterUser: { findUnique: mocks.findUnique },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/lib/security", () => ({ createGmSession: mocks.createSession, hashToken: mocks.hashToken }));

import { POST } from "./route";

function loginRequest() {
  return {
    json: vi.fn().mockResolvedValue({ username: "kato", password: "development-captain-only" }),
    headers: { get: vi.fn().mockReturnValue(null) },
  } as unknown as Request;
}

describe("POST /api/gm/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashToken.mockReturnValue("fingerprint");
  });

  it("returns a JSON error when an unexpected server failure interrupts sign-in", async () => {
    mocks.count.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(loginRequest());

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Sign-in is temporarily unavailable. Please try again." });
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});

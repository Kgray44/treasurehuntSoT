import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @sounding-line-registration owner=project-landfall suite=unit.landfall contracts=landfall.player-live-position
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  account: vi.fn(),
  record: vi.fn(),
  claim: vi.fn(),
  access: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, playerCanAccessPlaythrough: mocks.access }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: () => true, get: () => ({ value: "synthetic-credential" }) }),
}));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));
vi.mock("@/lib/db", () => ({ db: { taleSession: { findUnique: mocks.session } } }));
vi.mock("@/landfall/notification-return-server", () => ({ readLandfallReturnHandle: mocks.claim }));
vi.mock("./operational-observability", () => ({
  recordLandfallOperation: mocks.record,
  landfallDurationBand: () => "LT_50_MS",
}));
import { resolveAuthenticatedLandfallReturn } from "./notification-return-authority";

describe("native return diagnostics preserve canonical authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue(null);
    mocks.access.mockResolvedValue(false);
    mocks.session.mockResolvedValue(null);
    mocks.claim.mockReturnValue({
      scope: {
        playerProfileId: "synthetic-profile",
        sessionId: "synthetic-session",
        publishedVersionId: "synthetic-edition",
      },
      issuedAt: Date.now() - 1000,
      expiresAt: Date.now() + 30000,
    });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LANDFALL_NATIVE_RETURN_OBSERVATION_PATH", undefined);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("does not recheck the account outside the owned native lab", async () => {
    expect(await resolveAuthenticatedLandfallReturn("synthetic-handle")).toEqual({
      state: "SIGN_IN",
      destination: "/player/sign-in",
    });
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "DENIED", authorizationCookie: "PRESENT" }),
    );
  });
  it("retains denial even when the diagnostic query later finds an eligible account", async () => {
    vi.stubEnv("LANDFALL_NATIVE_RETURN_OBSERVATION_PATH", "owned-lab-observer");
    mocks.account.mockResolvedValue({ account: { profile: { id: "synthetic-profile", status: "ACTIVE" } } });
    expect(await resolveAuthenticatedLandfallReturn("synthetic-handle")).toEqual({
      state: "SIGN_IN",
      destination: "/player/sign-in",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "DENIED", authorizationSession: "ELIGIBLE_ON_RECHECK" }),
    );
    expect(JSON.stringify(mocks.record.mock.calls)).not.toMatch(/synthetic-credential|synthetic-profile/);
  });
  it("retains denial when the read-only diagnostic query fails", async () => {
    vi.stubEnv("LANDFALL_NATIVE_RETURN_OBSERVATION_PATH", "owned-lab-observer");
    mocks.account.mockRejectedValue(new Error("synthetic-private-failure"));
    expect(await resolveAuthenticatedLandfallReturn("synthetic-handle")).toEqual({
      state: "SIGN_IN",
      destination: "/player/sign-in",
    });
    expect(mocks.record.mock.calls[0][0]).toMatchObject({ outcome: "DENIED", authorizationCookie: "PRESENT" });
    expect(mocks.record.mock.calls[0][0]).not.toHaveProperty("authorizationSession");
    expect(JSON.stringify(mocks.record.mock.calls)).not.toContain("synthetic-private-failure");
  });
  it("keeps an authenticated Player signed in when Voyage membership is removed", async () => {
    mocks.identity.mockResolvedValue({ playerProfileId: "synthetic-profile" });
    expect(await resolveAuthenticatedLandfallReturn("a".repeat(43))).toEqual({
      state: "UNAVAILABLE",
      destination: "/player",
    });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "UNAVAILABLE" }));
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it.each([null, { id: "synthetic-session", status: "ACTIVE", publishedVersionId: "changed-edition" }])(
    "refuses missing or changed pinned sessions without treating authenticated identity as absent",
    async (session) => {
      mocks.identity.mockResolvedValue({ playerProfileId: "synthetic-profile" });
      mocks.access.mockResolvedValue(true);
      mocks.session.mockResolvedValue(session);
      expect(await resolveAuthenticatedLandfallReturn("a".repeat(43))).toEqual({
        state: "UNAVAILABLE",
        destination: "/player",
      });
    },
  );
  it.each(["ACTIVE", "COMPLETED"])("retains current authorized %s destination behavior", async (status) => {
    mocks.identity.mockResolvedValue({ playerProfileId: "synthetic-profile" });
    mocks.access.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ id: "synthetic-session", status, publishedVersionId: "synthetic-edition" });
    expect(await resolveAuthenticatedLandfallReturn("a".repeat(43))).toEqual({
      state: status === "ACTIVE" ? "CURRENT_JOURNEY" : "COMPLETED_JOURNEY",
      destination: `/player/playthroughs/synthetic-session/${status === "ACTIVE" ? "journal" : "archive"}`,
    });
  });
});

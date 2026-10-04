import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @sounding-line-registration owner=project-landfall suite=unit.landfall contracts=landfall.player-live-position
const mocks = vi.hoisted(() => ({ identity: vi.fn(), account: vi.fn(), record: vi.fn(), claim: vi.fn() }));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, playerCanAccessPlaythrough: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: () => true, get: () => ({ value: "synthetic-credential" }) }),
}));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));
vi.mock("@/lib/db", () => ({ db: {} }));
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
});

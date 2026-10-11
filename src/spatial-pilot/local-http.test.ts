import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn(), remove: vi.fn(), account: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set, delete: mocks.remove }) }));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.account }));

const preview = {
  SPATIAL_PILOT_LOCAL_HTTP: "1",
  SPATIAL_PILOT_ENABLED: "1",
  SPATIAL_PILOT_OWNER_ID: "spatial-pilot-navigator",
  DATABASE_URL: "file:C:/owned/artifacts/spatial-pilot/owner-sea-trials.db",
};

describe("synthetic pilot HTTP cookie boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    for (const [key, value] of Object.entries(preview)) vi.stubEnv(key, value);
    mocks.account.mockResolvedValue({ accountId: "spatial-pilot-navigator" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("allows only the verified synthetic navigator's HTTP cookie while retaining HttpOnly and SameSite", async () => {
    const { setWayfarerCookie } = await import("../wayfarer/http");
    await setWayfarerCookie("opaque-issued-token");
    expect(mocks.account).toHaveBeenCalledWith("opaque-issued-token");
    expect(mocks.set).toHaveBeenCalledWith(
      "wayfarer_account",
      "opaque-issued-token",
      expect.objectContaining({ secure: false, httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it.each([null, { accountId: "another-account" }])(
    "retains Secure for an unverified or other account: %j",
    async (account) => {
      mocks.account.mockResolvedValue(account);
      const { setWayfarerCookie } = await import("../wayfarer/http");
      await setWayfarerCookie("opaque-issued-token");
      expect(mocks.set.mock.calls[0][2].secure).toBe(true);
    },
  );

  it.each([
    ["SPATIAL_PILOT_LOCAL_HTTP", ""],
    ["SPATIAL_PILOT_ENABLED", ""],
    ["SPATIAL_PILOT_OWNER_ID", "another-account"],
    ["DATABASE_URL", "file:C:/shared/production.db"],
    ["DATABASE_URL", "postgresql://example.invalid/application"],
    ["DATABASE_URL", "file:C:/owned/artifacts/spatial-pilot/../production.db"],
    ["DATABASE_URL", "file:./artifacts/spatial-pilot/unbound.db"],
  ])("retains production Secure when %s is %s", async (key, value) => {
    vi.stubEnv(key, value);
    const { setWayfarerCookie } = await import("../wayfarer/http");
    await setWayfarerCookie("opaque-issued-token");
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.set.mock.calls[0][2].secure).toBe(true);
  });
});

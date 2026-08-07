import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  currentAccount: vi.fn(),
  safeEqual: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: mocks.cookieGet })) }));
vi.mock("@/wayfarer/accounts", () => ({ currentAccount: mocks.currentAccount }));
vi.mock("@/lib/security", () => ({ safeEqual: mocks.safeEqual }));

import { requireWayfarerAccount } from "./http";

describe("Wayfarer canonical session and CSRF boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue({ value: "session-token" });
    mocks.currentAccount.mockResolvedValue({ accountId: "account-1", csrfToken: "csrf-1" });
    mocks.safeEqual.mockReturnValue(true);
  });

  it("homeport.owner-correction.round1.mutation-csrf denies a missing or mismatched challenge", async () => {
    const missing = new Request("http://localhost/api/account/data/delete", { method: "POST" });
    mocks.safeEqual.mockReturnValue(false);
    await expect(requireWayfarerAccount(missing)).resolves.toBeNull();
    expect(mocks.safeEqual).toHaveBeenCalledWith("csrf-1", "");

    const mismatched = new Request("http://localhost/api/account/data/delete", {
      method: "POST",
      headers: { "x-csrf-token": "wrong" },
    });
    await expect(requireWayfarerAccount(mismatched)).resolves.toBeNull();
    expect(mocks.safeEqual).toHaveBeenLastCalledWith("csrf-1", "wrong");
  });

  it("accepts a live canonical session with matching CSRF and permits read-only session lookup without CSRF", async () => {
    const mutation = new Request("http://localhost/api/account/data/delete", {
      method: "POST",
      headers: { "x-csrf-token": "csrf-1" },
    });
    await expect(requireWayfarerAccount(mutation)).resolves.toMatchObject({ accountId: "account-1" });
    expect(mocks.safeEqual).toHaveBeenCalledWith("csrf-1", "csrf-1");

    mocks.safeEqual.mockClear();
    await expect(requireWayfarerAccount()).resolves.toMatchObject({ accountId: "account-1" });
    expect(mocks.safeEqual).not.toHaveBeenCalled();
  });

  it("does not query private account state without the canonical cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    await expect(requireWayfarerAccount()).resolves.toBeNull();
    expect(mocks.currentAccount).not.toHaveBeenCalled();
  });
});

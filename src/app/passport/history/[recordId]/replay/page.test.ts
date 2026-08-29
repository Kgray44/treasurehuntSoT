import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRecord: vi.fn(),
  getPlayerArchive: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  requireWayfarerAccount: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { playerChronicleRecord: { findFirst: mocks.findRecord } } }));
vi.mock("@/platform/libraries", () => ({ getPlayerArchive: mocks.getPlayerArchive }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.requireWayfarerAccount }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));

import PassportHistoryReplayPage from "./page";

describe("PassportHistoryReplayPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("fails closed before reading a record when the Passport session has no Player profile", async () => {
    mocks.requireWayfarerAccount.mockResolvedValue(null);

    await expect(PassportHistoryReplayPage({ params: Promise.resolve({ recordId: "record-owned" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.findRecord).not.toHaveBeenCalled();
    expect(mocks.getPlayerArchive).not.toHaveBeenCalled();
  });

  it("requires the canonical completed archive before entering the historical journal", async () => {
    mocks.requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "player-owned" } } });
    mocks.findRecord.mockResolvedValue({ sourcePlaythroughId: "playthrough-owned" });
    mocks.getPlayerArchive.mockResolvedValue(null);

    await expect(PassportHistoryReplayPage({ params: Promise.resolve({ recordId: "record-owned" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.findRecord).toHaveBeenCalledWith({
      where: { id: "record-owned", playerProfileId: "player-owned" },
      select: { sourcePlaythroughId: true },
    });
    expect(mocks.getPlayerArchive).toHaveBeenCalledWith("player-owned", "playthrough-owned");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an authorized completed record to Lanternwake's existing historical journal", async () => {
    mocks.requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "player-owned" } } });
    mocks.findRecord.mockResolvedValue({ sourcePlaythroughId: "playthrough-owned" });
    mocks.getPlayerArchive.mockResolvedValue({ playthrough: { id: "playthrough-owned" } });

    await expect(PassportHistoryReplayPage({ params: Promise.resolve({ recordId: "record-owned" }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/player/playthroughs/playthrough-owned/journal");
  });
});

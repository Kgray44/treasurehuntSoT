import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gm: vi.fn(),
  player: vi.fn(),
  reference: vi.fn(),
  reveal: vi.fn(),
}));

vi.mock("@/lib/security", () => ({ requireGmCapability: mocks.gm }));
vi.mock("@/platform/auth", () => ({ authorizeTaleSessionPlayer: mocks.player }));
vi.mock("@/lib/db", () => ({
  db: {
    privateAssetReference: { findFirst: mocks.reference },
    revealState: { findFirst: mocks.reveal },
  },
}));

import { privateContentAuthorization } from "@/private-content/authorization";

describe("private asset authorization", () => {
  it("allows a Creator only for an owned reference", async () => {
    mocks.gm.mockResolvedValue({ userId: "creator-a" });
    mocks.reference.mockResolvedValueOnce({ id: "asset" });
    await expect(privateContentAuthorization.canReadPrivateAsset({ assetId: "asset" })).resolves.toBe(true);
    expect(mocks.reference).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it("requires identity membership, active pinned session, matching tale, and canonical reveal for Player delivery", async () => {
    mocks.gm.mockResolvedValue(null);
    mocks.player.mockResolvedValue({ kind: "identity", playerId: "player-a" });
    mocks.reference.mockResolvedValue({
      id: "asset-a",
      logicalId: "source-asset-a",
      taleId: "tale-a",
      session: { taleId: "tale-a", publishedVersionId: "version-a", status: "ACTIVE" },
    });
    mocks.reveal.mockResolvedValue({ id: "reveal-a" });
    await expect(
      privateContentAuthorization.canReadPrivateAsset({ assetId: "asset-a", playthroughId: "playthrough-a" }),
    ).resolves.toBe(true);
    expect(mocks.reveal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          playthroughId: "playthrough-a",
          contentKey: { in: ["asset-a", "source-asset-a"] },
        }),
      }),
    );
  });

  it("fails closed for legacy-only credentials, mismatched sessions, or unrevealed assets", async () => {
    mocks.gm.mockResolvedValue(null);
    mocks.player.mockResolvedValue({ kind: "legacy", token: "not-sufficient" });
    await expect(
      privateContentAuthorization.canReadPrivateAsset({ assetId: "asset-a", playthroughId: "playthrough-a" }),
    ).resolves.toBe(false);
    mocks.player.mockResolvedValue({ kind: "identity", playerId: "player-a" });
    mocks.reference.mockResolvedValue({
      id: "asset-a",
      logicalId: "source-asset-a",
      taleId: "tale-a",
      session: { taleId: "other-tale", publishedVersionId: "version-a", status: "ACTIVE" },
    });
    await expect(
      privateContentAuthorization.canReadPrivateAsset({ assetId: "asset-a", playthroughId: "playthrough-a" }),
    ).resolves.toBe(false);
    mocks.reference.mockResolvedValue({
      id: "asset-a",
      logicalId: "source-asset-a",
      taleId: "tale-a",
      session: { taleId: "tale-a", publishedVersionId: "version-a", status: "ACTIVE" },
    });
    mocks.reveal.mockResolvedValue(null);
    await expect(
      privateContentAuthorization.canReadPrivateAsset({ assetId: "asset-a", playthroughId: "playthrough-a" }),
    ).resolves.toBe(false);
  });
});

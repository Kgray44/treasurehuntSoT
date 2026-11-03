// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), membership: vi.fn(), load: vi.fn() }));
vi.mock("@/platform/auth", () => ({
  requirePlayerIdentity: mocks.identity,
  playerCanAccessPlaythrough: mocks.membership,
}));
vi.mock("@/parallax/asset-delivery", () => ({ loadReleasedSpatialAsset: mocks.load }));
import { GET } from "./route";

const checksum = "b".repeat(64);
const context = { params: Promise.resolve({ playthroughId: "voyage-1", assetId: "brass-compass" }) };
const request = () => new Request(`https://example.test/api?block=passage-1&versionChecksum=${checksum}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ playerProfileId: "player-1" });
  mocks.membership.mockResolvedValue(true);
  mocks.load.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), sha256: "a".repeat(64), byteLength: 3 });
});

it("requires the current signed-in Player and Voyage membership before any asset lookup", async () => {
  mocks.identity.mockResolvedValueOnce(null);
  expect((await GET(request(), context)).status).toBe(401);
  mocks.membership.mockResolvedValueOnce(false);
  expect((await GET(request(), context)).status).toBe(404);
  expect(mocks.load).not.toHaveBeenCalled();
});

it("uses the current actor and exact passage checksum and returns private integrity-identified GLB bytes", async () => {
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(mocks.load).toHaveBeenCalledWith({
    playthroughId: "voyage-1",
    playerProfileId: "player-1",
    assetId: "brass-compass",
    blockId: "passage-1",
    versionChecksum: checksum,
  });
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(response.headers.get("Content-Type")).toBe("model/gltf-binary");
  expect(response.headers.get("Content-Length")).toBe("3");
  expect(response.headers.get("X-Parallax-Asset-SHA256")).toBe("a".repeat(64));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
});

it("withholds bytes when membership is revoked while the asset is loading", async () => {
  mocks.membership.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const response = await GET(request(), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Asset not found." });
});

it("uses the same opaque private response for unavailable releases and integrity failures", async () => {
  for (const reason of [
    "PARALLAX_ASSET_SCENE_CHANGED",
    "PARALLAX_PASSAGE_NOT_RELEASED",
    "PARALLAX_ASSET_INTEGRITY_FAILED",
  ]) {
    mocks.load.mockRejectedValueOnce(new Error(reason));
    const response = await GET(request(), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Asset not found." });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  }
});

// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { syntheticSpatialMoment } from "./fixtures";
const mocks = vi.hoisted(() => ({ load: vi.fn(), read: vi.fn() }));
vi.mock("./service", () => ({ loadReleasedSpatialMoment: mocks.load }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.read }));
import { loadReleasedSpatialAsset } from "./asset-delivery";

const { readFile } = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const checksum = "b".repeat(64);
const request = (assetId = "brass-compass") => ({
  playthroughId: "voyage-1",
  playerProfileId: "player-1",
  blockId: "passage-1",
  versionChecksum: checksum,
  assetId,
});
function moment(assetId: "brass-compass" | "treasure-chest" = "brass-compass") {
  const value = syntheticSpatialMoment();
  value.version.checksum = checksum;
  value.version.entities[0].element = {
    kind: "PHYSICAL_ASSET",
    modelId: assetId,
    packageVersion: "1.0.0",
    enabled: true,
    articulation: 0,
  };
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockImplementation(readFile);
  mocks.load.mockResolvedValue({ moment: moment() });
});

it.each([
  ["brass-compass", 313396, "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb"],
  ["treasure-chest", 630120, "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f"],
] as const)("delivers the exact original %s binary for its pinned released scene", async (id, length, digest) => {
  mocks.load.mockResolvedValue({ moment: moment(id) });
  const result = await loadReleasedSpatialAsset(request(id));
  expect(result.byteLength).toBe(length);
  expect(createHash("sha256").update(result.bytes).digest("hex")).toBe(digest);
  expect(result.sha256).toBe(digest);
  expect(mocks.load).toHaveBeenCalledWith("voyage-1", "player-1", "passage-1");
});

it("requires the exact scene revision and a currently released passage before reading bytes", async () => {
  await expect(loadReleasedSpatialAsset({ ...request(), versionChecksum: "c".repeat(64) })).rejects.toThrow(
    "PARALLAX_ASSET_SCENE_CHANGED",
  );
  mocks.load.mockRejectedValueOnce(new Error("PARALLAX_PASSAGE_NOT_RELEASED"));
  await expect(loadReleasedSpatialAsset(request())).rejects.toThrow("PARALLAX_PASSAGE_NOT_RELEASED");
  expect(mocks.read).not.toHaveBeenCalled();
});

it("rejects absent, disabled, different-package and editor-only dependencies", async () => {
  const absent = moment();
  delete absent.version.entities[0].element;
  const disabled = moment();
  disabled.version.entities[0].element!.enabled = false;
  const wrongPackage = moment();
  Object.assign(wrongPackage.version.entities[0].element!, { packageVersion: "2.0.0" });
  const editor = moment();
  editor.version.studio = {
    schemaVersion: 1,
    layers: [
      {
        entityId: editor.version.entities[0].id,
        tags: [],
        visible: true,
        locked: false,
        selectable: true,
        audience: "EDITOR_ONLY",
      },
    ],
    behaviors: [],
    assets: [],
    visionReferences: [],
    minimumRuntime: "PARALLAX_2",
    capabilityDependencies: [],
    compatibilityNotes: "",
    provenance: { origin: "MANUAL", generator: "test", license: "test" },
  };
  for (const value of [absent, disabled, wrongPackage, editor]) {
    mocks.load.mockResolvedValueOnce({ moment: value });
    await expect(loadReleasedSpatialAsset(request())).rejects.toThrow("PARALLAX_ASSET_NOT_RELEASED");
  }
  expect(mocks.read).not.toHaveBeenCalled();
});

it("refuses unsupported identifiers, traversal and missing revision pins", async () => {
  for (const value of [
    request("lantern"),
    request("../../secret"),
    { ...request(), blockId: "../passage" },
    { ...request(), versionChecksum: undefined },
  ])
    await expect(loadReleasedSpatialAsset(value)).rejects.toThrow();
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
});

it("withholds truncated and same-length corrupted files before response delivery", async () => {
  mocks.read.mockResolvedValueOnce(Buffer.from([0]));
  await expect(loadReleasedSpatialAsset(request())).rejects.toThrow("PARALLAX_ASSET_INTEGRITY_FAILED");
  const changed = await readFile("public/parallax/sc02/models/brass-compass.glb");
  changed[changed.length - 1] ^= 1;
  mocks.read.mockResolvedValueOnce(changed);
  await expect(loadReleasedSpatialAsset(request())).rejects.toThrow("PARALLAX_ASSET_INTEGRITY_FAILED");
});

it("revalidates release access after a successful delivery instead of trusting a process cache", async () => {
  await loadReleasedSpatialAsset(request());
  mocks.load.mockRejectedValueOnce(new Error("PARALLAX_PASSAGE_NOT_RELEASED"));
  await expect(loadReleasedSpatialAsset(request())).rejects.toThrow("PARALLAX_PASSAGE_NOT_RELEASED");
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(mocks.read).toHaveBeenCalledTimes(1);
});

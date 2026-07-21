import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalCommunityAssetStorage } from "./storage";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
describe("local community storage", () => {
  it("separates staging, immutable releases, and quarantine", async () => { root = await mkdtemp(path.join(os.tmpdir(), "harborlight-")); const storage = new LocalCommunityAssetStorage(root); const staged = await storage.putStagedObject("owner", "map.png", Buffer.from("map")); const release = await storage.copyToImmutableRelease(staged.key, "release"); expect(release.checksum).toBe(staged.checksum); expect((await storage.moveToQuarantine(release.key)).key).toBe("quarantine/map.png"); });
  it("rejects traversal and immutable overwrite", async () => { root = await mkdtemp(path.join(os.tmpdir(), "harborlight-")); const storage = new LocalCommunityAssetStorage(root); await expect(storage.putStagedObject("owner", "../nope", Buffer.from("x"))).rejects.toThrow(); const staged = await storage.putStagedObject("owner", "a", Buffer.from("x")); await storage.copyToImmutableRelease(staged.key, "release"); await expect(storage.copyToImmutableRelease(staged.key, "release")).rejects.toThrow(); });
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileFind: vi.fn(),
  mediaCreate: vi.fn(),
  profileUpdateMany: vi.fn(),
  mediaUpdateMany: vi.fn(),
  mediaFind: vi.fn(),
  mediaUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    playerProfile: { findUnique: mocks.profileFind, updateMany: mocks.profileUpdateMany },
    profileMedia: {
      create: mocks.mediaCreate,
      findFirst: mocks.mediaFind,
      updateMany: mocks.mediaUpdateMany,
      update: mocks.mediaUpdate,
    },
    $transaction: vi.fn(async (value: unknown) => {
      if (Array.isArray(value)) return Promise.all(value);
      return (value as (transaction: typeof db) => unknown)(db);
    }),
  };
  return { db };
});

import {
  normalizeProfileCrop,
  profileCropWindow,
  profileMediaOutput,
  removeProfileMedia,
  saveProfileMedia,
} from "./profile-media";

describe("Project Homeport governed Profile imagery", () => {
  let root = "";

  beforeEach(() => {
    vi.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), "homeport-profile-media-"));
    process.env.PROFILE_MEDIA_ROOT = root;
    mocks.profileFind.mockResolvedValue({ accountId: "account-1", avatarMediaId: "avatar-old", bannerMediaId: null });
    mocks.profileUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mediaCreate.mockImplementation(({ data }) => Promise.resolve({ ...data, altText: data.altText ?? null }));
    mocks.mediaUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mediaUpdate.mockResolvedValue({ id: "avatar-old" });
  });

  afterEach(() => {
    delete process.env.PROFILE_MEDIA_ROOT;
    rmSync(root, { recursive: true, force: true });
  });

  it("homeport.owner-correction.round3.crop-normalization bounds focal coordinates, scale, and extraction windows", () => {
    expect(normalizeProfileCrop({ centerX: 0.2, centerY: 0.8, scale: 2, rotation: 90 })).toEqual({
      centerX: 0.2,
      centerY: 0.8,
      scale: 2,
      rotation: 90,
    });
    expect(() => normalizeProfileCrop({ centerX: -0.1, centerY: 0.5, scale: 1 })).toThrow("crop is invalid");
    const edge = profileCropWindow(101, 73, 1, { centerX: 1, centerY: 1, scale: 3, rotation: 0 });
    expect(edge.left + edge.width).toBeLessThanOrEqual(101);
    expect(edge.top + edge.height).toBeLessThanOrEqual(73);
  });

  it("homeport.owner-correction.round3.image-processing stores a private original and normalized avatar derivative", async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#16716c" } })
      .jpeg()
      .toBuffer();
    const result = await saveProfileMedia(
      "profile-1",
      "AVATAR",
      `data:image/jpeg;base64,${source.toString("base64")}`,
      { centerX: 0.72, centerY: 0.4, scale: 1.8 },
      "Profile avatar",
      "avatar-old",
    );
    expect(result.kind).toBe("AVATAR");
    const data = mocks.mediaCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      ownerAccountId: "account-1",
      originalMimeType: "image/jpeg",
      mimeType: "image/webp",
      width: profileMediaOutput.AVATAR.width,
      height: profileMediaOutput.AVATAR.height,
      cropCenterX: 0.72,
      cropCenterY: 0.4,
      cropScale: 1.8,
      scanState: "LOCAL_VALIDATED",
      processingState: "READY",
      replacesMediaId: "avatar-old",
    });
    expect(data.originalStorageKey).toMatch(/^originals\//u);
    expect(data.storageKey).toMatch(/^derivatives\/[a-f0-9]+\/avatar\//u);
    expect(readFileSync(join(root, data.originalStorageKey))).toEqual(source);
    const derivative = await sharp(readFileSync(join(root, data.storageKey))).metadata();
    expect(derivative).toMatchObject({ format: "webp", width: 768, height: 768 });
  });

  it("homeport.owner-correction.round3.profile-image-selection gives identical uploads distinct media-record keys", async () => {
    const source = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#16716c" } })
      .png()
      .toBuffer();
    for (const profileId of ["profile-1", "profile-2"])
      await saveProfileMedia(
        profileId,
        "AVATAR",
        `data:image/png;base64,${source.toString("base64")}`,
        { centerX: 0.5, centerY: 0.5, scale: 1 },
        undefined,
        "avatar-old",
      );
    const [first, second] = mocks.mediaCreate.mock.calls.map((call) => call[0].data);
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(first.originalStorageKey).not.toBe(second.originalStorageKey);
    expect(first.checksum).toBe(second.checksum);
  });

  it("homeport.owner-correction.round3.media-validation rejects declared and decoded type mismatches without replacing active media", async () => {
    const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#123456" } })
      .png()
      .toBuffer();
    await expect(
      saveProfileMedia(
        "profile-1",
        "AVATAR",
        `data:image/jpeg;base64,${png.toString("base64")}`,
        { centerX: 0.5, centerY: 0.5, scale: 1 },
        undefined,
        "avatar-old",
      ),
    ).rejects.toThrow("decoded and safely normalized");
    expect(mocks.mediaCreate).not.toHaveBeenCalled();
    expect(mocks.profileUpdateMany).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round3.media-atomic-replacement rejects a stale expected active image", async () => {
    const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#123456" } })
      .png()
      .toBuffer();
    await expect(
      saveProfileMedia(
        "profile-1",
        "AVATAR",
        `data:image/png;base64,${png.toString("base64")}`,
        { centerX: 0.5, centerY: 0.5, scale: 1 },
        undefined,
        "avatar-stale",
      ),
    ).rejects.toMatchObject({ code: "STALE" });
    expect(mocks.mediaCreate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round3.media-removal clears only the still-active owned media", async () => {
    mocks.mediaFind.mockResolvedValue({ id: "avatar-old", kind: "AVATAR" });
    await expect(removeProfileMedia("profile-1", "avatar-old")).resolves.toMatchObject({ ok: true });
    expect(mocks.profileUpdateMany).toHaveBeenCalledWith({
      where: { id: "profile-1", avatarMediaId: "avatar-old" },
      data: { avatarMediaId: null },
    });
    mocks.profileUpdateMany.mockResolvedValue({ count: 0 });
    await expect(removeProfileMedia("profile-1", "avatar-old")).rejects.toMatchObject({ code: "STALE" });
  });
});

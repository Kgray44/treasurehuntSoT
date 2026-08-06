import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { computeProfileCropWindow } from "@/wayfarer/profile-crop";
import { ProfileError } from "@/wayfarer/profile";

const limits = { AVATAR: 8_000_000, BANNER: 8_000_000 } as const;
export const profileMediaOutput = {
  AVATAR: { width: 768, height: 768, aspect: 1 },
  BANNER: { width: 1600, height: 640, aspect: 2.5 },
} as const;
type MediaKind = keyof typeof limits;
export type ProfileCrop = Readonly<{
  centerX: number;
  centerY: number;
  scale: number;
  rotation?: 0 | 90 | 180 | 270;
}>;

const mediaRoot = () =>
  process.env.PROFILE_MEDIA_ROOT ??
  path.join(process.env.LOCALAPPDATA ?? process.env.TEMP ?? process.cwd(), "ForeverTreasureCompanion", "profile-media");

function decodeDataUrl(value: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) throw new ProfileError("Upload a PNG, JPEG, or WebP image.");
  return { declaredType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export function normalizeProfileCrop(crop: ProfileCrop) {
  const rotation = crop.rotation ?? 0;
  if (
    !Number.isFinite(crop.centerX) ||
    !Number.isFinite(crop.centerY) ||
    !Number.isFinite(crop.scale) ||
    crop.centerX < 0 ||
    crop.centerX > 1 ||
    crop.centerY < 0 ||
    crop.centerY > 1 ||
    crop.scale < 1 ||
    crop.scale > 4 ||
    ![0, 90, 180, 270].includes(rotation)
  )
    throw new ProfileError("The selected crop is invalid. Reset the editor and try again.");
  return { centerX: crop.centerX, centerY: crop.centerY, scale: crop.scale, rotation };
}

export const profileCropWindow = computeProfileCropWindow;

async function writeOnce(target: string, value: Buffer) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
}

export async function saveProfileMedia(
  profileId: string,
  kind: MediaKind,
  dataUrl: string,
  cropInput: ProfileCrop,
  altText?: string,
  expectedMediaId?: string | null,
) {
  const { buffer, declaredType } = decodeDataUrl(dataUrl);
  const crop = normalizeProfileCrop(cropInput);
  if (!buffer.length || buffer.length > limits[kind])
    throw new ProfileError(`${kind === "AVATAR" ? "Avatar" : "Banner"} exceeds the 8 MB upload limit.`);

  const current = await db.playerProfile.findUnique({
    where: { id: profileId },
    select: { accountId: true, avatarMediaId: true, bannerMediaId: true },
  });
  if (!current?.accountId) throw new ProfileError("A claimed account Profile is required.", "NOT_FOUND");
  const initiallyActiveId = kind === "AVATAR" ? current.avatarMediaId : current.bannerMediaId;
  if (expectedMediaId !== undefined && initiallyActiveId !== expectedMediaId)
    throw new ProfileError("Profile imagery changed in another window. Reload before replacing it.", "STALE");

  let derivative: Buffer;
  let originalWidth: number;
  let originalHeight: number;
  let sourceOrientation: number;
  let originalFormat: "png" | "jpeg" | "webp";
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: 24_000_000,
      animated: false,
      failOn: "warning",
    }).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64) throw new Error("small");
    if ((metadata.pages ?? 1) > 1) throw new Error("animated");
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) throw new Error("format");
    if (`image/${metadata.format}` !== declaredType) throw new Error("mismatch");
    originalFormat = metadata.format as typeof originalFormat;
    sourceOrientation = metadata.orientation ?? 1;
    const oriented = await sharp(buffer, { limitInputPixels: 24_000_000, animated: false, failOn: "warning" })
      .rotate()
      .toBuffer({ resolveWithObject: true });
    originalWidth = oriented.info.width;
    originalHeight = oriented.info.height;
    const window = profileCropWindow(originalWidth, originalHeight, profileMediaOutput[kind].aspect, crop);
    derivative = await sharp(oriented.data, { limitInputPixels: 24_000_000, animated: false, failOn: "warning" })
      .extract(window)
      .resize(profileMediaOutput[kind].width, profileMediaOutput[kind].height, { fit: "fill" })
      .webp({ quality: 88, effort: 5 })
      .toBuffer();
  } catch {
    throw new ProfileError("That image could not be decoded and safely normalized.");
  }

  const originalChecksum = createHash("sha256").update(buffer).digest("hex");
  const derivativeChecksum = createHash("sha256").update(derivative).digest("hex");
  const profileScope = createHash("sha256").update(profileId).digest("hex").slice(0, 20);
  const mediaId = randomUUID();
  const originalKey = `originals/${profileScope}/${mediaId}/${originalChecksum}.${originalFormat === "jpeg" ? "jpg" : originalFormat}`;
  const derivativeKey = `derivatives/${profileScope}/${kind.toLowerCase()}/${mediaId}-${derivativeChecksum}.webp`;
  await writeOnce(path.join(mediaRoot(), originalKey), buffer);
  await writeOnce(path.join(mediaRoot(), derivativeKey), derivative);

  const previousId = initiallyActiveId;
  const now = new Date();
  const media = await db.$transaction(async (tx) => {
    const created = await tx.profileMedia.create({
      data: {
        id: mediaId,
        profileId,
        ownerAccountId: current.accountId,
        kind,
        storageKey: derivativeKey,
        originalStorageKey: originalKey,
        mimeType: "image/webp",
        originalMimeType: declaredType,
        byteLength: derivative.length,
        originalByteLength: buffer.length,
        width: profileMediaOutput[kind].width,
        height: profileMediaOutput[kind].height,
        originalWidth,
        originalHeight,
        checksum: derivativeChecksum,
        cropCenterX: crop.centerX,
        cropCenterY: crop.centerY,
        cropScale: crop.scale,
        cropAspect: profileMediaOutput[kind].aspect,
        sourceOrientation,
        rotation: crop.rotation,
        processingState: "READY",
        scanState: "LOCAL_VALIDATED",
        replacesMediaId: previousId,
        altText: altText?.trim().slice(0, 240) || null,
      },
    });
    const activated = await tx.playerProfile.updateMany({
      where: {
        id: profileId,
        ...(kind === "AVATAR" ? { avatarMediaId: previousId } : { bannerMediaId: previousId }),
      },
      data: kind === "AVATAR" ? { avatarMediaId: mediaId } : { bannerMediaId: mediaId },
    });
    if (activated.count !== 1)
      throw new ProfileError("Profile imagery changed in another window. Reload before replacing it.", "STALE");
    if (previousId)
      await tx.profileMedia.updateMany({
        where: { id: previousId, profileId },
        data: { removedAt: now, processingState: "REPLACED" },
      });
    return created;
  });
  return { id: media.id, kind, url: `/api/profile-media/${media.id}`, altText: media.altText };
}

export async function readProfileMedia(id: string) {
  const media = await db.profileMedia.findFirst({
    where: { id, removedAt: null, processingState: "READY", scanState: "LOCAL_VALIDATED" },
    include: {
      profile: {
        select: {
          id: true,
          accountId: true,
          handle: true,
          status: true,
          defaultVisibility: true,
          privacyRules: { where: { section: "HEADER" } },
        },
      },
    },
  });
  if (!media) return null;
  try {
    const buffer = await readFile(path.join(mediaRoot(), media.storageKey));
    return { media, buffer };
  } catch {
    return null;
  }
}

export async function readOwnedProfileMediaOriginal(profileId: string, id: string) {
  const media = await db.profileMedia.findFirst({
    where: { id, profileId, removedAt: null, processingState: "READY" },
    select: { originalStorageKey: true, originalMimeType: true, originalByteLength: true },
  });
  if (!media?.originalStorageKey || !media.originalMimeType) return null;
  try {
    const buffer = await readFile(path.join(mediaRoot(), media.originalStorageKey));
    return { buffer, mimeType: media.originalMimeType, byteLength: media.originalByteLength ?? buffer.length };
  } catch {
    return null;
  }
}

export async function removeProfileMedia(profileId: string, mediaId: string) {
  const media = await db.profileMedia.findFirst({
    where: { id: mediaId, profileId, removedAt: null },
    select: { id: true, kind: true },
  });
  if (!media) throw new ProfileError("Profile image not found.", "NOT_FOUND");
  await db.$transaction(async (tx) => {
    const removed = await tx.playerProfile.updateMany({
      where: {
        id: profileId,
        ...(media.kind === "AVATAR" ? { avatarMediaId: mediaId } : { bannerMediaId: mediaId }),
      },
      data: media.kind === "AVATAR" ? { avatarMediaId: null } : { bannerMediaId: null },
    });
    if (removed.count !== 1)
      throw new ProfileError("Profile imagery changed in another window. Reload before removing it.", "STALE");
    await tx.profileMedia.update({
      where: { id: mediaId },
      data: { removedAt: new Date(), processingState: "REMOVED" },
    });
  });
  return { ok: true as const, id: mediaId, kind: media.kind };
}

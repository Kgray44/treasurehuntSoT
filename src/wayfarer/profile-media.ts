import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { ProfileError } from "@/wayfarer/profile";

const limits = { AVATAR: 1_000_000, BANNER: 3_000_000 } as const;
type MediaKind = keyof typeof limits;
const mediaRoot = () =>
  process.env.PROFILE_MEDIA_ROOT ??
  path.join(process.env.LOCALAPPDATA ?? process.env.TEMP ?? process.cwd(), "ForeverTreasureCompanion", "profile-media");

function decodeDataUrl(value: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) throw new ProfileError("Upload a PNG, JPEG, or WebP image.");
  return { declaredType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function saveProfileMedia(profileId: string, kind: MediaKind, dataUrl: string, altText?: string) {
  const { buffer } = decodeDataUrl(dataUrl);
  if (!buffer.length || buffer.length > limits[kind])
    throw new ProfileError(`${kind === "AVATAR" ? "Avatar" : "Banner"} exceeds the allowed upload size.`);
  let normalized: Buffer;
  let metadata: sharp.Metadata;
  try {
    const image = sharp(buffer, { limitInputPixels: 20_000_000, animated: false }).rotate();
    metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) throw new Error("small");
    normalized = await image.png({ compressionLevel: 9 }).toBuffer();
  } catch {
    throw new ProfileError("That image could not be safely processed.");
  }
  const key = `${kind.toLowerCase()}/${createHash("sha256").update(normalized).digest("hex")}.png`;
  const target = path.join(mediaRoot(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, normalized, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  const current = await db.playerProfile.findUnique({
    where: { id: profileId },
    select: { avatarMediaId: true, bannerMediaId: true },
  });
  if (!current) throw new ProfileError("Profile not found.", "NOT_FOUND");
  const media = await db.profileMedia.create({
    data: {
      id: randomUUID(),
      profileId,
      kind,
      storageKey: key,
      mimeType: "image/png",
      byteLength: normalized.length,
      width: metadata.width,
      height: metadata.height,
      altText: altText?.trim().slice(0, 240) || null,
    },
  });
  const field = kind === "AVATAR" ? { avatarMediaId: media.id } : { bannerMediaId: media.id };
  await db.playerProfile.update({ where: { id: profileId }, data: field });
  const previousId = kind === "AVATAR" ? current.avatarMediaId : current.bannerMediaId;
  if (previousId && previousId !== media.id)
    await db.profileMedia.updateMany({ where: { id: previousId }, data: { removedAt: new Date() } });
  return { id: media.id, kind, url: `/api/profile-media/${media.id}`, altText: media.altText };
}

export async function readProfileMedia(id: string) {
  const media = await db.profileMedia.findFirst({
    where: { id, removedAt: null },
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

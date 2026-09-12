import type { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Narrowly update the documented synthetic Chronicle; preserve any unrelated cover. */
export async function ensureDevelopmentMusterCover(db: PrismaClient) {
  const tale = await db.chronicle.findUnique({ where: { slug: "development-studio-voyage" } });
  if (!tale || !tale.title.startsWith("The Forever Treasure")) return null;
  if (tale.coverAssetId) {
    const existing = await db.taleAsset.findUnique({ where: { id: tale.coverAssetId }, include: { variants: true } });
    if (existing?.description !== "Owner-supplied Muster development cover, 2026-09-12") return null;
    return existing;
  }
  const buffer = await readFile(path.join(process.cwd(), "public/images/muster/moonlit-island.png"));
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const folder = randomUUID(),
    filename = randomUUID();
  const storageKey = `${folder}/${filename}.png`;
  const storageRoot = process.env.CHRONICLE_ASSET_ROOT ?? path.join(process.cwd(), ".data/chronicle-assets");
  await mkdir(path.join(storageRoot, folder), { recursive: true });
  await writeFile(path.join(storageRoot, storageKey), buffer, { flag: "wx" });
  const asset = await db.taleAsset.upsert({
    where: { taleId_checksum: { taleId: tale.id, checksum } },
    update: {},
    create: {
      taleId: tale.id,
      mediaType: "IMAGE",
      displayName: "Moonlit island",
      description: "Owner-supplied Muster development cover, 2026-09-12",
      originalFilename: "moonlit-island.png",
      mimeType: "image/png",
      fileSize: buffer.length,
      width: 1672,
      height: 941,
      checksum,
      createdBy: tale.creatorId,
      createdByAccountId: tale.creatorAccountId,
      variants: {
        create: {
          role: "PREVIEW",
          storageKey,
          mimeType: "image/png",
          fileSize: buffer.length,
          width: 1672,
          height: 941,
          checksum,
        },
      },
    },
    include: { variants: true },
  });
  await db.chronicle.updateMany({ where: { id: tale.id, coverAssetId: null }, data: { coverAssetId: asset.id } });
  return asset;
}

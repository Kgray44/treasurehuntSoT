import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/tall-tale/publishing";
import { getStudioTale } from "@/tall-tale/studio-service";
import { logger } from "@/lib/logger";

const supported = new Map([
  ["image/png", { mediaType: "IMAGE", extension: ".png" }],
  ["image/jpeg", { mediaType: "IMAGE", extension: ".jpg" }],
  ["image/webp", { mediaType: "IMAGE", extension: ".webp" }],
  ["image/avif", { mediaType: "IMAGE", extension: ".avif" }],
  ["video/mp4", { mediaType: "VIDEO", extension: ".mp4" }],
  ["video/webm", { mediaType: "VIDEO", extension: ".webm" }],
  ["audio/mpeg", { mediaType: "AUDIO", extension: ".mp3" }],
  ["audio/ogg", { mediaType: "AUDIO", extension: ".ogg" }],
  ["audio/wav", { mediaType: "AUDIO", extension: ".wav" }],
  ["application/pdf", { mediaType: "DOCUMENT", extension: ".pdf" }],
]);

function storageRoot() {
  const configured = process.env.TALL_TALE_ASSET_ROOT;
  if (configured) {
    if (!path.isAbsolute(configured)) throw new Error("Asset storage is not configured correctly.");
    return path.normalize(configured);
  }
  return path.join(process.cwd(), ".data", "tall-tale-assets");
}

function keyPath(storageKey: string) {
  if (!/^[a-f0-9-]+\/[a-f0-9-]+\.[a-z0-9]+$/.test(storageKey)) throw new Error("The requested asset cannot be opened.");
  const root = storageRoot();
  const resolved = path.join(/* turbopackIgnore: true */ root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("The requested asset cannot be opened.");
  return resolved;
}

export interface TaleAssetStorage {
  write(storageKey: string, buffer: Buffer): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
}

class LocalTaleAssetStorage implements TaleAssetStorage {
  async write(storageKey: string, buffer: Buffer) {
    const target = keyPath(storageKey);
    await mkdir(/* turbopackIgnore: true */ path.dirname(target), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ target, buffer, { flag: "wx" });
  }

  read(storageKey: string) {
    return readFile(/* turbopackIgnore: true */ keyPath(storageKey));
  }
}

const assetStorage: TaleAssetStorage = new LocalTaleAssetStorage();

function hasValidSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimeType === "image/webp")
    return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (mimeType === "image/avif") return buffer.subarray(4, 12).toString().includes("ftyp");
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (mimeType === "video/mp4") return buffer.subarray(4, 12).toString().includes("ftyp");
  if (mimeType === "video/webm" || mimeType === "audio/webm")
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === "audio/mpeg")
    return buffer.subarray(0, 3).toString() === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mimeType === "audio/ogg") return buffer.subarray(0, 4).toString() === "OggS";
  if (mimeType === "audio/wav")
    return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WAVE";
  return false;
}

async function store(storageKey: string, buffer: Buffer) {
  await assetStorage.write(storageKey, buffer);
}

async function derivativeSet(buffer: Buffer, folder: string) {
  const metadata = await sharp(buffer).metadata();
  const definitions = [
    { role: "THUMBNAIL", width: 360, quality: 72 },
    { role: "PREVIEW", width: 960, quality: 78 },
    { role: "OPTIMIZED", width: 1800, quality: 84 },
    { role: "MOBILE", width: 900, quality: 80 },
  ];
  const items: Array<{
    role: string;
    storageKey: string;
    mimeType: string;
    buffer: Buffer;
    width: number | null;
    height: number | null;
    checksum: string;
  }> = [];
  for (const definition of definitions) {
    const output = await sharp(buffer)
      .rotate()
      .resize({ width: definition.width, withoutEnlargement: true })
      .webp({ quality: definition.quality })
      .toBuffer({ resolveWithObject: true });
    const storageKey = `${folder}/${randomUUID()}.webp`;
    items.push({
      role: definition.role,
      storageKey,
      mimeType: "image/webp",
      buffer: output.data,
      width: output.info.width,
      height: output.info.height,
      checksum: createHash("sha256").update(output.data).digest("hex"),
    });
  }
  return { width: metadata.width ?? null, height: metadata.height ?? null, items };
}

export async function ingestAsset(taleId: string, file: File, userId: string, replaceAssetId?: string) {
  const definition = supported.get(file.type);
  if (!definition)
    throw new Error(
      "This file type cannot be uploaded. Choose PNG, JPEG, WebP, AVIF, MP4, WebM, MP3, Ogg, WAV, or PDF.",
    );
  const maximum = Number(process.env.TALL_TALE_MAX_UPLOAD_MB ?? 25) * 1024 * 1024;
  if (!file.size || file.size > maximum)
    throw new Error(`Choose a file smaller than ${Math.round(maximum / 1024 / 1024)} MB.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidSignature(buffer, file.type))
    throw new Error(
      "The file content does not match its file type. Choose the file again or export it in a supported format.",
    );
  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (!replaceAssetId) {
    const duplicate = await db.taleAsset.findUnique({
      where: { taleId_checksum: { taleId, checksum } },
      include: { variants: true, tags: { include: { tag: true } }, roles: true },
    });
    if (duplicate) {
      logger.info(
        { area: "tall-tale-assets", taleId, assetId: duplicate.id },
        "Duplicate upload reused existing asset",
      );
      return { asset: duplicate, duplicate: true };
    }
  }
  const folder = randomUUID();
  const originalKey = `${folder}/${randomUUID()}${definition.extension}`;
  await store(originalKey, buffer);
  let width: number | null = null;
  let height: number | null = null;
  let derivatives: Awaited<ReturnType<typeof derivativeSet>>["items"] = [];
  if (definition.mediaType === "IMAGE") {
    const processed = await derivativeSet(buffer, folder);
    width = processed.width;
    height = processed.height;
    derivatives = processed.items;
    for (const item of derivatives) await store(item.storageKey, item.buffer);
  }
  const asset = await db.$transaction(async (tx) => {
    const record = replaceAssetId
      ? await tx.taleAsset.update({
          where: { id: replaceAssetId },
          data: {
            displayName: file.name.replace(/\.[^.]+$/, ""),
            originalFilename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            width,
            height,
            checksum,
            mediaType: definition.mediaType,
            deletedAt: null,
          },
        })
      : await tx.taleAsset.create({
          data: {
            taleId,
            mediaType: definition.mediaType,
            displayName: file.name.replace(/\.[^.]+$/, ""),
            originalFilename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            width,
            height,
            checksum,
            createdBy: userId,
          },
        });
    const original = await tx.taleAssetVariant.create({
      data: {
        assetId: record.id,
        role: "ORIGINAL",
        storageKey: originalKey,
        mimeType: file.type,
        fileSize: file.size,
        width,
        height,
        checksum,
      },
    });
    let optimizedVariantId: string | null = null;
    for (const item of derivatives) {
      const derivative = await tx.taleAssetVariant.create({
        data: {
          assetId: record.id,
          role: item.role,
          storageKey: item.storageKey,
          mimeType: item.mimeType,
          fileSize: item.buffer.length,
          width: item.width,
          height: item.height,
          checksum: item.checksum,
        },
      });
      if (item.role === "OPTIMIZED") optimizedVariantId = derivative.id;
    }
    await tx.taleAsset.update({
      where: { id: record.id },
      data: { currentVariantId: optimizedVariantId ?? original.id },
    });
    return tx.taleAsset.findUniqueOrThrow({
      where: { id: record.id },
      include: { variants: { orderBy: { createdAt: "desc" } }, tags: { include: { tag: true } }, roles: true },
    });
  });
  logger.info(
    {
      area: "tall-tale-assets",
      taleId,
      assetId: asset.id,
      mediaType: asset.mediaType,
      replacement: Boolean(replaceAssetId),
    },
    "Chronicle asset ingested",
  );
  return { asset, duplicate: false };
}

export async function assetUsages(taleId: string, assetId: string) {
  const studio = await getStudioTale(taleId);
  const usages: Array<{ type: string; id: string; label: string; field?: string }> = [];
  if (studio.tale.coverAssetId === assetId)
    usages.push({ type: "tale", id: taleId, label: "Chronicle cover", field: "coverAssetId" });
  for (const chapter of studio.draft.chapters) {
    if (chapter.coverAssetId === assetId)
      usages.push({ type: "chapter", id: chapter.id, label: `${chapter.title} cover`, field: "coverAssetId" });
    for (const block of chapter.blocks)
      for (const [field, value] of Object.entries(block.configuration))
        if (value === assetId) usages.push({ type: "block", id: block.id, label: block.title, field });
  }
  for (const location of studio.locations)
    for (const field of ["mapAssetId", "displayAssetId"] as const)
      if (location[field] === assetId) usages.push({ type: "location", id: location.id, label: location.name, field });
  for (const artifact of studio.artifacts)
    for (const field of ["artworkAssetId", "revealVideoAssetId", "modelAssetId"] as const)
      if (artifact[field] === assetId) usages.push({ type: "artifact", id: artifact.id, label: artifact.name, field });
  return usages;
}

export async function updateAsset(
  assetId: string,
  input: { displayName?: string; description?: string; tags?: string[]; roles?: string[]; collectionIds?: string[] },
) {
  const asset = await db.taleAsset.findUniqueOrThrow({ where: { id: assetId } });
  return db.$transaction(async (tx) => {
    await tx.taleAsset.update({
      where: { id: assetId },
      data: { displayName: input.displayName?.trim() || undefined, description: input.description?.trim() || null },
    });
    if (input.tags) {
      await tx.taleAssetTagLink.deleteMany({ where: { assetId } });
      for (const name of [...new Set(input.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))]) {
        const tag = await tx.taleAssetTag.upsert({
          where: { taleId_name: { taleId: asset.taleId, name } },
          update: {},
          create: { taleId: asset.taleId, name },
        });
        await tx.taleAssetTagLink.create({ data: { assetId, tagId: tag.id } });
      }
    }
    if (input.roles) {
      await tx.taleAssetRole.deleteMany({ where: { assetId } });
      for (const role of [...new Set(input.roles)]) await tx.taleAssetRole.create({ data: { assetId, role } });
    }
    if (input.collectionIds) {
      await tx.taleAssetCollectionItem.deleteMany({ where: { assetId } });
      for (const collectionId of input.collectionIds)
        await tx.taleAssetCollectionItem.create({ data: { assetId, collectionId } });
    }
    return tx.taleAsset.findUniqueOrThrow({
      where: { id: assetId },
      include: { variants: true, tags: { include: { tag: true } }, roles: true, collectionItems: true },
    });
  });
}

export async function archiveAsset(assetId: string) {
  const asset = await db.taleAsset.findUniqueOrThrow({ where: { id: assetId } });
  const usages = await assetUsages(asset.taleId, assetId);
  if (usages.length) return { archived: false, usages };
  await db.taleAsset.update({ where: { id: assetId }, data: { deletedAt: new Date() } });
  return { archived: true, usages: [] };
}

export async function resolveAssetVariant(assetId: string, requestedRole: string, versionIdentity?: string) {
  let allowedVariantIds: Set<string> | null = null;
  if (versionIdentity && !versionIdentity.startsWith("draft:")) {
    const version = await db.publishedTaleVersion.findUnique({ where: { id: versionIdentity } });
    if (!version) throw new Error("This published Version could not be found.");
    const asset = parsePublishedSnapshot(version.contentSnapshot).assets.find((item) => item.id === assetId);
    if (!asset) throw new Error("This asset is not part of the selected published Version.");
    allowedVariantIds = new Set(asset.variants?.map((variant) => variant.id) ?? []);
  }
  const candidates = await db.taleAssetVariant.findMany({ where: { assetId }, orderBy: { createdAt: "desc" } });
  const allowed = allowedVariantIds
    ? candidates.filter((candidate) => allowedVariantIds.has(candidate.id))
    : candidates;
  const variant =
    allowed.find((candidate) => candidate.role === requestedRole) ??
    allowed.find((candidate) => candidate.role === "OPTIMIZED") ??
    allowed.find((candidate) => candidate.role === "ORIGINAL");
  if (!variant) throw new Error("This asset file is unavailable. Upload it again or choose another asset.");
  return { variant, buffer: await assetStorage.read(variant.storageKey) };
}

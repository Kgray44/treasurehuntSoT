import { privateFailure } from "./core";
import type { PrivatePackageAsset } from "./core";

const invalid = () => privateFailure("PRIVATE_PACKAGE_INVALID", "A private asset failed structural validation.");
const u32 = (bytes: Buffer, offset: number) => bytes.readUInt32BE(offset);

function validateImage(bytes: Buffer, mediaType: string) {
  if (mediaType === "image/png") {
    if (
      !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
      bytes.length < 33
    )
      throw invalid();
    const width = u32(bytes, 16);
    const height = u32(bytes, 20);
    if (!width || !height || width * height > 100_000_000 || !bytes.includes(Buffer.from("IEND"))) throw invalid();
  } else if (mediaType === "image/gif") {
    if (!/GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii")) || bytes.length < 10) throw invalid();
    const pixels = bytes.readUInt16LE(6) * bytes.readUInt16LE(8);
    if (!pixels || pixels > 100_000_000) throw invalid();
  } else if (mediaType === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)
      throw invalid();
  } else if (mediaType === "image/webp") {
    if (bytes.length < 16 || bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WEBP")
      throw invalid();
  } else if (mediaType === "image/avif") {
    if (
      bytes.length < 16 ||
      bytes.subarray(4, 8).toString() !== "ftyp" ||
      !bytes.subarray(8, 16).includes(Buffer.from("avif"))
    )
      throw invalid();
  }
}

function validateAudio(bytes: Buffer, mediaType: string) {
  const valid =
    (mediaType === "audio/wav" &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WAVE") ||
    (mediaType === "audio/ogg" && bytes.subarray(0, 4).toString() === "OggS") ||
    (mediaType === "audio/mpeg" &&
      (bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)));
  if (!valid) throw invalid();
}

function validateVideo(bytes: Buffer, mediaType: string) {
  const valid =
    (mediaType === "video/mp4" && bytes.length >= 12 && bytes.subarray(4, 8).toString() === "ftyp") ||
    (mediaType === "video/webm" &&
      bytes.length >= 4 &&
      bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));
  if (!valid) throw invalid();
}

function validatePdf(bytes: Buffer) {
  const text = bytes.toString("latin1");
  if (
    !text.startsWith("%PDF-") ||
    !text.includes("%%EOF") ||
    /\/(?:JavaScript|JS|EmbeddedFile|Launch|OpenAction)\b/i.test(text)
  )
    throw invalid();
}

function validateGlb(bytes: Buffer) {
  if (
    bytes.length < 20 ||
    bytes.subarray(0, 4).toString() !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw invalid();
  let offset = 12;
  let json: Record<string, unknown> | undefined;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw invalid();
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 || offset + length > bytes.length) throw invalid();
    if (type === 0x4e4f534a) {
      if (json) throw invalid();
      try {
        json = JSON.parse(
          bytes
            .subarray(offset, offset + length)
            .toString("utf8")
            .replace(/\0+$/, ""),
        );
      } catch {
        throw invalid();
      }
    }
    offset += length;
  }
  if (offset !== bytes.length || !json) throw invalid();
  const arrays = ["nodes", "meshes", "materials", "textures", "animations"] as const;
  for (const name of arrays) if (Array.isArray(json[name]) && json[name].length > 10_000) throw invalid();
  const rejectUris = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(rejectUris);
    if (value && typeof value === "object")
      return Object.entries(value as Record<string, unknown>).some(([key, item]) => key === "uri" || rejectUris(item));
    return false;
  };
  if (rejectUris(json)) throw invalid();
}

/** Bounded, structural media validation before scan and storage finalization. */
export function validatePrivateMediaAsset(asset: PrivatePackageAsset, bytes: Buffer) {
  if (!bytes.length || bytes.length !== asset.byteLength) throw invalid();
  if (asset.representation === "image") validateImage(bytes, asset.mediaType);
  else if (asset.representation === "audio") validateAudio(bytes, asset.mediaType);
  else if (asset.representation === "video") validateVideo(bytes, asset.mediaType);
  else if (asset.representation === "document") validatePdf(bytes);
  else if (asset.representation === "model-3d" && asset.mediaType === "model/gltf-binary") validateGlb(bytes);
}

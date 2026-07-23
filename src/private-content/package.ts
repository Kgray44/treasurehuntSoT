import { createCipheriv, createDecipheriv, randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { z } from "zod";
import {
  assertSafeArchivePath,
  PRIVATE_PACKAGE_FORMAT,
  PRIVATE_PACKAGE_VERSION,
  privateFailure,
  privateLimits,
  sha256,
  type PrivatePackageEnvelope,
  type PrivatePackageManifest,
  type PrivatePayload,
} from "./core";
import { validatePrivateMediaAsset } from "./media-validation";

const base64 = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);
const envelopeSchema = z.object({
  format: z.literal(PRIVATE_PACKAGE_FORMAT),
  envelopeVersion: z.literal(1),
  payloadFormatVersion: z.literal(1),
  cipher: z.literal("aes-256-gcm"),
  keyDerivation: z.literal("scrypt"),
  kdf: z.object({ N: z.literal(32768), r: z.literal(8), p: z.literal(1), keyLength: z.literal(32) }),
  salt: base64,
  nonce: base64,
  authenticationTag: base64,
  encryptedPayloadBytes: z.number().int().positive(),
  encryptedPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
});
const manifestSchema = z
  .object({
    packageId: z.string().min(1).max(120),
    packageRevision: z.number().int().positive(),
    formatVersion: z.literal(1),
    createdAt: z.string().datetime(),
    sourceApplicationVersion: z.string().min(1),
    minimumApplicationVersion: z.string().min(1),
    maximumApplicationVersion: z.string().optional(),
    classification: z.literal("private"),
    contentType: z.enum(["tale-draft", "published-tale", "tale-archive"]),
    tales: z
      .array(
        z.object({
          logicalId: z.string().min(1),
          slug: z.string().min(1),
          title: z.string().min(1),
          contentPath: z.string().min(1),
        }),
      )
      .min(1),
    assets: z.array(
      z.object({
        logicalId: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        relativePath: z.string().min(1),
        mediaType: z.string().min(1),
        byteLength: z.number().int().positive(),
        representation: z.enum(["image", "audio", "video", "document", "model-3d", "binary"]),
        role: z.string().optional(),
      }),
    ),
    dependencies: z.array(z.object({ logicalId: z.string().min(1), kind: z.string().min(1), required: z.boolean() })),
    totals: z.object({
      files: z.number().int().positive(),
      assets: z.number().int().nonnegative(),
      plaintextBytes: z.number().int().positive(),
    }),
  })
  .strict();

async function derive(passphrase: string, salt: Buffer) {
  if (!passphrase) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(Buffer.from(key));
    });
  });
}

export type PrivatePackage = { envelope: PrivatePackageEnvelope; payload: string };

function decoded(value: string, expectedLength?: number) {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const bytes = Buffer.from(value, "base64url");
  // Node intentionally accepts several malformed base64 spellings.  Re-encode
  // to make the serialized envelope canonical before cryptographic use.
  if (
    !bytes.length ||
    bytes.toString("base64url") !== value.replace(/=+$/, "") ||
    (expectedLength && bytes.length !== expectedLength)
  )
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return bytes;
}

function canonicalAad(
  envelope: Omit<PrivatePackageEnvelope, "authenticationTag" | "encryptedPayloadBytes" | "encryptedPayloadSha256">,
) {
  return Buffer.from(JSON.stringify(envelope));
}

export async function encryptPrivatePayload(payload: PrivatePayload, passphrase: string): Promise<Buffer> {
  validatePayload(payload);
  const plaintext = Buffer.from(JSON.stringify(payload));
  if (plaintext.length > privateLimits().plaintextBytes) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const createdAt = new Date().toISOString();
  const partial = {
    format: PRIVATE_PACKAGE_FORMAT,
    envelopeVersion: 1 as const,
    payloadFormatVersion: PRIVATE_PACKAGE_VERSION,
    cipher: "aes-256-gcm" as const,
    keyDerivation: "scrypt" as const,
    kdf: { N: 32768 as const, r: 8 as const, p: 1 as const, keyLength: 32 as const },
    salt: salt.toString("base64url"),
    nonce: nonce.toString("base64url"),
    createdAt,
  };
  const cipher = createCipheriv("aes-256-gcm", await derive(passphrase, salt), nonce);
  cipher.setAAD(canonicalAad(partial));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: PrivatePackageEnvelope = {
    ...partial,
    authenticationTag: cipher.getAuthTag().toString("base64url"),
    encryptedPayloadBytes: encrypted.length,
    encryptedPayloadSha256: sha256(encrypted),
  };
  return Buffer.from(JSON.stringify({ envelope, payload: encrypted.toString("base64url") } satisfies PrivatePackage));
}

export async function decryptPrivatePackage(bytes: Buffer, passphrase: string): Promise<PrivatePayload> {
  if (!bytes.length || bytes.length > privateLimits().packageBytes)
    throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as PrivatePackage;
    if (
      parsed?.envelope?.format !== PRIVATE_PACKAGE_FORMAT ||
      parsed?.envelope?.envelopeVersion !== 1 ||
      parsed?.envelope?.payloadFormatVersion !== PRIVATE_PACKAGE_VERSION
    )
      throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
    if (parsed?.envelope?.cipher !== "aes-256-gcm" || parsed?.envelope?.keyDerivation !== "scrypt")
      throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
    const envelope = envelopeSchema.parse(parsed.envelope) as PrivatePackageEnvelope;
    const encrypted = decoded(parsed.payload);
    const salt = decoded(envelope.salt, 16);
    const nonce = decoded(envelope.nonce, 12);
    const tag = decoded(envelope.authenticationTag, 16);
    if (encrypted.length !== envelope.encryptedPayloadBytes || sha256(encrypted) !== envelope.encryptedPayloadSha256)
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    const decipher = createDecipheriv("aes-256-gcm", await derive(passphrase, salt), nonce);
    const {
      authenticationTag: _tag,
      encryptedPayloadBytes: _bytes,
      encryptedPayloadSha256: _sha,
      ...partial
    } = envelope;
    decipher.setAAD(canonicalAad(partial));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    if (plaintext.length > privateLimits().plaintextBytes) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    const payload = JSON.parse(plaintext.toString("utf8")) as PrivatePayload;
    validatePayload(payload);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "PrivateContentError") throw error;
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  }
}

export function validatePayload(payload: PrivatePayload): PrivatePackageManifest {
  const manifest = manifestSchema.parse(payload.manifest) as PrivatePackageManifest;
  const paths = Object.keys(payload.entries);
  const normalized = paths.map(assertSafeArchivePath);
  const folded = new Set<string>();
  if (
    paths.length !== new Set(normalized).size ||
    normalized.some((item) => {
      const key = item.toLocaleLowerCase();
      if (folded.has(key)) return true;
      folded.add(key);
      return false;
    }) ||
    paths.length > privateLimits().fileCount
  )
    throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
  let size = 0;
  for (const entryPath of normalized) {
    const bytes = Buffer.from(payload.entries[entryPath] ?? "", "base64url");
    size += bytes.length;
    if (bytes.length > privateLimits().assetBytes || payload.checksums[entryPath] !== sha256(bytes))
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
  }
  if (
    size > privateLimits().plaintextBytes ||
    manifest.totals.files !== paths.length ||
    manifest.totals.assets !== manifest.assets.length ||
    manifest.totals.plaintextBytes !== size
  )
    throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  for (const tale of manifest.tales)
    if (!payload.entries[assertSafeArchivePath(tale.contentPath)]) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const logicalAssets = new Set<string>();
  const approvedMedia: Record<PrivatePackageManifest["assets"][number]["representation"], RegExp> = {
    image: /^image\/(?:avif|gif|jpeg|png|webp)$/,
    audio: /^audio\/(?:mpeg|ogg|wav)$/,
    video: /^video\/(?:mp4|webm)$/,
    document: /^application\/pdf$/,
    "model-3d": /^(?:model\/gltf-binary|model\/gltf\+json)$/,
    binary: /^application\/octet-stream$/,
  };
  for (const asset of manifest.assets) {
    if (logicalAssets.has(asset.logicalId) || !approvedMedia[asset.representation].test(asset.mediaType))
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    logicalAssets.add(asset.logicalId);
    const bytes = Buffer.from(payload.entries[assertSafeArchivePath(asset.relativePath)] ?? "", "base64url");
    const expectedMagic =
      asset.representation === "image" && asset.mediaType === "image/png"
        ? Buffer.from([0x89, 0x50, 0x4e, 0x47])
        : asset.representation === "document"
          ? Buffer.from("%PDF-")
          : asset.representation === "model-3d"
            ? Buffer.from("glTF")
            : undefined;
    if (
      !bytes.length ||
      bytes.length !== asset.byteLength ||
      sha256(bytes) !== asset.sha256 ||
      (expectedMagic && !bytes.subarray(0, expectedMagic.length).equals(expectedMagic))
    )
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    validatePrivateMediaAsset(asset, bytes);
  }
  return manifest;
}

export function makePayload(input: Omit<PrivatePayload, "checksums">): PrivatePayload {
  const checksums = Object.fromEntries(
    Object.entries(input.entries).map(([key, value]) => [key, sha256(Buffer.from(value, "base64url"))]),
  );
  const payload = { ...input, checksums };
  validatePayload(payload);
  return payload;
}

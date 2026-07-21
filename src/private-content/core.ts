import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export const PRIVATE_PACKAGE_FORMAT = "forever-treasure-private-package" as const;
export const PRIVATE_PACKAGE_EXTENSION = ".ftprivate";
export const PRIVATE_PACKAGE_VERSION = 1 as const;
export const PRIVATE_SENTINEL = "SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL-73A9C1";

export type PrivateContentFailureCode =
  | "PRIVATE_PACKAGE_AUTHENTICATION_FAILED"
  | "PRIVATE_PACKAGE_INVALID"
  | "PRIVATE_PACKAGE_UNSUPPORTED"
  | "PRIVATE_PACKAGE_LIMIT_EXCEEDED"
  | "PRIVATE_PACKAGE_PATH_REJECTED"
  | "PRIVATE_PACKAGE_CHECKSUM_MISMATCH"
  | "PRIVATE_PACKAGE_CONFLICT"
  | "PRIVATE_CONTENT_CONFIGURATION_INVALID"
  | "PRIVATE_CONTENT_FORBIDDEN";

export class PrivateContentError extends Error {
  readonly correlationId: string;
  constructor(
    readonly code: PrivateContentFailureCode,
    message: string,
    correlationId = randomUUID(),
  ) {
    super(message);
    this.name = "PrivateContentError";
    this.correlationId = correlationId;
  }
}

export const safeMessage = "The private package could not be authenticated or opened.";

export function privateFailure(code: PrivateContentFailureCode, message = safeMessage): PrivateContentError {
  return new PrivateContentError(code, message);
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function numberSetting(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallback;
}

export const privateLimits = () => ({
  packageBytes: numberSetting("PRIVATE_CONTENT_MAX_PACKAGE_BYTES", 32 * 1024 * 1024, 128 * 1024 * 1024),
  plaintextBytes: numberSetting("PRIVATE_CONTENT_MAX_PLAINTEXT_BYTES", 48 * 1024 * 1024, 192 * 1024 * 1024),
  assetBytes: numberSetting("PRIVATE_CONTENT_MAX_ASSET_BYTES", 24 * 1024 * 1024, 96 * 1024 * 1024),
  fileCount: numberSetting("PRIVATE_CONTENT_MAX_FILE_COUNT", 256, 4096),
  pathLength: 180,
  jsonDepth: 24,
});

export type PrivatePackageAsset = {
  logicalId: string;
  sha256: string;
  relativePath: string;
  mediaType: string;
  byteLength: number;
  representation: "image" | "audio" | "video" | "document" | "model-3d" | "binary";
  role?: string;
};

export type PrivatePackageManifest = {
  packageId: string;
  packageRevision: number;
  formatVersion: 1;
  createdAt: string;
  sourceApplicationVersion: string;
  minimumApplicationVersion: string;
  maximumApplicationVersion?: string;
  classification: "private";
  contentType: "tale-draft" | "published-tale" | "tale-archive";
  tales: Array<{ logicalId: string; slug: string; title: string; contentPath: string }>;
  assets: PrivatePackageAsset[];
  dependencies: Array<{ logicalId: string; kind: string; required: boolean }>;
  totals: { files: number; assets: number; plaintextBytes: number };
};

export type PrivatePackageEnvelope = {
  format: typeof PRIVATE_PACKAGE_FORMAT;
  envelopeVersion: 1;
  payloadFormatVersion: 1;
  cipher: "aes-256-gcm";
  keyDerivation: "scrypt";
  kdf: { N: 32768; r: 8; p: 1; keyLength: 32 };
  salt: string;
  nonce: string;
  authenticationTag: string;
  encryptedPayloadBytes: number;
  encryptedPayloadSha256: string;
  createdAt: string;
};

export type PrivatePayload = {
  manifest: PrivatePackageManifest;
  entries: Record<string, string>;
  checksums: Record<string, string>;
};

export function assertSafeArchivePath(candidate: string) {
  const normalized = candidate.normalize("NFC").replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.length > privateLimits().pathLength ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[a-z]:/i.test(normalized) ||
    normalized
      .split("/")
      .some(
        (part) =>
          !part || part === "." || part === ".." || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part),
      ) ||
    /\.(?:exe|dll|bat|cmd|ps1|sh|js|ts|zip|tar|gz|ftprivate)$/i.test(normalized)
  )
    throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
  return normalized;
}

export function isWithin(parent: string, candidate: string) {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  if (path.parse(resolvedParent).root.toLocaleLowerCase() !== path.parse(resolvedCandidate).root.toLocaleLowerCase())
    return false;
  const relative = path.relative(resolvedParent, resolvedCandidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

const forbiddenLogKey = /passphrase|password|secret|token|key|payload|private.*(?:text|path|name)|filename|staging/i;
export function redactPrivate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPrivate);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        forbiddenLogKey.test(key) ? "[REDACTED]" : redactPrivate(item),
      ]),
    );
  return typeof value === "string" && value.includes(PRIVATE_SENTINEL) ? "[REDACTED]" : value;
}

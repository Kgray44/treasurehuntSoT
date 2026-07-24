import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type {
  PrivateObjectDescriptor,
  PrivateObjectNamespace,
  PrivateStorageProvider,
  PrivateWriteOptions,
} from "./contracts";
import { isWithin, privateFailure } from "./core";

const namespaces = new Set<PrivateObjectNamespace>(["uploads", "normalized", "objects", "quarantine", "backups"]);
type MultipartManifest = {
  key: string;
  expectedBytes?: number;
  parts: Record<string, { etag: string; byteLength: number }>;
};

function configuredRoot(value: string | undefined) {
  if (!value || !path.isAbsolute(value))
    throw privateFailure(
      "PRIVATE_CONTENT_CONFIGURATION_INVALID",
      "Private provider storage is not configured securely.",
    );
  const root = path.resolve(value);
  const repository = path.resolve(process.cwd());
  if (
    [repository, path.join(repository, "public"), path.join(repository, ".next"), path.join(repository, "src")].some(
      (forbidden) => isWithin(forbidden, root) || isWithin(root, forbidden),
    )
  )
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private provider storage root is unsafe.");
  return root;
}

function safeKey(value: string) {
  const normalized = value.normalize("NFC").replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.length > 512 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(normalized)
  )
    throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
  return normalized;
}

function descriptorKey(namespace: PrivateObjectNamespace, key: string) {
  return `${namespace}/${safeKey(key)}`;
}

function digestDescriptor(
  key: string,
  bytes: number,
  digest: string,
  metadata?: Record<string, string>,
): PrivateObjectDescriptor {
  return { key, sha256: digest, byteLength: bytes, metadata };
}

/**
 * Private, filesystem-backed implementation used for development and isolated tests.
 * It never exposes a filesystem path as a storage key and all writes are streamed via
 * a private temporary file before an immutable rename into the requested namespace.
 */
export class LocalPhase2PrivateStorageProvider implements PrivateStorageProvider {
  readonly name = "local-private-phase2";
  readonly supportsMultipart = true;
  readonly supportsSignedRead = false;
  readonly root: string;
  private readonly multipartRoot: string;

  constructor(input: { root?: string } = {}) {
    this.root = configuredRoot(input.root ?? process.env.PRIVATE_CONTENT_PROVIDER_ROOT);
    this.multipartRoot = path.join(this.root, ".multipart");
  }

  async health() {
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      await access(this.root);
      return { configured: true, healthy: true };
    } catch {
      return { configured: true, healthy: false };
    }
  }

  private pathForKey(key: string) {
    const normalized = safeKey(key);
    const destination = path.resolve(this.root, ...normalized.split("/"));
    if (!isWithin(this.root, destination)) throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
    return destination;
  }

  private async writeStream(target: string, body: Readable, options: PrivateWriteOptions) {
    const temporary = `${target}.${randomUUID()}.incoming`;
    const hash = createHash("sha256");
    let byteLength = 0;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      handle = await open(temporary, "wx", 0o600);
      for await (const chunk of body) {
        if (options.signal?.aborted) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private upload was cancelled.");
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteLength += bytes.length;
        if (options.contentLength !== undefined && byteLength > options.contentLength)
          throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
        hash.update(bytes);
        await handle.write(bytes);
      }
      const sha256 = hash.digest("hex");
      if (options.contentLength !== undefined && byteLength !== options.contentLength)
        throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
      if (options.expectedSha256 && sha256 !== options.expectedSha256)
        throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
      await handle.close();
      handle = undefined;
      return { temporary, byteLength, sha256 };
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async immutableRename(temporary: string, destination: string, expectedSha256: string, byteLength: number) {
    try {
      await rename(temporary, destination);
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EEXIST"))
        throw error;
      await rm(temporary, { force: true });
      const existing = await this.descriptorForKey(path.relative(this.root, destination).replaceAll(path.sep, "/"));
      if (existing.sha256 !== expectedSha256 || existing.byteLength !== byteLength)
        throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    }
  }

  private async descriptorForKey(key: string, metadata?: Record<string, string>) {
    const target = this.pathForKey(key);
    const hash = createHash("sha256");
    let byteLength = 0;
    for await (const chunk of createReadStream(target)) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(bytes);
      byteLength += bytes.length;
    }
    return digestDescriptor(safeKey(key), byteLength, hash.digest("hex"), metadata);
  }

  async put(namespace: PrivateObjectNamespace, key: string, body: Readable, options: PrivateWriteOptions) {
    if (!namespaces.has(namespace)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const storageKey = descriptorKey(namespace, key);
    const target = this.pathForKey(storageKey);
    const written = await this.writeStream(target, body, options);
    await this.immutableRename(written.temporary, target, written.sha256, written.byteLength);
    return digestDescriptor(storageKey, written.byteLength, written.sha256, options.metadata);
  }

  async read(object: PrivateObjectDescriptor, range?: { start: number; end?: number }) {
    const target = this.pathForKey(object.key);
    const info = await stat(target);
    if (!range) return createReadStream(target);
    if (!Number.isSafeInteger(range.start) || range.start < 0 || range.start >= info.size)
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    const end = range.end ?? info.size - 1;
    if (!Number.isSafeInteger(end) || end < range.start || end >= info.size)
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return createReadStream(target, { start: range.start, end });
  }

  async exists(object: Pick<PrivateObjectDescriptor, "key" | "sha256">) {
    try {
      const descriptor = await this.descriptorForKey(object.key);
      return descriptor.sha256 === object.sha256;
    } catch {
      return false;
    }
  }

  async promote(source: PrivateObjectDescriptor, destination: { namespace: PrivateObjectNamespace; key: string }) {
    if (!namespaces.has(destination.namespace)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const verified = await this.descriptorForKey(source.key);
    if (verified.sha256 !== source.sha256 || verified.byteLength !== source.byteLength)
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    const storageKey = descriptorKey(destination.namespace, destination.key);
    const target = this.pathForKey(storageKey);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    try {
      await copyFile(this.pathForKey(source.key), target, 1);
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EEXIST"))
        throw error;
      const present = await this.descriptorForKey(storageKey);
      if (present.sha256 !== source.sha256 || present.byteLength !== source.byteLength)
        throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    }
    return digestDescriptor(storageKey, source.byteLength, source.sha256, source.metadata);
  }

  async moveToQuarantine(object: PrivateObjectDescriptor, reason: string) {
    const reasonCode = /^[A-Z0-9_]{1,64}$/.test(reason) ? reason : "PRIVATE_QUARANTINE";
    const promoted = await this.promote(object, {
      namespace: "quarantine",
      key: `${reasonCode.toLowerCase()}/${randomUUID()}`,
    });
    await this.remove(object);
    return { ...promoted, metadata: { ...object.metadata, quarantineReason: reasonCode } };
  }

  async remove(object: PrivateObjectDescriptor) {
    await rm(this.pathForKey(object.key), { force: true });
  }

  private manifestPath(uploadId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(uploadId)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    return path.join(this.multipartRoot, uploadId, "manifest.json");
  }

  private async loadManifest(uploadId: string): Promise<MultipartManifest> {
    try {
      return JSON.parse(await readFile(this.manifestPath(uploadId), "utf8")) as MultipartManifest;
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_INVALID", "Private multipart upload was not found.");
    }
  }

  private async saveManifest(uploadId: string, manifest: MultipartManifest) {
    const manifestPath = this.manifestPath(uploadId);
    await writeFile(`${manifestPath}.next`, JSON.stringify(manifest), { encoding: "utf8", mode: 0o600 });
    await rename(`${manifestPath}.next`, manifestPath);
  }

  async beginMultipart(input: { key: string; expectedBytes?: number }) {
    const uploadId = randomUUID();
    const key = safeKey(input.key);
    if (input.expectedBytes !== undefined && (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 0))
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const directory = path.join(this.multipartRoot, uploadId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await this.saveManifest(uploadId, { key, expectedBytes: input.expectedBytes, parts: {} });
    return { uploadId };
  }

  async uploadPart(input: { uploadId: string; partNumber: number; body: Readable; expectedSha256: string }) {
    if (!Number.isSafeInteger(input.partNumber) || input.partNumber < 1 || !/^[a-f0-9]{64}$/.test(input.expectedSha256))
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const manifest = await this.loadManifest(input.uploadId);
    if (manifest.parts[String(input.partNumber)]) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    const target = path.join(this.multipartRoot, input.uploadId, `${input.partNumber}.part`);
    const written = await this.writeStream(target, input.body, { expectedSha256: input.expectedSha256 });
    await rename(written.temporary, target);
    manifest.parts[String(input.partNumber)] = { etag: written.sha256, byteLength: written.byteLength };
    await this.saveManifest(input.uploadId, manifest);
    return { etag: written.sha256, byteLength: written.byteLength };
  }

  async completeMultipart(input: { uploadId: string; parts: Array<{ partNumber: number; etag: string }> }) {
    const manifest = await this.loadManifest(input.uploadId);
    const expected = Object.entries(manifest.parts)
      .map(([partNumber, part]) => ({ partNumber: Number(partNumber), etag: part.etag }))
      .sort((a, b) => a.partNumber - b.partNumber);
    const supplied = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (JSON.stringify(expected) !== JSON.stringify(supplied)) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    const directory = path.join(this.multipartRoot, input.uploadId);
    const body = Readable.from(
      (async function* () {
        for (const part of expected) {
          for await (const chunk of createReadStream(path.join(directory, `${part.partNumber}.part`))) yield chunk;
        }
      })(),
    );
    const descriptor = await this.put("uploads", manifest.key, body, { contentLength: manifest.expectedBytes });
    await rm(directory, { recursive: true, force: true });
    return descriptor;
  }

  async abortMultipart(uploadId: string) {
    await rm(path.join(this.multipartRoot, uploadId), { recursive: true, force: true });
  }
}

/**
 * Production S3-compatible seam. Credentials and endpoints are intentionally not
 * guessed: until an application injects an exercised client, every data operation
 * fails closed and health truthfully reports an unconfigured provider.
 */
export class UnconfiguredS3CompatiblePrivateStorageProvider implements PrivateStorageProvider {
  readonly name = "s3-compatible-private-storage";
  readonly supportsMultipart = true;
  readonly supportsSignedRead = true;
  async health() {
    return { configured: false, healthy: false };
  }
  private unavailable(): never {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private S3-compatible storage is not configured.");
  }
  async put(
    _namespace: PrivateObjectNamespace,
    _key: string,
    _body: Readable,
    _options: PrivateWriteOptions,
  ): Promise<PrivateObjectDescriptor> {
    return this.unavailable();
  }
  async read(_object: PrivateObjectDescriptor, _range?: { start: number; end?: number }): Promise<Readable> {
    return this.unavailable();
  }
  async exists(_object: Pick<PrivateObjectDescriptor, "key" | "sha256">): Promise<boolean> {
    return this.unavailable();
  }
  async promote(
    _source: PrivateObjectDescriptor,
    _destination: { namespace: PrivateObjectNamespace; key: string },
  ): Promise<PrivateObjectDescriptor> {
    return this.unavailable();
  }
  async moveToQuarantine(_object: PrivateObjectDescriptor, _reason: string): Promise<PrivateObjectDescriptor> {
    return this.unavailable();
  }
  async remove(_object: PrivateObjectDescriptor): Promise<void> {
    return this.unavailable();
  }
  async beginMultipart(_input: { key: string; expectedBytes?: number }): Promise<{ uploadId: string }> {
    return this.unavailable();
  }
  async uploadPart(_input: {
    uploadId: string;
    partNumber: number;
    body: Readable;
    expectedSha256: string;
  }): Promise<{ etag: string; byteLength: number }> {
    return this.unavailable();
  }
  async completeMultipart(_input: {
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<PrivateObjectDescriptor> {
    return this.unavailable();
  }
  async abortMultipart(_uploadId: string): Promise<void> {
    return this.unavailable();
  }
}

import { createHash, createHmac, randomUUID } from "node:crypto";
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

const namespaces = new Set<PrivateObjectNamespace>([
  "uploads",
  "normalized",
  "objects",
  "derivatives",
  "quarantine",
  "backups",
]);
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
    // A repair retry must address the same immutable quarantine object.  A
    // random destination would turn a crash after copy and before the database
    // receipt into duplicate provider effects.
    const quarantineKey = `${reasonCode.toLowerCase()}/${object.sha256}`;
    const expected = digestDescriptor(descriptorKey("quarantine", quarantineKey), object.byteLength, object.sha256);
    const promoted = (await this.exists(expected))
      ? expected
      : await this.promote(object, { namespace: "quarantine", key: quarantineKey });
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

export type S3CompatibleObjectClient = {
  health(): Promise<{ healthy: boolean; providerVersion?: string }>;
  put(key: string, body: Readable, options: PrivateWriteOptions): Promise<{ sha256?: string; byteLength?: number }>;
  read(key: string, range?: { start: number; end?: number }): Promise<Readable>;
  head(key: string): Promise<{ sha256?: string; byteLength: number } | null>;
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  remove(key: string): Promise<void>;
  beginMultipart(key: string): Promise<{ uploadId: string }>;
  uploadPart(
    uploadId: string,
    key: string,
    partNumber: number,
    body: Readable,
    expectedSha256: string,
  ): Promise<{ etag: string; byteLength: number }>;
  completeMultipart(
    uploadId: string,
    key: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<{ sha256?: string; byteLength?: number }>;
  abortMultipart(uploadId: string, key: string): Promise<void>;
};

function privateS3Key(prefix: string, namespace: PrivateObjectNamespace, key: string) {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  return `${normalizedPrefix}/${descriptorKey(namespace, key)}`;
}

async function digestStream(stream: Readable) {
  const digest = createHash("sha256");
  let byteLength = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    digest.update(bytes);
    byteLength += bytes.length;
  }
  return { sha256: digest.digest("hex"), byteLength };
}

/**
 * Concrete S3/MinIO provider. It keeps namespace policy in this layer and delegates
 * protocol credentials to the injected S3 client, so route code cannot select a
 * bucket, prefix, or public access mode.
 */
export class S3CompatiblePrivateStorageProvider implements PrivateStorageProvider {
  readonly name: string;
  readonly supportsMultipart = true;
  readonly supportsSignedRead = false;
  private readonly uploads = new Map<string, { key: string }>();
  constructor(private readonly input: { client: S3CompatibleObjectClient; prefix: string; providerName?: string }) {
    if (!input.prefix || input.prefix.includes("..")) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
    this.name = input.providerName ?? "s3-compatible-private-storage";
  }
  async health() {
    try {
      const result = await this.input.client.health();
      return {
        configured: true,
        healthy: result.healthy,
        providerVersion: result.providerVersion,
        capabilities: ["private", "range", "multipart", "immutable-copy"],
      };
    } catch {
      return { configured: true, healthy: false, capabilities: ["private", "range", "multipart", "immutable-copy"] };
    }
  }
  private key(namespace: PrivateObjectNamespace, key: string) {
    return privateS3Key(this.input.prefix, namespace, key);
  }
  private async inspect(key: string) {
    const present = await this.input.client.head(key);
    if (!present) return null;
    if (present.sha256) return present;
    return { ...present, ...(await digestStream(await this.input.client.read(key))) };
  }
  private descriptor(
    namespace: PrivateObjectNamespace,
    key: string,
    sha256: string,
    byteLength: number,
    metadata?: Record<string, string>,
  ) {
    return digestDescriptor(descriptorKey(namespace, key), byteLength, sha256, metadata);
  }
  async put(namespace: PrivateObjectNamespace, key: string, body: Readable, options: PrivateWriteOptions) {
    const storageKey = this.key(namespace, key);
    const result = await this.input.client.put(storageKey, body, options);
    const present = await this.inspect(storageKey);
    if (
      !present ||
      (options.expectedSha256 && present.sha256 !== options.expectedSha256) ||
      (options.contentLength !== undefined && present.byteLength !== options.contentLength)
    )
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    return this.descriptor(
      namespace,
      key,
      present.sha256 ?? result.sha256 ?? options.expectedSha256 ?? "",
      present.byteLength,
      options.metadata,
    );
  }
  async read(object: PrivateObjectDescriptor, range?: { start: number; end?: number }) {
    return this.input.client.read(this.keyFromDescriptor(object.key), range);
  }
  private keyFromDescriptor(storageKey: string) {
    const [namespace, ...rest] = safeKey(storageKey).split("/");
    if (!namespaces.has(namespace as PrivateObjectNamespace)) throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
    return privateS3Key(this.input.prefix, namespace as PrivateObjectNamespace, rest.join("/"));
  }
  async exists(object: Pick<PrivateObjectDescriptor, "key" | "sha256">) {
    const present = await this.inspect(this.keyFromDescriptor(object.key));
    return Boolean(present && present.sha256 === object.sha256);
  }
  async promote(source: PrivateObjectDescriptor, destination: { namespace: PrivateObjectNamespace; key: string }) {
    const current = await this.inspect(this.keyFromDescriptor(source.key));
    if (!current || current.sha256 !== source.sha256 || current.byteLength !== source.byteLength)
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    const target = this.key(destination.namespace, destination.key);
    const existing = await this.inspect(target);
    if (existing && (existing.sha256 !== source.sha256 || existing.byteLength !== source.byteLength))
      throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    if (!existing) await this.input.client.copy(this.keyFromDescriptor(source.key), target);
    const verified = await this.inspect(target);
    if (!verified || verified.sha256 !== source.sha256 || verified.byteLength !== source.byteLength)
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    return this.descriptor(destination.namespace, destination.key, source.sha256, source.byteLength, source.metadata);
  }
  async moveToQuarantine(object: PrivateObjectDescriptor, reason: string) {
    const safeReason = /^[A-Z0-9_]{1,64}$/.test(reason) ? reason.toLowerCase() : "private_quarantine";
    // Deterministic target makes a retry after a copied-but-unrecorded repair
    // idempotent for both S3 and MinIO implementations.
    const key = `${safeReason}/${object.sha256}`;
    const expected = this.descriptor("quarantine", key, object.sha256, object.byteLength, object.metadata);
    const quarantined = (await this.exists(expected))
      ? expected
      : await this.promote(object, { namespace: "quarantine", key });
    await this.remove(object);
    return { ...quarantined, metadata: { ...object.metadata, quarantineReason: safeReason } };
  }
  async remove(object: PrivateObjectDescriptor) {
    await this.input.client.remove(this.keyFromDescriptor(object.key));
  }
  async beginMultipart(input: { key: string; expectedBytes?: number }) {
    const key = safeKey(input.key);
    const started = await this.input.client.beginMultipart(this.key("uploads", key));
    this.uploads.set(started.uploadId, { key });
    return started;
  }
  async uploadPart(input: { uploadId: string; partNumber: number; body: Readable; expectedSha256: string }) {
    const upload = this.uploads.get(input.uploadId);
    if (!upload) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    return this.input.client.uploadPart(
      input.uploadId,
      this.key("uploads", upload.key),
      input.partNumber,
      input.body,
      input.expectedSha256,
    );
  }
  async completeMultipart(input: { uploadId: string; parts: Array<{ partNumber: number; etag: string }> }) {
    const upload = this.uploads.get(input.uploadId);
    if (!upload) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    try {
      await this.input.client.completeMultipart(input.uploadId, this.key("uploads", upload.key), input.parts);
      const present = await this.inspect(this.key("uploads", upload.key));
      if (!present?.sha256) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
      return this.descriptor("uploads", upload.key, present.sha256, present.byteLength);
    } finally {
      this.uploads.delete(input.uploadId);
    }
  }
  async abortMultipart(uploadId: string) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    try {
      await this.input.client.abortMultipart(uploadId, this.key("uploads", upload.key));
    } finally {
      this.uploads.delete(uploadId);
    }
  }
}

type S3Credentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
const s3Hash = (value: string) => createHash("sha256").update(value).digest("hex");
const s3Hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();
const xmlValue = (xml: string, name: string) => new RegExp(`<${name}>([^<]+)</${name}>`).exec(xml)?.[1];

/** Native HTTPS SigV4 S3 client for AWS S3 and MinIO-compatible endpoints. It deliberately has no public-URL operation. */
export class FetchS3CompatibleObjectClient implements S3CompatibleObjectClient {
  constructor(
    private readonly input: {
      endpoint: string;
      region: string;
      bucket: string;
      forcePathStyle: boolean;
      credentials: S3Credentials;
    },
  ) {}
  private address(key = "", query?: Record<string, string>) {
    const endpoint = new URL(this.input.endpoint);
    const encodedKey = key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    if (this.input.forcePathStyle)
      endpoint.pathname = `/${encodeURIComponent(this.input.bucket)}${encodedKey ? `/${encodedKey}` : ""}`;
    else {
      endpoint.hostname = `${this.input.bucket}.${endpoint.hostname}`;
      endpoint.pathname = `/${encodedKey}`;
    }
    if (query) for (const [name, value] of Object.entries(query)) endpoint.searchParams.set(name, value);
    return endpoint;
  }
  private async request(
    method: string,
    key: string,
    input: {
      query?: Record<string, string>;
      headers?: Record<string, string>;
      body?: BodyInit | null;
      payloadHash?: string;
      signal?: AbortSignal;
    } = {},
  ) {
    const url = this.address(key, input.query);
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const date = stamp.slice(0, 8);
    const headers: Record<string, string> = { host: url.host, "x-amz-date": stamp, ...(input.headers ?? {}) };
    if (this.input.credentials.sessionToken) headers["x-amz-security-token"] = this.input.credentials.sessionToken;
    const names = Object.keys(headers)
      .map((name) => name.toLowerCase())
      .sort();
    const headerValues = Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")]),
    );
    const canonicalHeaders = names.map((name) => `${name}:${headerValues[name]}\n`).join("");
    const query = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([a, b]) => `${encodeURIComponent(a)}=${encodeURIComponent(b)}`)
      .join("&");
    const payloadHash = input.payloadHash ?? (typeof input.body === "string" ? s3Hash(input.body) : "UNSIGNED-PAYLOAD");
    const canonicalRequest = `${method}\n${url.pathname}\n${query}\n${canonicalHeaders}\n${names.join(";")}\n${payloadHash}`;
    const scope = `${date}/${this.input.region}/s3/aws4_request`;
    const signingKey = s3Hmac(
      s3Hmac(s3Hmac(s3Hmac(`AWS4${this.input.credentials.secretAccessKey}`, date), this.input.region), "s3"),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey)
      .update(`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${s3Hash(canonicalRequest)}`)
      .digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.input.credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
    const response = await fetch(url, {
      method,
      headers: { ...headers, authorization, "x-amz-content-sha256": payloadHash },
      body: input.body,
      signal: input.signal ?? AbortSignal.timeout(5000),
      ...(input.body && typeof input.body !== "string" ? { duplex: "half" } : {}),
    } as RequestInit);
    if (!response.ok) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private object provider request failed.");
    return response;
  }
  async health() {
    await this.request("HEAD", "");
    return { healthy: true, providerVersion: "s3-compatible-sigv4" };
  }
  async put(key: string, body: Readable, options: PrivateWriteOptions) {
    const sha = options.expectedSha256;
    await this.request("PUT", key, {
      body: Readable.toWeb(body) as BodyInit,
      payloadHash: "UNSIGNED-PAYLOAD",
      signal: options.signal,
      headers: {
        ...(options.contentLength !== undefined ? { "content-length": String(options.contentLength) } : {}),
        ...(sha
          ? { "x-amz-meta-sha256": sha, "x-amz-checksum-sha256": Buffer.from(sha, "hex").toString("base64") }
          : {}),
      },
    });
    return { sha256: sha, byteLength: options.contentLength };
  }
  async read(key: string, range?: { start: number; end?: number }) {
    const response = await this.request("GET", key, {
      headers: range ? { range: `bytes=${range.start}-${range.end ?? ""}` } : {},
    });
    if (!response.body) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  }
  async head(key: string) {
    try {
      const response = await this.request("HEAD", key);
      const size = Number(response.headers.get("content-length"));
      return Number.isSafeInteger(size) && size >= 0
        ? { sha256: response.headers.get("x-amz-meta-sha256") ?? undefined, byteLength: size }
        : null;
    } catch {
      return null;
    }
  }
  async copy(sourceKey: string, destinationKey: string) {
    await this.request("PUT", destinationKey, {
      headers: {
        "x-amz-copy-source": `/${this.input.bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
      },
    });
  }
  async remove(key: string) {
    await this.request("DELETE", key);
  }
  async beginMultipart(key: string) {
    const response = await this.request("POST", key, { query: { uploads: "" } });
    const uploadId = xmlValue(await response.text(), "UploadId");
    if (!uploadId) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return { uploadId };
  }
  async uploadPart(uploadId: string, key: string, partNumber: number, body: Readable, expectedSha256: string) {
    const response = await this.request("PUT", key, {
      query: { partNumber: String(partNumber), uploadId },
      body: Readable.toWeb(body) as BodyInit,
      payloadHash: "UNSIGNED-PAYLOAD",
      headers: { "x-amz-checksum-sha256": Buffer.from(expectedSha256, "hex").toString("base64") },
    });
    const etag = response.headers.get("etag")?.replaceAll('"', "");
    if (!etag) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return { etag, byteLength: Number(response.headers.get("content-length") ?? 0) };
  }
  async completeMultipart(uploadId: string, key: string, parts: Array<{ partNumber: number; etag: string }>) {
    const body = `<CompleteMultipartUpload>${parts
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>\"${part.etag}\"</ETag></Part>`)
      .join("")}</CompleteMultipartUpload>`;
    await this.request("POST", key, { query: { uploadId }, body, headers: { "content-type": "application/xml" } });
    return {};
  }
  async abortMultipart(uploadId: string, key: string) {
    await this.request("DELETE", key, { query: { uploadId } });
  }
}

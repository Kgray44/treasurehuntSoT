import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { PRIVATE_STREAMING_PACKAGE_VERSION } from "./contracts";
import { assertSafeArchivePath, privateFailure, sha256, type PrivatePayload } from "./core";

const magic = Buffer.from("FTH2");
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_HEADER_BYTES = 64 * 1024;
const streamFormat = "forever-treasure-private-stream";
const recordFormat = "forever-treasure-private-record-stream";
type FrameHeader = {
  sequence: number;
  kind: "data" | "terminal";
  nonce: string;
  cipherBytes: number;
  plainBytes: number;
  sha256: string;
};
const aad = (streamId: string, header: Omit<FrameHeader, "nonce" | "sha256">) =>
  Buffer.from(JSON.stringify({ streamId, ...header }));
const encode = (value: Buffer) => {
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(value.length);
  return Buffer.concat([prefix, value]);
};
function take(buffer: Buffer, offset: number) {
  if (offset + 4 > buffer.length) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const length = buffer.readUInt32BE(offset);
  if (length > 8 * 1024 * 1024 || offset + 4 + length > buffer.length)
    throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  return { value: buffer.subarray(offset + 4, offset + 4 + length), next: offset + 4 + length };
}

function lengthPrefix(value: Buffer) {
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(value.length);
  return prefix;
}

async function* asBuffers(source: AsyncIterable<Buffer | Uint8Array>) {
  for await (const item of source) {
    const buffer = Buffer.isBuffer(item) ? item : Buffer.from(item);
    if (buffer.length) yield buffer;
  }
}

type StreamHeaderV2 = {
  format: typeof streamFormat; version: 2; streamId: string; packageId: string; packageRevision: number; createdAt: string;
  cipher: { name: "aes-256-gcm"; keyBytes: 32; nonceBytes: 12; authenticationTagBytes: 16 };
  keyDerivation: { name: "scrypt"; salt: string; N: 32768; r: 8; p: 1; keyBytes: 32; maxmemBytes: 67108864 };
  recordFormat: { name: typeof recordFormat; version: 1 };
};
type StreamRecord = Record<string, unknown> & { recordFormatVersion: 1; kind: "manifest" | "file-start" | "file-chunk" | "file-end" };

const deriveStreamKey = (passphrase: string, salt: Buffer) => {
  if (!passphrase || salt.length !== 16) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  return new Promise<Buffer>((resolve, reject) => nodeScrypt(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67108864 }, (error, key) => error ? reject(error) : resolve(Buffer.from(key))));
};
function streamHeader(payload: PrivatePayload): { value: StreamHeaderV2; bytes: Buffer } {
  const value: StreamHeaderV2 = {
    format: streamFormat, version: 2, streamId: randomUUID(), packageId: payload.manifest.packageId, packageRevision: payload.manifest.packageRevision, createdAt: new Date().toISOString(),
    cipher: { name: "aes-256-gcm", keyBytes: 32, nonceBytes: 12, authenticationTagBytes: 16 },
    keyDerivation: { name: "scrypt", salt: randomBytes(16).toString("base64url"), N: 32768, r: 8, p: 1, keyBytes: 32, maxmemBytes: 67108864 },
    recordFormat: { name: recordFormat, version: 1 },
  };
  return { value, bytes: Buffer.from(JSON.stringify(value)) };
}
function v2Aad(headerDigest: string, header: StreamHeaderV2, sequence: number, kind: FrameHeader["kind"], cipherBytes: number, plainBytes: number) {
  return Buffer.from(`v2|${headerDigest}|${header.packageId}|${header.streamId}|${sequence}|${kind}|${cipherBytes}|${plainBytes}`);
}
function recordBytes(meta: StreamRecord, payload = Buffer.alloc(0)) {
  const encoded = Buffer.from(JSON.stringify(meta));
  if (encoded.length > MAX_HEADER_BYTES) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  return Buffer.concat([lengthPrefix(encoded), encoded, payload]);
}
function parseRecord(bytes: Buffer): { meta: StreamRecord; payload: Buffer } {
  if (bytes.length < 4) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const length = bytes.readUInt32BE(0);
  if (length > MAX_HEADER_BYTES || 4 + length > bytes.length) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  let meta: StreamRecord;
  try { meta = JSON.parse(bytes.subarray(4, 4 + length).toString("utf8")); } catch { throw privateFailure("PRIVATE_PACKAGE_INVALID"); }
  if (meta.recordFormatVersion !== 1 || !["manifest", "file-start", "file-chunk", "file-end"].includes(meta.kind)) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  return { meta, payload: bytes.subarray(4 + length) };
}

/** Complete owner-authorized v2 package writer. Records are bounded per frame. */
export async function* encryptPrivatePackageV2(payload: PrivatePayload, passphrase: string, signal?: AbortSignal): AsyncGenerator<Buffer> {
  const { value: header, bytes: headerBytes } = streamHeader(payload);
  const key = await deriveStreamKey(passphrase, Buffer.from(header.keyDerivation.salt, "base64url"));
  try {
    const headerDigest = sha256(headerBytes); const chain = createHmac("sha256", key).update(headerBytes);
    yield magic; yield lengthPrefix(headerBytes); yield headerBytes;
    let sequence = 0; let records = 0; let files = 0; let plaintextBytes = 0;
    const emit = (plain: Buffer, kind: FrameHeader["kind"] = "data") => {
      const nonce = randomBytes(12); const cipherBytes = plain.length + 16;
      const cipher = createCipheriv("aes-256-gcm", key, nonce); cipher.setAAD(v2Aad(headerDigest, header, sequence, kind, cipherBytes, plain.length));
      const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
      const frame: FrameHeader = { sequence: sequence++, kind, nonce: nonce.toString("base64url"), cipherBytes, plainBytes: plain.length, sha256: sha256(encrypted) };
      const encoded = Buffer.from(JSON.stringify(frame)); if (kind === "data") chain.update(encoded).update(encrypted);
      return [lengthPrefix(encoded), encoded, lengthPrefix(encrypted), encrypted];
    };
    const manifestBytes = Buffer.from(JSON.stringify(payload.manifest));
    for (const part of emit(recordBytes({ recordFormatVersion: 1, kind: "manifest", mediaType: "application/json", payloadBytes: manifestBytes.length, sha256: sha256(manifestBytes) }, manifestBytes))) yield part;
    records++; plaintextBytes += manifestBytes.length;
    const declared = new Map<string, { logicalId: string; relativePath: string; mediaType: string; representation: string; byteLength: number; sha256: string }>();
    for (const tale of payload.manifest.tales) declared.set(tale.logicalId, { logicalId: tale.logicalId, relativePath: tale.contentPath, mediaType: "application/json", representation: "json", byteLength: Buffer.from(payload.entries[tale.contentPath]!, "base64url").length, sha256: payload.checksums[tale.contentPath]! });
    for (const asset of payload.manifest.assets) declared.set(asset.logicalId, asset);
    for (const file of declared.values()) {
      if (signal?.aborted) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
      const bytes = Buffer.from(payload.entries[file.relativePath] ?? "", "base64url");
      for (const part of emit(recordBytes({ recordFormatVersion: 1, kind: "file-start", ...file })) ) yield part; records++;
      let index = 0; for (let offset = 0; offset < bytes.length || (bytes.length === 0 && index === 0); offset += MAX_FRAME_BYTES - MAX_HEADER_BYTES) {
        const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + MAX_FRAME_BYTES - MAX_HEADER_BYTES));
        for (const part of emit(recordBytes({ recordFormatVersion: 1, kind: "file-chunk", logicalId: file.logicalId, chunkIndex: index++, offset, payloadBytes: chunk.length }, chunk))) yield part;
        records++; plaintextBytes += chunk.length; if (!bytes.length) break;
      }
      for (const part of emit(recordBytes({ recordFormatVersion: 1, kind: "file-end", logicalId: file.logicalId, byteLength: bytes.length, sha256: sha256(bytes) }))) yield part;
      records++; files++;
    }
    const terminal = Buffer.from(JSON.stringify({ chainDigest: chain.digest("hex"), recordCount: records, fileCount: files, plaintextBytes, manifestSha256: sha256(manifestBytes) }));
    for (const part of emit(terminal, "terminal")) yield part;
  } finally { key.fill(0); }
}

/** A bounded pull reader: it never collects more than the current framed item. */
class FramedReader {
  private readonly iterator: AsyncIterator<Buffer>;
  private pending: Buffer[] = [];
  private pendingBytes = 0;
  private ended = false;

  constructor(source: AsyncIterable<Buffer | Uint8Array>) {
    this.iterator = asBuffers(source)[Symbol.asyncIterator]();
  }

  private async fill(length: number) {
    while (this.pendingBytes < length && !this.ended) {
      const next = await this.iterator.next();
      if (next.done) this.ended = true;
      else {
        if (next.value.length > MAX_FRAME_BYTES + MAX_HEADER_BYTES + 8)
          throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
        this.pending.push(next.value);
        this.pendingBytes += next.value.length;
      }
      if (this.pendingBytes > MAX_FRAME_BYTES + MAX_HEADER_BYTES + 8)
        throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    }
  }

  async readExact(length: number) {
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_FRAME_BYTES + 16)
      throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    await this.fill(length);
    if (this.pendingBytes < length) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    const output = Buffer.allocUnsafe(length);
    let written = 0;
    while (written < length) {
      const current = this.pending[0]!;
      const takeBytes = Math.min(length - written, current.length);
      current.copy(output, written, 0, takeBytes);
      written += takeBytes;
      this.pendingBytes -= takeBytes;
      if (takeBytes === current.length) this.pending.shift();
      else this.pending[0] = current.subarray(takeBytes);
    }
    return output;
  }

  async readFrame(maxLength = MAX_FRAME_BYTES) {
    const prefix = await this.readExact(4);
    const length = prefix.readUInt32BE(0);
    if (length > maxLength) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    return this.readExact(length);
  }

  async ensureEnd() {
    await this.fill(1);
    if (this.pendingBytes) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  }
}

/** Reconstructs the canonical private payload while rejecting any record-order or digest violation. */
export async function decryptPrivatePackageV2(source: AsyncIterable<Buffer | Uint8Array>, passphrase: string): Promise<PrivatePayload> {
  const reader = new FramedReader(source);
  if (!(await reader.readExact(4)).equals(magic)) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const headerBytes = await reader.readFrame(MAX_HEADER_BYTES);
  let header: StreamHeaderV2;
  try { header = JSON.parse(headerBytes.toString("utf8")); } catch { throw privateFailure("PRIVATE_PACKAGE_INVALID"); }
  const kdf = header?.keyDerivation;
  if (header?.format !== streamFormat || header.version !== 2 || !/^[0-9a-f-]{36}$/i.test(header.streamId) || !/^[A-Za-z0-9._:-]{1,120}$/.test(header.packageId) || !Number.isSafeInteger(header.packageRevision) || header.packageRevision < 1 || Number.isNaN(Date.parse(header.createdAt)) || header.cipher?.name !== "aes-256-gcm" || header.cipher?.keyBytes !== 32 || header.cipher?.nonceBytes !== 12 || header.cipher?.authenticationTagBytes !== 16 || kdf?.name !== "scrypt" || kdf.N !== 32768 || kdf.r !== 8 || kdf.p !== 1 || kdf.keyBytes !== 32 || kdf.maxmemBytes !== 67108864 || header.recordFormat?.name !== recordFormat || header.recordFormat?.version !== 1) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const salt = Buffer.from(kdf.salt, "base64url"); if (salt.length !== 16 || salt.toString("base64url") !== kdf.salt) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const key = await deriveStreamKey(passphrase, salt);
  try {
    const headerDigest = sha256(headerBytes), chain = createHmac("sha256", key).update(headerBytes);
    let expected = 0, manifest: PrivatePayload["manifest"] | undefined, manifestDigest = "", open: { id: string; path: string; expected: number; digest: string; chunks: Buffer[]; bytes: number; index: number } | undefined;
    const entries: Record<string, string> = {}, checksums: Record<string, string> = {}; let recordCount = 0, fileCount = 0, plaintextBytes = 0;
    while (true) {
      const rawHeader = await reader.readFrame(MAX_HEADER_BYTES), cipherText = await reader.readFrame(MAX_FRAME_BYTES + 16); let frame: FrameHeader;
      try { frame = JSON.parse(rawHeader.toString("utf8")); } catch { throw privateFailure("PRIVATE_PACKAGE_INVALID"); }
      if (frame.sequence !== expected++ || frame.cipherBytes !== cipherText.length || frame.plainBytes < 0 || frame.plainBytes > MAX_FRAME_BYTES || sha256(cipherText) !== frame.sha256) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
      const nonce = Buffer.from(frame.nonce, "base64url"); if (nonce.length !== 12 || nonce.toString("base64url") !== frame.nonce) throw privateFailure("PRIVATE_PACKAGE_INVALID");
      let plain: Buffer; try { const decipher = createDecipheriv("aes-256-gcm", key, nonce); decipher.setAAD(v2Aad(headerDigest, header, frame.sequence, frame.kind, frame.cipherBytes, frame.plainBytes)); decipher.setAuthTag(cipherText.subarray(-16)); plain = Buffer.concat([decipher.update(cipherText.subarray(0, -16)), decipher.final()]); } catch { throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED"); }
      if (plain.length !== frame.plainBytes) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
      if (frame.kind === "terminal") { const terminal = JSON.parse(plain.toString("utf8")); if (open || !manifest || terminal.chainDigest !== chain.digest("hex") || terminal.recordCount !== recordCount || terminal.fileCount !== fileCount || terminal.plaintextBytes !== plaintextBytes || terminal.manifestSha256 !== manifestDigest) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED"); break; }
      if (frame.kind !== "data") throw privateFailure("PRIVATE_PACKAGE_INVALID"); chain.update(rawHeader).update(cipherText); const record = parseRecord(plain); recordCount++;
      if (record.meta.kind === "manifest") { if (manifest || open || record.payload.length !== record.meta.payloadBytes || sha256(record.payload) !== record.meta.sha256) throw privateFailure("PRIVATE_PACKAGE_INVALID"); let parsed: PrivatePayload["manifest"]; try { parsed = JSON.parse(record.payload.toString("utf8")) as PrivatePayload["manifest"]; } catch { throw privateFailure("PRIVATE_PACKAGE_INVALID"); } if (parsed.packageId !== header.packageId || parsed.packageRevision !== header.packageRevision) throw privateFailure("PRIVATE_PACKAGE_INVALID"); manifest = parsed; manifestDigest = sha256(record.payload); plaintextBytes += record.payload.length; continue; }
      if (!manifest) throw privateFailure("PRIVATE_PACKAGE_INVALID");
      if (record.meta.kind === "file-start") { if (open || record.payload.length || typeof record.meta.logicalId !== "string" || typeof record.meta.relativePath !== "string" || typeof record.meta.byteLength !== "number" || typeof record.meta.sha256 !== "string") throw privateFailure("PRIVATE_PACKAGE_INVALID"); const path = assertSafeArchivePath(record.meta.relativePath); if (entries[path]) throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED"); open = { id: record.meta.logicalId, path, expected: record.meta.byteLength, digest: record.meta.sha256, chunks: [], bytes: 0, index: 0 }; continue; }
      if (record.meta.kind === "file-chunk") { if (!open || record.meta.logicalId !== open.id || record.meta.chunkIndex !== open.index || record.meta.offset !== open.bytes || record.meta.payloadBytes !== record.payload.length || open.bytes + record.payload.length > open.expected) throw privateFailure("PRIVATE_PACKAGE_INVALID"); open.chunks.push(record.payload); open.bytes += record.payload.length; open.index++; plaintextBytes += record.payload.length; continue; }
      if (!open || record.meta.logicalId !== open.id || record.payload.length || record.meta.byteLength !== open.expected || record.meta.sha256 !== open.digest || open.bytes !== open.expected) throw privateFailure("PRIVATE_PACKAGE_INVALID"); const bytes = Buffer.concat(open.chunks); if (sha256(bytes) !== open.digest) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH"); entries[open.path] = bytes.toString("base64url"); checksums[open.path] = open.digest; open = undefined; fileCount++;
    }
    await reader.ensureEnd(); if (!manifest) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const verifiedManifest = manifest as PrivatePayload["manifest"];
    const declaredPaths = [...verifiedManifest.tales.map((tale) => tale.contentPath), ...verifiedManifest.assets.map((asset) => asset.relativePath)];
    if (new Set(declaredPaths).size !== declaredPaths.length || declaredPaths.length !== Object.keys(entries).length || declaredPaths.some((path) => !entries[path]))
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    return { manifest: verifiedManifest, entries, checksums };
  } finally { key.fill(0); }
}

function encryptFrame(input: {
  key: Buffer;
  streamId: string;
  sequence: number;
  kind: FrameHeader["kind"];
  plain: Buffer;
}) {
  const nonce = randomBytes(12);
  const partial = {
    sequence: input.sequence,
    kind: input.kind,
    cipherBytes: input.plain.length + 16,
    plainBytes: input.plain.length,
  };
  const cipher = createCipheriv("aes-256-gcm", input.key, nonce);
  cipher.setAAD(aad(input.streamId, partial));
  const encrypted = Buffer.concat([cipher.update(input.plain), cipher.final(), cipher.getAuthTag()]);
  const item: FrameHeader = {
    ...partial,
    nonce: nonce.toString("base64url"),
    sha256: createHash("sha256").update(encrypted).digest("hex"),
  };
  const encodedHeader = Buffer.from(JSON.stringify(item));
  return {
    encodedHeader,
    encrypted,
    wire: [lengthPrefix(encodedHeader), encodedHeader, lengthPrefix(encrypted), encrypted],
  };
}

/**
 * Incremental v2 writer. Each yielded value is a bounded wire fragment, so callers
 * can pipe it straight to provider storage without retaining a package or asset.
 */
export async function* encryptPrivateFrameStream(
  chunks: AsyncIterable<Buffer | Uint8Array>,
  key: Buffer,
  signal?: AbortSignal,
) {
  if (key.length !== 32) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  const streamId = randomUUID();
  const header = Buffer.from(
    JSON.stringify({ format: "forever-treasure-private-stream", version: PRIVATE_STREAMING_PACKAGE_VERSION, streamId }),
  );
  const chain = createHmac("sha256", key).update(header);
  yield magic;
  yield lengthPrefix(header);
  yield header;
  let sequence = 0;
  for await (const plain of asBuffers(chunks)) {
    if (signal?.aborted) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private stream was cancelled.");
    if (plain.length > MAX_FRAME_BYTES) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    const frame = encryptFrame({ key, streamId, sequence: sequence++, kind: "data", plain });
    chain.update(frame.encodedHeader).update(frame.encrypted);
    yield* frame.wire;
  }
  if (signal?.aborted) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private stream was cancelled.");
  const terminal = encryptFrame({
    key,
    streamId,
    sequence,
    kind: "terminal",
    plain: Buffer.from(JSON.stringify({ digest: chain.digest("hex") })),
  });
  yield* terminal.wire;
}

/** Incremental v2 reader. It rejects truncation, trailing frames, reordering and tampering before yielding data. */
export async function* decryptPrivateFrameStream(source: AsyncIterable<Buffer | Uint8Array>, key: Buffer) {
  if (key.length !== 32) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const reader = new FramedReader(source);
  if (!(await reader.readExact(4)).equals(magic)) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const first = await reader.readFrame(MAX_HEADER_BYTES);
  let meta: { format: string; version: number; streamId: string };
  try {
    meta = JSON.parse(first.toString("utf8"));
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  }
  if (
    meta.format !== "forever-treasure-private-stream" ||
    meta.version !== PRIVATE_STREAMING_PACKAGE_VERSION ||
    !meta.streamId
  )
    throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const chain = createHmac("sha256", key).update(first);
  let expected = 0;
  let terminal = false;
  while (!terminal) {
    const rawHeader = await reader.readFrame(MAX_HEADER_BYTES);
    const rawCipher = await reader.readFrame(MAX_FRAME_BYTES + 16);
    let header: FrameHeader;
    try {
      header = JSON.parse(rawHeader.toString("utf8"));
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    }
    if (
      header.sequence !== expected++ ||
      !["data", "terminal"].includes(header.kind) ||
      header.cipherBytes !== rawCipher.length ||
      header.plainBytes < 0 ||
      header.plainBytes > MAX_FRAME_BYTES ||
      createHash("sha256").update(rawCipher).digest("hex") !== header.sha256
    )
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    const { nonce, sha256: _sha, ...partial } = header;
    let plain: Buffer;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
      decipher.setAAD(aad(meta.streamId, partial));
      decipher.setAuthTag(rawCipher.subarray(-16));
      plain = Buffer.concat([decipher.update(rawCipher.subarray(0, -16)), decipher.final()]);
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    }
    if (plain.length !== header.plainBytes) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    if (header.kind === "data") {
      chain.update(rawHeader).update(rawCipher);
      yield plain;
    } else {
      let value: { digest?: string };
      try {
        value = JSON.parse(plain.toString("utf8"));
      } catch {
        throw privateFailure("PRIVATE_PACKAGE_INVALID");
      }
      if (value.digest !== chain.digest("hex")) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
      terminal = true;
    }
  }
  await reader.ensureEnd();
}

/** Framed v2 transport: a caller streams encrypted package bytes; plaintext frames are bounded. */
export function encryptPrivateFrames(chunks: Iterable<Buffer>, key: Buffer) {
  if (key.length !== 32) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  const streamId = randomUUID();
  const header = Buffer.from(
    JSON.stringify({ format: "forever-treasure-private-stream", version: PRIVATE_STREAMING_PACKAGE_VERSION, streamId }),
  );
  const output: Buffer[] = [magic, encode(header)];
  const chain = createHmac("sha256", key).update(header);
  let sequence = 0;
  const frame = (plain: Buffer, kind: FrameHeader["kind"], includeInChain = true) => {
    const nonce = randomBytes(12);
    const partial = { sequence: sequence++, kind, cipherBytes: plain.length + 16, plainBytes: plain.length };
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad(streamId, partial));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    const item: FrameHeader = {
      ...partial,
      nonce: nonce.toString("base64url"),
      sha256: createHash("sha256").update(encrypted).digest("hex"),
    };
    const encodedHeader = Buffer.from(JSON.stringify(item));
    if (includeInChain) chain.update(encodedHeader).update(encrypted);
    output.push(encode(encodedHeader), encode(encrypted));
  };
  for (const chunk of chunks) {
    if (!chunk.length || chunk.length > 4 * 1024 * 1024) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    frame(chunk, "data");
  }
  const terminal = Buffer.from(JSON.stringify({ digest: chain.digest("hex") }));
  frame(terminal, "terminal", false);
  return Buffer.concat(output);
}

export function decryptPrivateFrames(input: Buffer, key: Buffer) {
  if (!input.subarray(0, 4).equals(magic) || key.length !== 32) throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  let offset = 4;
  const first = take(input, offset);
  offset = first.next;
  let meta: { format: string; version: number; streamId: string };
  try {
    meta = JSON.parse(first.value.toString("utf8"));
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  }
  if (
    meta.format !== "forever-treasure-private-stream" ||
    meta.version !== PRIVATE_STREAMING_PACKAGE_VERSION ||
    !meta.streamId
  )
    throw privateFailure("PRIVATE_PACKAGE_UNSUPPORTED");
  const chain = createHmac("sha256", key).update(first.value);
  const output: Buffer[] = [];
  let expected = 0;
  let terminal = false;
  while (offset < input.length) {
    const rawHeader = take(input, offset);
    offset = rawHeader.next;
    const rawCipher = take(input, offset);
    offset = rawCipher.next;
    let header: FrameHeader;
    try {
      header = JSON.parse(rawHeader.value.toString("utf8"));
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    }
    if (
      terminal ||
      header.sequence !== expected++ ||
      !["data", "terminal"].includes(header.kind) ||
      header.cipherBytes !== rawCipher.value.length ||
      createHash("sha256").update(rawCipher.value).digest("hex") !== header.sha256
    )
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    const { nonce, sha256: _sha, ...partial } = header;
    let plain: Buffer;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
      decipher.setAAD(aad(meta.streamId, partial));
      decipher.setAuthTag(rawCipher.value.subarray(-16));
      plain = Buffer.concat([decipher.update(rawCipher.value.subarray(0, -16)), decipher.final()]);
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    }
    if (plain.length !== header.plainBytes) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    if (header.kind === "terminal") {
      terminal = true;
      let value: { digest?: string };
      try {
        value = JSON.parse(plain.toString("utf8"));
      } catch {
        throw privateFailure("PRIVATE_PACKAGE_INVALID");
      }
      if (value.digest !== chain.digest("hex")) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    } else {
      chain.update(rawHeader.value).update(rawCipher.value);
      output.push(plain);
    }
  }
  if (!terminal) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  return output;
}

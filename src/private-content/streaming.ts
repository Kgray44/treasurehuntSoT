import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { PRIVATE_STREAMING_PACKAGE_VERSION } from "./contracts";
import { privateFailure } from "./core";

const magic = Buffer.from("FTH2");
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_HEADER_BYTES = 64 * 1024;
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

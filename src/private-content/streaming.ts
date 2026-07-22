import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { PRIVATE_STREAMING_PACKAGE_VERSION } from "./contracts";
import { privateFailure } from "./core";

const magic = Buffer.from("FTH2");
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

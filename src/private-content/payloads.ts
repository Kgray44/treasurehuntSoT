import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrivateKeyProvider, WrappedPrivateDataKey } from "./contracts";
import { privateFailure, sha256, type PrivatePayload } from "./core";

export type EncryptedNormalizedPayload = {
  bytes: Buffer;
  digest: string;
  wrappedKey: WrappedPrivateDataKey;
  cipher: "AES-256-GCM";
};

/** Converts short-lived authenticated plaintext into retry-safe encrypted bytes. */
export async function encryptNormalizedPayload(
  payload: PrivatePayload,
  keyProvider: PrivateKeyProvider,
): Promise<EncryptedNormalizedPayload> {
  const dataKey = randomBytes(32);
  try {
    const nonce = randomBytes(12);
    const plaintext = Buffer.from(JSON.stringify(payload));
    const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
    cipher.setAAD(Buffer.from("forever-treasure-private-normalized-payload-v1"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    const bytes = Buffer.concat([nonce, ciphertext]);
    return { bytes, digest: sha256(bytes), wrappedKey: await keyProvider.wrap(dataKey), cipher: "AES-256-GCM" };
  } finally {
    dataKey.fill(0);
  }
}

export async function decryptNormalizedPayload(
  input: EncryptedNormalizedPayload,
  keyProvider: PrivateKeyProvider,
): Promise<PrivatePayload> {
  if (sha256(input.bytes) !== input.digest || input.bytes.length < 29)
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  const dataKey = await keyProvider.unwrap(input.wrappedKey);
  try {
    const nonce = input.bytes.subarray(0, 12);
    const ciphertext = input.bytes.subarray(12, -16);
    const tag = input.bytes.subarray(-16);
    const decipher = createDecipheriv("aes-256-gcm", dataKey, nonce);
    decipher.setAAD(Buffer.from("forever-treasure-private-normalized-payload-v1"));
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"),
    ) as PrivatePayload;
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  } finally {
    dataKey.fill(0);
  }
}

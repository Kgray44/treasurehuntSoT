import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrivateKeyProvider, WrappedPrivateDataKey } from "./contracts";
import { privateFailure } from "./core";

/** Development/test-only provider. Its master key must be injected, never committed. */
export class LocalPrivateKeyProvider implements PrivateKeyProvider {
  readonly name = "local-development";
  constructor(
    private readonly masterKey: Buffer,
    private readonly keyVersion = "dev-v1",
  ) {
    if (masterKey.length !== 32) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  }
  async health() {
    return { configured: true, healthy: true, keyVersion: this.keyVersion };
  }
  async wrap(dataKey: Buffer): Promise<WrappedPrivateDataKey> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, nonce);
    const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    return {
      provider: this.name,
      keyVersion: this.keyVersion,
      algorithm: "AES-256-GCM",
      wrappedKey: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url"),
    };
  }
  async unwrap(wrapped: WrappedPrivateDataKey) {
    if (wrapped.provider !== this.name || wrapped.keyVersion !== this.keyVersion)
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    try {
      const value = Buffer.from(wrapped.wrappedKey, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", this.masterKey, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]);
    } catch {
      throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    }
  }
  async rewrap(wrapped: WrappedPrivateDataKey) {
    return this.wrap(await this.unwrap(wrapped));
  }
}

export class UnconfiguredProductionKeyProvider implements PrivateKeyProvider {
  readonly name = "production-kms-adapter";
  async health() {
    return { configured: false, healthy: false };
  }
  async wrap(_dataKey: Buffer): Promise<WrappedPrivateDataKey> {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  }
  async unwrap(_wrapped: WrappedPrivateDataKey): Promise<Buffer> {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  }
  async rewrap(_wrapped: WrappedPrivateDataKey): Promise<WrappedPrivateDataKey> {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  }
}

/**
 * Development/test key ring used to prove envelope-key rotation semantics. The
 * active version wraps new DEKs while retained versions may only unwrap until
 * the caller has verified that no durable references remain.
 */
export class RotatingLocalPrivateKeyProvider implements PrivateKeyProvider {
  readonly name = "local-development-keyring";
  constructor(
    private readonly keys: Readonly<Record<string, Buffer>>,
    private readonly activeVersion: string,
  ) {
    if (!keys[activeVersion] || Object.values(keys).some((key) => key.length !== 32))
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  }
  async health() {
    return { configured: true, healthy: true, keyVersion: this.activeVersion };
  }
  private provider(version: string) {
    const key = this.keys[version];
    if (!key) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return new LocalPrivateKeyProvider(key, version);
  }
  async wrap(dataKey: Buffer) {
    const wrapped = await this.provider(this.activeVersion).wrap(dataKey);
    return { ...wrapped, provider: this.name };
  }
  async unwrap(wrapped: WrappedPrivateDataKey) {
    if (wrapped.provider !== this.name) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    const { provider: _provider, ...local } = wrapped;
    return this.provider(wrapped.keyVersion).unwrap({ ...local, provider: "local-development" });
  }
  async rewrap(wrapped: WrappedPrivateDataKey) {
    const dataKey = await this.unwrap(wrapped);
    try {
      return await this.wrap(dataKey);
    } finally {
      dataKey.fill(0);
    }
  }
  canRetire(version: string, referencedVersions: readonly string[]) {
    return version !== this.activeVersion && !referencedVersions.includes(version);
  }
}

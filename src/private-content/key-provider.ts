import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
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

type AwsKmsResponse = {
  CiphertextBlob?: string;
  Plaintext?: string;
  KeyId?: string;
  KeyMetadata?: { KeyId?: string; KeyState?: string };
};
export interface AwsKmsClient {
  invoke(target: "Encrypt" | "Decrypt" | "DescribeKey", body: Record<string, unknown>): Promise<AwsKmsResponse>;
}

const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Minimal AWS KMS JSON protocol client using the standard SigV4 credential chain values supplied to the factory. */
export class FetchAwsKmsClient implements AwsKmsClient {
  constructor(
    private readonly input: {
      endpoint: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    },
  ) {}

  async invoke(target: "Encrypt" | "Decrypt" | "DescribeKey", body: Record<string, unknown>): Promise<AwsKmsResponse> {
    const endpoint = new URL(this.input.endpoint);
    const now = new Date();
    const stamp = now
      .toISOString()
      .replace(/[-:]|\.\d{3}/g, "")
      .replace("Z", "Z");
    const date = stamp.slice(0, 8);
    const payload = JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/x-amz-json-1.1",
      host: endpoint.host,
      "x-amz-date": stamp,
      "x-amz-target": `TrentService.${target}`,
    };
    if (this.input.sessionToken) headers["x-amz-security-token"] = this.input.sessionToken;
    const sorted = Object.keys(headers).sort();
    const canonicalHeaders = sorted.map((name) => `${name}:${headers[name]}\n`).join("");
    const signedHeaders = sorted.join(";");
    const canonicalRequest = `POST\n${endpoint.pathname || "/"}\n\n${canonicalHeaders}\n${signedHeaders}\n${hash(payload)}`;
    const scope = `${date}/${this.input.region}/kms/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${hash(canonicalRequest)}`;
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.input.secretAccessKey}`, date), this.input.region), "kms"),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, authorization },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private KMS request failed.");
    return (await response.json()) as AwsKmsResponse;
  }
}

/** Production AWS KMS provider. It binds every wrap/unwrap to a configured cryptographic context and never offers a plaintext fallback. */
export class AwsKmsPrivateKeyProvider implements PrivateKeyProvider {
  readonly name = "aws-kms";
  constructor(
    private readonly input: { client: AwsKmsClient; keyId: string; encryptionContext: Record<string, string> },
  ) {}
  async health() {
    try {
      const result = await this.input.client.invoke("DescribeKey", { KeyId: this.input.keyId });
      const keyVersion = result.KeyMetadata?.KeyId ?? result.KeyId ?? this.input.keyId;
      return {
        configured: true,
        healthy: result.KeyMetadata?.KeyState === "Enabled",
        keyVersion,
        providerVersion: "aws-kms",
      };
    } catch {
      return { configured: true, healthy: false, providerVersion: "aws-kms" };
    }
  }
  async wrap(dataKey: Buffer): Promise<WrappedPrivateDataKey> {
    if (dataKey.length !== 32) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
    try {
      const result = await this.input.client.invoke("Encrypt", {
        KeyId: this.input.keyId,
        Plaintext: dataKey.toString("base64"),
        EncryptionContext: this.input.encryptionContext,
      });
      if (!result.CiphertextBlob || !result.KeyId) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
      return {
        provider: this.name,
        keyVersion: result.KeyId,
        wrappedKey: result.CiphertextBlob,
        algorithm: "AES-256-GCM",
      };
    } finally {
      dataKey.fill(0);
    }
  }
  async unwrap(wrapped: WrappedPrivateDataKey): Promise<Buffer> {
    if (wrapped.provider !== this.name || !wrapped.keyVersion) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    try {
      const result = await this.input.client.invoke("Decrypt", {
        CiphertextBlob: wrapped.wrappedKey,
        EncryptionContext: this.input.encryptionContext,
        KeyId: wrapped.keyVersion,
      });
      if (!result.Plaintext) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
      const plaintext = Buffer.from(result.Plaintext, "base64");
      if (plaintext.length !== 32) {
        plaintext.fill(0);
        throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
      }
      return plaintext;
    } catch (error) {
      if (error instanceof Error && "code" in error) throw error;
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    }
  }
  async rewrap(wrapped: WrappedPrivateDataKey) {
    const plaintext = await this.unwrap(wrapped);
    return this.wrap(plaintext);
  }
}

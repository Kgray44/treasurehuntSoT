import type { PrivateKeyProvider, PrivateScannerProvider, PrivateStorageProvider } from "./contracts";
import {
  assessPrivateReadiness,
  privateProviderHealth,
  type PrivateContentConfiguration,
  type PrivateProcessRole,
  type PrivateProviderHealth,
} from "./config";
import { AwsKmsPrivateKeyProvider, FetchAwsKmsClient, LocalPrivateKeyProvider } from "./key-provider";
import {
  FetchS3CompatibleObjectClient,
  LocalPhase2PrivateStorageProvider,
  S3CompatiblePrivateStorageProvider,
} from "./provider-storage";
import { ClamAvPrivateScanner, UnconfiguredPrivateScanner } from "./scanner";
import { privateFailure } from "./core";

export type PrivateProviderRuntime = {
  storage: PrivateStorageProvider;
  scanner: PrivateScannerProvider;
  keyProvider: PrivateKeyProvider;
  configuration: PrivateContentConfiguration;
};

function localMasterKey(value: string) {
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64url");
  if (key.length !== 32)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Local private key material is invalid.");
  return key;
}

/** Builds every operational provider from the one validated configuration authority. */
export function createPrivateProviderRuntime(configuration: PrivateContentConfiguration): PrivateProviderRuntime {
  const storage: PrivateStorageProvider =
    configuration.PRIVATE_CONTENT_STORAGE_PROVIDER === "s3"
      ? new S3CompatiblePrivateStorageProvider({
          prefix: configuration.PRIVATE_CONTENT_S3_PREFIX,
          client: new FetchS3CompatibleObjectClient({
            endpoint: configuration.PRIVATE_CONTENT_S3_ENDPOINT!,
            region: configuration.PRIVATE_CONTENT_S3_REGION,
            bucket: configuration.PRIVATE_CONTENT_S3_BUCKET!,
            forcePathStyle: configuration.PRIVATE_CONTENT_S3_FORCE_PATH_STYLE,
            credentials: {
              accessKeyId: configuration.AWS_ACCESS_KEY_ID!,
              secretAccessKey: configuration.AWS_SECRET_ACCESS_KEY!,
              sessionToken: configuration.AWS_SESSION_TOKEN,
            },
          }),
        })
      : new LocalPhase2PrivateStorageProvider({ root: configuration.PRIVATE_CONTENT_PROVIDER_ROOT });
  const scanner: PrivateScannerProvider =
    configuration.PRIVATE_CONTENT_SCANNER_PROVIDER === "clamav"
      ? new ClamAvPrivateScanner({
          storage,
          host: configuration.PRIVATE_CONTENT_CLAMAV_HOST,
          port: configuration.PRIVATE_CONTENT_CLAMAV_PORT,
          timeoutMs: configuration.PRIVATE_CONTENT_CLAMAV_TIMEOUT_MS,
        })
      : new UnconfiguredPrivateScanner();
  const keyProvider: PrivateKeyProvider =
    configuration.PRIVATE_CONTENT_KEY_PROVIDER === "aws-kms"
      ? new AwsKmsPrivateKeyProvider({
          keyId: configuration.PRIVATE_CONTENT_KMS_KEY_ID!,
          encryptionContext: configuration.encryptionContext,
          client: new FetchAwsKmsClient({
            endpoint:
              configuration.PRIVATE_CONTENT_KMS_ENDPOINT ??
              `https://kms.${configuration.PRIVATE_CONTENT_KMS_REGION}.amazonaws.com`,
            region: configuration.PRIVATE_CONTENT_KMS_REGION,
            accessKeyId: configuration.AWS_ACCESS_KEY_ID!,
            secretAccessKey: configuration.AWS_SECRET_ACCESS_KEY!,
            sessionToken: configuration.AWS_SESSION_TOKEN,
          }),
        })
      : new LocalPrivateKeyProvider(localMasterKey(configuration.PRIVATE_CONTENT_LOCAL_MASTER_KEY!));
  return { storage, scanner, keyProvider, configuration };
}

export async function collectPrivateProviderHealth(runtime: PrivateProviderRuntime): Promise<PrivateProviderHealth[]> {
  const [storage, scanner, keys] = await Promise.all([
    runtime.storage.health(),
    runtime.scanner.health(),
    runtime.keyProvider.health(),
  ]);
  const databaseConfigured = Boolean(runtime.configuration.DATABASE_URL);
  return [
    privateProviderHealth({
      kind: "DATABASE",
      provider: runtime.configuration.DATABASE_URL?.startsWith("mysql:") ? "mysql" : "sqlite",
      configured: databaseConfigured,
      healthy: databaseConfigured,
      safeCode: databaseConfigured ? "DATABASE_CONFIGURED" : "DATABASE_UNCONFIGURED",
      capabilities: ["durable-operations"],
    }),
    privateProviderHealth({
      kind: "STORAGE",
      provider: runtime.storage.name,
      configured: storage.configured,
      healthy: storage.healthy,
      safeCode: storage.healthy ? "STORAGE_HEALTHY" : storage.configured ? "STORAGE_UNHEALTHY" : "STORAGE_UNCONFIGURED",
      providerVersion: storage.providerVersion,
      capabilities: storage.capabilities ?? [],
    }),
    privateProviderHealth({
      kind: "SCANNER",
      provider: runtime.scanner.name,
      configured: scanner.configured,
      healthy: scanner.healthy,
      safeCode: scanner.healthy ? "SCANNER_HEALTHY" : scanner.configured ? "SCANNER_UNHEALTHY" : "SCANNER_UNCONFIGURED",
      providerVersion: scanner.providerVersion,
      capabilities: scanner.capabilities ?? ["scan-gated"],
    }),
    privateProviderHealth({
      kind: "KEY_MANAGEMENT",
      provider: runtime.keyProvider.name,
      configured: keys.configured,
      healthy: keys.healthy,
      safeCode: keys.healthy ? "KMS_HEALTHY" : keys.configured ? "KMS_UNHEALTHY" : "KMS_UNCONFIGURED",
      providerVersion: keys.providerVersion,
      activeKeyVersion: keys.keyVersion,
      capabilities: keys.capabilities ?? ["wrap", "unwrap", "rewrap"],
    }),
    privateProviderHealth({
      kind: "WORKER",
      provider: "private-durable-worker",
      configured: runtime.configuration.PRIVATE_CONTENT_WORKER_ENABLED,
      healthy: runtime.configuration.PRIVATE_CONTENT_WORKER_ENABLED,
      safeCode: runtime.configuration.PRIVATE_CONTENT_WORKER_ENABLED ? "WORKER_CONFIGURED" : "WORKER_DISABLED",
      capabilities: ["lease", "retry", "cancellation"],
    }),
    privateProviderHealth({
      kind: "BACKUP_TARGET",
      provider: runtime.storage.name,
      configured: storage.configured,
      healthy: storage.healthy,
      safeCode: storage.healthy ? "BACKUP_TARGET_HEALTHY" : "BACKUP_TARGET_UNHEALTHY",
      capabilities: ["private-backup-namespace"],
    }),
    privateProviderHealth({
      kind: "ALERTING",
      provider: "structured-sanitized-logs",
      configured: true,
      healthy: true,
      safeCode: "ALERTING_LOCAL",
      capabilities: ["sanitized"],
    }),
  ];
}

export async function requirePrivateReadiness(runtime: PrivateProviderRuntime, role: PrivateProcessRole) {
  const health = await collectPrivateProviderHealth(runtime);
  const readiness = assessPrivateReadiness(role, health);
  if (runtime.configuration.PRIVATE_CONTENT_REQUIRE_READY && !readiness.ready)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", `Private ${role} readiness is blocked.`);
  return { health, readiness };
}

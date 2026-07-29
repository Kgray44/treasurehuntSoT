import path from "node:path";
import { z } from "zod";
import { privateFailure } from "./core";

export const privateProcessRoles = ["web", "worker", "scheduler", "backup", "restore-drill", "admin"] as const;
export type PrivateProcessRole = (typeof privateProcessRoles)[number];
export const privateProviderKinds = [
  "DATABASE",
  "STORAGE",
  "SCANNER",
  "KEY_MANAGEMENT",
  "WORKER",
  "BACKUP_TARGET",
  "ALERTING",
] as const;
export type PrivateProviderKind = (typeof privateProviderKinds)[number];
export const privateProviderConfigurationStates = [
  "DISABLED",
  "UNCONFIGURED",
  "CONFIGURED",
  "STARTING",
  "HEALTHY",
  "DEGRADED",
  "UNHEALTHY",
  "BLOCKED",
] as const;
export type PrivateProviderConfigurationState = (typeof privateProviderConfigurationStates)[number];

export type PrivateProviderHealth = {
  kind: PrivateProviderKind;
  provider: string;
  configurationState: PrivateProviderConfigurationState;
  configured: boolean;
  healthy: boolean;
  degraded: boolean;
  checkedAt: string;
  safeCode: string;
  providerVersion?: string;
  activeKeyVersion?: string;
  capabilities: string[];
};

const bool = z.enum(["true", "false"]).transform((value) => value === "true");
const integer = (fallback: number, minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).default(fallback);

const rawEnvironment = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PRIVATE_CONTENT_ENVIRONMENT_ID: z.string().trim().min(3).max(80).default("local-development"),
  PRIVATE_CONTENT_ENABLED: bool.default(true),
  PRIVATE_CONTENT_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  PRIVATE_CONTENT_PROVIDER_ROOT: z.string().trim().optional(),
  PRIVATE_CONTENT_S3_ENDPOINT: z.string().url().optional(),
  PRIVATE_CONTENT_S3_REGION: z.string().trim().min(1).max(64).default("us-east-1"),
  PRIVATE_CONTENT_S3_BUCKET: z.string().trim().min(3).max(63).optional(),
  PRIVATE_CONTENT_S3_PREFIX: z.string().trim().max(160).default("sealed-hold"),
  PRIVATE_CONTENT_S3_FORCE_PATH_STYLE: bool.default(true),
  PRIVATE_CONTENT_S3_TLS_REQUIRED: bool.default(true),
  PRIVATE_CONTENT_SCANNER_PROVIDER: z.enum(["clamav", "disabled", "synthetic"]).default("disabled"),
  PRIVATE_CONTENT_CLAMAV_HOST: z.string().trim().min(1).max(255).optional(),
  PRIVATE_CONTENT_CLAMAV_PORT: integer(3310, 1, 65535),
  PRIVATE_CONTENT_CLAMAV_TIMEOUT_MS: integer(5000, 250, 5000),
  PRIVATE_CONTENT_CLAMAV_REQUIRED: bool.default(true),
  PRIVATE_CONTENT_KEY_PROVIDER: z.enum(["local", "aws-kms"]).default("local"),
  PRIVATE_CONTENT_KMS_REGION: z.string().trim().min(1).max(64).default("us-east-1"),
  PRIVATE_CONTENT_KMS_KEY_ID: z.string().trim().min(1).max(512).optional(),
  PRIVATE_CONTENT_KMS_ENDPOINT: z.string().url().optional(),
  PRIVATE_CONTENT_KMS_ENCRYPTION_CONTEXT_ENV: z.string().trim().optional(),
  PRIVATE_CONTENT_LOCAL_MASTER_KEY: z.string().trim().optional(),
  PRIVATE_CONTENT_WORKER_ENABLED: bool.default(false),
  PRIVATE_CONTENT_WORKER_CONCURRENCY: integer(2, 1, 4),
  PRIVATE_CONTENT_WORKER_LEASE_MS: integer(30000, 1000, 300000),
  PRIVATE_CONTENT_WORKER_POLL_MS: integer(3000, 250, 60000),
  PRIVATE_CONTENT_REQUIRE_READY: bool.default(true),
  PRIVATE_CONTENT_GC_GRACE_DAYS: integer(30, 1, 3650),
  PRIVATE_CONTENT_QUARANTINE_RETENTION_DAYS: integer(90, 1, 3650),
  PRIVATE_CONTENT_RESTORE_MODE: z.enum(["isolated-only"]).default("isolated-only"),
  DATABASE_URL: z.string().trim().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().optional(),
  AWS_SESSION_TOKEN: z.string().trim().optional(),
});

export type PrivateContentConfiguration = z.infer<typeof rawEnvironment> & {
  encryptionContext: Record<string, string>;
};

function absoluteRoot(value: string | undefined, label: string) {
  if (!value || !path.isAbsolute(value))
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", `${label} must be absolute.`);
}

function parseContext(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("invalid");
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (
      entries.length > 16 ||
      entries.some(
        ([key, item]) => !/^[A-Za-z0-9_.:-]{1,64}$/.test(key) || typeof item !== "string" || item.length > 256,
      )
    )
      throw new Error("invalid");
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private KMS context is invalid.");
  }
}

/** The only server-side environment parser for Sealed Hold operational settings. */
export function parsePrivateContentConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): PrivateContentConfiguration {
  const parsed = rawEnvironment.safeParse(environment);
  if (!parsed.success)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private operational configuration is invalid.");
  const config = {
    ...parsed.data,
    encryptionContext: parseContext(parsed.data.PRIVATE_CONTENT_KMS_ENCRYPTION_CONTEXT_ENV),
  };
  const production = config.NODE_ENV === "production";
  if (config.PRIVATE_CONTENT_STORAGE_PROVIDER === "local")
    absoluteRoot(config.PRIVATE_CONTENT_PROVIDER_ROOT, "Private storage root");
  if (config.PRIVATE_CONTENT_STORAGE_PROVIDER === "s3") {
    if (!config.PRIVATE_CONTENT_S3_ENDPOINT || !config.PRIVATE_CONTENT_S3_BUCKET)
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private S3 storage is incomplete.");
    if (config.PRIVATE_CONTENT_S3_TLS_REQUIRED && new URL(config.PRIVATE_CONTENT_S3_ENDPOINT).protocol !== "https:")
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private S3 storage requires TLS.");
    if (production && (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY))
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private S3 credentials are unavailable.");
  }
  if (config.PRIVATE_CONTENT_SCANNER_PROVIDER === "clamav" && !config.PRIVATE_CONTENT_CLAMAV_HOST)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private scanner is incomplete.");
  if (production && config.PRIVATE_CONTENT_SCANNER_PROVIDER !== "clamav" && config.PRIVATE_CONTENT_CLAMAV_REQUIRED)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Production private scanning requires ClamAV.");
  if (production && config.PRIVATE_CONTENT_KEY_PROVIDER !== "aws-kms")
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Production private content requires KMS.");
  if (
    config.PRIVATE_CONTENT_KEY_PROVIDER === "aws-kms" &&
    (!config.PRIVATE_CONTENT_KMS_KEY_ID || !config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY)
  )
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private KMS is incomplete.");
  if (config.PRIVATE_CONTENT_KEY_PROVIDER === "local" && !config.PRIVATE_CONTENT_LOCAL_MASTER_KEY)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Local private key material is unavailable.");
  if (production && (!config.DATABASE_URL || !/^mysql:/.test(config.DATABASE_URL)))
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Production private content requires MySQL.");
  return config;
}

export function privateProviderHealth(
  input: Omit<PrivateProviderHealth, "checkedAt" | "configurationState" | "degraded">,
): PrivateProviderHealth {
  const configurationState: PrivateProviderConfigurationState = !input.configured
    ? "UNCONFIGURED"
    : input.healthy
      ? "HEALTHY"
      : "UNHEALTHY";
  return {
    ...input,
    configurationState,
    degraded: input.configured && !input.healthy,
    checkedAt: new Date().toISOString(),
  };
}

export function assessPrivateReadiness(role: PrivateProcessRole, health: readonly PrivateProviderHealth[]) {
  const requiredKinds: Record<PrivateProcessRole, readonly PrivateProviderKind[]> = {
    web: ["DATABASE", "STORAGE", "SCANNER", "KEY_MANAGEMENT"],
    worker: ["DATABASE", "STORAGE", "SCANNER", "KEY_MANAGEMENT", "WORKER"],
    scheduler: ["DATABASE", "STORAGE", "WORKER"],
    backup: ["DATABASE", "STORAGE", "KEY_MANAGEMENT", "BACKUP_TARGET"],
    "restore-drill": ["DATABASE", "STORAGE", "KEY_MANAGEMENT", "BACKUP_TARGET"],
    admin: ["DATABASE"],
  };
  const blocked = requiredKinds[role].filter((kind) => !health.some((item) => item.kind === kind && item.healthy));
  return { role, ready: blocked.length === 0, blockedKinds: blocked };
}

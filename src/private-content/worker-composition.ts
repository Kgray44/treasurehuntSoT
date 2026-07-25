import { Readable } from "node:stream";
import type { PrivateJobType, PrivateObjectNamespace } from "./contracts";
import { privateFailure, sha256 } from "./core";
import type { PrivateProviderRuntime } from "./providers";
import { requirePrivateReadiness } from "./providers";
import type { PrivateDurableJob } from "./worker";
import type { PrivateHandlerExecutor } from "./worker-handlers";
import { createDurablePrivateBackup } from "./backup-service";

type OperationalPayload = {
  schemaVersion: 1;
  aggregateId: string;
  correlationId: string;
  /** A caller-controlled opaque operation revision, never private content. */
  revision?: string;
  backup?: { sourceEnvironmentId: string; sourceDatabaseIdentity: string; idempotencyKey: string };
};

const keyRequired = new Set<PrivateJobType>([
  "PRIVATE_BACKUP_BUILD",
  "PRIVATE_BACKUP_VERIFY",
  "PRIVATE_RESTORE_VERIFY",
  "PRIVATE_KEY_REWRAP",
]);
const scannerRequired = new Set<PrivateJobType>(["PRIVATE_ASSET_SCAN"]);

function parsePayload(job: PrivateDurableJob): OperationalPayload {
  try {
    const parsed = JSON.parse(job.payload) as OperationalPayload;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.aggregateId !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,160}$/.test(parsed.aggregateId) ||
      typeof parsed.correlationId !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,160}$/.test(parsed.correlationId) ||
      (parsed.revision !== undefined && !/^[A-Za-z0-9_.:-]{1,160}$/.test(parsed.revision))
    )
      throw new Error("invalid payload");
    if (
      parsed.backup &&
      (!/^[A-Za-z0-9_.:-]{3,160}$/.test(parsed.backup.sourceEnvironmentId) ||
        !/^[a-f0-9]{64}$/i.test(parsed.backup.sourceDatabaseIdentity) ||
        !/^[A-Za-z0-9_.:-]{3,160}$/.test(parsed.backup.idempotencyKey))
    )
      throw new Error("invalid backup payload");
    return parsed;
  } catch {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private worker payload is invalid.");
  }
}

async function requireOperationProviders(runtime: PrivateProviderRuntime, type: PrivateJobType) {
  const { readiness } = await requirePrivateReadiness(runtime, "worker");
  if (!readiness.ready)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private worker readiness is blocked.");
  const storage = await runtime.storage.health();
  if (!storage.configured || !storage.healthy)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private storage is unavailable.");
  if (scannerRequired.has(type)) {
    const scanner = await runtime.scanner.health();
    if (!scanner.configured || !scanner.healthy)
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private scanner is unavailable.");
  }
  if (keyRequired.has(type)) {
    const keys = await runtime.keyProvider.health();
    if (!keys.configured || !keys.healthy)
      throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private key provider is unavailable.");
  }
}

function receiptKey(type: PrivateJobType, job: PrivateDurableJob) {
  return `phase3-operations/${type.toLowerCase()}/${job.id}`;
}

/**
 * Local production-shaped composition used by the durable worker.  Each job
 * validates its typed envelope, proves the required provider is ready, and
 * persists an immutable, non-sensitive provider receipt before the lease can
 * be completed. Domain handlers may be injected for a richer operation, but
 * no registered type is a source-only placeholder.
 */
export function createLocalPrivateOperationExecutors(input: {
  runtime: PrivateProviderRuntime;
  execute?: Partial<Record<PrivateJobType, PrivateHandlerExecutor>>;
}): Record<PrivateJobType, PrivateHandlerExecutor> {
  return Object.fromEntries(
    (
      [
        "PRIVATE_UPLOAD_VERIFY",
        "PRIVATE_PACKAGE_INSPECT",
        "PRIVATE_PACKAGE_NORMALIZE",
        "PRIVATE_IMPORT_MATERIALIZE",
        "PRIVATE_ASSET_VALIDATE",
        "PRIVATE_ASSET_SCAN",
        "PRIVATE_ASSET_FINALIZE",
        "PRIVATE_EXPORT_BUILD",
        "PRIVATE_BACKUP_BUILD",
        "PRIVATE_BACKUP_VERIFY",
        "PRIVATE_RESTORE_VERIFY",
        "PRIVATE_KEY_REWRAP",
        "PRIVATE_INTEGRITY_RECONCILE",
        "PRIVATE_STAGING_CLEANUP",
        "PRIVATE_UPLOAD_CLEANUP",
        "PRIVATE_ORPHAN_CLEANUP",
        "PRIVATE_QUARANTINE_RETENTION",
      ] as const
    ).map((type) => [
      type,
      async (_type: PrivateJobType, job: PrivateDurableJob, signal: AbortSignal) => {
        const payload = parsePayload(job);
        if (signal.aborted)
          throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private worker operation was cancelled.");
        await requireOperationProviders(input.runtime, type);
        if (signal.aborted)
          throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private worker operation lost its lease.");
        const domainExecutor = input.execute?.[type];
        if (domainExecutor) await domainExecutor(type, job, signal);
        else if (type === "PRIVATE_BACKUP_BUILD" && payload.backup)
          await createDurablePrivateBackup({
            runtime: input.runtime,
            sourceEnvironmentId: payload.backup.sourceEnvironmentId,
            sourceDatabaseIdentity: payload.backup.sourceDatabaseIdentity,
            idempotencyKey: payload.backup.idempotencyKey,
          });
        if (signal.aborted)
          throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private worker operation lost its lease.");
        const body = Buffer.from(
          JSON.stringify({
            format: "sealed-hold-phase3-operation-receipt",
            version: 1,
            type,
            jobId: job.id,
            operationId: job.operationId,
            correlationId: payload.correlationId,
            aggregateDigest: sha256(payload.aggregateId),
            revision: payload.revision ?? "0",
          }),
        );
        await input.runtime.storage.put(
          "normalized" as PrivateObjectNamespace,
          receiptKey(type, job),
          Readable.from([body]),
          { expectedSha256: sha256(body), contentLength: body.length, signal },
        );
      },
    ]),
  ) as Record<PrivateJobType, PrivateHandlerExecutor>;
}

import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { parsePrivateContentConfiguration } from "../../src/private-content/config";
import { enqueuePrivateJob } from "../../src/private-content/operations";
import { createPrivateProviderRuntime } from "../../src/private-content/providers";
import { dispatchPrivateJobBatch } from "../../src/private-content/worker";
import { createLocalPrivateOperationExecutors } from "../../src/private-content/worker-composition";
import { createPrivateOperationalHandlerRegistry } from "../../src/private-content/worker-handlers";

async function main() {
  const root = process.env.PHASE3_REHEARSAL_ROOT;
  if (!root || !path.isAbsolute(root)) throw new Error("PHASE3_REHEARSAL_ROOT must be an isolated absolute path.");
  const sourceDatabasePath = path.join(root, "source.db");
  const sourceDatabaseIdentity = createHash("sha256")
    .update(await readFile(sourceDatabasePath))
    .digest("hex");
  const configuration = parsePrivateContentConfiguration();
  const runtime = createPrivateProviderRuntime(configuration);
  const idempotencyKey = `backup:rehearsal-${randomUUID()}`;
  const correlationId = `rehearsal-${randomUUID()}`;
  await enqueuePrivateJob({
    operationId: "operation-pending",
    type: "PRIVATE_BACKUP_BUILD",
    idempotencyKey: `job:${idempotencyKey}`,
    correlationId,
    payload: {
      aggregateId: "synthetic-backup",
      correlationId,
      backup: { sourceEnvironmentId: "phase3-synthetic-source", sourceDatabaseIdentity, idempotencyKey },
    },
  });
  const handlers = createPrivateOperationalHandlerRegistry({
    runtime,
    execute: createLocalPrivateOperationExecutors({ runtime }),
  });
  let dispatch = { claimed: 0, processed: 0, cancelled: 0 };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await dispatchPrivateJobBatch("phase3-rehearsal-worker", handlers, { limit: 10, leaseMs: 5_000 });
    dispatch = {
      claimed: dispatch.claimed + result.claimed,
      processed: dispatch.processed + result.processed,
      cancelled: dispatch.cancelled + result.cancelled,
    };
    const present = await db.privateBackupRun.findUnique({ where: { backupId: idempotencyKey } });
    if (present) break;
  }
  const backup = await db.privateBackupRun.findUniqueOrThrow({ where: { backupId: idempotencyKey } });
  const receipt = {
    format: "sealed-hold-phase3-backup-rehearsal-receipt",
    version: 1,
    dispatch,
    backup: {
      state: backup.state,
      manifestDigest: backup.manifestDigest,
      objectSetDigest: backup.objectSetDigest,
      keyVersions: JSON.parse(backup.keyVersions) as string[],
      verified: Boolean(backup.verifiedAt),
    },
  };
  await writeFile(path.join(root, "backup-receipt.json"), JSON.stringify(receipt));
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}
void main().catch(() => {
  process.stderr.write("Private backup rehearsal failed.\n");
  process.exitCode = 1;
});

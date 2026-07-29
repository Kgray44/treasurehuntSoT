import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { LocalPrivateKeyProvider } from "../../src/private-content/key-provider";
import { LocalPhase2PrivateStorageProvider } from "../../src/private-content/provider-storage";
import { restorePrivateOperationalBackup } from "../../src/private-content/backup-phase3";

const exec = promisify(execFile);
async function main() {
  const sourceRoot = process.env.PHASE3_REHEARSAL_ROOT;
  const targetRoot = process.env.PHASE3_RESTORE_ROOT;
  if (
    !sourceRoot ||
    !targetRoot ||
    !path.isAbsolute(sourceRoot) ||
    !path.isAbsolute(targetRoot) ||
    sourceRoot === targetRoot
  )
    throw new Error("Restore rehearsal requires distinct isolated absolute roots.");
  await mkdir(targetRoot, { recursive: true });
  const source = new LocalPhase2PrivateStorageProvider({ root: path.join(sourceRoot, "storage") });
  const destination = new LocalPhase2PrivateStorageProvider({ root: path.join(targetRoot, "storage") });
  const keyProvider = new LocalPrivateKeyProvider(Buffer.alloc(32), "dev-v1");
  const backupId = process.env.PHASE3_BACKUP_ID;
  if (!backupId) throw new Error("PHASE3_BACKUP_ID is required.");
  const targetDatabase = path.join(targetRoot, "restore.db");
  const recordsPath = path.join(targetRoot, "records.json");
  const result = await restorePrivateOperationalBackup({
    backupId,
    targetEnvironmentId: `phase3-restore-${randomUUID()}`,
    storage: source,
    destinationStorage: destination,
    keyProvider,
    knownKeyVersions: ["local:v-active", "local:v-retiring"],
    restoreRecords: async (records) => {
      await writeFile(recordsPath, JSON.stringify(records));
      await exec("python", [
        path.join(process.cwd(), "scripts", "private-content", "rehearse_restore_records.py"),
        targetDatabase,
        recordsPath,
        process.cwd(),
      ]);
    },
  });
  const receipt = {
    format: "sealed-hold-phase3-restore-rehearsal-receipt",
    restoreNonce: randomUUID(),
    restoredObjects: result.restoredObjects,
    manifestDigest: result.manifestDigest,
    targetDatabaseDigest: createHash("sha256")
      .update(await readFile(targetDatabase))
      .digest("hex"),
  };
  await writeFile(path.join(targetRoot, "restore-receipt.json"), JSON.stringify(receipt));
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}
void main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "RESTORE_REHEARSAL_FAILED";
  process.stderr.write(`Private restore rehearsal failed: ${code}.\n`);
  process.exitCode = 1;
});

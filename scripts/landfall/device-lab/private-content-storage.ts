import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type RuntimeProof = {
  diagnosticBinding?: { candidateSha?: string };
  lifecycle?: {
    cleanup?: {
      status?: string;
      portsReleased?: boolean;
      browser?: { treeReaped?: boolean; streamsClosed?: boolean };
      server?: { treeReaped?: boolean; streamsClosed?: boolean };
    };
  };
};
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Creation-bound synthetic store. Never borrows existing storage or key configuration. */
export async function createSyntheticPrivateStorage(candidate: string, databaseUrl: string, root = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(candidate) || !databaseUrl.startsWith("file:"))
    throw new Error("SEXTANT_PRIVATE_STORAGE_BINDING_REQUIRED");
  const parent = await realpath(tmpdir());
  const checkout = await realpath(root);
  const parentRelative = path.relative(checkout, parent);
  if (
    !parentRelative ||
    (parentRelative !== ".." && !parentRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(parentRelative))
  )
    throw new Error("SEXTANT_PRIVATE_STORAGE_TEMP_ROOT_INSIDE_CHECKOUT");
  const taskRoot = await mkdtemp(path.join(parent, `sextant-private-${candidate.slice(0, 12)}-`));
  const createdRealPath = await realpath(taskRoot);
  const createdIdentity = await lstat(taskRoot);
  const relative = path.relative(path.resolve(root), createdRealPath);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)))
    throw new Error("SEXTANT_PRIVATE_STORAGE_MUST_BE_OUTSIDE_CHECKOUT");
  const ownershipId = randomUUID();
  const receiptDirectory = path.join(root, "artifacts", "sounding-line", "private-content-storage");
  await mkdir(receiptDirectory, { recursive: true });
  const receiptPath = path.join(receiptDirectory, `${ownershipId}.json`);
  const marker = Buffer.from(
    JSON.stringify({
      classification: "OWNED_SYNTHETIC_PRIVATE_CONTENT_DEVELOPMENT",
      sourceSha: candidate,
      databaseUrl,
      taskRoot,
      ownershipId,
    }) + "\n",
  );
  const markerSha256 = hash(marker);
  const record: Record<string, unknown> = {
    schemaVersion: 1,
    classification: "ENGINEERING_SYNTHETIC_STORAGE_LIFECYCLE_NOT_ACCEPTANCE",
    sourceSha: candidate,
    ownershipId,
    taskRoot,
    createdRealPath,
    markerSha256,
    createdAt: new Date().toISOString(),
    status: "CREATED",
    keyPublished: false,
  };
  const save = () => writeFile(receiptPath, JSON.stringify(record, null, 2) + "\n");
  // Record creation before any package/provider operation or diagnostic setup.
  await save();
  await writeFile(path.join(taskRoot, "identity.json"), marker, { flag: "wx" });
  const environment: Record<string, string> = {
    SEXTANT_PRIVATE_CONTENT_TEST_ROOT: taskRoot,
    PRIVATE_CONTENT_ROOT: path.join(taskRoot, "objects"),
    PRIVATE_CONTENT_STAGING_ROOT: path.join(taskRoot, "staging"),
    PRIVATE_CONTENT_PROVIDER_ROOT: path.join(taskRoot, "provider"),
    PRIVATE_CONTENT_LOCAL_MASTER_KEY: randomBytes(32).toString("hex"),
  };
  let finalized = false;
  return {
    environment,
    receiptPath,
    async close({ succeeded, runtime }: { succeeded: boolean; runtime?: RuntimeProof | null }) {
      if (finalized) throw new Error("SEXTANT_PRIVATE_STORAGE_ALREADY_FINALIZED");
      finalized = true;
      delete environment.PRIVATE_CONTENT_LOCAL_MASTER_KEY;
      const cleanup = runtime?.lifecycle?.cleanup;
      const processCleanupVerified =
        runtime?.diagnosticBinding?.candidateSha === candidate &&
        cleanup?.status === "PASS" &&
        cleanup.portsReleased === true &&
        cleanup.browser?.treeReaped === true &&
        cleanup.browser.streamsClosed === true &&
        cleanup.server?.treeReaped === true &&
        cleanup.server.streamsClosed === true;
      record.processCleanupVerified = processCleanupVerified;
      record.finishedAt = new Date().toISOString();
      if (!succeeded || !processCleanupVerified) {
        record.status = "RETAINED_AFTER_FAILURE";
        record.retentionReason = succeeded ? "CANONICAL_PROCESS_CLEANUP_UNPROVED" : "PRESERVE_SYNTHETIC_FAILURE_STATE";
        record.keyRetained = false;
        await save();
        return { removed: false, receiptPath };
      }
      try {
        const current = await lstat(taskRoot);
        const markerIdentity = await lstat(path.join(taskRoot, "identity.json"));
        if (
          current.isSymbolicLink() ||
          markerIdentity.isSymbolicLink() ||
          !markerIdentity.isFile() ||
          current.dev !== createdIdentity.dev ||
          current.ino !== createdIdentity.ino ||
          (await realpath(taskRoot)) !== createdRealPath ||
          path.dirname(createdRealPath) !== parent ||
          hash(await readFile(path.join(taskRoot, "identity.json"))) !== markerSha256
        )
          throw new Error("SEXTANT_PRIVATE_STORAGE_OWNERSHIP_CHANGED");
        // Exactly the directory minted above; no enumerated or computed sibling target.
        await rm(createdRealPath, { recursive: true });
        try {
          await lstat(createdRealPath);
          throw new Error("SEXTANT_PRIVATE_STORAGE_REMOVE_UNPROVED");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        record.status = "PASS_REMOVED_AFTER_CANONICAL_PROCESS_CLEANUP";
        record.rootAbsent = true;
        await save();
        return { removed: true, receiptPath };
      } catch {
        record.status = "FAIL_RETAINED_STORAGE_CLEANUP_OR_OWNERSHIP";
        await save();
        return { removed: false, receiptPath };
      }
    },
  };
}

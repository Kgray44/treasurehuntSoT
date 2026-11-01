// SQLite-engine snapshot data only. No process quiescence, source/provider
// authentication, full runtime isolation, or permission to resume is minted.
// https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
// https://www.sqlite.org/backup.html
import { open, lstat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { createRawOutputDirectory, readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
import { spawnOwnedProcess, processExit, stopOwnedProcess, bounded } from "./owned-process.mjs";
const MAXIMUM = 32 * 1024 * 1024;
const MARKER = "SQLITE_ENGINE_SNAPSHOT_NO_RUNTIME_OR_PRODUCER_AUTHENTICATION";
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_SQLITE_SNAPSHOT_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function captureSqliteRuntimeSnapshot({
  root,
  rawDirectory,
  databasePath,
  prNumber,
  maximumBytes = MAXIMUM,
  deadlineMs = 15000,
}) {
  need(Number.isSafeInteger(prNumber) && prNumber > 0 && ![721, 776, 805].includes(prNumber), "PR");
  need(Number.isSafeInteger(maximumBytes) && maximumBytes >= 512 && maximumBytes <= MAXIMUM, "BOUND");
  need(Number.isSafeInteger(deadlineMs) && deadlineMs >= 20 && deadlineMs <= 15000, "DEADLINE");
  // This producer accepts only an already-private raw-scope database. It cannot
  // discover or copy an arbitrary application/user database from the host.
  await readBoundedRawCaptureFile({ root, rawDirectory, file: databasePath, maximumBytes });
  const directory = await createRawOutputDirectory({
    root,
    directory: path.resolve(root, rawDirectory, `sqlite-engine-${randomUUID()}`),
  });
  const configuration = {
    root: path.resolve(root),
    rawDirectory,
    databasePath: path.resolve(root, databasePath),
    maximumBytes,
    output: path.join(directory, "snapshot.db"),
  };
  const configPath = path.join(directory, "input.json"),
    configBytes = Buffer.from(JSON.stringify(configuration));
  need(configBytes.length <= 8192, "INPUT_BOUND");
  await writeFile(configPath, configBytes, { flag: "wx", mode: 0o600 });
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  const child = spawnOwnedProcess(
    process.execPath,
    [fileURLToPath(import.meta.url), "--worker", configPath, hash(configBytes)],
    { root, env, cleanupOptions: { gracefulMs: 200, forceMs: 1000 } },
  );
  let outcome, cleanup, failure;
  try {
    outcome = await bounded(() => processExit(child), deadlineMs, "SOUNDING_LINE_SQLITE_SNAPSHOT_DEADLINE");
    need(outcome.code === 0 && !outcome.supervisionFailure, "ENGINE_FAILED");
  } catch (error) {
    failure = error;
  } finally {
    cleanup = await stopOwnedProcess(child);
  }
  if (failure || cleanup.status !== "PASS") {
    const error = Error(
      failure?.message === "SOUNDING_LINE_SQLITE_SNAPSHOT_DEADLINE"
        ? failure.message
        : "SOUNDING_LINE_SQLITE_SNAPSHOT_UNAVAILABLE",
    );
    error.cleanup = cleanup; // Failed raw fragments remain preserved.
    throw error;
  }
  const bytes = await readBoundedRawCaptureFile({ root, rawDirectory, file: configuration.output, maximumBytes });
  need(bytes.length >= 512 && bytes.subarray(0, 16).equals(Buffer.from("SQLite format 3\0")), "OUTPUT");
  return Object.freeze({
    path: configuration.output,
    bytes: bytes.length,
    sha256: hash(bytes),
    classification: MARKER,
    qualification: false,
    reuseAuthorized: false,
    cleanup: Object.freeze({ ...cleanup }),
    allocationBoundBytes: 2 * maximumBytes + 8192,
  });
}

async function worker(configPath, expectedHash) {
  need(/^[a-f0-9]{64}$/u.test(expectedHash ?? ""), "INPUT");
  // The parent exclusively created this input. Its digest is passed separately;
  // it is not a provider/source certificate and is never accepted as one.
  const handle = await open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes;
  try {
    const stat = await handle.stat();
    need(stat.isFile() && stat.nlink === 1 && stat.size <= 8192, "INPUT");
    const buffer = Buffer.alloc(8193);
    let count = 0,
      result;
    while ((result = await handle.read(buffer, count, buffer.length - count, null)).bytesRead > 0) {
      count += result.bytesRead;
      need(count <= 8192, "INPUT");
    }
    const after = await handle.stat();
    need(
      count === stat.size &&
        after.size === stat.size &&
        after.mtimeMs === stat.mtimeMs &&
        after.ctimeMs === stat.ctimeMs,
      "INPUT",
    );
    bytes = buffer.subarray(0, count);
  } finally {
    await handle.close();
  }
  need(hash(bytes) === expectedHash, "INPUT");
  const config = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  need(
    Number.isSafeInteger(config.maximumBytes) && config.maximumBytes >= 512 && config.maximumBytes <= MAXIMUM,
    "BOUND",
  );
  need(
    path.dirname(config.output) === path.dirname(configPath) && path.basename(config.output) === "snapshot.db",
    "OUTPUT",
  );
  await readBoundedRawCaptureFile({
    root: config.root,
    rawDirectory: config.rawDirectory,
    file: config.databasePath,
    maximumBytes: config.maximumBytes,
  });
  const before = await lstat(config.databasePath);
  const { DatabaseSync, backup } = await import("node:sqlite");
  need(typeof backup === "function", "ENGINE_UNAVAILABLE");
  const destination = await open(config.output, "wx", 0o600);
  const source = new DatabaseSync(config.databasePath, { readOnly: true, timeout: 1000 });
  try {
    source.exec("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN");
    source.prepare("SELECT count(*) FROM sqlite_schema").get();
    const pageSize = source.prepare("PRAGMA page_size").get().page_size;
    const pages = source.prepare("PRAGMA page_count").get().page_count;
    need(
      Number.isSafeInteger(pageSize) &&
        Number.isSafeInteger(pages) &&
        pages > 0 &&
        pages * pageSize <= config.maximumBytes,
      "BOUND",
    );
    await backup(source, config.output, {
      rate: 128,
      progress({ totalPages }) {
        need(totalPages * pageSize <= config.maximumBytes, "BOUND");
      },
    });
    source.exec("ROLLBACK");
    const after = await lstat(config.databasePath),
      retained = await destination.stat(),
      named = await lstat(config.output);
    need(
      before.ino === after.ino && before.dev === after.dev && after.nlink === 1 && !after.isSymbolicLink(),
      "SOURCE_CHANGED",
    );
    need(
      retained.ino === named.ino &&
        retained.dev === named.dev &&
        retained.nlink === 1 &&
        retained.size <= config.maximumBytes,
      "OUTPUT",
    );
  } finally {
    source.close();
    await destination.close();
  }
  const verify = new DatabaseSync(config.output, { readOnly: true, timeout: 1000 });
  try {
    need(verify.prepare("PRAGMA quick_check").get().quick_check === "ok", "INTEGRITY");
  } finally {
    verify.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    need(process.argv[2] === "--worker" && process.argv.length === 5, "INPUT");
    await worker(process.argv[3], process.argv[4]);
  } catch {
    console.error("SOUNDING_LINE_SQLITE_SNAPSHOT_WORKER_UNAVAILABLE");
    process.exitCode = 1;
  }
}

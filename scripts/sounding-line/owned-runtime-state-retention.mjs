// Shadow parent-side ownership of two declared runtime launches and retained
// state. This does not prove external dependency closure or authorize resume.
import { lstat, realpath, open } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import { readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
import { createRuntimeSnapshotRetention } from "./runtime-snapshot-retention.mjs";
import { captureSqliteRuntimeSnapshot } from "./sqlite-runtime-snapshot.mjs";
import {
  spawnOwnedProcess,
  stopOwnedProcess,
  stopOwnedProcessWithClosureProof,
  consumeOwnedProcessClosure,
  inspectOwnedProcessCreation,
} from "./owned-process.mjs";
const MARKER = "CREATION_BOUND_DECLARED_SQLITE_RUNTIME_RETENTION_NOT_FULL_ISOLATION";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_OWNED_RUNTIME_STATE_${code}`);
};
async function entrypointBytes(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    need(stat.isFile() && stat.nlink === 1 && stat.size <= 1024 * 1024, "ENTRYPOINT");
    const bytes = Buffer.alloc(1024 * 1024 + 1);
    let count = 0,
      result;
    while ((result = await handle.read(bytes, count, bytes.length - count, null)).bytesRead > 0) {
      count += result.bytesRead;
      need(count <= 1024 * 1024, "ENTRYPOINT");
    }
    const after = await handle.stat(),
      named = await lstat(file);
    need(
      count === stat.size &&
        [after, named].every(
          (value) =>
            value.ino === stat.ino &&
            value.dev === stat.dev &&
            value.size === stat.size &&
            value.mtimeMs === stat.mtimeMs &&
            value.ctimeMs === stat.ctimeMs &&
            value.nlink === 1,
        ) &&
        !named.isSymbolicLink(),
      "ENTRYPOINT",
    );
    return Buffer.from(bytes.subarray(0, count));
  } finally {
    await handle.close();
  }
}
async function createOwner({ root, rawDirectory, databasePath, originalBinding, store, onClosed }) {
  need(
    originalBinding &&
      Number.isSafeInteger(originalBinding.prNumber) &&
      originalBinding.prNumber > 0 &&
      ![721, 776, 805].includes(originalBinding.prNumber),
    "BINDING",
  );
  need(
    Object.keys(originalBinding).sort().join() ===
      ["prNumber", "baseSha", "candidateSha", "sourceDigest", "runtimeDigest", "contextId"].sort().join() &&
      [originalBinding.baseSha, originalBinding.candidateSha].every(
        (v) => typeof v === "string" && /^[a-f0-9]{40}$/u.test(v),
      ) &&
      [originalBinding.sourceDigest, originalBinding.runtimeDigest, originalBinding.contextId].every(
        (v) => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v),
      ),
    "BINDING",
  );
  const binding = JSON.parse(canonicalJson(originalBinding));
  root = await realpath(root);
  databasePath = path.resolve(root, databasePath);
  await readBoundedRawCaptureFile({ root, rawDirectory, file: databasePath, maximumBytes: 32 * 1024 * 1024 });
  const databaseIdentity = await lstat(databasePath);
  const launches = new Map();
  let phase = "OPEN";
  let notified = false;
  const notify = () => {
    if (!notified) {
      notified = true;
      onClosed();
    }
  };
  async function stopAll() {
    return await Promise.all([...launches.values()].map(async ({ child }) => await stopOwnedProcess(child)));
  }
  async function close() {
    phase = "CLOSED_WITHOUT_CHECKPOINT";
    const receipts = await stopAll();
    if (receipts.every((receipt) => receipt.status === "PASS")) notify();
    return receipts;
  }
  async function admit(role, child, selected, args, source) {
    const creation = inspectOwnedProcessCreation(child);
    need(
      phase === "OPEN" &&
        ["application", "capture"].includes(role) &&
        !launches.has(role) &&
        ![...launches.values()].some((value) => value.child === child),
      "LAUNCH",
    );
    need(
      creation?.command === process.execPath &&
        creation.root === root &&
        creation.argumentsSha256 === hash(JSON.stringify([selected, ...args])) &&
        creation.databaseUrlSha256 === hash(`file:${databasePath}`),
      "CREATION_BINDING",
    );
    const metadata = Object.freeze({
      role,
      entrypoint: path.relative(root, selected),
      entrypointSha256: hash(source),
      argumentsSha256: hash(JSON.stringify(args)),
    });
    launches.set(role, { child, metadata });
    return Object.freeze({ child, metadata, qualification: false, reuseAuthorized: false });
  }
  return Object.freeze({
    async adoptCreatedProcess(role, { child, entrypoint, args = [] }) {
      need(
        phase === "OPEN" &&
          typeof entrypoint === "string" &&
          Array.isArray(args) &&
          args.length <= 64 &&
          args.every((value) => typeof value === "string" && Buffer.byteLength(value) <= 8192) &&
          Buffer.byteLength(JSON.stringify(args)) <= 65536,
        "LAUNCH",
      );
      const selected = path.resolve(root, entrypoint);
      need(selected.startsWith(root + path.sep) && (await realpath(selected)) === selected, "ENTRYPOINT");
      const source = await entrypointBytes(selected);
      return await admit(role, child, selected, args, source);
    },
    async launch(role, { entrypoint, args = [], environment = {} }) {
      need(phase === "OPEN" && ["application", "capture"].includes(role) && !launches.has(role), "LAUNCH");
      need(
        typeof entrypoint === "string" &&
          Array.isArray(args) &&
          args.length <= 64 &&
          args.every((v) => typeof v === "string" && Buffer.byteLength(v) <= 8192) &&
          Buffer.byteLength(JSON.stringify(args)) <= 65536,
        "LAUNCH",
      );
      const selected = await realpath(path.resolve(root, entrypoint)),
        stat = await lstat(selected);
      need(selected.startsWith(root + path.sep) && stat.isFile() && stat.size <= 1024 * 1024, "ENTRYPOINT");
      const source = await entrypointBytes(selected);
      // Recheck after asynchronous source inspection so parallel calls cannot
      // replace an already admitted launch or race a closing checkpoint.
      need(phase === "OPEN" && !launches.has(role), "LAUNCH");
      const env = { ...process.env, ...environment, DATABASE_URL: `file:${databasePath}` };
      delete env.NODE_OPTIONS;
      delete env.NODE_PATH;
      for (const key of ["GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"])
        delete env[key];
      const child = spawnOwnedProcess(process.execPath, [selected, ...args], {
        root,
        env,
        cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
      });
      try {
        return await admit(role, child, selected, args, source);
      } catch (error) {
        await stopOwnedProcess(child);
        throw error;
      }
    },
    async checkpoint({ authenticationCache, fixtureState }) {
      need(phase === "OPEN" && launches.size === 2, "CHECKPOINT");
      need(
        [authenticationCache, fixtureState].every(
          (bytes) => Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 2 * 1024 * 1024,
        ),
        "STATE_BOUND",
      );
      const authentication = Buffer.from(authenticationCache),
        fixture = Buffer.from(fixtureState);
      phase = "CLOSING"; // Terminal even if a later snapshot or retention fails.
      const capture = launches.get("capture"),
        application = launches.get("application");
      try {
        const captureClosed = await stopOwnedProcessWithClosureProof(capture.child);
        const applicationClosed = await stopOwnedProcessWithClosureProof(application.child);
        return await consumeOwnedProcessClosure(captureClosed.proof, capture.child, () =>
          consumeOwnedProcessClosure(applicationClosed.proof, application.child, async () => {
            const current = await lstat(databasePath);
            need(
              current.ino === databaseIdentity.ino &&
                current.dev === databaseIdentity.dev &&
                current.nlink === 1 &&
                !current.isSymbolicLink(),
              "DATABASE_CHANGED",
            );
            const snapshot = await captureSqliteRuntimeSnapshot({
              root,
              rawDirectory,
              databasePath,
              prNumber: binding.prNumber,
            });
            const sqlite = await readBoundedRawCaptureFile({
              root,
              rawDirectory,
              file: snapshot.path,
              maximumBytes: 32 * 1024 * 1024,
            });
            need(phase === "CLOSING", "CANCELLED");
            const retained = await store.append({
              originalBinding: binding,
              files: new Map([
                ["sqlite-backup", sqlite],
                ["browser-authentication-cache", authentication],
                ["fixture-state", fixture],
              ]),
            });
            need(phase === "CLOSING", "CANCELLED");
            phase = "RETAINED";
            notify();
            return Object.freeze({
              classification: MARKER,
              qualification: false,
              reuseAuthorized: false,
              originalBinding: JSON.parse(canonicalJson(binding)),
              retained,
              snapshot,
              launches: Object.freeze([...launches.values()].map((value) => value.metadata)),
              cleanup: Object.freeze({ capture: captureClosed.cleanup, application: applicationClosed.cleanup }),
            });
          }),
        );
      } finally {
        if (phase !== "RETAINED") {
          phase = "FAILED";
          const receipts = await stopAll();
          if (receipts.every((receipt) => receipt.status === "PASS")) notify();
        }
      }
    },
    close,
  });
}
export async function createOwnedRuntimeStateRetentionFactory({ root, rawDirectory, prNumber }) {
  need(Number.isSafeInteger(prNumber) && prNumber > 0 && ![721, 776, 805].includes(prNumber), "BINDING");
  const store = await createRuntimeSnapshotRetention({ root, rawDirectory });
  const contexts = new Set(),
    owners = [];
  let closed = false,
    active = false;
  return Object.freeze({
    async forContext({ databasePath, originalBinding }) {
      need(
        !closed &&
          !active &&
          contexts.size < 128 &&
          originalBinding?.prNumber === prNumber &&
          typeof originalBinding?.contextId === "string" &&
          /^[a-f0-9]{64}$/u.test(originalBinding?.contextId ?? "") &&
          !contexts.has(originalBinding.contextId),
        "CONTEXT",
      );
      contexts.add(originalBinding.contextId); // Failed admissions retain their original ordinal identity.
      active = true;
      let owner;
      try {
        owner = await createOwner({
          root,
          rawDirectory,
          databasePath,
          originalBinding,
          store,
          onClosed: () => {
            active = false;
          },
        });
      } catch (error) {
        active = false;
        throw error;
      }
      if (closed) {
        await owner.close();
        throw Error("SOUNDING_LINE_OWNED_RUNTIME_STATE_CONTEXT");
      }
      owners.push(owner);
      return owner;
    },
    async close() {
      closed = true;
      return await Promise.all(owners.map((owner) => owner.close()));
    },
  });
}
export async function createOwnedRuntimeStateRetention(options) {
  const factory = await createOwnedRuntimeStateRetentionFactory({
    root: options.root,
    rawDirectory: options.rawDirectory,
    prNumber: options.originalBinding?.prNumber,
  });
  return await factory.forContext(options);
}

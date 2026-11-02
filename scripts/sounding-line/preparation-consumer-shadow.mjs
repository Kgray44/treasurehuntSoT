// Native, read-only-provider validation campaign. It does not install a cached
// client, execute it, or skip any governed preparation obligation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import {
  authenticatePreparationProvider,
  retainAuthenticatedPreparationArchive,
  validateAuthenticatedPreparationCapsule,
  inspectAuthenticatedPreparationCapsule,
  retainedPreparationProviderEvidence,
} from "./preparation-provider-auth.mjs";
import { PREPARATION_PUBLISHER_READERS } from "./preparation-publisher-shadow.mjs";
export const PREPARATION_CONSUMER_WORKFLOW = ".github/workflows/sounding-line-preparation-consumer-shadow.yml";
export const PREPARATION_CONSUMER_READERS = Object.freeze([
  ...PREPARATION_PUBLISHER_READERS,
  PREPARATION_CONSUMER_WORKFLOW,
  ...[
    "preparation-consumer-shadow.mjs",
    "preparation-provider-auth.mjs",
    "preparation-archive-shadow.mjs",
    "attestation-archive-shadow.mjs",
    "bounded-media-shadow.mjs",
    "owned-process.mjs",
    "owned-process-windows.ps1",
    "owned-process-linux.py",
  ].map((name) => `scripts/sounding-line/${name}`),
]);
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_CONSUMER_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Local custody only. The provider and consumer bindings are separate gates.
export function retainPreparationConsumerFrame(filename, bytes) {
  need(path.isAbsolute(filename) && Buffer.isBuffer(bytes) && bytes.length <= 8 * 1024 ** 2, "FRAME_BOUND");
  const parent = path.dirname(filename);
  need(fs.realpathSync.native(parent) === path.resolve(parent), "FRAME_PARENT_ALIAS");
  const parentBefore = fs.lstatSync(parent, { bigint: true });
  need(parentBefore.isDirectory() && !parentBefore.isSymbolicLink(), "FRAME_PARENT");
  const signature = (stat) =>
    [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
  let fd, failure, pinned;
  try {
    fd = fs.openSync(
      filename,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(fd, bytes, offset, Math.min(65536, bytes.length - offset));
      need(count > 0, "FRAME_SHORT_WRITE");
      offset += count;
    }
    fs.fsyncSync(fd);
    const stat = fs.fstatSync(fd, { bigint: true });
    need(
      stat.isFile() &&
        stat.nlink === 1n &&
        stat.size === BigInt(bytes.length) &&
        signature(stat) === signature(fs.lstatSync(filename, { bigint: true })),
      "FRAME_WRITE_DRIFT",
    );
    pinned = signature(stat);
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "PREPARATION_FRAME_WRITE_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  fd = undefined;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    need(signature(fs.fstatSync(fd, { bigint: true })) === pinned, "FRAME_READBACK_IDENTITY");
    const buffer = Buffer.alloc(65536),
      actual = createHash("sha256");
    let count,
      received = 0;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      received += count;
      need(received <= bytes.length, "FRAME_READBACK_BOUND");
      actual.update(buffer.subarray(0, count));
    }
    need(
      received === bytes.length &&
        actual.digest("hex") === hash(bytes) &&
        signature(fs.fstatSync(fd, { bigint: true })) === pinned &&
        signature(fs.lstatSync(filename, { bigint: true })) === pinned,
      "FRAME_READBACK_DRIFT",
    );
    const parentAfter = fs.lstatSync(parent, { bigint: true });
    need(
      parentAfter.isDirectory() &&
        !parentAfter.isSymbolicLink() &&
        parentAfter.dev === parentBefore.dev &&
        parentAfter.ino === parentBefore.ino &&
        fs.realpathSync.native(parent) === path.resolve(parent),
      "FRAME_PARENT_DRIFT",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "PREPARATION_FRAME_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return Object.freeze({ bytes: bytes.length, sha256: hash(bytes), completeReadback: true });
}
export function observePreparationConsumerContext(environment) {
  const e = environment,
    producerRunId = Number(e.INPUT_PRODUCER_RUN_ID);
  need(
    e.GITHUB_REPOSITORY === "Kgray44/treasurehuntSoT" &&
      e.GITHUB_REPOSITORY_ID === "1303074266" &&
      e.GITHUB_ACTOR === "Kgray44" &&
      e.GITHUB_ACTOR_ID === "64373011",
    "OWNER",
  );
  need(
    e.GITHUB_REF === "refs/heads/main" &&
      e.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      e.GITHUB_RUN_ATTEMPT === "1" &&
      e.GITHUB_JOB === "consumer-shadow",
    "EVENT",
  );
  need(
    typeof e.GITHUB_SHA === "string" &&
      /^[a-f0-9]{40}$/u.test(e.GITHUB_SHA) &&
      e.INPUT_BASE_SHA === e.GITHUB_SHA &&
      e.GITHUB_WORKFLOW_SHA === e.GITHUB_SHA &&
      e.GITHUB_WORKFLOW_REF === `Kgray44/treasurehuntSoT/${PREPARATION_CONSUMER_WORKFLOW}@refs/heads/main`,
    "SOURCE",
  );
  need(
    /^[1-9][0-9]*$/u.test(e.GITHUB_RUN_ID) &&
      /^[1-9][0-9]*$/u.test(e.INPUT_PRODUCER_RUN_ID) &&
      Number.isSafeInteger(Number(e.GITHUB_RUN_ID)) &&
      Number.isSafeInteger(producerRunId) &&
      producerRunId !== Number(e.GITHUB_RUN_ID),
    "RUN",
  );
  return Object.freeze({
    kind: "PREPARATION_CONSUMER_CONTEXT_SHADOW",
    version: 1,
    repository: e.GITHUB_REPOSITORY,
    sourceCommit: e.GITHUB_SHA,
    runId: Number(e.GITHUB_RUN_ID),
    attempt: 1,
    producerRunId,
    jobKey: e.GITHUB_JOB,
    authentication: "DECLARED_CONTEXT_NOT_PROVIDER_PROOF",
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  });
}
function nativeGit(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", ["-c", "protocol.allow=never", "-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    env: { ...env, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
    timeout: 10000,
    maxBuffer: 8 * 1024 ** 2,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
export async function preparationConsumerShadowMain() {
  const context = observePreparationConsumerContext(process.env),
    root = fs.realpathSync.native(process.cwd());
  need(
    process.platform === "linux" &&
      process.arch === "x64" &&
      root === "/home/runner/work/treasurehuntSoT/treasurehuntSoT/candidate" &&
      root === fs.realpathSync.native(fileURLToPath(new URL("../../", import.meta.url))),
    "NATIVE_NAMESPACE",
  );
  need(nativeGit(root, ["rev-parse", "HEAD"]).toString().trim() === context.sourceCommit, "INSTALLED_HEAD");
  nativeGit(root, ["diff", "--quiet", "HEAD", "--"]);
  for (const file of PREPARATION_CONSUMER_READERS) {
    const named = fs.lstatSync(path.join(root, file));
    need(
      named.isFile() && !named.isSymbolicLink() && named.nlink === 1 && named.size <= 8 * 1024 ** 2,
      "INSTALLED_READER",
    );
    need(
      fs.readFileSync(path.join(root, file)).equals(nativeGit(root, ["show", `${context.sourceCommit}:${file}`])),
      "INSTALLED_READER_BYTES",
    );
  }
  const free = fs.statfsSync(root, { bigint: true });
  need(free.bavail * free.bsize >= 1024n ** 3n, "FREE_SPACE");
  const artifacts = path.join(root, "artifacts");
  fs.mkdirSync(artifacts, { recursive: true, mode: 0o700 });
  need(
    fs.lstatSync(artifacts).isDirectory() &&
      !fs.lstatSync(artifacts).isSymbolicLink() &&
      fs.realpathSync.native(artifacts) === artifacts,
    "ARTIFACT_DIRECTORY",
  );
  const directory = path.join(artifacts, "preparation-consumer-shadow");
  const originals = path.join(directory, "originals"),
    archives = path.join(directory, "archives"),
    restores = path.join(directory, "restores");
  let ownedDirectory;
  const checkOwnedDirectory = () => {
    const current = fs.lstatSync(directory, { bigint: true });
    need(
      current.isDirectory() &&
        !current.isSymbolicLink() &&
        fs.realpathSync.native(directory) === directory &&
        (!ownedDirectory || (current.dev === ownedDirectory.dev && current.ino === ownedDirectory.ino)),
      "OWNED_DIRECTORY_DRIFT",
    );
  };
  const writeJSON = (name, value) => (
    checkOwnedDirectory(),
    retainPreparationConsumerFrame(path.join(directory, name), Buffer.from(canonicalJson(value) + "\n"))
  );
  const receipt = {
    kind: "PREPARATION_CONSUMER_SHADOW",
    version: 1,
    context,
    status: "INCOMPLETE",
    originalFrames: [],
    measurements: {},
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  };
  let retainedBytes = 0,
    ordinal = 0;
  const retainFrame = (stage, endpoint, bytes) => {
    need(
      Buffer.isBuffer(bytes) && bytes.length <= 8 * 1024 ** 2 && retainedBytes + bytes.length <= 64 * 1024 ** 2,
      "EVIDENCE_BOUND",
    );
    const name = `${String(++ordinal).padStart(3, "0")}-${stage}.original.bin`;
    checkOwnedDirectory();
    const retainedFrame = retainPreparationConsumerFrame(path.join(originals, name), bytes);
    retainedBytes += bytes.length;
    receipt.originalFrames.push({
      ordinal,
      stage,
      endpoint,
      path: `originals/${name}`,
      bytes: bytes.length,
      sha256: retainedFrame.sha256,
      completeReadback: retainedFrame.completeReadback,
    });
  };
  const retain = (stage, handle) => {
    const evidence = retainedPreparationProviderEvidence(handle);
    need(evidence, "STAGE_EVIDENCE");
    try {
      for (const row of evidence.originals) retainFrame(stage, row.endpoint, row.bytes);
      if (evidence.stderr) retainFrame(stage, "OWNED_PROCESS_STDERR", evidence.stderr);
      const errors = [evidence.originalError, ...evidence.failures.map((row) => row.originalError)].filter(Boolean);
      for (const error of errors) {
        const descriptors = Object.getOwnPropertyDescriptors(error);
        for (const key of ["stdout", "stderr"])
          if (Buffer.isBuffer(descriptors[key]?.value))
            retainFrame(stage, `NATIVE_ERROR_${key.toUpperCase()}`, descriptors[key].value);
      }
      receipt[stage] = {
        ...handle,
        cleanup: evidence.cleanup,
        result: evidence.result,
        transport: evidence.transport,
        restore: evidence.restore,
        originalExceptionRetainedInMemory: Boolean(evidence.originalError),
        exceptionSerialization: "NOT_A_LOSSLESS_EXCEPTION_SERIALIZATION",
      };
    } catch (error) {
      if (evidence.originalError)
        throw new AggregateError([evidence.originalError, error], "PREPARATION_STAGE_AND_EVIDENCE_RETENTION_FAILED", {
          cause: evidence.originalError,
        });
      throw error;
    }
    return evidence;
  };
  const binding = { root, acceptedBaseSha: context.sourceCommit, runId: context.producerRunId };
  let originalError;
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  try {
    ownedDirectory = fs.lstatSync(directory, { bigint: true });
    checkOwnedDirectory();
    for (const child of [originals, archives, restores]) fs.mkdirSync(child, { mode: 0o700 });
    writeJSON("initial.json", { ...context, status: "INCOMPLETE", allocationBoundBytes: 448 * 1024 ** 2 });
    console.log(`SOUNDING_LINE_PREPARATION_CONSUMER_CONTEXT_V1 ${canonicalJson(context)}`);
    let began = performance.now();
    const provider = authenticatePreparationProvider(binding);
    receipt.measurements.providerAuthenticationMs = performance.now() - began;
    let evidence = retain("provider", provider);
    if (evidence.originalError) throw evidence.originalError;
    began = performance.now();
    const archive = await retainAuthenticatedPreparationArchive({ proof: provider, ...binding, directory: archives });
    receipt.measurements.archiveTransportAndReadbackMs = performance.now() - began;
    evidence = retain("transport", archive);
    if (evidence.originalError) throw evidence.originalError;
    began = performance.now();
    const capsule = validateAuthenticatedPreparationCapsule({ archive, binding, directory: restores });
    receipt.measurements.payloadValidationMs = performance.now() - began;
    evidence = retain("payload", capsule);
    if (evidence.originalError) throw evidence.originalError;
    const actual = inspectAuthenticatedPreparationCapsule(capsule, binding);
    need(actual, "FINAL_PAYLOAD");
    receipt.sourceTree = provider.sourceTree;
    receipt.inventoryDigest = actual.inventoryDigest;
    receipt.manifestSha256 = actual.manifestSha256;
    receipt.inputFingerprint = actual.inputFingerprint;
    receipt.fileCount = actual.fileCount;
    receipt.byteLength = actual.byteLength;
    receipt.status = "PASS_SHADOW_NO_PREPARATION_SUBSTITUTED";
  } catch (error) {
    originalError = error;
    receipt.status = "FAIL_SHADOW";
  }
  receipt.measurements.processResourceUsage = process.resourceUsage();
  try {
    writeJSON("terminal.json", receipt);
  } catch (error) {
    if (originalError)
      throw new AggregateError([originalError, error], "PREPARATION_CONSUMER_AND_TERMINAL_RETENTION_FAILED", {
        cause: originalError,
      });
    throw error;
  }
  console.log(
    `SOUNDING_LINE_PREPARATION_CONSUMER_RESULT_V1 ${canonicalJson({ status: receipt.status, sourceCommit: context.sourceCommit, producerRunId: context.producerRunId, inventoryDigest: receipt.inventoryDigest ?? null, measurements: receipt.measurements, certificate: "NOT_ISSUED", qualification: false, reuseAuthorized: false })}`,
  );
  if (originalError) throw originalError;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await preparationConsumerShadowMain();

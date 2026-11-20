// Inactive provider implementation. Tests supply an in-memory authenticated HTTP
// fixture. There is deliberately no ambient credential lookup or network fallback.
import { createHash, randomUUID } from "node:crypto";
import { constants, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import {
  PRIVATE_CAPTURE_LIMITS,
  requirePrivateCapturePolicy,
  validatePrivateCaptureProvenance,
} from "./experience-private-publication.mjs";
import { openPrivateCaptureArchive } from "./experience-private-archive.mjs";

const fail = (code) => {
  throw new Error(`PRIVATE_CAPTURE_PROVIDER_${code}`);
};
const packets = new WeakMap();
function immutableJSON(value) {
  const copy = structuredClone(value),
    queue = [[copy, 0]];
  let count = 0;
  while (queue.length) {
    const [item, depth] = queue.pop();
    if (!item || typeof item !== "object") continue;
    if (++count > 50000 || depth > 64) fail("METADATA_LIMIT");
    queue.push(...Object.values(item).map((child) => [child, depth + 1]));
    Object.freeze(item);
  }
  return copy;
}
function cleanupFailure(primary, cleanup) {
  return primary
    ? new AggregateError([primary, cleanup], "PRIVATE_CAPTURE_PROVIDER_CLEANUP_FAILED", { cause: primary })
    : cleanup;
}
function boundedCleanup(promise, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PRIVATE_CAPTURE_PROVIDER_CLEANUP_TIMEOUT")), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
async function withResponse(response, action) {
  let result, primary;
  try {
    result = await action();
  } catch (error) {
    primary = error;
  }
  try {
    await cancel(response);
  } catch (error) {
    throw cleanupFailure(primary, error);
  }
  if (primary) throw primary;
  return result;
}
function within(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
async function* chunks(body, signal) {
  if (!body) fail("BODY_MISSING");
  const reader = body.getReader();
  let primary;
  try {
    while (true) {
      const next = await within(reader.read(), signal);
      if (next.done) break;
      yield next.value;
    }
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try {
      try {
        await boundedCleanup(reader.cancel());
      } catch (error) {
        throw cleanupFailure(primary, error);
      }
    } finally {
      reader.releaseLock();
    }
  }
}
async function cancel(response) {
  if (response?.body) {
    if (response.body.locked) fail("CLEANUP_BODY_LOCKED");
    await boundedCleanup(response.body.cancel());
  }
}
export function isAuthenticatedPrivateCapturePacket(packet) {
  return packets.has(packet) && !packets.get(packet).closed;
}
export async function retrievePrivateCaptureArtifact() {
  requirePrivateCapturePolicy();
}
function limitsValue(overrides = {}) {
  const result = { ...PRIVATE_CAPTURE_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(result))
    if (
      !Object.hasOwn(PRIVATE_CAPTURE_LIMITS, key) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > PRIVATE_CAPTURE_LIMITS[key]
    )
      fail("LIMIT_INVALID");
  return Object.freeze(result);
}
export function createPrivateCaptureFixtureProvider({
  request,
  credential,
  downloadRoot,
  actors,
  allowedBlobOrigins,
  limits: overrides,
  timeoutMs = 120000,
  lateCleanupTimeoutMs = 5000,
  now = Date.now,
  monotonicNow = () => performance.now(),
}) {
  const limits = limitsValue(overrides);
  if (
    typeof now !== "function" ||
    typeof monotonicNow !== "function" ||
    typeof request !== "function" ||
    typeof credential !== "function" ||
    !Array.isArray(actors) ||
    !actors.length ||
    !Array.isArray(allowedBlobOrigins) ||
    !allowedBlobOrigins.length ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 120000 ||
    !Number.isSafeInteger(lateCleanupTimeoutMs) ||
    lateCleanupTimeoutMs < 1 ||
    lateCleanupTimeoutMs > 5000
  )
    fail("CONFIGURATION_INVALID");
  const trustedActors = Object.freeze([...actors]);
  if (trustedActors.some((actor) => !/^[A-Za-z0-9-]+$/u.test(actor))) fail("CONFIGURATION_INVALID");
  const origins = new Set(
    allowedBlobOrigins.map((origin) => {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password)
        fail("REDIRECT_POLICY_INVALID");
      return origin;
    }),
  );
  async function retrieve({ artifactId, expectedBinding, signal, kind = "capture" }) {
    const binding = immutableJSON(expectedBinding);
    const started = monotonicNow();
    if (!Number.isFinite(started)) fail("CLOCK_INVALID");
    const checkDeadline = () => {
      signal?.throwIfAborted();
      const elapsed = monotonicNow() - started;
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= timeoutMs) fail("DEADLINE_EXCEEDED");
    };
    const wallNow = () => {
      const value = now();
      if (!Number.isFinite(value)) fail("CLOCK_INVALID");
      return value;
    };
    if (
      !Number.isSafeInteger(artifactId) ||
      artifactId < 1 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(binding?.repository ?? "") ||
      !/^[1-9][0-9]*$/u.test(binding.runId ?? "") ||
      !/^[1-9][0-9]*$/u.test(binding.runAttempt ?? "") ||
      !["capture", "review"].includes(kind)
    )
      fail("BINDING_INVALID");
    const root = path.resolve(downloadRoot);
    if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory()) fail("ROOT_INVALID");
    const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)]);
    const token = await within(Promise.resolve().then(credential), deadline);
    deadline.throwIfAborted();
    checkDeadline();
    if (typeof token !== "string" || !token || /[\r\n]/u.test(token)) fail("CREDENTIAL_UNAVAILABLE");
    const apiRoot = `https://api.github.com/repos/${binding.repository}/`;
    const call = async (url, authorized) => {
      deadline.throwIfAborted();
      checkDeadline();
      const pending = Promise.resolve().then(() =>
        request(url, {
          method: "GET",
          redirect: "manual",
          signal: deadline,
          headers: {
            Accept: authorized ? "application/vnd.github+json" : "application/octet-stream",
            "Accept-Encoding": "identity",
            ...(authorized ? { Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28" } : {}),
          },
        }),
      );
      try {
        return await within(pending, deadline);
      } catch (error) {
        if (deadline.aborted) {
          // Keep the disposal observer even if the bounded drain times out.
          // Timeout reports incomplete cleanup; it never yields a packet.
          const disposal = pending.then(
            (response) => cancel(response),
            () => {},
          );
          try {
            await boundedCleanup(disposal, lateCleanupTimeoutMs);
          } catch (cleanupError) {
            throw cleanupFailure(error, cleanupError);
          }
          throw error;
        }
        deadline.throwIfAborted();
        checkDeadline();
        fail("REQUEST_FAILED");
      }
    };
    const metadata = async (endpoint) => {
      const response = await call(apiRoot + endpoint, true);
      return withResponse(response, async () => {
        try {
          if (
            response.status !== 200 ||
            !response.headers.get("content-type")?.startsWith("application/json") ||
            ![null, "identity"].includes(response.headers.get("content-encoding"))
          )
            fail("METADATA_RESPONSE_INVALID");
          const buffers = [];
          let total = 0;
          for await (const chunk of chunks(response.body, deadline)) {
            deadline.throwIfAborted();
            checkDeadline();
            if (chunk.length > 1048576 || (total += chunk.length) > 1048576) fail("METADATA_LIMIT");
            buffers.push(Buffer.from(chunk));
          }
          return JSON.parse(Buffer.concat(buffers));
        } catch (error) {
          if (error.name === "SyntaxError") fail("METADATA_JSON_INVALID");
          throw error;
        }
      });
    };
    const artifact = await metadata(`actions/artifacts/${artifactId}`);
    const run = await metadata(`actions/runs/${binding.runId}/attempts/${binding.runAttempt}`);
    if (!Number.isSafeInteger(run.workflow_id) || run.workflow_id < 1) fail("WORKFLOW_INVALID");
    const workflow = await metadata(`actions/workflows/${run.workflow_id}`);
    if (workflow.id !== run.workflow_id) fail("WORKFLOW_INVALID");
    // Establish provenance before requesting any download. Actual digest/size and
    // members are authenticated below before an opaque packet can be minted.
    validatePrivateCaptureProvenance({
      artifact,
      run,
      workflow,
      artifactId,
      binding,
      actors: trustedActors,
      archiveBytes: artifact.size_in_bytes,
      archiveDigest: artifact.digest,
      entries: new Map(),
      limits,
      kind,
      now: wallNow(),
    });
    const redirect = await call(apiRoot + `actions/artifacts/${artifactId}/zip`, true);
    let location;
    await withResponse(redirect, async () => {
      if (redirect.status !== 302) fail("DOWNLOAD_REDIRECT_REQUIRED");
      location = new URL(redirect.headers.get("location"));
      if (
        location.protocol !== "https:" ||
        location.username ||
        location.password ||
        location.hash ||
        !origins.has(location.origin)
      )
        fail("REDIRECT_NOT_APPROVED");
    });
    const directory = path.join(root, randomUUID());
    await mkdir(directory, { mode: 0o700 });
    const directoryIdentity = await lstat(directory);
    const archivePath = path.join(directory, "artifact.zip");
    let output, archive, response, packet, archiveIdentity;
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      archive?.close();
      if (output) {
        await output.close();
        output = null;
      }
      const currentDirectory = await lstat(directory);
      if (
        currentDirectory.isSymbolicLink() ||
        !currentDirectory.isDirectory() ||
        currentDirectory.dev !== directoryIdentity.dev ||
        currentDirectory.ino !== directoryIdentity.ino
      )
        fail("CLEANUP_IDENTITY_CHANGED");
      try {
        const stat = await lstat(archivePath);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.nlink !== 1 ||
          !archiveIdentity ||
          stat.dev !== archiveIdentity.dev ||
          stat.ino !== archiveIdentity.ino
        )
          fail("CLEANUP_IDENTITY_CHANGED");
        await unlink(archivePath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      // Empty-directory deletion only; never recursively delete foreign contents.
      const { rmdir } = await import("node:fs/promises");
      await rmdir(directory);
    };
    try {
      response = await call(location.href, false);
      if (response.status !== 200 || ![null, "identity"].includes(response.headers.get("content-encoding")))
        fail("DOWNLOAD_RESPONSE_INVALID");
      const declared = response.headers.get("content-length");
      if (declared !== null && (!/^[1-9][0-9]*$/u.test(declared) || Number(declared) > limits.archiveBytes))
        fail("ARCHIVE_LIMIT");
      output = await open(
        archivePath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      archiveIdentity = await output.stat();
      const digest = createHash("sha256");
      let total = 0;
      for await (const chunk of chunks(response.body, deadline)) {
        deadline.throwIfAborted();
        checkDeadline();
        if (chunk.length > 1048576 || total + chunk.length > limits.archiveBytes) fail("ARCHIVE_LIMIT");
        await output.writeFile(chunk);
        digest.update(chunk);
        total += chunk.length;
      }
      await output.sync();
      await output.close();
      output = null;
      deadline.throwIfAborted();
      checkDeadline();
      const archiveDigest = `sha256:${digest.digest("hex")}`;
      if (!total || archiveDigest !== artifact.digest || (declared !== null && Number(declared) !== total))
        fail("ARCHIVE_DIGEST_OR_LENGTH_MISMATCH");
      archive = openPrivateCaptureArchive({
        archivePath,
        limits,
        signal: deadline,
        checkDeadline,
        expectedDigest: archiveDigest,
      });
      validatePrivateCaptureProvenance({
        artifact,
        run,
        workflow,
        artifactId,
        binding,
        actors: trustedActors,
        archiveBytes: total,
        archiveDigest,
        entries: archive.entries,
        limits,
        kind,
        now: wallNow(),
      });
      // Re-read metadata after transfer: reject expiry, replacement or run/workflow
      // changes rather than trusting an early snapshot across a long download.
      const afterArtifact = await metadata(`actions/artifacts/${artifactId}`);
      const afterRun = await metadata(`actions/runs/${binding.runId}/attempts/${binding.runAttempt}`);
      const afterWorkflow = await metadata(`actions/workflows/${run.workflow_id}`);
      if (
        JSON.stringify(afterArtifact) !== JSON.stringify(artifact) ||
        JSON.stringify(afterRun) !== JSON.stringify(run) ||
        JSON.stringify(afterWorkflow) !== JSON.stringify(workflow)
      )
        fail("PROVENANCE_CHANGED");
      deadline.throwIfAborted();
      checkDeadline();
      await cancel(response);
      response = null;
      deadline.throwIfAborted();
      checkDeadline();
      validatePrivateCaptureProvenance({
        artifact,
        run,
        workflow,
        artifactId,
        binding,
        actors: trustedActors,
        archiveBytes: total,
        archiveDigest,
        entries: archive.entries,
        limits,
        kind,
        now: wallNow(),
      });
      packet = Object.freeze({
        artifact: immutableJSON(artifact),
        run: immutableJSON(run),
        workflow: immutableJSON(workflow),
        archiveBytes: total,
        archiveDigest,
        entries: archive.entries,
      });
      packets.set(packet, { close, closed: false });
      return packet;
    } catch (error) {
      const failures = [error];
      try {
        await cancel(response);
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
      try {
        await close();
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
      if (failures.length > 1)
        throw new AggregateError(failures, "PRIVATE_CAPTURE_PROVIDER_CLEANUP_FAILED", { cause: error });
      throw error;
    }
  }
  return Object.freeze({ retrieve, limits });
}
export async function closeAuthenticatedPrivateCapturePacket(packet) {
  const state = packets.get(packet);
  if (!state) fail("AUTHENTICATED_PACKET_REQUIRED");
  if (!state.closed) {
    state.closed = true;
    await state.close();
  }
}

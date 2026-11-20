// Local transfer/extraction only. No capture, upload, viewer or review decision.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, writeFileSync } from "node:fs";
import { constants, lstat, mkdir, open, opendir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withTrustedLocalExperienceArtifact } from "./experience-attestation.mjs";
import { withLocalDiagnosticArtifact } from "./experience-diagnostic-artifact.mjs";
import { storageSnapshot } from "./experience-artifact-intake.mjs";
import { EXPERIENCE_STORAGE_RESERVE } from "./experience-capacity.mjs";
import { experienceDigest, planProductExperience } from "./product-experience.mjs";
import { experienceChangedPaths } from "./experience-browser.mjs";

const MiB = 1048576;
const metadataAllowance = 64 * MiB;
const sameObject = (a, b) => a.dev === b.dev && a.ino === b.ino;
const sameFileState = (a, b) =>
  sameObject(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const fail = (code) => {
  throw new Error(`LOCAL_MEDIA_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function relative(file) {
  if (typeof file !== "string" || file.length > 2048 || file.includes("\\") || file.includes(":")) fail("PATH_INVALID");
  const parts = file.split("/");
  if (
    parts.length > 64 ||
    parts.some(
      (p) =>
        !p ||
        p === "." ||
        p === ".." ||
        /[\u0000-\u001f\u007f]/u.test(p) ||
        /[. ]$/u.test(p) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(p),
    )
  )
    fail("PATH_INVALID");
  return parts;
}
function requiredDescriptors(manifest, catalog, allocationUnit, diagnosticOnly = false) {
  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length) fail("SELECTED_SET_MISSING");
  const refs = [...manifest.artifacts];
  if (manifest.pairedEvidence)
    refs.push(
      manifest.pairedEvidence.report,
      manifest.pairedEvidence.runtime,
      manifest.pairedEvidence.profile,
      ...(manifest.pairedEvidence.cases ?? []).map((c) => c.witness),
    );
  const byPath = new Map(),
    aliases = new Set(),
    directories = new Set();
  for (const ref of refs) {
    if (!ref || (diagnosticOnly ? ref.sha256 !== null : !/^[a-f0-9]{64}$/u.test(ref.sha256 ?? "")))
      fail("DESCRIPTOR_INVALID");
    const parts = relative(ref.path),
      prior = byPath.get(ref.path);
    if (prior) {
      if (prior.sha256 !== ref.sha256 || (ref.bytes !== undefined && ref.bytes !== prior.bytes))
        fail("DESCRIPTOR_CONFLICT");
      prior.references.push({ ...ref });
      continue;
    }
    const alias = ref.path.normalize("NFC").toLowerCase();
    if (aliases.has(alias)) fail("PATH_ALIAS");
    aliases.add(alias);
    const entries = catalog.filter(
      (e) => e.name === ref.path || (!diagnosticOnly && e.name === `candidate/${ref.path}`),
    );
    if (entries.length !== 1) fail("MEMBER_MISSING_OR_AMBIGUOUS");
    const entry = entries[0];
    if (ref.bytes !== undefined && ref.bytes !== entry.bytes) fail("DESCRIPTOR_SIZE_MISMATCH");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
    byPath.set(ref.path, {
      path: ref.path,
      member: entry.name,
      bytes: entry.bytes,
      allocatedBytes: Math.ceil(entry.bytes / allocationUnit) * allocationUnit,
      sha256: ref.sha256,
      references: [{ ...ref }],
    });
  }
  for (const dir of directories) if (aliases.has(dir.normalize("NFC").toLowerCase())) fail("FILE_DIRECTORY_COLLISION");
  return { files: [...byPath.values()], directories: [...directories] };
}
async function actualAllocationUnit() {
  if (os.platform() !== "win32") fail("WINDOWS_VOLUME_REQUIRED");
  const result = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "(Get-Volume -DriveLetter D).AllocationUnitSize"],
    { timeout: 15000, maxBuffer: 4096, encoding: "utf8", windowsHide: true },
  );
  return Number(result.trim());
}
async function externalReserveGuard(guardPath, estimate) {
  if (os.platform() !== "win32" || !path.isAbsolute(guardPath ?? "")) fail("RESERVE_GUARD_REQUIRED");
  const output = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      guardPath,
      "-EstimatedCBytes",
      String(estimate.c),
      "-EstimatedDBytes",
      String(estimate.d),
    ],
    { timeout: 15000, maxBuffer: 65536, encoding: "utf8", windowsHide: true },
  );
  const receipt = JSON.parse(output);
  if (receipt.allowed !== true || receipt.floorBytesEach !== EXPERIENCE_STORAGE_RESERVE) fail("RESERVE_GUARD_REJECTED");
  return receipt;
}
function contextIndex(files) {
  const contexts = new Map();
  for (const file of files)
    for (const ref of file.references) {
      if (!["screenshot", "recording", "trace"].includes(ref.type)) continue;
      const context = Object.fromEntries(
        ["contractId", "state", "device", "role", "motionMode"].map((k) => [k, ref[k] ?? null]),
      );
      const key = JSON.stringify(context);
      if (!contexts.has(key))
        contexts.set(key, { context, files: [], recordings: [], traces: [], reviewStatus: "NOT_REVIEWED" });
      const row = contexts.get(key);
      row.files.push(file.path);
      if (ref.type === "recording") row.recordings.push(file.path);
      if (ref.type === "trace") row.traces.push(file.path);
    }
  return [...contexts.values()].map((c) => ({
    ...c,
    temporalSource: c.recordings.length
      ? "RECORDING_AVAILABLE_NOT_INSPECTED"
      : c.traces.length
        ? "TRACE_ONLY_DECODE_REQUIRED"
        : "TEMPORAL_MEDIA_NOT_IDENTIFIED",
  }));
}
export async function retainTrustedLocalMedia(options) {
  return retainLocalMedia(options, false);
}
export async function retainDiagnosticLocalMedia(options) {
  return retainLocalMedia(options, true);
}
async function retainLocalMedia(
  {
    root,
    outputParent,
    plan,
    artifactId,
    policy,
    expectedRunId,
    expectedRunAttempt,
    expectedArtifactBytes,
    expectedArtifactDigest,
    plannedContexts = 118,
    request,
    signal,
    reserveGuardPath,
    measure = storageSnapshot,
    reserveGuard = externalReserveGuard,
    allocationUnit = actualAllocationUnit,
    now = Date.now,
    onPendingReceipt,
  },
  diagnosticOnly,
) {
  outputParent = path.resolve(outputParent);
  if ((await realpath(outputParent)) !== outputParent || !(await lstat(outputParent)).isDirectory())
    fail("OUTPUT_PARENT_INVALID");
  if (os.platform() === "win32" && path.parse(outputParent).root.toUpperCase() !== "D:\\")
    fail("OWNED_D_OUTPUT_REQUIRED");
  if (
    !Number.isSafeInteger(expectedRunId) ||
    expectedRunId < 1 ||
    !Number.isSafeInteger(expectedRunAttempt) ||
    expectedRunAttempt < 1
  )
    fail("EXPECTED_RUN_REQUIRED");
  const unit = await allocationUnit();
  if (!Number.isSafeInteger(unit) || unit < 512 || unit > 2097152 || unit & (unit - 1)) fail("ALLOCATION_UNIT_INVALID");
  const reserveAbort = new AbortController();
  const activeSignal = AbortSignal.any([reserveAbort.signal, ...(signal ? [signal] : [])]);
  let lastGuard = -Infinity,
    phase = "metadata",
    remaining = metadataAllowance,
    metadataWritten = 0;
  const guardReceipts = [];
  const space = async (needed, { force = false, forPhase = phase } = {}) => {
    if (!Number.isSafeInteger(needed) || needed < 0) fail("ALLOCATION_INVALID");
    const rows = await measure(outputParent);
    if (!Array.isArray(rows) || !rows.length || !rows.some((r) => r.writes)) fail("MEASUREMENT_INVALID");
    for (const row of rows) {
      if (
        !Number.isSafeInteger(row.freeBytes) ||
        row.freeBytes - (row.writes ? needed : 0) <= EXPERIENCE_STORAGE_RESERVE
      )
        fail("RESERVE_REACHED");
    }
    if (force || forPhase !== phase || now() - lastGuard >= 240000) {
      const receipt = await reserveGuard(reserveGuardPath, { c: 0, d: needed });
      guardReceipts.push(receipt);
      lastGuard = now();
    }
    phase = forPhase;
    activeSignal.throwIfAborted();
    return rows;
  };
  await space(metadataAllowance, { force: true });
  const session = path.join(outputParent, `media-intake-${randomUUID()}`);
  await mkdir(session, { mode: 0o700 });
  const sessionPin = await lstat(session),
    directoryPins = new Map([[session, sessionPin]]),
    retainedPins = new Map();
  let retainedVerificationDeadline = Infinity;
  let monitorError, guardInFlight;
  const monitor = setInterval(() => {
    if (guardInFlight) return;
    guardInFlight = space(remaining, { force: true })
      .catch((error) => {
        monitorError = error;
        reserveAbort.abort(error);
      })
      .finally(() => {
        guardInFlight = undefined;
      });
  }, 240000);
  const ensure = async (directory) => {
    if (!directory.startsWith(session + path.sep) && directory !== session) fail("OUTPUT_ESCAPE");
    const parts = path.relative(session, directory).split(path.sep).filter(Boolean);
    let at = session;
    for (const part of [null, ...parts]) {
      if (part !== null) at = path.join(at, part);
      if (!directoryPins.has(at)) {
        await space(remaining);
        await mkdir(at, { mode: 0o700 });
        directoryPins.set(at, await lstat(at));
      }
      const current = await lstat(at),
        pin = directoryPins.get(at);
      if (!current.isDirectory() || current.isSymbolicLink() || !sameObject(current, pin)) fail("DIRECTORY_CHANGED");
    }
  };
  const verifyFile = async (file, target, expectedBytes, expectedSha256) => {
    const pin = await file.stat(),
      digest = createHash("sha256"),
      buffer = Buffer.alloc(MiB);
    if (!pin.isFile() || pin.nlink !== 1 || pin.size !== expectedBytes) fail("OUTPUT_CHANGED");
    const original = retainedPins.get(target);
    if (original && !sameFileState(pin, original.identity)) fail("OUTPUT_CHANGED");
    for (let at = 0; at < expectedBytes; ) {
      activeSignal.throwIfAborted();
      if (now() >= retainedVerificationDeadline) fail("RETAINED_VERIFICATION_TIMEOUT");
      const read = await file.read(buffer, 0, Math.min(buffer.length, expectedBytes - at), at);
      if (!read.bytesRead) fail("OUTPUT_TRUNCATED");
      digest.update(buffer.subarray(0, read.bytesRead));
      at += read.bytesRead;
    }
    const after = await file.stat(),
      named = await lstat(target);
    if (
      digest.digest("hex") !== expectedSha256 ||
      !sameObject(pin, after) ||
      !sameObject(pin, named) ||
      named.isSymbolicLink() ||
      named.nlink !== 1 ||
      after.size !== pin.size ||
      after.mtimeMs !== pin.mtimeMs ||
      after.ctimeMs !== pin.ctimeMs ||
      named.size !== after.size ||
      named.mtimeMs !== after.mtimeMs ||
      named.ctimeMs !== after.ctimeMs
    )
      fail("OUTPUT_CHANGED");
    if (!original) retainedPins.set(target, { identity: after, bytes: expectedBytes, sha256: expectedSha256 });
    return { bytes: pin.size, sha256: expectedSha256 };
  };
  const writeJson = async (name, value) => {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    if (bytes.length > 8 * MiB || metadataWritten + bytes.length > metadataAllowance) fail("METADATA_LIMIT");
    await space(remaining);
    const target = path.join(session, name),
      file = await open(target, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
      await verifyFile(file, target, bytes.length, hash(bytes));
    } finally {
      await file.close();
    }
    metadataWritten += bytes.length;
    return { path: target, bytes: bytes.length, sha256: hash(bytes) };
  };
  const verifyRetainedSet = async () => {
    // A second, bounded read observes every retained byte after provider
    // rechecks and intake cleanup. It does not lock out external filesystem writers.
    retainedVerificationDeadline = now() + 900000;
    for (const [target, pin] of retainedPins) {
      await ensure(path.dirname(target));
      const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        await verifyFile(file, target, pin.bytes, pin.sha256);
      } finally {
        await file.close();
      }
    }
    const closurePins = new Map();
    const children = new Map([...directoryPins.keys()].map((dir) => [dir, new Set()]));
    for (const target of [...directoryPins.keys(), ...retainedPins.keys()])
      if (target !== session) children.get(path.dirname(target)).add(path.basename(target));
    for (const [directory, expected] of children) {
      activeSignal.throwIfAborted();
      if (now() >= retainedVerificationDeadline) fail("RETAINED_VERIFICATION_TIMEOUT");
      const stream = await opendir(directory);
      let count = 0;
      for await (const entry of stream) {
        if (!expected.has(entry.name)) fail("RETAINED_DIRECTORY_CLOSURE_CHANGED");
        count++;
      }
      if (count !== expected.size) fail("RETAINED_DIRECTORY_CLOSURE_CHANGED");
      const observed = await lstat(directory);
      if (!observed.isDirectory() || observed.isSymbolicLink() || !sameObject(observed, directoryPins.get(directory)))
        fail("DIRECTORY_CHANGED");
      closurePins.set(directory, observed);
    }
    return closurePins;
  };
  let manifest,
    files = [],
    allocation,
    archiveReceipt,
    index;
  const preparedMetadata = {};
  try {
    const result = await (diagnosticOnly ? withLocalDiagnosticArtifact : withTrustedLocalExperienceArtifact)(
      {
        root,
        intakeRoot: session,
        plan,
        artifactId,
        kind: "capture",
        policy,
        expectedRunId,
        expectedRunAttempt,
        expectedArtifactBytes,
        expectedArtifactDigest,
        request,
        signal: activeSignal,
        measure: async (_root, context) => {
          remaining = context.remainingBytes + metadataAllowance;
          return space(remaining, { forPhase: "download" });
        },
      },
      async (trusted, archive) => {
        manifest = trusted;
        const sourceArtifact = diagnosticOnly ? trusted.diagnosticArtifact : trusted.trustedArtifact;
        if (sourceArtifact.runId !== expectedRunId || sourceArtifact.runAttempt !== expectedRunAttempt)
          fail("RUN_MISMATCH");
        remaining = archive.bytes + metadataAllowance + Math.max(65536, unit);
        await space(remaining, { force: true, forPhase: "retain-archive" });
        const archivePath = path.join(session, "capture.original.zip");
        const retained = await open(
          archivePath,
          constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        let archived = 0;
        try {
          archiveReceipt = await archive.copyArchive(async (bytes) => {
            if (archived + bytes.length > archive.bytes) fail("ARCHIVE_WRITE_LIMIT");
            await space(remaining);
            await retained.writeFile(bytes);
            archived += bytes.length;
            remaining -= bytes.length;
          });
          await retained.sync();
          await verifyFile(retained, archivePath, archive.bytes, archive.digest.slice(7));
        } finally {
          await retained.close();
        }
        archiveReceipt = { ...archiveReceipt, path: archivePath };
        const catalog = await archive.catalog(),
          selection = requiredDescriptors(trusted, catalog, unit, diagnosticOnly);
        const allocated = selection.files.reduce((n, f) => n + f.allocatedBytes, 0);
        const overhead =
          metadataAllowance + Math.max(65536, unit) * (selection.files.length + selection.directories.length + 2);
        if (!Number.isSafeInteger(allocated + overhead)) fail("ALLOCATION_INVALID");
        remaining = allocated + overhead;
        allocation = {
          archiveBytes: archive.bytes,
          temporaryArchiveStillRetained: true,
          retainedArchiveBytes: archive.bytes,
          selectedLogicalBytes: selection.files.reduce((n, f) => n + f.bytes, 0),
          selectedAllocatedBytes: allocated,
          filesystemAndMetadataAllowance: overhead,
          concurrentPeakModel: 2 * archive.bytes + allocated + overhead,
          allocationUnitBytes: unit,
          rendererAdditionalCBytes: null,
          rendererAdditionalDBytes: null,
        };
        await space(remaining, { force: true, forPhase: "extract" });
        preparedMetadata.allocation = await writeJson("allocation.original.json", allocation);
        preparedMetadata.manifest = await writeJson(
          diagnosticOnly ? "diagnostic-manifest.observed.json" : "capture-manifest.observed.json",
          trusted,
        );
        for (const descriptor of selection.files) {
          const destination = path.join(session, "members", ...relative(descriptor.path));
          await ensure(path.dirname(destination));
          await space(remaining);
          const file = await open(
            destination,
            constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          const pin = await file.stat();
          let written = 0,
            verified;
          try {
            verified = await (diagnosticOnly ? archive.copyDiagnosticMember : archive.copyMember)({
              name: descriptor.member,
              expectedSha256: descriptor.sha256,
              write: async (bytes) => {
                if (written + bytes.length > descriptor.bytes) fail("MEMBER_WRITE_LIMIT");
                await ensure(path.dirname(destination));
                await space(remaining);
                await file.writeFile(bytes);
                written += bytes.length;
                remaining -= bytes.length;
              },
            });
            await file.sync();
            await verifyFile(file, destination, descriptor.bytes, verified.sha256);
            const current = await file.stat(),
              named = await lstat(destination);
            if (
              !sameObject(current, pin) ||
              !sameObject(named, pin) ||
              !named.isFile() ||
              named.isSymbolicLink() ||
              named.nlink !== 1 ||
              current.size !== descriptor.bytes
            )
              fail("OUTPUT_CHANGED");
          } finally {
            await file.close();
          }
          files.push({
            ...descriptor,
            sha256: verified.sha256,
            localPath: destination,
            verified,
            reviewStatus: "NOT_REVIEWED",
          });
        }
        index = {
          classification: diagnosticOnly
            ? "DIAGNOSTIC_ONLY_ALL_ARCHIVE_FILES_NOT_A_REVIEW_OR_ACCEPTANCE"
            : "VERIFIED_SELECTED_FILES_NOT_A_REVIEW",
          plannedContexts,
          actualIdentifiedContexts: diagnosticOnly ? null : contextIndex(files).length,
          contexts: diagnosticOnly ? [] : contextIndex(files),
          files,
          requiredOriginalMediaPreserved: true,
          renderer: {
            status: "NOT_EXECUTED",
            additionalCBytes: null,
            additionalDBytes: null,
            gap: "NATIVE_DECODER_TOTAL_MEMORY_AND_VIEWER_CACHE_TEMP_NOT_QUALIFIED",
          },
          productAccepted: false,
          qualification: false,
        };
        preparedMetadata.index = await writeJson("inspection-index.prepared.json", index);
        return index;
      },
    );
    if (guardInFlight) await guardInFlight;
    if (monitorError) throw monitorError;
    remaining = metadataAllowance - metadataWritten;
    await space(remaining, { force: true, forPhase: "finalize" });
    const receipt = {
      version: 1,
      status: diagnosticOnly
        ? "COMPLETE_DIAGNOSTIC_EXTRACTION_NOT_REVIEWED_NOT_ACCEPTANCE"
        : "COMPLETE_VERIFIED_EXTRACTION_NOT_REVIEWED",
      diagnosticOnly,
      session,
      sourceRun: diagnosticOnly ? manifest.diagnosticArtifact : manifest.trustedArtifact,
      sourceBinding: {
        baseSha: manifest.baseSha,
        sourceDigest: manifest.sourceDigest,
        contractDigest: manifest.contractDigest,
      },
      retainedArchive: archiveReceipt,
      preparedMetadata,
      allocation,
      files: files.length,
      contexts: result.actualIdentifiedContexts,
      originalTemporaryArchiveCleanup: "AWAITED_BY_TRUSTED_SESSION",
      provenance: {
        freshProviderMetadata: "RECHECKED_AFTER_COPY",
        afterIntakeCleanup: "SNAPSHOT_PROVENANCE_EXPIRY_AND_CANCELLATION_VALIDATED",
      },
      reserveObservations: guardReceipts,
      qualification: false,
      productAccepted: false,
    };
    const pending = await writeJson("extraction-complete.pending.json", {
      ...receipt,
      status: "PENDING_FINAL_CANCELLATION_AND_IDENTITY_CHECK_NOT_COMPLETE",
    });
    if (onPendingReceipt) {
      const observed = onPendingReceipt({ session, pending });
      if (observed && typeof observed.then === "function") fail("ASYNC_PUBLICATION_OBSERVER_NOT_SUPPORTED");
    }
    const closurePins = await verifyRetainedSet();
    await space(metadataAllowance - metadataWritten, { force: true, forPhase: "publish" });
    clearInterval(monitor);
    if (guardInFlight) await guardInFlight;
    if (monitorError) throw monitorError;
    activeSignal.throwIfAborted();
    if (now() >= retainedVerificationDeadline) fail("RETAINED_VERIFICATION_TIMEOUT");
    for (const [target, pin] of retainedPins) {
      const current = lstatSync(target);
      if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || !sameFileState(current, pin.identity))
        fail("OUTPUT_CHANGED");
    }
    for (const [directory, pin] of closurePins) {
      const current = lstatSync(directory);
      if (!current.isDirectory() || current.isSymbolicLink() || !sameFileState(current, pin)) fail("DIRECTORY_CHANGED");
    }
    receipt.pendingReceipt = pending;
    receipt.retainedSetVerification = {
      status: "ALL_RETAINED_ARCHIVE_MEDIA_METADATA_AND_DIRECTORY_CLOSURE_RECHECKED",
      files: retainedPins.size,
      logicalBytes: [...retainedPins.values()].reduce((n, pin) => n + pin.bytes, 0),
      externalFilesystemWritersExcluded: false,
    };
    const completeBytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
    if (completeBytes.length > 8 * MiB || metadataWritten + completeBytes.length > metadataAllowance)
      fail("METADATA_LIMIT");
    const receiptPath = path.join(session, "extraction-complete.original.json");
    // Linearize publication without an asynchronous cancellation window. The
    // caller must also retain the successful process result and this exact pin;
    // a pending receipt or file existence alone never means completion.
    writeFileSync(receiptPath, completeBytes, { flag: "wx", mode: 0o600, flush: true });
    metadataWritten += completeBytes.length;
    const receiptPin = { path: receiptPath, bytes: completeBytes.length, sha256: hash(completeBytes) };
    return Object.freeze({ session, receipt: receiptPin, index: result });
  } catch (error) {
    const failure = {
      version: 1,
      status: "FAILED_OR_INCOMPLETE_NOT_REVIEWED",
      diagnosticOnly,
      session,
      filesCompleted: files.length,
      error: { name: error.name, message: error.message },
      partialArchiveAndFilesPreserved: true,
      qualification: false,
      productAccepted: false,
    };
    try {
      await writeJson("extraction-failure.original.json", failure);
    } catch (receiptError) {
      failure.receiptFailure = { name: receiptError.name, message: receiptError.message };
    }
    error.localMediaFailure = failure;
    throw error;
  } finally {
    clearInterval(monitor);
    if (guardInFlight) await guardInFlight;
  }
}
async function main() {
  const options = {},
    allowed = new Set([
      "workspace",
      "output-parent",
      "plan",
      "plan-sha256",
      "artifact",
      "run",
      "attempt",
      "reserve-guard",
      "mode",
      "expected-bytes",
      "expected-digest",
    ]);
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.slice(2);
    if (!process.argv[i]?.startsWith("--") || !allowed.has(key) || Object.hasOwn(options, key) || !process.argv[i + 1])
      fail("ARGUMENTS_INVALID");
    options[key] = process.argv[i + 1];
  }
  const file = await open(options.plan, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > 8 * MiB) fail("PLAN_INVALID");
    bytes = Buffer.alloc(info.size);
    let at = 0;
    while (at < bytes.length) {
      const result = await file.read(bytes, at, Math.min(MiB, bytes.length - at), at);
      if (!result.bytesRead) fail("PLAN_TRUNCATED");
      at += result.bytesRead;
    }
    const after = await file.stat(),
      named = await lstat(options.plan);
    if (
      !sameObject(info, after) ||
      !sameObject(info, named) ||
      named.isSymbolicLink() ||
      after.size !== info.size ||
      after.mtimeMs !== info.mtimeMs ||
      after.ctimeMs !== info.ctimeMs ||
      hash(bytes) !== options["plan-sha256"]
    )
      fail("PLAN_DIGEST_MISMATCH");
  } finally {
    await file.close();
  }
  const plan = JSON.parse(bytes);
  const root = path.resolve(options.workspace);
  process.env.GIT_NO_LAZY_FETCH = "1";
  process.env.GIT_OPTIONAL_LOCKS = "0";
  if (
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 4096,
    }).trim() !== plan.candidateSha
  )
    fail("PLAN_SOURCE_MISMATCH");
  const canonical = planProductExperience({
    root,
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    changedPaths: experienceChangedPaths(root, plan.baseSha, plan.candidateSha),
  });
  if (
    canonical.sourceDigest !== plan.sourceDigest ||
    canonical.contractDigest !== plan.contractDigest ||
    experienceDigest(canonical.attestationPolicy) !== experienceDigest(plan.attestationPolicy) ||
    experienceDigest(canonical.exception ?? null) !== experienceDigest(plan.exception ?? null)
  )
    fail("PLAN_SOURCE_MISMATCH");
  const mode = options.mode ?? "capture";
  if (!["capture", "diagnostic-only"].includes(mode)) fail("MODE_INVALID");
  const diagnosticOnly = mode === "diagnostic-only";
  const result = await (diagnosticOnly ? retainDiagnosticLocalMedia : retainTrustedLocalMedia)({
    root,
    outputParent: path.resolve(options["output-parent"]),
    plan,
    policy: plan.attestationPolicy,
    artifactId: Number(options.artifact),
    expectedRunId: Number(options.run),
    expectedRunAttempt: Number(options.attempt),
    expectedArtifactBytes: Number(options["expected-bytes"]),
    expectedArtifactDigest: options["expected-digest"],
    reserveGuardPath: options["reserve-guard"],
  });
  console.log(
    JSON.stringify({
      status: diagnosticOnly
        ? "COMPLETE_DIAGNOSTIC_EXTRACTION_NOT_REVIEWED_NOT_ACCEPTANCE"
        : "COMPLETE_VERIFIED_EXTRACTION_NOT_REVIEWED",
      session: result.session,
      receipt: result.receipt,
    }),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(
      JSON.stringify(
        error.localMediaFailure ?? {
          status: "FAILED_BEFORE_MEDIA_ADMISSION",
          message: error.message,
          qualification: false,
        },
      ),
    );
    process.exitCode = 1;
  });

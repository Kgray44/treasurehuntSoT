"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const { captureError, requireIdentifier } = require("./capture-contract.cjs");

const gzip = promisify(zlib.gzip);

function withinRoot(root, candidate) {
  const resolvedRoot = path.resolve(root) + path.sep;
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate.startsWith(resolvedRoot) && resolvedCandidate !== path.resolve(root);
}

async function closeWriter(writer) {
  if (!writer) return;
  await new Promise((resolve, reject) => {
    writer.once("error", reject);
    writer.end(resolve);
  });
}

class CompanionStorage {
  constructor(root, options = {}) {
    if (!path.isAbsolute(root)) throw captureError("ARTIFACT_PATH_INVALID", "Companion storage root must be absolute.");
    this.root = path.resolve(root);
    this.maximumCreatorBytes = options.maximumCreatorBytes ?? 2 * 1024 * 1024 * 1024;
    this.paths = {
      configuration: path.join(this.root, "configuration"),
      pairings: path.join(this.root, "pairings"),
      creator: path.join(this.root, "recordings", "creator"),
      diagnostics: path.join(this.root, "diagnostics"),
      logs: path.join(this.root, "logs"),
      temporary: path.join(this.root, "temporary"),
    };
    this.activeRecordings = new Map();
  }

  async initialize() {
    await Promise.all(Object.values(this.paths).map((entry) => fsp.mkdir(entry, { recursive: true })));
    const cleanup = await this.cleanupTemporary();
    const filesystem = await fsp.statfs(this.root).catch(() => null);
    return {
      location: { category: "ELECTRON_USER_DATA", managed: true },
      availableDiskBytes: filesystem ? filesystem.bavail * filesystem.bsize : null,
      cleanup,
    };
  }

  async cleanupTemporary() {
    let removed = 0;
    const entries = await fsp.readdir(this.paths.temporary, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !/^[A-Za-z0-9._-]+\.(part|tmp)$/.test(entry.name)) continue;
      const candidate = path.join(this.paths.temporary, entry.name);
      if (!withinRoot(this.paths.temporary, candidate)) continue;
      await fsp.rm(candidate, { force: true });
      removed += 1;
    }
    return { staleTemporaryFilesRemoved: removed };
  }

  async startCreatorRecording(metadata) {
    const artifactId = `artifact_${crypto.randomUUID()}`;
    const recordingId = `recording_${crypto.randomUUID()}`;
    const temporaryPath = path.join(this.paths.temporary, `${artifactId}.part`);
    if (!withinRoot(this.paths.temporary, temporaryPath))
      throw captureError("ARTIFACT_PATH_INVALID", "Temporary path escaped storage.");
    const writer = fs.createWriteStream(temporaryPath, { flags: "wx" });
    await new Promise((resolve, reject) => {
      writer.once("open", resolve);
      writer.once("error", reject);
    });
    this.activeRecordings.set(recordingId, {
      artifactId,
      recordingId,
      temporaryPath,
      writer,
      bytes: 0,
      hash: crypto.createHash("sha256"),
      metadata,
      startedAt: new Date().toISOString(),
      writerError: null,
    });
    writer.on("error", (error) => {
      const active = this.activeRecordings.get(recordingId);
      if (active) active.writerError = error;
    });
    return { artifactId, recordingId, storageCategory: "LOCAL_APP_DATA", startedAt: new Date().toISOString() };
  }

  appendCreatorChunk(recordingId, chunk) {
    const active = this.activeRecordings.get(recordingId);
    if (!active) throw captureError("CAPTURE_STORAGE_UNAVAILABLE", "Creator recording is not active.");
    if (active.writerError) throw captureError("CAPTURE_STORAGE_UNAVAILABLE", active.writerError.message);
    const binary = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (active.bytes + binary.length > this.maximumCreatorBytes)
      throw captureError("CAPTURE_STORAGE_UNAVAILABLE", "Creator recording reached its configured size limit.");
    active.bytes += binary.length;
    active.hash.update(binary);
    if (!active.writer.write(binary)) return new Promise((resolve) => active.writer.once("drain", resolve));
    return Promise.resolve();
  }

  async finishCreatorRecording(recordingId, completion) {
    const active = this.activeRecordings.get(recordingId);
    if (!active) throw captureError("CAPTURE_STORAGE_UNAVAILABLE", "Creator recording is not active.");
    if (active.writerError) {
      this.activeRecordings.delete(recordingId);
      active.writer.destroy();
      await fsp.rm(active.temporaryPath, { force: true });
      throw captureError("CAPTURE_STORAGE_UNAVAILABLE", active.writerError.message);
    }
    this.activeRecordings.delete(recordingId);
    await closeWriter(active.writer);
    const mediaName = `${active.artifactId}.webm`;
    const manifestName = `${active.artifactId}.manifest.json`;
    const mediaPath = path.join(this.paths.creator, mediaName);
    const manifestPath = path.join(this.paths.creator, manifestName);
    if (!withinRoot(this.paths.creator, mediaPath) || !withinRoot(this.paths.creator, manifestPath))
      throw captureError("ARTIFACT_PATH_INVALID", "Creator artifact path escaped storage.");
    await fsp.rename(active.temporaryPath, mediaPath);
    const manifest = {
      schemaVersion: 1,
      artifactId: active.artifactId,
      recordingId: active.recordingId,
      mediaType: "video/webm",
      storageCategory: "LOCAL_APP_DATA",
      contentHash: `sha256:${active.hash.digest("hex")}`,
      fileSize: active.bytes,
      startedAt: active.startedAt,
      completedAt: new Date().toISOString(),
      metadata: active.metadata,
      capture: completion,
      retention: {
        policy: "CREATOR_MANAGED",
        deletable: true,
        uploadAuthorized: Boolean(active.metadata.allowCloudUpload),
      },
    };
    const temporaryManifest = path.join(this.paths.temporary, `${active.artifactId}.manifest.tmp`);
    try {
      await fsp.writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      await fsp.rename(temporaryManifest, manifestPath);
      return manifest;
    } catch (error) {
      await fsp.rm(temporaryManifest, { force: true }).catch(() => {});
      await fsp.rm(mediaPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async cancelCreatorRecording(recordingId) {
    const active = this.activeRecordings.get(recordingId);
    if (!active) return { cancelled: false, idempotent: true };
    this.activeRecordings.delete(recordingId);
    active.writer.destroy();
    await fsp.rm(active.temporaryPath, { force: true });
    return { cancelled: true, temporaryRemoved: true };
  }

  async listCreatorArtifacts() {
    const entries = await fsp.readdir(this.paths.creator, { withFileTypes: true }).catch(() => []);
    const manifests = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/^artifact_[A-Za-z0-9-]+\.manifest\.json$/.test(entry.name)) continue;
      const candidate = path.join(this.paths.creator, entry.name);
      try {
        const parsed = JSON.parse(await fsp.readFile(candidate, "utf8"));
        manifests.push(parsed);
      } catch {
        // Corrupt manifests are excluded and reported through diagnostics, never exposed as arbitrary files.
      }
    }
    return manifests.sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)));
  }

  async getCreatorArtifact(artifactId) {
    requireIdentifier(artifactId, "artifactId");
    const manifestPath = path.join(this.paths.creator, `${artifactId}.manifest.json`);
    const mediaPath = path.join(this.paths.creator, `${artifactId}.webm`);
    if (!withinRoot(this.paths.creator, manifestPath) || !withinRoot(this.paths.creator, mediaPath))
      throw captureError("ARTIFACT_PATH_INVALID", "Creator artifact path escaped storage.");
    try {
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
      const stat = await fsp.stat(mediaPath);
      if (manifest.artifactId !== artifactId || stat.size !== manifest.fileSize)
        throw captureError("ARTIFACT_PATH_INVALID", "Creator artifact integrity metadata is invalid.");
      return { manifest, mediaPath, size: stat.size };
    } catch (error) {
      if (error?.name === "CaptureError") throw error;
      throw captureError("ARTIFACT_NOT_FOUND", "Creator artifact was not found.");
    }
  }

  async deleteCreatorArtifact(artifactId) {
    const artifact = await this.getCreatorArtifact(artifactId);
    const manifestPath = path.join(this.paths.creator, `${artifactId}.manifest.json`);
    await fsp.rm(artifact.mediaPath, { force: true });
    await fsp.rm(manifestPath, { force: true });
    return { artifactId, deleted: true, recoverable: false };
  }

  async writeDiagnosticBundle(metadata) {
    const bundleId = `diagnostic_${crypto.randomUUID()}`;
    const bundlePath = path.join(this.paths.diagnostics, `${bundleId}.json.gz`);
    if (!withinRoot(this.paths.diagnostics, bundlePath))
      throw captureError("ARTIFACT_PATH_INVALID", "Diagnostic path escaped storage.");
    const body = Buffer.from(`${JSON.stringify({ schemaVersion: 1, bundleId, ...metadata }, null, 2)}\n`, "utf8");
    await fsp.writeFile(bundlePath, await gzip(body), { flag: "wx" });
    const stat = await fsp.stat(bundlePath);
    return { bundleId, storageCategory: "LOCAL_APP_DATA", fileSize: stat.size, containsRawFrames: false };
  }

  async getDiagnosticBundle(bundleId) {
    requireIdentifier(bundleId, "bundleId");
    if (!/^diagnostic_[A-Za-z0-9-]+$/.test(bundleId))
      throw captureError("VALIDATION_FAILED", "Diagnostic bundle ID is invalid.");
    const bundlePath = path.join(this.paths.diagnostics, `${bundleId}.json.gz`);
    if (!withinRoot(this.paths.diagnostics, bundlePath))
      throw captureError("ARTIFACT_PATH_INVALID", "Diagnostic bundle path escaped managed storage.");
    try {
      const stat = await fsp.stat(bundlePath);
      if (!stat.isFile()) throw new Error("NOT_A_FILE");
      return { bundleId, bundlePath, fileSize: stat.size, mediaType: "application/gzip" };
    } catch {
      throw captureError("ARTIFACT_NOT_FOUND", "Diagnostic bundle was not found.");
    }
  }
}

module.exports = { CompanionStorage, withinRoot };

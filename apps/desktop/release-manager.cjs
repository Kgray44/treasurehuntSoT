"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ReleaseGovernanceError,
  assertUpgradeAllowed,
  parseVersion,
  verifyArtifactBuffer,
  verifyManifestSignature,
} = require("../companion/release-governance.cjs");

function boundedRoot(root) {
  if (!path.isAbsolute(root))
    throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "Update root must be absolute.");
  return path.resolve(root);
}

function childPath(root, ...segments) {
  const resolvedRoot = boundedRoot(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`))
    throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "Update path escaped the governed root.");
  return candidate;
}

async function atomicJsonWrite(file, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${file}.${process.pid}.part`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temporary, body, { encoding: "utf8", flag: "wx" });
  await fs.rename(temporary, file);
}

class JsonReleaseStateStore {
  constructor(root) {
    this.root = boundedRoot(root);
    this.stateFile = childPath(this.root, "update-state.json");
  }

  async load() {
    try {
      const body = await fs.readFile(this.stateFile, "utf8");
      if (Buffer.byteLength(body) > 256 * 1024)
        throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Persisted update state is oversized.");
      return JSON.parse(body);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async save(state) {
    await atomicJsonWrite(this.stateFile, state);
    return state;
  }
}

class DirectoryArtifactStore {
  constructor(root) {
    this.root = boundedRoot(root);
    this.activePointer = childPath(this.root, "active-release.json");
  }

  async stage(manifest, buffer) {
    parseVersion(manifest.releaseVersion);
    const parsed = (() => {
      try {
        return new URL(manifest.artifact.location);
      } catch {
        return null;
      }
    })();
    const basename = path.basename(parsed ? parsed.pathname : manifest.artifact.location);
    if (!/^[A-Za-z0-9._ -]+\.exe$/i.test(basename))
      throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "Update artifact filename is unsupported.");
    const directory = childPath(this.root, "staged", manifest.releaseVersion);
    const finalPath = childPath(directory, basename);
    const partialPath = `${finalPath}.${process.pid}.part`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(partialPath, buffer, { flag: "wx" });
    await fs.rename(partialPath, finalPath);
    return { artifactPath: finalPath, artifactHash: `sha256:${manifest.artifact.sha256}` };
  }

  async activate(manifest, staged, previousVersion) {
    const pointer = {
      schemaVersion: 1,
      version: manifest.releaseVersion,
      artifactPath: staged.artifactPath,
      artifactHash: staged.artifactHash,
      previousVersion,
      activatedAt: new Date().toISOString(),
    };
    await atomicJsonWrite(this.activePointer, pointer);
    return pointer;
  }

  async rollback(version, reason) {
    const pointer = {
      schemaVersion: 1,
      version,
      rollback: true,
      reason,
      activatedAt: new Date().toISOString(),
    };
    await atomicJsonWrite(this.activePointer, pointer);
    return pointer;
  }
}

class ReleaseManager {
  constructor(options) {
    this.stateStore = options.stateStore;
    this.artifactStore = options.artifactStore;
    this.healthCheck = options.healthCheck ?? (async () => ({ healthy: true }));
    this.trustedPublicKeys = options.trustedPublicKeys ?? {};
    this.allowUnsignedDevelopment = options.allowUnsignedDevelopment === true;
    this.platform = options.platform ?? process.platform;
    this.architecture = options.architecture ?? process.arch;
    this.clock = options.clock ?? (() => new Date());
  }

  async check(manifest, context) {
    const verified = verifyManifestSignature(manifest, {
      trustedPublicKeys: this.trustedPublicKeys,
      allowUnsignedDevelopment: this.allowUnsignedDevelopment,
    });
    const upgrade = assertUpgradeAllowed(context.currentVersion, verified, {
      channel: context.channel,
      platform: this.platform,
      architecture: this.architecture,
      activeScan: context.activeScan,
      activeStoryCriticalPresentation: context.activeStoryCriticalPresentation,
    });
    return { verified, upgrade };
  }

  async prepare(manifest, artifactBuffer, context) {
    const checked = await this.check(manifest, context);
    const artifact = verifyArtifactBuffer(artifactBuffer, checked.verified.manifest.artifact);
    const staged = await this.artifactStore.stage(checked.verified.manifest, artifactBuffer);
    const state = {
      schemaVersion: 1,
      installationId: context.installationId,
      channel: context.channel,
      currentVersion: context.currentVersion,
      targetVersion: checked.verified.manifest.releaseVersion,
      previousVersion: context.currentVersion,
      phase: "STAGED",
      manifestHash: checked.verified.manifestHash,
      stagedArtifactHash: artifact.hash,
      staged,
      manifest: checked.verified.manifest,
      verificationStatus: checked.verified.status,
      rollbackVersion: checked.upgrade.rollbackTarget,
      lastHealthStatus: null,
      errorCode: null,
      updatedAt: this.clock().toISOString(),
    };
    await this.stateStore.save(state);
    return state;
  }

  async activate(context = {}) {
    const state = await this.stateStore.load();
    if (!state || state.phase !== "STAGED")
      throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "No verified staged update is ready.");
    if (context.activeScan || context.activeStoryCriticalPresentation)
      throw new ReleaseGovernanceError("UPDATE_ACTIVE_SESSION", "The staged update is deferred until activity ends.", {
        retryable: true,
      });
    const activating = {
      ...state,
      phase: "PENDING_HEALTH",
      updatedAt: this.clock().toISOString(),
    };
    await this.stateStore.save(activating);
    await this.artifactStore.activate(state.manifest, state.staged, state.currentVersion);
    const health = await this.healthCheck(state.manifest.releaseVersion);
    if (health?.healthy !== true) {
      await this.#rollback(activating, "UPDATE_HEALTH_CHECK_FAILED");
      throw new ReleaseGovernanceError(
        "UPDATE_HEALTH_CHECK_FAILED",
        "The updated application failed its health check.",
      );
    }
    const completed = {
      ...activating,
      currentVersion: state.targetVersion,
      targetVersion: null,
      phase: "IDLE",
      lastHealthStatus: "HEALTHY",
      errorCode: null,
      updatedAt: this.clock().toISOString(),
    };
    await this.stateStore.save(completed);
    return completed;
  }

  async recoverInterruptedActivation() {
    const state = await this.stateStore.load();
    if (!state || state.phase !== "PENDING_HEALTH") return { recovered: false, state };
    return this.#rollback(state, "UPDATE_INTERRUPTED_ACTIVATION");
  }

  async defer() {
    const state = await this.stateStore.load();
    if (!state || state.phase !== "STAGED") return { deferred: false, state };
    const deferred = { ...state, phase: "DEFERRED", updatedAt: this.clock().toISOString() };
    await this.stateStore.save(deferred);
    return { deferred: true, state: deferred };
  }

  async #rollback(state, reason) {
    const target = state.previousVersion ?? state.rollbackVersion;
    if (!target) throw new ReleaseGovernanceError("UPDATE_ROLLBACK_FAILED", "No rollback target is available.");
    await this.artifactStore.rollback(target, reason);
    const rolledBack = {
      ...state,
      currentVersion: target,
      targetVersion: null,
      phase: "ROLLED_BACK",
      lastHealthStatus: "FAILED",
      errorCode: reason,
      updatedAt: this.clock().toISOString(),
    };
    await this.stateStore.save(rolledBack);
    return { recovered: true, state: rolledBack };
  }
}

module.exports = {
  DirectoryArtifactStore,
  JsonReleaseStateStore,
  ReleaseManager,
  atomicJsonWrite,
  childPath,
};

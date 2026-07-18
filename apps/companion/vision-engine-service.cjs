"use strict";

const { EventEmitter } = require("node:events");
const os = require("node:os");
const { VisionBuildEngine } = require("./vision-build-engine.cjs");
const { validateVisionCommand } = require("./vision-command-contract.cjs");
const {
  VISION_ENGINE_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  VisionEngineError,
} = require("./vision-engine-contract.cjs");
const { VisionProviderRouter } = require("./vision-provider.cjs");
const { VisionRuntimeEngine } = require("./vision-runtime-engine.cjs");

class VisionEngineService extends EventEmitter {
  constructor(options) {
    super();
    this.storage = options.storage;
    this.graphicsAdapters = options.graphicsAdapters ?? [];
    this.featureFlags =
      options.featureFlags ??
      (() => ({ visionBuildEngine: false, visionRuntimeEngine: false, shadowVerification: false }));
    this.providerRouter = new VisionProviderRouter({ graphicsAdapters: this.graphicsAdapters });
    this.builder = new VisionBuildEngine({ providerRouter: this.providerRouter });
    this.runtime = new VisionRuntimeEngine({ providerRouter: this.providerRouter });
    this.jobs = new Map();
    this.armedAttempts = new Map();
  }

  setGraphicsAdapters(adapters) {
    this.graphicsAdapters = adapters ?? [];
    this.providerRouter.graphicsAdapters = this.graphicsAdapters;
  }

  capabilities() {
    const flags = this.featureFlags();
    return {
      engineVersion: VISION_ENGINE_VERSION,
      modelBundleVersion: VISION_MODEL_BUNDLE_VERSION,
      buildEngine: true,
      runtimeEngine: true,
      shadowModeOnly: true,
      automaticProgression: false,
      localPixelsOnly: true,
      runtimeRawFrameRetention: false,
      packageSchemaVersions: [1],
      frameSetSchemaVersions: [1],
      providers: this.providerRouter.inventory(),
      resourcePolicy: {
        maximumConcurrentBuilds: 1,
        maximumConcurrentRuntimeAttempts: 1,
        logicalCores: os.cpus().length,
        packageCache: "LOAD_PER_ATTEMPT",
      },
      reconstruction: {
        active: "PLANAR_REFERENCE_GRAPH",
        generalMetric3dAvailable: false,
      },
      configured: {
        buildEngine: flags.visionBuildEngine === true,
        runtimeEngine: flags.visionRuntimeEngine === true,
        reconstruction: flags.visionReconstruction === true,
        secondaryMatcher: flags.visionSecondaryMatcher === true,
        shadowVerification: flags.shadowVerification === true,
        automaticProgression: false,
      },
    };
  }

  async execute(command, unchecked = {}) {
    const input = validateVisionCommand(command, unchecked);
    if (command === "vision.engine.getCapabilities") return this.capabilities();
    const flags = this.featureFlags();
    if (
      command.startsWith("vision.build.") &&
      (flags.visionBuildEngine !== true || flags.visionReconstruction !== true)
    )
      throw new VisionEngineError("MODEL_PROVIDER_UNAVAILABLE", "The local Vision build engine feature is disabled.", {
        retryable: false,
      });
    if (
      command.startsWith("vision.runtime.") &&
      (flags.visionRuntimeEngine !== true || flags.visionSecondaryMatcher !== true || flags.shadowVerification !== true)
    )
      throw new VisionEngineError("PROVIDER_UNAVAILABLE", "The shadow Vision runtime feature is disabled.", {
        retryable: false,
      });
    if (command === "vision.build.start") return this.#startBuild(input);
    if (command === "vision.build.status") return this.#jobStatus(input.buildId);
    if (command === "vision.build.cancel") return this.#cancelBuild(input.buildId);
    if (command === "vision.runtime.arm") return this.#arm(input);
    if (command === "vision.runtime.disarm") return this.#disarm(input.attemptId);
    throw new VisionEngineError("INTERNAL_RUNTIME_ERROR", "Vision command is not implemented.");
  }

  #startBuild(input) {
    const existing = this.jobs.get(input.buildId);
    if (existing) return this.#jobStatus(input.buildId);
    if ([...this.jobs.values()].some((job) => job.status === "RUNNING"))
      throw new VisionEngineError("MODEL_PROVIDER_UNAVAILABLE", "Another local vision build is already running.");
    const controller = new AbortController();
    const job = {
      buildId: input.buildId,
      status: "RUNNING",
      processingStage: "QUEUED",
      progress: 0,
      controller,
      startedAt: new Date().toISOString(),
      completedAt: null,
      report: null,
      failure: null,
    };
    this.jobs.set(input.buildId, job);
    queueMicrotask(
      () =>
        void this.builder
          .build({
            ...input,
            signal: controller.signal,
            resolveFrameSet: async (asset) => {
              const artifactId = asset.sourceAssetId ?? asset.id;
              const expected = asset.sourceAssetId ? undefined : asset.contentHash;
              try {
                return await this.storage.loadCreatorFrameSet(artifactId, expected);
              } catch (error) {
                if (error?.code === "ARTIFACT_NOT_FOUND")
                  throw new VisionEngineError("BUILD_INPUT_ARTIFACT_MISSING", error.message, {
                    details: { assetId: asset.id, artifactId },
                  });
                if (error?.code === "ARTIFACT_PATH_INVALID")
                  throw new VisionEngineError("BUILD_INPUT_HASH_MISMATCH", error.message, {
                    retryable: false,
                    details: { assetId: asset.id, artifactId },
                  });
                throw error;
              }
            },
            onProgress: (event) => {
              job.processingStage = event.stage;
              job.progress = event.overallProgress;
              this.emit("vision-build-progress", event);
            },
          })
          .then(async (report) => {
            const published = await this.storage.publishVisionPackage(report.package);
            job.status = "COMPLETED";
            job.processingStage = "COMPLETE";
            job.progress = 1;
            job.completedAt = new Date().toISOString();
            job.report = { ...report, package: undefined, packageArtifact: published };
            this.emit("vision-build-completed", { buildId: job.buildId, report: job.report });
          })
          .catch((error) => {
            job.status = error.code === "BUILD_CANCELLED" ? "CANCELLED" : "FAILED";
            job.processingStage = job.status;
            job.progress = null;
            job.completedAt = new Date().toISOString();
            job.failure = error.buildReport ?? {
              failureCode: error.code ?? "INTERNAL_BUILD_ERROR",
              message: error.message,
            };
            this.emit("vision-build-failed", { buildId: job.buildId, failure: job.failure });
          }),
    );
    return this.#jobStatus(input.buildId);
  }

  #jobStatus(buildId) {
    const job = this.jobs.get(buildId);
    if (!job) throw new VisionEngineError("BUILD_INPUT_ARTIFACT_MISSING", "Local build job was not found.");
    return {
      buildId: job.buildId,
      status: job.status,
      processingStage: job.processingStage,
      progress: job.progress,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      report: job.report,
      failure: job.failure,
    };
  }

  #cancelBuild(buildId) {
    const job = this.jobs.get(buildId);
    if (!job) return { buildId, cancelled: false, idempotent: true };
    if (job.status !== "RUNNING") return { buildId, cancelled: job.status === "CANCELLED", idempotent: true };
    job.controller.abort();
    return { buildId, cancelled: true, status: "CANCELLING" };
  }

  async #arm(input) {
    if ([...this.armedAttempts.values()].some((attempt) => attempt.active))
      throw new VisionEngineError("INTERNAL_RUNTIME_ERROR", "Another runtime attempt is armed.");
    const runtimePackage = await this.storage.loadVisionPackage(input.packageId);
    this.armedAttempts.set(input.attemptId, {
      ...input,
      package: runtimePackage,
      active: true,
      armedAt: new Date().toISOString(),
    });
    return { attemptId: input.attemptId, armed: true, shadowMode: true, automaticProgression: false };
  }

  #disarm(attemptId) {
    const attempt = this.armedAttempts.get(attemptId);
    if (!attempt) return { attemptId, disarmed: false, idempotent: true };
    this.armedAttempts.delete(attemptId);
    return { attemptId, disarmed: true };
  }

  async consumePlayerEvidence(evidence) {
    const armed = this.armedAttempts.get(evidence.attemptId);
    if (!armed) return null;
    this.armedAttempts.delete(evidence.attemptId);
    const result = await this.runtime.verify({
      ...armed,
      frames: evidence.frames,
      onProgress: (event) => this.emit("vision-runtime-progress", event),
    });
    this.emit("vision-runtime-completed", result);
    return result;
  }
}

module.exports = { VisionEngineService };

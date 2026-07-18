"use strict";

const os = require("node:os");
const { VisionEngineError, VISION_MODEL_BUNDLE_VERSION } = require("./vision-engine-contract.cjs");

const PROVIDER_VERSION = "b4-provider-router-1";

class CpuVisionProvider {
  constructor() {
    this.id = "CPU_CLASSICAL";
    this.version = PROVIDER_VERSION;
    this.modelBundleVersion = VISION_MODEL_BUNDLE_VERSION;
  }

  capabilities() {
    return {
      id: this.id,
      available: true,
      active: true,
      acceleration: "CPU",
      logicalCores: os.cpus().length,
      tasks: ["GLOBAL_DESCRIPTOR", "LOCAL_FEATURES", "HOMOGRAPHY", "RELATIVE_POSE"],
      limitations: [
        "Classical gray-gradient features; no learned semantic model",
        "Planar and relative-pose localization only; not general metric 3D reconstruction",
      ],
    };
  }
}

class DetectedAccelerationProvider {
  constructor(id, adapters, enabled = false) {
    this.id = id;
    this.adapters = adapters;
    this.enabled = enabled;
  }

  capabilities() {
    return {
      id: this.id,
      available: this.adapters.length > 0,
      active: false,
      enabled: this.enabled,
      adapters: this.adapters,
      tasks: [],
      limitation: "Hardware was detected but this B-4 implementation does not ship a GPU inference backend.",
    };
  }
}

class VisionProviderRouter {
  constructor(options = {}) {
    this.graphicsAdapters = options.graphicsAdapters ?? [];
    this.forceUnavailable = new Set(options.forceUnavailable ?? []);
    this.preferred = options.preferred ?? ["DIRECTML_DETECTED", "CUDA_DETECTED", "CPU_CLASSICAL"];
  }

  inventory() {
    const labels = this.graphicsAdapters.map((adapter) => String(adapter.deviceString ?? adapter.driverVendor ?? ""));
    const cuda = labels.filter((label) => /nvidia/i.test(label));
    const directml = labels.filter((label) => /nvidia|amd|intel/i.test(label));
    return [
      new DetectedAccelerationProvider("DIRECTML_DETECTED", directml).capabilities(),
      new DetectedAccelerationProvider("CUDA_DETECTED", cuda).capabilities(),
      new CpuVisionProvider().capabilities(),
    ];
  }

  select(options = {}) {
    const allowFallback = options.allowFallback !== false;
    const requested = options.requested ?? this.preferred[0];
    const available = new Map(this.inventory().map((provider) => [provider.id, provider]));
    const order = [requested, ...(allowFallback ? this.preferred : [])].filter(
      (value, index, values) => values.indexOf(value) === index,
    );
    const attempts = [];
    for (const id of order) {
      const candidate = available.get(id);
      const usable = candidate?.active === true && !this.forceUnavailable.has(id);
      attempts.push({ provider: id, available: Boolean(candidate?.available), usable });
      if (usable) {
        return {
          provider: new CpuVisionProvider(),
          fallbackUsed: id !== requested,
          requested,
          attempts,
        };
      }
    }
    throw new VisionEngineError("PROVIDER_UNAVAILABLE", `No usable vision provider was available for ${requested}.`, {
      details: { requested, attempts },
    });
  }
}

module.exports = { CpuVisionProvider, PROVIDER_VERSION, VisionProviderRouter };

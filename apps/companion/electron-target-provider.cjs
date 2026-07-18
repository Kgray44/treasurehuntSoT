"use strict";

const { captureError, validateSourceId } = require("./capture-contract.cjs");

function sanitizeWindowLabel(value) {
  return String(value || "Application window")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function windowHandleFromSourceId(sourceId) {
  validateSourceId(sourceId);
  return sourceId.split(":")[1];
}

class ElectronTargetProvider {
  constructor(desktopCapturer) {
    this.desktopCapturer = desktopCapturer;
    this.lastCandidates = new Map();
  }

  async listTargets(options = {}) {
    const includeThumbnails = options.includeThumbnails !== false;
    const sources = await this.desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: includeThumbnails ? { width: 240, height: 135 } : { width: 0, height: 0 },
      fetchWindowIcons: includeThumbnails,
    });
    const candidates = sources
      .filter((source) => /^window:\d+:\d+$/.test(source.id))
      .slice(0, 64)
      .map((source, index) => {
        const label = sanitizeWindowLabel(source.name);
        const likelySeaOfThieves = /sea\s+of\s+thieves|sotgame/i.test(label);
        const thumbnailSize = source.thumbnail?.getSize?.() ?? { width: 0, height: 0 };
        const thumbnailDataUrl =
          includeThumbnails && !source.thumbnail?.isEmpty?.() ? source.thumbnail.toDataURL() : null;
        const applicationIconDataUrl =
          includeThumbnails && source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null;
        return {
          targetId: source.id,
          windowHandle: windowHandleFromSourceId(source.id),
          label,
          privacyLabel: likelySeaOfThieves ? "Sea of Thieves window" : `Application window ${index + 1}: ${label}`,
          likelySeaOfThieves,
          dimensions: thumbnailSize,
          displayId: source.display_id || null,
          thumbnailDataUrl: thumbnailDataUrl && thumbnailDataUrl.length <= 256 * 1024 ? thumbnailDataUrl : null,
          applicationIconDataUrl:
            applicationIconDataUrl && applicationIconDataUrl.length <= 64 * 1024 ? applicationIconDataUrl : null,
          available: true,
        };
      });
    this.lastCandidates = new Map(candidates.map((candidate) => [candidate.targetId, candidate]));
    return candidates;
  }

  async validateTarget(targetId) {
    validateSourceId(targetId);
    const targets = await this.listTargets({ includeThumbnails: false });
    const selected = targets.find((target) => target.targetId === targetId);
    if (!selected) throw captureError("CAPTURE_SOURCE_UNAVAILABLE", "The selected application window is unavailable.");
    return selected;
  }
}

module.exports = { ElectronTargetProvider, sanitizeWindowLabel, windowHandleFromSourceId };

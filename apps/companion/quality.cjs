"use strict";

const QUALITY_ALGORITHM_VERSION = "b2-quality-1";
const BEST_FRAME_ALGORITHM_VERSION = "b2-temporal-diversity-1";

function hammingHex(left, right) {
  if (!left || !right || left.length !== right.length) return 64;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    let value = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    while (value) {
      distance += value & 1;
      value >>>= 1;
    }
  }
  return distance;
}

function perceptualHash(luminance, width, height) {
  const bits = [];
  for (let row = 0; row < 8; row += 1) {
    const y = Math.min(height - 1, Math.floor(((row + 0.5) * height) / 8));
    for (let column = 0; column < 8; column += 1) {
      const x = Math.min(width - 1, Math.floor(((column + 0.5) * width) / 8));
      const nextX = Math.min(width - 1, x + Math.max(1, Math.floor(width / 16)));
      bits.push(luminance[y * width + x] >= luminance[y * width + nextX] ? 1 : 0);
    }
  }
  let result = "";
  for (let index = 0; index < bits.length; index += 4)
    result += Number.parseInt(bits.slice(index, index + 4).join(""), 2).toString(16);
  return result.padEnd(16, "0");
}

function analyzeFrame(input, previousFrame) {
  const { pixels, width, height } = input;
  if (
    !Buffer.isBuffer(pixels) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    pixels.length < width * height * 4
  )
    throw new Error("CAPTURE_FRAME_INVALID");
  const pixelCount = width * height;
  const luminance = Buffer.allocUnsafe(pixelCount);
  const histogram = new Uint32Array(16);
  let sum = 0;
  let sumSquares = 0;
  let dark = 0;
  let bright = 0;
  let black = 0;
  for (let index = 0, pixelIndex = 0; pixelIndex < pixelCount; index += 4, pixelIndex += 1) {
    const value = Math.round(pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722);
    luminance[pixelIndex] = value;
    histogram[Math.min(15, value >>> 4)] += 1;
    sum += value;
    sumSquares += value * value;
    if (value <= 12) black += 1;
    if (value <= 24) dark += 1;
    if (value >= 232) bright += 1;
  }
  const mean = sum / pixelCount;
  const variance = Math.max(0, sumSquares / pixelCount - mean * mean);
  let entropy = 0;
  for (const count of histogram) {
    if (!count) continue;
    const probability = count / pixelCount;
    entropy -= probability * Math.log2(probability);
  }
  let edge = 0;
  let edgeSamples = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
  for (let y = step; y < height; y += step) {
    for (let x = step; x < width; x += step) {
      const current = luminance[y * width + x];
      edge += Math.abs(current - luminance[y * width + x - step]);
      edge += Math.abs(current - luminance[(y - step) * width + x]);
      edgeSamples += 2;
    }
  }
  let motion = null;
  if (previousFrame?.luminance?.length === luminance.length) {
    let difference = 0;
    let samples = 0;
    for (let index = 0; index < luminance.length; index += Math.max(1, Math.floor(luminance.length / 4096))) {
      difference += Math.abs(luminance[index] - previousFrame.luminance[index]);
      samples += 1;
    }
    motion = difference / Math.max(1, samples) / 255;
  }
  const hash = perceptualHash(luminance, width, height);
  const duplicateDistance = previousFrame?.quality?.perceptualHash
    ? hammingHex(hash, previousFrame.quality.perceptualHash)
    : null;
  const sharpness = Math.min(1, edge / Math.max(1, edgeSamples) / 32);
  const reasons = [];
  if (black / pixelCount > 0.85) reasons.push("FRAME_MOSTLY_BLACK");
  if (mean < 28) reasons.push("FRAME_TOO_DARK");
  if (mean > 232) reasons.push("FRAME_TOO_BRIGHT");
  if (sharpness < 0.08) reasons.push("FRAME_BLURRY");
  if (entropy < 1.1) reasons.push("FRAME_LOW_INFORMATION");
  if (duplicateDistance !== null && duplicateDistance <= 2) reasons.push("FRAME_NEAR_DUPLICATE");
  if (motion !== null && motion > 0.32) reasons.push("FRAME_EXCESSIVE_MOTION");
  return {
    luminance,
    quality: {
      algorithmVersion: QUALITY_ALGORITHM_VERSION,
      sharpness,
      meanLuminance: mean / 255,
      luminanceVariance: variance / (255 * 255),
      darkClippingRatio: dark / pixelCount,
      brightClippingRatio: bright / pixelCount,
      blackFrameRatio: black / pixelCount,
      contrast: Math.min(1, Math.sqrt(variance) / 64),
      entropy: entropy / 4,
      perceptualHash: hash,
      duplicateDistance,
      nearDuplicate: duplicateDistance !== null && duplicateDistance <= 2,
      motion,
      reasons,
      usable: reasons.every(
        (reason) => !["FRAME_MOSTLY_BLACK", "FRAME_BLURRY", "FRAME_EXCESSIVE_MOTION"].includes(reason),
      ),
    },
  };
}

function selectBestFrames(frames, options = {}) {
  const maximum = options.maximum ?? 12;
  const minimum = options.minimum ?? 6;
  const usable = frames.filter((frame) => frame.quality.usable);
  const selected = [];
  if (usable.length) {
    const bucketCount = Math.min(maximum, usable.length);
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = Math.floor((bucket * usable.length) / bucketCount);
      const end = Math.max(start + 1, Math.floor(((bucket + 1) * usable.length) / bucketCount));
      const candidates = usable.slice(start, end).sort((left, right) => {
        const score = (frame) =>
          frame.quality.sharpness * 0.45 +
          frame.quality.contrast * 0.2 +
          frame.quality.entropy * 0.15 +
          Math.min(0.2, (frame.quality.motion ?? 0.08) * 0.8);
        return score(right) - score(left) || left.sequence - right.sequence;
      });
      const diverse = candidates.find(
        (candidate) =>
          !selected.some(
            (existing) => hammingHex(existing.quality.perceptualHash, candidate.quality.perceptualHash) <= 3,
          ),
      );
      if (diverse) selected.push(diverse);
    }
  }
  selected.sort((left, right) => left.capturedAtMs - right.capturedAtMs || left.sequence - right.sequence);
  const reasons = [];
  if (frames.length < minimum) reasons.push("TOO_FEW_CAPTURED_FRAMES");
  if (usable.length < minimum) reasons.push("TOO_FEW_USABLE_FRAMES");
  if (selected.length < minimum) reasons.push("TOO_FEW_DIVERSE_FRAMES");
  return {
    algorithmVersion: BEST_FRAME_ALGORITHM_VERSION,
    sufficient: selected.length >= minimum,
    reasons,
    selected,
  };
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function summarizeQuality(frames, ringStats = {}) {
  const duplicateCount = frames.filter((frame) => frame.quality.nearDuplicate).length;
  const frozenRun = frames.reduce(
    (state, frame) => {
      const duplicate = frame.quality.nearDuplicate;
      const current = duplicate ? state.current + 1 : 0;
      return { current, longest: Math.max(state.longest, current) };
    },
    { current: 0, longest: 0 },
  ).longest;
  const reasons = [...new Set(frames.flatMap((frame) => frame.quality.reasons))];
  return {
    algorithmVersion: QUALITY_ALGORITHM_VERSION,
    capturedFrameCount: frames.length + (ringStats.droppedFrames ?? 0),
    retainedFrameCount: frames.length,
    usableFrameCount: frames.filter((frame) => frame.quality.usable).length,
    droppedFrameCount: ringStats.droppedFrames ?? 0,
    averageSharpness: average(frames.map((frame) => frame.quality.sharpness)),
    averageLuminance: average(frames.map((frame) => frame.quality.meanLuminance)),
    averageContrast: average(frames.map((frame) => frame.quality.contrast)),
    averageEntropy: average(frames.map((frame) => frame.quality.entropy)),
    averageMotion: average(frames.map((frame) => frame.quality.motion)),
    duplicateRatio: frames.length ? duplicateCount / frames.length : 0,
    longestFrozenRun: frozenRun,
    frozen: frames.length >= 8 && frozenRun >= Math.max(6, Math.floor(frames.length * 0.6)),
    queuePressureRatio: ringStats.pressureRatio ?? 0,
    reasons,
  };
}

module.exports = {
  BEST_FRAME_ALGORITHM_VERSION,
  QUALITY_ALGORITHM_VERSION,
  analyzeFrame,
  hammingHex,
  perceptualHash,
  selectBestFrames,
  summarizeQuality,
};

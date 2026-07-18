"use strict";

const { cosineSimilarity, normalize } = require("./vision-math.cjs");
const { sha256 } = require("./vision-engine-contract.cjs");

const GLOBAL_DESCRIPTOR_VERSION = "gray-gradient-pyramid-2";
const LOCAL_FEATURE_VERSION = "gradient-patch-1";
const LOCAL_MATCHER_VERSION = "mutual-ratio-1";

function assertFrame(frame) {
  if (
    !frame ||
    !Buffer.isBuffer(frame.luminance) ||
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width < 24 ||
    frame.height < 24 ||
    frame.luminance.length !== frame.width * frame.height
  )
    throw new Error("VISION_FRAME_INVALID");
  return frame;
}

function frameContentHash(frame) {
  assertFrame(frame);
  return `sha256:${sha256(Buffer.concat([Buffer.from(`${frame.width}x${frame.height}:`), frame.luminance]))}`;
}

function luminanceHistogram(frame, bins = 16, bounds = {}) {
  const x0 = Math.max(0, Math.floor(bounds.x0 ?? 0));
  const y0 = Math.max(0, Math.floor(bounds.y0 ?? 0));
  const x1 = Math.min(frame.width, Math.ceil(bounds.x1 ?? frame.width));
  const y1 = Math.min(frame.height, Math.ceil(bounds.y1 ?? frame.height));
  const histogram = Array(bins).fill(0);
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      histogram[Math.min(bins - 1, Math.floor((frame.luminance[y * frame.width + x] / 256) * bins))] += 1;
      count += 1;
    }
  }
  return histogram.map((value) => value / Math.max(1, count));
}

function gradientHistogram(frame, bounds = {}, bins = 8) {
  const x0 = Math.max(1, Math.floor(bounds.x0 ?? 1));
  const y0 = Math.max(1, Math.floor(bounds.y0 ?? 1));
  const x1 = Math.min(frame.width - 1, Math.ceil(bounds.x1 ?? frame.width - 1));
  const y1 = Math.min(frame.height - 1, Math.ceil(bounds.y1 ?? frame.height - 1));
  const histogram = Array(bins).fill(0);
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(frame.width, frame.height) / 128));
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const dx = frame.luminance[y * frame.width + x + 1] - frame.luminance[y * frame.width + x - 1];
      const dy = frame.luminance[(y + 1) * frame.width + x] - frame.luminance[(y - 1) * frame.width + x];
      const strength = Math.hypot(dx, dy);
      if (strength < 4) continue;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      histogram[Math.min(bins - 1, Math.floor(angle * bins))] += strength;
      total += strength;
    }
  }
  return histogram.map((value) => value / Math.max(1, total));
}

function spatialMeans(frame, bounds = {}, grid = 4) {
  const x0 = Math.max(0, Math.floor(bounds.x0 ?? 0));
  const y0 = Math.max(0, Math.floor(bounds.y0 ?? 0));
  const x1 = Math.min(frame.width, Math.ceil(bounds.x1 ?? frame.width));
  const y1 = Math.min(frame.height, Math.ceil(bounds.y1 ?? frame.height));
  const values = [];
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const left = Math.floor(x0 + ((x1 - x0) * column) / grid);
      const right = Math.max(left + 1, Math.floor(x0 + ((x1 - x0) * (column + 1)) / grid));
      const top = Math.floor(y0 + ((y1 - y0) * row) / grid);
      const bottom = Math.max(top + 1, Math.floor(y0 + ((y1 - y0) * (row + 1)) / grid));
      let sum = 0;
      let count = 0;
      for (let y = top; y < bottom; y += 2) {
        for (let x = left; x < right; x += 2) {
          sum += frame.luminance[y * frame.width + x] / 255;
          count += 1;
        }
      }
      values.push(sum / Math.max(1, count));
    }
  }
  return values;
}

function cropBounds(frame, crop) {
  const width = frame.width;
  const height = frame.height;
  const definitions = {
    FULL: { x0: 0, y0: 0, x1: width, y1: height },
    CENTER: { x0: width * 0.18, y0: height * 0.12, x1: width * 0.82, y1: height * 0.88 },
    LEFT_CONTEXT: { x0: 0, y0: height * 0.08, x1: width * 0.62, y1: height * 0.92 },
    RIGHT_CONTEXT: { x0: width * 0.38, y0: height * 0.08, x1: width, y1: height * 0.92 },
    UPPER_CONTEXT: { x0: width * 0.08, y0: 0, x1: width * 0.92, y1: height * 0.62 },
    LOWER_CONTEXT: { x0: width * 0.08, y0: height * 0.38, x1: width * 0.92, y1: height },
  };
  return definitions[crop] ?? definitions.FULL;
}

function describeGlobal(frame, options = {}) {
  assertFrame(frame);
  const crops = options.crops ?? ["FULL", "CENTER", "LEFT_CONTEXT", "RIGHT_CONTEXT", "UPPER_CONTEXT", "LOWER_CONTEXT"];
  return crops.map((crop) => {
    const bounds = cropBounds(frame, crop);
    const coarse = spatialMeans(frame, bounds, 4);
    const fine = spatialMeans(frame, bounds, 8);
    const fineMean = fine.reduce((sum, value) => sum + value, 0) / fine.length;
    return {
      crop,
      version: GLOBAL_DESCRIPTOR_VERSION,
      values: normalize([
        ...coarse.map((value) => (value - fineMean) * 2),
        ...fine.map((value) => (value - fineMean) * 3),
        ...luminanceHistogram(frame, 16, bounds),
        ...gradientHistogram(frame, bounds, 8),
      ]),
    };
  });
}

function bestGlobalSimilarity(queryDescriptors, referenceDescriptors) {
  let best = { similarity: -1, queryCrop: null, referenceCrop: null };
  for (const query of queryDescriptors) {
    for (const reference of referenceDescriptors) {
      const similarity = cosineSimilarity(query.values, reference.values);
      if (similarity > best.similarity) best = { similarity, queryCrop: query.crop, referenceCrop: reference.crop };
    }
  }
  return best;
}

function frameQuality(frame) {
  assertFrame(frame);
  const histogram = Array(16).fill(0);
  let sum = 0;
  let sumSquares = 0;
  let dark = 0;
  let bright = 0;
  let gradientSum = 0;
  let laplacianSum = 0;
  let samples = 0;
  for (let valueIndex = 0; valueIndex < frame.luminance.length; valueIndex += 1) {
    const value = frame.luminance[valueIndex];
    sum += value;
    sumSquares += value * value;
    histogram[Math.min(15, value >>> 4)] += 1;
    if (value < 24) dark += 1;
    if (value > 232) bright += 1;
  }
  const step = Math.max(1, Math.floor(Math.min(frame.width, frame.height) / 120));
  for (let y = step; y < frame.height - step; y += step) {
    for (let x = step; x < frame.width - step; x += step) {
      const center = frame.luminance[y * frame.width + x];
      const left = frame.luminance[y * frame.width + x - step];
      const right = frame.luminance[y * frame.width + x + step];
      const top = frame.luminance[(y - step) * frame.width + x];
      const bottom = frame.luminance[(y + step) * frame.width + x];
      gradientSum += Math.hypot(right - left, bottom - top);
      laplacianSum += Math.abs(left + right + top + bottom - 4 * center);
      samples += 1;
    }
  }
  const count = frame.luminance.length;
  const mean = sum / count;
  const variance = Math.max(0, sumSquares / count - mean * mean);
  let entropy = 0;
  for (const bucket of histogram) {
    if (!bucket) continue;
    const probability = bucket / count;
    entropy -= probability * Math.log2(probability);
  }
  const sharpness = Math.min(1, laplacianSum / Math.max(1, samples) / 52);
  const motionBlurRisk = Math.max(0, 1 - gradientSum / Math.max(1, samples) / 28) * Math.max(0, 1 - sharpness);
  const reasons = [];
  if (mean < 25) reasons.push("UNDEREXPOSED");
  if (mean > 234) reasons.push("OVEREXPOSED");
  if (sharpness < 0.035) reasons.push("BLURRY");
  if (variance < 90 || entropy < 1.2) reasons.push("LOW_CONTRAST");
  if (dark / count > 0.9 || bright / count > 0.9) reasons.push("LIKELY_LOADING_OR_OBSTRUCTED");
  return {
    meanLuminance: mean / 255,
    contrast: Math.min(1, Math.sqrt(variance) / 64),
    entropy: entropy / 4,
    sharpness,
    motionBlurRisk,
    darkClippingRatio: dark / count,
    brightClippingRatio: bright / count,
    usable: !reasons.some((reason) =>
      ["UNDEREXPOSED", "OVEREXPOSED", "BLURRY", "LIKELY_LOADING_OR_OBSTRUCTED"].includes(reason),
    ),
    reasons,
  };
}

function differenceHash(frame) {
  assertFrame(frame);
  let bits = "";
  for (let row = 0; row < 8; row += 1) {
    const y = Math.min(frame.height - 1, Math.floor(((row + 0.5) * frame.height) / 8));
    for (let column = 0; column < 8; column += 1) {
      const x = Math.min(frame.width - 2, Math.floor(((column + 0.5) * frame.width) / 8));
      bits += frame.luminance[y * frame.width + x] >= frame.luminance[y * frame.width + x + 1] ? "1" : "0";
    }
  }
  let value = "";
  for (let index = 0; index < bits.length; index += 4)
    value += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  return value;
}

function hammingHex(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY;
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

function patchDescriptor(frame, x, y, radius = 10, cells = 8) {
  const values = [];
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const sampleX = Math.max(
        0,
        Math.min(frame.width - 1, Math.round(x - radius + ((column + 0.5) * radius * 2) / cells)),
      );
      const sampleY = Math.max(
        0,
        Math.min(frame.height - 1, Math.round(y - radius + ((row + 0.5) * radius * 2) / cells)),
      );
      values.push(frame.luminance[sampleY * frame.width + sampleX] / 255);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return normalize(values.map((value) => (value - mean) / Math.max(0.025, deviation)));
}

function extractLocalFeatures(frame, options = {}) {
  assertFrame(frame);
  const maximum = options.maximum ?? 220;
  const border = options.border ?? 12;
  const minimumDistance = options.minimumDistance ?? 6;
  const candidates = [];
  const step = options.step ?? 2;
  for (let y = border; y < frame.height - border; y += step) {
    for (let x = border; x < frame.width - border; x += step) {
      const dx = frame.luminance[y * frame.width + x + 1] - frame.luminance[y * frame.width + x - 1];
      const dy = frame.luminance[(y + 1) * frame.width + x] - frame.luminance[(y - 1) * frame.width + x];
      const diagonalA = frame.luminance[(y + 1) * frame.width + x + 1] - frame.luminance[(y - 1) * frame.width + x - 1];
      const diagonalB = frame.luminance[(y + 1) * frame.width + x - 1] - frame.luminance[(y - 1) * frame.width + x + 1];
      const response = Math.abs(dx * dy) + 0.35 * Math.abs(diagonalA * diagonalB) + 0.15 * (dx * dx + dy * dy);
      if (response > 380) candidates.push({ x, y, response });
    }
  }
  candidates.sort((left, right) => right.response - left.response || left.y - right.y || left.x - right.x);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((feature) => Math.hypot(feature.x - candidate.x, feature.y - candidate.y) < minimumDistance))
      continue;
    selected.push({
      id: `${frame.id ?? "frame"}:feature:${selected.length}`,
      x: candidate.x,
      y: candidate.y,
      scale: 1,
      confidence: Math.min(1, candidate.response / 12_000),
      descriptor: patchDescriptor(frame, candidate.x, candidate.y),
    });
    if (selected.length >= maximum) break;
  }
  return { version: LOCAL_FEATURE_VERSION, width: frame.width, height: frame.height, features: selected };
}

function descriptorDistance(left, right) {
  return 1 - cosineSimilarity(left, right);
}

function nearest(features, descriptor, excluded = -1) {
  let best = { index: -1, distance: Number.POSITIVE_INFINITY };
  let second = { index: -1, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < features.length; index += 1) {
    if (index === excluded) continue;
    const distance = descriptorDistance(descriptor, features[index].descriptor);
    if (distance < best.distance) {
      second = best;
      best = { index, distance };
    } else if (distance < second.distance) second = { index, distance };
  }
  return { best, second };
}

function matchLocalFeatures(query, reference, options = {}) {
  const ratio = options.ratio ?? 0.82;
  const maximumDistance = options.maximumDistance ?? 0.35;
  const forward = [];
  for (let queryIndex = 0; queryIndex < query.features.length; queryIndex += 1) {
    const result = nearest(reference.features, query.features[queryIndex].descriptor);
    if (result.best.index < 0 || result.best.distance > maximumDistance) continue;
    if (Number.isFinite(result.second.distance) && result.best.distance > result.second.distance * ratio) continue;
    forward.push({ queryIndex, referenceIndex: result.best.index, distance: result.best.distance });
  }
  const matches = [];
  for (const candidate of forward) {
    const reverse = nearest(query.features, reference.features[candidate.referenceIndex].descriptor);
    if (reverse.best.index !== candidate.queryIndex) continue;
    const queryFeature = query.features[candidate.queryIndex];
    const referenceFeature = reference.features[candidate.referenceIndex];
    matches.push({
      query: { x: queryFeature.x, y: queryFeature.y, featureId: queryFeature.id },
      reference: { x: referenceFeature.x, y: referenceFeature.y, featureId: referenceFeature.id },
      confidence: Math.max(0, 1 - candidate.distance),
      distance: candidate.distance,
    });
  }
  return {
    version: LOCAL_MATCHER_VERSION,
    rawCount: forward.length,
    filteredCount: matches.length,
    matches: matches.sort((left, right) => right.confidence - left.confidence),
  };
}

module.exports = {
  GLOBAL_DESCRIPTOR_VERSION,
  LOCAL_FEATURE_VERSION,
  LOCAL_MATCHER_VERSION,
  assertFrame,
  bestGlobalSimilarity,
  describeGlobal,
  differenceHash,
  extractLocalFeatures,
  frameContentHash,
  frameQuality,
  hammingHex,
  matchLocalFeatures,
};

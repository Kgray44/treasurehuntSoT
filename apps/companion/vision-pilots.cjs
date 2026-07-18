"use strict";

const { sha256 } = require("./vision-engine-contract.cjs");

function seededNoise(x, y, seed) {
  let value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263) ^ Math.imul(seed + 7, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) & 255;
}

function sourceValue(x, y, seed, confuser = false) {
  const checker = ((Math.floor(x / 13) + Math.floor(y / 11) + seed) & 1) * 34;
  const waves = 34 * Math.sin((x + seed * 9) / 17) + 27 * Math.cos((y - seed * 5) / 13);
  const diagonal = (x * 3 + y * 5 + seed * 11) % 71 < 7 ? 58 : 0;
  const centerX = confuser ? 0.68 : 0.47;
  const centerY = confuser ? 0.38 : 0.53;
  const landmark =
    Math.hypot(x / 160 - centerX, y / 96 - centerY) < (confuser ? 0.105 : 0.145) ? (confuser ? -65 : 78) : 0;
  const tower = x > (confuser ? 92 : 67) && x < (confuser ? 104 : 79) && y > 18 && y < 78 ? (confuser ? 42 : -52) : 0;
  return Math.max(
    0,
    Math.min(255, Math.round(118 + checker + waves + diagonal + landmark + tower + (seededNoise(x, y, seed) % 17) - 8)),
  );
}

function makeFrame(id, seed, options = {}) {
  const width = 160;
  const height = 96;
  const shiftX = options.shiftX ?? 0;
  const shiftY = options.shiftY ?? 0;
  const scale = options.scale ?? 1;
  const luminance = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(0, Math.min(width - 1, Math.round((x - width / 2) / scale + width / 2 + shiftX)));
      const sourceY = Math.max(0, Math.min(height - 1, Math.round((y - height / 2) / scale + height / 2 + shiftY)));
      let value = sourceValue(sourceX, sourceY, seed, options.confuser);
      if (options.dark) value = Math.round(value * 0.08);
      if (options.occluded && x > width * 0.25 && x < width * 0.8) value = 8;
      luminance[y * width + x] = value;
    }
  }
  return {
    id,
    width,
    height,
    sequence: options.sequence ?? 1,
    offsetMs: options.offsetMs ?? 0,
    capturedAtMs: options.offsetMs ?? 0,
    luminance,
  };
}

function asset(pilotId, suffix, role, contentSeed) {
  return {
    id: `artifact_${pilotId}_${suffix}`,
    role,
    contentHash: `sha256:${sha256(`pilot-media:${pilotId}:${contentSeed}`)}`,
    durationMs: 4_000,
    segmentStartMs: null,
    segmentEndMs: null,
    sourceAssetId: null,
    integrityState: "LOCAL_VERIFIED",
  };
}

function frameSet(assetRecord, seed, kind, pilotIndex) {
  const positive = kind.includes("positive") || kind === "target";
  const confuser = !positive;
  const difficultyShift = pilotIndex - 1;
  const variants = [
    { shiftX: 0, shiftY: 0, scale: 1 },
    { shiftX: 2 + difficultyShift, shiftY: -1, scale: 1.015 },
    { shiftX: -2, shiftY: 2 + difficultyShift, scale: 0.985 },
    { shiftX: 3, shiftY: 1, scale: 1.025 },
  ];
  return {
    schemaVersion: 1,
    artifactId: assetRecord.id,
    sourceContentHash: assetRecord.contentHash,
    width: 160,
    height: 96,
    frames: variants.map((variant, index) =>
      makeFrame(`frame_${assetRecord.id}_${index + 1}`, seed, {
        ...variant,
        confuser,
        sequence: index + 1,
        offsetMs: index * 700,
      }),
    ),
  };
}

function createPilot(index) {
  const pilotId = `pilot${index}`;
  const seed = 20 + index * 13;
  const target = asset(pilotId, "target", "TARGET_REFERENCE", "target");
  const negative = asset(pilotId, "hard_negative", "HARD_NEGATIVE_NEARBY", "hard-negative");
  const validationPositive = asset(pilotId, "validation_positive", "VALIDATION", "validation-positive");
  const validationNegative = asset(pilotId, "validation_negative", "VALIDATION", "validation-negative");
  const lockedPositive = asset(pilotId, "locked_positive", "LOCKED_TEST", "locked-positive");
  const lockedNegative = asset(pilotId, "locked_negative", "LOCKED_TEST", "locked-negative");
  const assets = [target, negative, validationPositive, validationNegative, lockedPositive, lockedNegative];
  const test = (suffix, testType, expectedResult, assetId, locked) => ({
    id: `test_${pilotId}_${suffix}`,
    name: `${pilotId} ${suffix}`,
    testType,
    instructions: "Replay through the production B-4 engine without tuning against locked evidence.",
    expectedResult,
    status: "AUTHORED",
    environment: { plainLanguage: "Synthetic mathematical fixture; not Sea of Thieves evidence.", assetIds: [assetId] },
    assetRole: locked ? "LOCKED_TEST" : "VALIDATION",
    lockedAt: locked ? "2026-07-18T00:00:00.000Z" : null,
  });
  const buildInput = {
    schemaVersion: 1,
    inputType: "VISION_WAYPOINT_BUILD_INPUT",
    waypoint: {
      id: `waypoint_${pilotId}`,
      versionId: `version_${pilotId}_0001`,
      versionNumber: 1,
      type: index === 1 ? "EXACT_LANDMARK" : index === 2 ? "AREA_ARRIVAL" : "VIEWPOINT",
      verificationProfile: index === 1 ? "BALANCED" : index === 2 ? "STRICT" : "STORY_CRITICAL",
    },
    authoring: { schemaVersion: 1, steps: { purpose: { summary: "Synthetic fixture" } } },
    assets,
    acceptedPoseRegions: [
      {
        id: `pose_${pilotId}_accepted`,
        coordinateSystem: "CREATOR_PROVISIONAL_2D",
        shapeType: "CIRCLE",
        classification: "ACCEPTED",
        parameters: { centerX: 0, centerZ: 1, radius: 8, facingDegrees: 0, toleranceDegrees: 180 },
        orientationRules: { toleranceDegrees: 180 },
        visibilityRules: { required: true },
        authoringSource: "SYNTHETIC_MATHEMATICAL_FIXTURE",
      },
    ],
    visualRegions: [
      {
        id: `region_${pilotId}_stable`,
        recordingAssetId: target.id,
        regionType: "STABLE",
        coordinateSpace: "NORMALIZED_IMAGE",
        geometry: { tool: "RECTANGLE", x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
        semanticLabel: "Synthetic stable region",
      },
    ],
    hardNegatives: [
      {
        id: `negative_${pilotId}_nearby`,
        name: "Synthetic look-alike",
        classification: "NEARBY",
        metadata: { reason: "Mathematical confuser fixture", assetIds: [negative.id] },
      },
    ],
    validationTests: [
      test("validation_positive", "POSITIVE", "MATCH", validationPositive.id, false),
      test("validation_negative", "NEGATIVE", "NO_MATCH", validationNegative.id, false),
    ],
    lockedTests: [
      test("locked_positive", "POSITIVE", "MATCH", lockedPositive.id, true),
      test("locked_negative", "NEGATIVE", "NO_MATCH", lockedNegative.id, true),
    ],
    boundary: { implementation: "LOCAL_COMPANION_BUILD_REQUIRED", shadowModeOnly: true, automaticProgression: false },
  };
  const frameSets = new Map([
    [target.id, frameSet(target, seed, "target", index)],
    [negative.id, frameSet(negative, seed + 71, "negative", index)],
    [validationPositive.id, frameSet(validationPositive, seed, "validation-positive", index)],
    [validationNegative.id, frameSet(validationNegative, seed + 83, "validation-negative", index)],
    [lockedPositive.id, frameSet(lockedPositive, seed, "locked-positive", index)],
    [lockedNegative.id, frameSet(lockedNegative, seed + 97, "locked-negative", index)],
  ]);
  return {
    id: pilotId,
    label:
      index === 1
        ? "Easy exact landmark"
        : index === 2
          ? "Moderate natural location"
          : "Difficult confusable viewpoint",
    evidenceClass: "SYNTHETIC_MATHEMATICAL_FIXTURE",
    seaOfThievesClaim: false,
    buildInput,
    frameSets,
    runtime: {
      positive: frameSet(validationPositive, seed, "validation-positive", index).frames,
      negative: frameSet(validationNegative, seed + 83, "validation-negative", index).frames,
      insufficient: [
        makeFrame(`frame_${pilotId}_dark_1`, seed, { dark: true }),
        makeFrame(`frame_${pilotId}_dark_2`, seed, { dark: true, shiftX: 2 }),
      ],
    },
  };
}

function createSyntheticPilots() {
  return [createPilot(1), createPilot(2), createPilot(3)];
}

function cloneFrames(frames) {
  return frames.map((frame) => ({ ...frame, luminance: Buffer.from(frame.luminance) }));
}

module.exports = { cloneFrames, createSyntheticPilots, makeFrame };

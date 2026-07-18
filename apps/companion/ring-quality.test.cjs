"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzeFrame, selectBestFrames, summarizeQuality } = require("./quality.cjs");
const { BoundedFrameRing } = require("./ring-buffer.cjs");

function patternedPixels(width, height, phase = 0) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = ((x * 17 + y * 29 + phase * (x + 3)) % 220) + 18;
      pixels[index] = value;
      pixels[index + 1] = (value * 3 + phase * 11) % 255;
      pixels[index + 2] = (value * 7 + phase * 5) % 255;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

function analyzedFrame(sequence, phase, previous) {
  const frame = {
    sequence,
    capturedAtMs: sequence * 100,
    width: 32,
    height: 24,
    pixels: patternedPixels(32, 24, phase),
  };
  const analysis = analyzeFrame(frame, previous);
  return { ...frame, ...analysis };
}

test("bounded frame ring evicts deterministically and zeroizes discarded buffers", () => {
  const ring = new BoundedFrameRing({ maxFrames: 2, maxBytes: 16 * 1024 });
  const first = analyzedFrame(1, 1);
  const second = analyzedFrame(2, 2, first);
  const third = analyzedFrame(3, 3, second);
  ring.push(first);
  ring.push(second);
  ring.push(third);
  assert.deepEqual(
    ring.snapshot().map((frame) => frame.sequence),
    [2, 3],
  );
  assert.equal(
    first.pixels.every((value) => value === 0),
    true,
  );
  assert.equal(
    first.luminance.every((value) => value === 0),
    true,
  );
  assert.equal(ring.stats().droppedFrames, 1);
  assert.equal(ring.clear(), 2);
  assert.equal(
    second.pixels.every((value) => value === 0),
    true,
  );
  assert.equal(
    third.pixels.every((value) => value === 0),
    true,
  );
});

test("quality analysis detects black and frozen streams", () => {
  const blackPixels = Buffer.alloc(32 * 24 * 4);
  const black = analyzeFrame({ pixels: blackPixels, width: 32, height: 24 });
  assert.equal(black.quality.usable, false);
  assert.ok(black.quality.reasons.includes("FRAME_MOSTLY_BLACK"));

  const frozen = [];
  let previous = null;
  for (let sequence = 1; sequence <= 10; sequence += 1) {
    const frame = analyzedFrame(sequence, 7, previous);
    frozen.push(frame);
    previous = frame;
  }
  const summary = summarizeQuality(frozen);
  assert.equal(summary.frozen, true);
  assert.ok(summary.duplicateRatio >= 0.8);
  assert.equal(selectBestFrames(frozen, { minimum: 6, maximum: 12 }).sufficient, false);
});

test("best-frame selection returns chronological, bounded evidence from varied input", () => {
  const frames = [];
  let previous = null;
  for (let sequence = 1; sequence <= 20; sequence += 1) {
    const frame = analyzedFrame(sequence, sequence, previous);
    frames.push(frame);
    previous = frame;
  }
  const selection = selectBestFrames(frames, { minimum: 3, maximum: 8 });
  assert.ok(selection.selected.length <= 8);
  assert.equal(
    selection.selected.every((frame, index) => index === 0 || frame.sequence > selection.selected[index - 1].sequence),
    true,
  );
  assert.equal(
    selection.selected.every((frame) => frame.quality.usable),
    true,
  );
});

"use strict";

const { captureError } = require("./capture-contract.cjs");

function disposeFrame(frame) {
  if (Buffer.isBuffer(frame?.pixels)) frame.pixels.fill(0);
  if (Buffer.isBuffer(frame?.luminance)) frame.luminance.fill(0);
}

class BoundedFrameRing {
  constructor(options = {}) {
    this.maxFrames = options.maxFrames ?? 72;
    this.maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    this.frames = [];
    this.bytes = 0;
    this.droppedFrames = 0;
    this.lastSequence = -1;
    if (!Number.isInteger(this.maxFrames) || this.maxFrames < 1 || this.maxFrames > 600)
      throw captureError("VALIDATION_FAILED", "Ring maxFrames is invalid.");
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1024 || this.maxBytes > 512 * 1024 * 1024)
      throw captureError("VALIDATION_FAILED", "Ring maxBytes is invalid.");
  }

  push(frame) {
    if (!frame || !Number.isSafeInteger(frame.sequence) || frame.sequence <= this.lastSequence)
      throw captureError("VALIDATION_FAILED", "Captured frame sequence must be strictly increasing.");
    if (!Buffer.isBuffer(frame.pixels))
      throw captureError("VALIDATION_FAILED", "Captured frame pixels must be binary.");
    const size = frame.pixels.byteLength + (Buffer.isBuffer(frame.luminance) ? frame.luminance.byteLength : 0);
    if (size > this.maxBytes) {
      disposeFrame(frame);
      this.droppedFrames += 1;
      this.lastSequence = frame.sequence;
      return false;
    }
    while (this.frames.length >= this.maxFrames || this.bytes + size > this.maxBytes) {
      const evicted = this.frames.shift();
      this.bytes -= evicted._ringBytes;
      disposeFrame(evicted);
      this.droppedFrames += 1;
    }
    frame._ringBytes = size;
    this.frames.push(frame);
    this.bytes += size;
    this.lastSequence = frame.sequence;
    return true;
  }

  snapshot() {
    return [...this.frames];
  }

  stats() {
    return {
      frameCount: this.frames.length,
      bytes: this.bytes,
      maxFrames: this.maxFrames,
      maxBytes: this.maxBytes,
      droppedFrames: this.droppedFrames,
      pressureRatio: Math.max(this.frames.length / this.maxFrames, this.bytes / this.maxBytes),
    };
  }

  clear() {
    for (const frame of this.frames) disposeFrame(frame);
    const cleared = this.frames.length;
    this.frames.length = 0;
    this.bytes = 0;
    this.lastSequence = -1;
    return cleared;
  }
}

module.exports = { BoundedFrameRing, disposeFrame };

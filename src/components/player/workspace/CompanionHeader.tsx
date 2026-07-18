"use client";

import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";

export function CompanionHeader({
  connection,
  muted,
  volume,
  mode,
  textScale,
  texture,
  canReplay,
  toggleMute,
  setVolume,
  cycleMotion,
  setTextScale,
  setTexture,
  replay,
}: {
  connection: "connecting" | "live" | "adrift";
  muted: boolean;
  volume: number;
  mode: MotionMode;
  textScale: number;
  texture: number;
  canReplay: boolean;
  toggleMute: () => void;
  setVolume: (value: number) => void;
  cycleMotion: () => void;
  setTextScale: (value: number) => void;
  setTexture: (value: number) => void;
  replay: () => void;
}) {
  return (
    <header className="companion-bar" data-scene-part="peripheral" data-gsap-owned>
      <div className="companion-title">
        <p className="eyebrow">The Forever Treasure</p>
        <h1>Voyage Companion</h1>
      </div>
      <div className="companion-controls">
        <motion.span layout className={`connection ${connection}`} aria-live="polite">
          <i aria-hidden="true" />
          {connection === "live" ? "Tide connected" : connection === "adrift" ? "Signal adrift" : "Finding the tide"}
        </motion.span>
        <button onClick={toggleMute} aria-pressed={muted}>
          {muted ? "Sound off" : "Sound on"}
        </button>
        <label className="volume-control">
          Volume
          <input
            aria-label="Master volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <button
          onClick={cycleMotion}
          aria-pressed={mode !== "full"}
          aria-label={`Motion: ${mode}. Change motion setting`}
        >
          {mode === "full" ? "Full motion" : mode === "gentle" ? "Gentle motion" : "Reduced motion"}
        </button>
        <button
          onClick={() =>
            document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.()
          }
        >
          Companion mode
        </button>
        <details className="preference-menu">
          <summary>Preferences</summary>
          <label>
            Text size
            <input
              aria-label="Text size"
              type="range"
              min="0.9"
              max="1.35"
              step="0.05"
              value={textScale}
              onChange={(event) => setTextScale(Number(event.target.value))}
            />
          </label>
          <label>
            Texture
            <input
              aria-label="Texture intensity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={texture}
              onChange={(event) => setTexture(Number(event.target.value))}
            />
          </label>
          <button onClick={replay} disabled={!canReplay}>
            Replay last ceremony
          </button>
        </details>
      </div>
    </header>
  );
}

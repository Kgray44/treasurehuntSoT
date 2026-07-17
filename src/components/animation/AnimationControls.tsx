"use client";

import type { MotionMode } from "@/animation/core/animation-types";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";

export function AnimationControls({ mode, setMode }: { mode: MotionMode; setMode: (mode: MotionMode) => void }) {
  const { director, snapshot } = useAnimationDirector();
  return (
    <section className="animation-controls" aria-label="Animation playback controls">
      <div className="animation-readout">
        <span>{snapshot.scene ?? "No scene"}</span>
        <strong>{snapshot.label}</strong>
        <output>{Math.round(snapshot.progress * 100)}%</output>
      </div>
      <div className="transport-controls">
        <button
          onClick={() => (snapshot.isPaused ? director.resume() : director.pause())}
          disabled={!snapshot.isPlaying}
        >
          {snapshot.isPaused ? "Resume" : "Pause"}
        </button>
        <button onClick={() => director.seek(0)} disabled={!snapshot.isPlaying}>
          Restart
        </button>
        <button onClick={() => director.skip()} disabled={!snapshot.isPlaying}>
          Skip
        </button>
        <button onClick={() => director.reverse()} disabled={!snapshot.isPlaying}>
          Reverse
        </button>
      </div>
      <label>
        Timeline{" "}
        <input
          aria-label="Timeline scrubber"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={snapshot.progress}
          onChange={(event) => director.seek(Number(event.target.value))}
        />
      </label>
      <label>
        Speed{" "}
        <select value={snapshot.speed} onChange={(event) => director.setSpeed(Number(event.target.value))}>
          {[0.25, 0.5, 1, 1.5, 2].map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Motion</legend>
        {(["full", "gentle", "reduced"] as MotionMode[]).map((item) => (
          <button key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>
            {item}
          </button>
        ))}
      </fieldset>
    </section>
  );
}

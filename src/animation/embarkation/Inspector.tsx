"use client";
import { useEffect, useState } from "react";
import type { EmbarkationControls } from "./Embarkation";
import { beats, beatAt, camera, EMBARKATION_VERSION, gust, stormEnergy, type Tier } from "./program";
export default function Inspector({ controls }: { controls: EmbarkationControls }) {
  const [snapshot, setSnapshot] = useState(() => controls.snapshot());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSnapshot(controls.snapshot()), 100);
    return () => clearInterval(id);
  }, [controls]);
  return (
    <aside
      className={`embarkation-inspector ${collapsed ? "collapsed" : ""}`}
      aria-label="Development Embarkation inspector"
    >
      <header>
        <strong>DEVELOPMENT · EMBARKATION</strong>
        <button onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Expand" : "Collapse"}</button>
      </header>
      {!collapsed && (
        <>
          <output>
            {snapshot.time.toFixed(3)} / {snapshot.duration.toFixed(1)} s · {beatAt(snapshot.filmTime)} · wind{" "}
            {gust(snapshot.filmTime).toFixed(2)} / storm {stormEnergy(snapshot.filmTime).toFixed(2)} · {snapshot.tier} ·{" "}
            {snapshot.fps.toFixed(1)} FPS
          </output>
          <input
            aria-label="Cinematic time"
            type="range"
            min="0"
            max={snapshot.duration}
            step="0.01"
            value={snapshot.time}
            onChange={(e) => controls.seek(Number(e.target.value))}
          />
          <div className="controls">
            {beats.map(([at, name]) => (
              <button key={at} onClick={() => controls.seek(at)} title={name}>
                {at}s · {name}
              </button>
            ))}
          </div>
          <div className="controls">
            <button onClick={() => controls.play()}>Play</button>
            <button onClick={() => controls.pause()}>Pause</button>
            <button onClick={() => controls.restart()}>Restart</button>
            <button onClick={() => controls.seek(Math.max(0, snapshot.time - 1 / 60))}>− frame</button>
            <button onClick={() => controls.seek(snapshot.time + 1 / 60)}>+ frame</button>
            <label>
              Speed
              <select
                aria-label="Playback speed"
                defaultValue="1"
                onChange={(e) => controls.speed(Number(e.target.value))}
              >
                <option value=".25">0.25×</option>
                <option value=".5">0.5×</option>
                <option value="1">1×</option>
              </select>
            </label>
            <label>
              Quality
              <select
                aria-label="Cinematic quality"
                value={snapshot.tier}
                onChange={(e) => controls.quality(e.target.value as Tier)}
              >
                <option>CINEMATIC</option>
                <option>BALANCED</option>
                <option>PERFORMANCE</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={snapshot.reduced} onChange={(e) => controls.reduced(e.target.checked)} />
              Reduced motion
            </label>
            <label>
              <input type="checkbox" checked={snapshot.mute} onChange={(e) => controls.mute(e.target.checked)} />
              Mute
            </label>
          </div>
          <div className="controls">
            <label>
              Layer
              <select aria-label="Isolate cinematic layer" onChange={(e) => controls.layer(e.target.value)}>
                <option value="">All</option>
                {["page", "environment", "paper", "props", "mist", "particles", "light", "spray"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" onChange={(e) => controls.debug(e.target.checked)} />
              Camera / depth planes / trajectories / landing boxes
            </label>
            <label>
              <input type="checkbox" onChange={(e) => controls.freezeLiving(e.target.checked)} />
              Freeze living materials for reference comparison
            </label>
            <label>
              <input type="checkbox" onChange={(e) => controls.projection(e.target.checked)} />
              Exterior projection grid
            </label>
            <button onClick={() => controls.fail()}>Test compositor loss</button>
          </div>
          <output>
            {EMBARKATION_VERSION} · seed {snapshot.seed} · {snapshot.active.join(", ")} · p95 {snapshot.p95.toFixed(1)}{" "}
            ms · render {snapshot.renderMs.toFixed(2)} ms
            {" · camera "}
            {camera(snapshot.filmTime)
              .position.map((n) => n.toFixed(0))
              .join(", ")}
          </output>
        </>
      )}
    </aside>
  );
}

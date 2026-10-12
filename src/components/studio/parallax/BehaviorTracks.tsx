"use client";
import { useRef, useState } from "react";
import { draftSchema } from "@/parallax/authoring";
import type { SpatialDraft } from "@/parallax/authoring";
import styles from "./SpatialStudio.module.css";

export function BehaviorTracks({
  draft,
  timeMs,
  selected,
  onSelect,
  onTime,
  onChange,
}: {
  draft: SpatialDraft;
  timeMs: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onTime: (time: number) => void;
  onChange: (draft: SpatialDraft) => void;
}) {
  const drag = useRef<{ id: string; startX: number; startMs: number; width: number } | null>(null);
  const setDelay = (id: string, value: number) => {
    const next = structuredClone(draft);
    const b = next.content.studio?.behaviors.find((b) => b.id === id);
    if (b) {
      b.delayMs = Math.max(0, Math.min(60000, Math.round(value / 100) * 100));
      onChange(next);
    }
  };
  const [duration, setDuration] = useState(60000);
  const [start, setStart] = useState(0);
  const [error, setError] = useState("");
  const moveKey = (trackId: string, frameId: string, atMs: number) => {
    try {
      const next = structuredClone(draft);
      const track = next.content.studio!.animationTracks!.find((t) => t.id === trackId)!;
      if (next.content.studio?.layers.find((l) => l.entityId === track.entityId)?.locked) return;
      track.keyframes.find((f) => f.id === frameId)!.atMs = Math.max(0, Math.min(60000, Math.round(atMs / 100) * 100));
      track.keyframes.sort((a, b) => a.atMs - b.atMs);
      onChange(draftSchema.parse(next));
      setError("");
    } catch {
      setError("Two keyframes cannot share a time. Move this keyframe to an unused time.");
    }
  };
  const position = (time: number) => `${((time - start) / duration) * 100}%`;
  const keyDrag = useRef<{ trackId: string; frameId: string; startX: number; atMs: number; width: number } | null>(
    null,
  );
  return (
    <div className={styles.tracks} aria-label="Spatial sequence tracks">
      <div className={styles.inline}>
        <label>
          Timeline zoom{" "}
          <select
            aria-label="Timeline visible duration"
            value={duration}
            onChange={(event) => {
              const next = Number(event.target.value);
              setDuration(next);
              setStart(Math.min(start, 60000 - next));
            }}
          >
            <option value="60000">60 seconds</option>
            <option value="30000">30 seconds</option>
            <option value="10000">10 seconds</option>
          </select>
        </label>
        {duration < 60000 && (
          <label>
            Window start (s)
            <input
              aria-label="Timeline window start"
              type="number"
              min="0"
              max={(60000 - duration) / 1000}
              value={start / 1000}
              onChange={(event) => setStart(Math.max(0, Math.min(60000 - duration, Number(event.target.value) * 1000)))}
            />
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.trackRuler}>
        <span>ENTITY / EVENT</span>
        <div>
          {Array.from({ length: 7 }, (_, i) => (start + (duration * i) / 6) / 1000).map((t) => (
            <button
              key={t}
              onClick={() => onTime(t * 1000)}
              style={{ left: position(t * 1000) }}
              aria-label={`Seek to ${t} seconds`}
            >
              {Number(t.toFixed(1))}s
            </button>
          ))}
        </div>
      </div>
      {draft.content.entities.map((e) => (
        <div className={styles.trackRow} key={e.id}>
          <button aria-pressed={selected === e.id} onClick={() => onSelect(e.id)}>
            {e.name}
          </button>
          <div className={styles.trackLane}>
            <span className={styles.playhead} style={{ left: position(timeMs) }} />
            {draft.content.studio?.behaviors
              .filter((b) => b.targetEntityId === e.id && b.delayMs >= start && b.delayMs <= start + duration)
              .map((b) => (
                <button
                  key={b.id}
                  className={styles.trackEvent}
                  data-action={b.action}
                  style={{ left: position(b.delayMs) }}
                  aria-label={`${e.name}: ${b.action.toLowerCase()} ${b.delayMs} milliseconds after ${b.trigger.toLowerCase()}`}
                  title={`${b.trigger} + ${(b.delayMs / 1000).toFixed(1)} s. Drag or use arrow keys to change the delay.`}
                  disabled={draft.content.studio?.layers.find((l) => l.entityId === e.id)?.locked}
                  onPointerDown={(event) => {
                    const lane = event.currentTarget.parentElement!;
                    drag.current = { id: b.id, startX: event.clientX, startMs: b.delayMs, width: lane.clientWidth };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerUp={(event) => {
                    if (drag.current?.id === b.id) {
                      setDelay(
                        b.id,
                        drag.current.startMs +
                          ((event.clientX - drag.current.startX) / Math.max(1, drag.current.width)) * duration,
                      );
                      drag.current = null;
                    }
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(event) => {
                    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                      event.preventDefault();
                      setDelay(b.id, b.delayMs + (event.key === "ArrowLeft" ? -100 : 100));
                    }
                  }}
                >
                  {b.action === "SHOW" ? "↗" : b.action === "HIDE" ? "↘" : "◇"}
                  <span>{b.action.toLowerCase()}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
      {(draft.content.studio?.animationTracks ?? []).map((track) => {
        const entity = draft.content.entities.find((e) => e.id === track.entityId)!;
        const locked = draft.content.studio?.layers.find((l) => l.entityId === track.entityId)?.locked;
        return (
          <div className={styles.trackRow} key={track.id}>
            <button aria-pressed={selected === entity.id} onClick={() => onSelect(entity.id)} title={entity.name}>
              {entity.name} · {track.property.toLowerCase()}
              {track.enabled ? "" : " (disabled)"}
            </button>
            <div className={styles.trackLane}>
              <span className={styles.playhead} style={{ left: position(timeMs) }} />
              {track.keyframes
                .filter((f) => f.atMs >= start && f.atMs <= start + duration)
                .map((frame) => (
                  <button
                    key={frame.id}
                    className={styles.trackEvent}
                    style={{ left: position(frame.atMs) }}
                    aria-label={`${entity.name}: ${track.property.toLowerCase()} keyframe at ${(frame.atMs / 1000).toFixed(1)} seconds`}
                    title="Click to preview. Drag or use arrow keys to move the keyframe."
                    disabled={locked}
                    onPointerDown={(event) => {
                      keyDrag.current = {
                        trackId: track.id,
                        frameId: frame.id,
                        startX: event.clientX,
                        atMs: frame.atMs,
                        width: event.currentTarget.parentElement!.clientWidth,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerUp={(event) => {
                      const active = keyDrag.current;
                      keyDrag.current = null;
                      if (!active) return;
                      if (Math.abs(event.clientX - active.startX) < 3) onTime(frame.atMs);
                      else
                        moveKey(
                          track.id,
                          frame.id,
                          active.atMs + ((event.clientX - active.startX) / Math.max(1, active.width)) * duration,
                        );
                    }}
                    onPointerCancel={() => {
                      keyDrag.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                        event.preventDefault();
                        moveKey(track.id, frame.id, frame.atMs + (event.key === "ArrowLeft" ? -100 : 100));
                      } else if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onTime(frame.atMs);
                      }
                    }}
                  >
                    ◆
                  </button>
                ))}
            </div>
          </div>
        );
      })}
      {!draft.content.studio?.behaviors.length && !draft.content.studio?.animationTracks?.length && (
        <small>No tracks yet. Record an object keyframe or add a triggered spatial behavior.</small>
      )}
    </div>
  );
}

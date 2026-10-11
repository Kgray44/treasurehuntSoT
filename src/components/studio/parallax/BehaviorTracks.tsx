"use client";
import { useRef } from "react";
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
  return (
    <div className={styles.tracks} aria-label="Spatial sequence tracks">
      <div className={styles.trackRuler}>
        <span>ENTITY / EVENT</span>
        <div>
          {[0, 10, 20, 30, 40, 50, 60].map((t) => (
            <button
              key={t}
              onClick={() => onTime(t * 1000)}
              style={{ left: `${(t / 60) * 100}%` }}
              aria-label={`Seek to ${t} seconds`}
            >
              {t}s
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
            <span className={styles.playhead} style={{ left: `${(timeMs / 60000) * 100}%` }} />
            {draft.content.studio?.behaviors
              .filter((b) => b.targetEntityId === e.id)
              .map((b) => (
                <button
                  key={b.id}
                  className={styles.trackEvent}
                  data-action={b.action}
                  style={{ left: `${Math.min(94, (b.delayMs / 60000) * 100)}%` }}
                  aria-label={`${e.name}: ${b.action.toLowerCase()} ${b.delayMs} milliseconds after ${b.trigger.toLowerCase()}`}
                  title={`${b.trigger} + ${(b.delayMs / 1000).toFixed(1)} s. Drag or use arrow keys to change the delay.`}
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
                          ((event.clientX - drag.current.startX) / Math.max(1, drag.current.width)) * 60000,
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
      {!draft.content.studio?.behaviors.length && (
        <small>No events yet. Add a spatial behavior to author timed state changes.</small>
      )}
    </div>
  );
}

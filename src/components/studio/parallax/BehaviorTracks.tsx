"use client";
import { useRef, useState } from "react";
import { draftSchema } from "@/parallax/authoring";
import type { SpatialDraft } from "@/parallax/authoring";
import styles from "./SpatialStudio.module.css";
import { retimeAnimationTrack } from "@/parallax/animation-authoring";
import { useStudioContextMenu, type StudioMenuAction } from "./StudioContextMenu";

export function BehaviorTracks({
  draft,
  timeMs,
  selected,
  onSelect,
  onTime,
  onChange,
  onEditTrack,
  onEditEvent,
}: {
  draft: SpatialDraft;
  timeMs: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onTime: (time: number) => void;
  onChange: (draft: SpatialDraft) => void;
  onEditTrack: (entityId: string, trackId: string, frameId?: string) => void;
  onEditEvent: (entityId: string, eventId: string) => void;
}) {
  const menu = useStudioContextMenu();
  const [live, setLive] = useState<{ id: string; atMs?: number; startMs?: number; endMs?: number } | null>(null);
  const clipDrag = useRef<{
    id: string;
    kind: "MOVE" | "START" | "END";
    x: number;
    width: number;
    startMs: number;
    endMs: number;
  } | null>(null);
  const mutate = (change: (next: SpatialDraft) => void) => {
    try {
      const next = structuredClone(draft);
      change(next);
      onChange(draftSchema.parse(next));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This timeline edit could not be saved.");
    }
  };
  const drag = useRef<{ id: string; startX: number; startMs: number; width: number } | null>(null);
  const setDelay = (id: string, value: number) => {
    const next = structuredClone(draft);
    const b = next.content.studio?.behaviors.find((b) => b.id === id);
    if (b) {
      b.delayMs = Math.max(0, Math.min(60000, Math.round(value / 100) * 100));
      onChange(next);
    }
  };
  const [duration, setDuration] = useState(10000);
  const [start, setStart] = useState(0);
  const [error, setError] = useState("");
  const ruler = useRef<HTMLDivElement>(null);
  const scrub = useRef<{ pointerId: number; left: number; width: number; start: number; duration: number } | null>(
    null,
  );
  const seekPointer = (x: number) => {
    const active = scrub.current;
    if (!active) return;
    onTime(Math.round(active.start + Math.max(0, Math.min(1, (x - active.left) / active.width)) * active.duration));
  };
  const timeInWindow = timeMs >= start && timeMs <= start + duration;
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
  const clipRange = (x: number) => {
    const active = clipDrag.current!;
    const delta = Math.round((((x - active.x) / Math.max(1, active.width)) * duration) / 100) * 100;
    if (active.kind === "START")
      return {
        id: active.id,
        startMs: Math.max(0, Math.min(active.endMs - 100, active.startMs + delta)),
        endMs: active.endMs,
      };
    if (active.kind === "END")
      return {
        id: active.id,
        startMs: active.startMs,
        endMs: Math.min(60000, Math.max(active.startMs + 100, active.endMs + delta)),
      };
    const shift = Math.max(-active.startMs, Math.min(60000 - active.endMs, delta));
    return { id: active.id, startMs: active.startMs + shift, endMs: active.endMs + shift };
  };
  const eventActions = (id: string, entityId: string, delayMs: number): StudioMenuAction[] => [
    { label: "Preview event time", icon: "frame", run: () => onTime(delayMs) },
    {
      label: "Remove event",
      icon: "trash",
      danger: true,
      disabled: Boolean(draft.content.studio?.layers.find((layer) => layer.entityId === entityId)?.locked),
      run: () =>
        mutate((next) => {
          next.content.studio!.behaviors = next.content.studio!.behaviors.filter((behavior) => behavior.id !== id);
        }),
    },
  ];
  const keyActions = (trackId: string, frameId: string, atMs: number, locked: boolean): StudioMenuAction[] => [
    { label: "Preview keyframe", icon: "frame", run: () => onTime(atMs) },
    {
      label: "Remove keyframe",
      icon: "trash",
      danger: true,
      disabled: locked,
      run: () =>
        mutate((next) => {
          const target = next.content.studio!.animationTracks!.find((item) => item.id === trackId)!;
          target.keyframes = target.keyframes.filter((item) => item.id !== frameId) as typeof target.keyframes;
          if (!target.keyframes.length)
            next.content.studio!.animationTracks = next.content.studio!.animationTracks!.filter(
              (item) => item.id !== trackId,
            );
        }),
    },
  ];
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
      <div className={styles.timelineScrubHint}>
        <span role="timer" aria-live="off" aria-label="Current scene time">
          {(timeMs / 1000).toFixed(2)} s
        </span>
        <small>Drag the blue playhead or ruler to preview a moment.</small>
        {!timeInWindow && (
          <button onClick={() => setStart(Math.max(0, Math.min(60000 - duration, timeMs - duration / 2)))}>
            Show current time
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.timelineTrackGrid}>
        {timeInWindow && (
          <div className={styles.timelineScannerLane} aria-hidden="true">
            <span className={styles.playhead} style={{ left: position(timeMs) }} />
          </div>
        )}
        <div className={styles.trackRuler}>
          <span>ENTITY / EVENT</span>
          <div
            ref={ruler}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (bounds.width <= 0) return;
              scrub.current = { pointerId: event.pointerId, left: bounds.left, width: bounds.width, start, duration };
              event.currentTarget.setPointerCapture(event.pointerId);
              seekPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (scrub.current?.pointerId === event.pointerId) seekPointer(event.clientX);
            }}
            onPointerUp={(event) => {
              if (scrub.current?.pointerId !== event.pointerId) return;
              seekPointer(event.clientX);
              scrub.current = null;
            }}
            onPointerCancel={() => {
              scrub.current = null;
            }}
            onLostPointerCapture={() => {
              scrub.current = null;
            }}
          >
            {Array.from({ length: 7 }, (_, i) => (start + (duration * i) / 6) / 1000).map((t) => (
              <button
                key={t}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onTime(t * 1000)}
                style={{ left: position(t * 1000) }}
                aria-label={`Seek to ${t} seconds`}
              >
                {Number(t.toFixed(1))}s
              </button>
            ))}
            {timeInWindow && (
              <button
                className={styles.timelineScannerHandle}
                role="slider"
                aria-label="Scene timeline playhead"
                aria-valuemin={0}
                aria-valuemax={60000}
                aria-valuenow={Math.round(timeMs)}
                aria-valuetext={`${(timeMs / 1000).toFixed(2)} seconds`}
                aria-orientation="horizontal"
                title="Drag to scrub the scene. Arrow keys move 0.1 s; Shift moves 1 s. Home/End seek to the visible window edges."
                style={{ left: position(timeMs) }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 1000 : 100;
                  const value =
                    event.key === "Home"
                      ? start
                      : event.key === "End"
                        ? start + duration
                        : event.key === "ArrowLeft"
                          ? timeMs - step
                          : event.key === "ArrowRight"
                            ? timeMs + step
                            : null;
                  if (value === null) return;
                  event.preventDefault();
                  onTime(Math.max(start, Math.min(start + duration, value)));
                }}
              >
              <span aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {draft.content.entities.map((e) => (
          <div className={styles.trackRow} key={e.id}>
            <button aria-pressed={selected === e.id} onClick={() => onSelect(e.id)}>
              {e.name}
            </button>
            <div className={styles.trackLane}>
              {draft.content.studio?.behaviors
                .filter((b) => b.targetEntityId === e.id && b.delayMs >= start && b.delayMs <= start + duration)
                .map((b) => (
                  <button
                    key={b.id}
                    className={styles.trackEvent}
                    data-action={b.action}
                    style={{ left: position(live?.id === b.id ? live.atMs! : b.delayMs) }}
                    aria-label={`${e.name}: ${b.action.toLowerCase()} ${b.delayMs} milliseconds after ${b.trigger.toLowerCase()}`}
                    onClick={() => {
                      onEditEvent(e.id, b.id);
                      onTime(b.delayMs);
                    }}
                    title={`${b.trigger} + ${(b.delayMs / 1000).toFixed(1)} s. Drag or use arrow keys to change the delay.`}
                    disabled={draft.content.studio?.layers.find((l) => l.entityId === e.id)?.locked}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      const lane = event.currentTarget.parentElement!;
                      drag.current = { id: b.id, startX: event.clientX, startMs: b.delayMs, width: lane.clientWidth };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const active = drag.current;
                      if (active?.id === b.id)
                        setLive({
                          id: b.id,
                          atMs: Math.max(
                            0,
                            Math.min(
                              60000,
                              Math.round(
                                (active.startMs +
                                  ((event.clientX - active.startX) / Math.max(1, active.width)) * duration) /
                                  100,
                              ) * 100,
                            ),
                          ),
                        });
                    }}
                    onPointerUp={(event) => {
                      if (drag.current?.id === b.id) {
                        setDelay(
                          b.id,
                          drag.current.startMs +
                            ((event.clientX - drag.current.startX) / Math.max(1, drag.current.width)) * duration,
                        );
                        drag.current = null;
                        setLive(null);
                      }
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      setLive(null);
                    }}
                    onContextMenu={(event) =>
                      menu.open(event, `${e.name} ${b.action.toLowerCase()} event`, eventActions(b.id, e.id, b.delayMs))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                        menu.open(event, `${e.name} event`, eventActions(b.id, e.id, b.delayMs));
                      else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
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
          const originalStart = track.keyframes[0].atMs,
            originalEnd = track.keyframes.at(-1)!.atMs;
          const first = live?.id === track.id ? live.startMs! : originalStart;
          const last = live?.id === track.id ? live.endMs! : originalEnd;
          const trackMenu = [
            { label: "Edit animation", icon: "frame" as const, run: () => onEditTrack(entity.id, track.id) },
            { label: "Preview animation start", icon: "frame" as const, run: () => onTime(originalStart) },
            {
              label: track.enabled ? "Disable animation" : "Enable animation",
              icon: "eye" as const,
              disabled: Boolean(locked),
              run: () =>
                mutate((next) => {
                  next.content.studio!.animationTracks!.find((item) => item.id === track.id)!.enabled = !track.enabled;
                }),
            },
            ...(track.property === "VISIBILITY"
              ? []
              : (["LINEAR", "EASE_IN_OUT", "CINEMATIC", "STEP"] as const).map((interpolation) => ({
                  label:
                    interpolation === "LINEAR"
                      ? "Animate linearly"
                      : interpolation === "EASE_IN_OUT"
                        ? "Animate with easing"
                        : interpolation === "CINEMATIC"
                          ? "Animate cinematically"
                          : "Instant steps",
                  icon: "move" as const,
                  disabled: Boolean(locked),
                  run: () =>
                    mutate((next) => {
                      next.content.studio!.animationTracks!.find((item) => item.id === track.id)!.interpolation =
                        interpolation;
                    }),
                }))),
            {
              label: "Remove animation",
              icon: "trash" as const,
              danger: true,
              disabled: Boolean(locked),
              run: () =>
                mutate((next) => {
                  next.content.studio!.animationTracks = next.content.studio!.animationTracks!.filter(
                    (item) => item.id !== track.id,
                  );
                }),
            },
          ];
          const startClip = (event: React.PointerEvent<HTMLButtonElement>, kind: "MOVE" | "START" | "END") => {
            if (event.button !== 0 || locked) return;
            const lane = event.currentTarget.closest(`.${styles.trackLane}`)!;
            clipDrag.current = {
              id: track.id,
              kind,
              x: event.clientX,
              width: lane.clientWidth,
              startMs: originalStart,
              endMs: originalEnd,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          };
          const finishClip = (event: React.PointerEvent<HTMLButtonElement>) => {
            if (clipDrag.current?.id !== track.id) return;
            const range = clipRange(event.clientX);
            clipDrag.current = null;
            setLive(null);
            onEditTrack(entity.id, track.id);
            if (range.startMs === originalStart && range.endMs === originalEnd) return;
            try {
              onChange(retimeAnimationTrack(draft, track.id, range.startMs, range.endMs));
              setError("");
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Could not resize animation.");
            }
          };
          return (
            <div className={styles.trackRow} key={track.id}>
              <button
                aria-pressed={selected === entity.id}
                onClick={() => onEditTrack(entity.id, track.id)}
                title={entity.name}
                onContextMenu={(event) => menu.open(event, `${entity.name} animation`, trackMenu)}
                onKeyDown={(event) => {
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                    menu.open(event, `${entity.name} animation`, trackMenu);
                }}
              >
                {entity.name} · {track.property.toLowerCase()}
                {track.enabled ? "" : " (disabled)"}
              </button>
              <div className={styles.trackLane}>
                {originalEnd > originalStart && last >= start && first <= start + duration && (
                  <div
                    className={styles.animationClip}
                    style={{ left: position(first), width: `${((last - first) / duration) * 100}%` }}
                  >
                    <button
                      aria-label={`Move ${entity.name} ${track.property.toLowerCase()} animation`}
                      disabled={locked}
                      onClick={() => onEditTrack(entity.id, track.id)}
                      onContextMenu={(event) => menu.open(event, `${entity.name} animation`, trackMenu)}
                      onPointerDown={(event) => startClip(event, "MOVE")}
                      onPointerMove={(event) => {
                        if (clipDrag.current?.id === track.id) setLive(clipRange(event.clientX));
                      }}
                      onPointerUp={finishClip}
                      onPointerCancel={() => {
                        clipDrag.current = null;
                        setLive(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                          menu.open(event, `${entity.name} animation`, trackMenu);
                        else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                          event.preventDefault();
                          const shift = event.key === "ArrowLeft" ? -100 : 100;
                          try {
                            onChange(retimeAnimationTrack(draft, track.id, originalStart + shift, originalEnd + shift));
                          } catch {
                            setError("Keep the animation within zero to sixty seconds.");
                          }
                        }
                      }}
                    >
                      {((last - first) / 1000).toFixed(1)}s
                    </button>
                    {(["START", "END"] as const).map((edge) => (
                      <button
                        key={edge}
                        className={edge === "START" ? styles.clipStart : styles.clipEnd}
                        aria-label={`Resize ${entity.name} ${track.property.toLowerCase()} animation ${edge.toLowerCase()}`}
                        disabled={locked}
                        onPointerDown={(event) => startClip(event, edge)}
                        onPointerMove={(event) => {
                          if (clipDrag.current?.id === track.id) setLive(clipRange(event.clientX));
                        }}
                        onPointerUp={finishClip}
                        onPointerCancel={() => {
                          clipDrag.current = null;
                          setLive(null);
                        }}
                        onKeyDown={(event) => {
                          if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                            event.preventDefault();
                            const shift = event.key === "ArrowLeft" ? -100 : 100;
                            try {
                              onChange(
                                retimeAnimationTrack(
                                  draft,
                                  track.id,
                                  originalStart + (edge === "START" ? shift : 0),
                                  originalEnd + (edge === "END" ? shift : 0),
                                ),
                              );
                            } catch {
                              setError("Keep distinct keyframe times within zero to sixty seconds.");
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                {track.keyframes
                  .filter((f) => f.atMs >= start && f.atMs <= start + duration)
                  .map((frame) => (
                    <button
                      key={frame.id}
                      className={styles.trackEvent}
                      style={{
                        left: position(
                          live?.id === frame.id
                            ? live.atMs!
                            : live?.id === track.id && originalEnd > originalStart
                              ? first + ((frame.atMs - originalStart) / (originalEnd - originalStart)) * (last - first)
                              : frame.atMs,
                        ),
                      }}
                      aria-label={`${entity.name}: ${track.property.toLowerCase()} keyframe at ${(frame.atMs / 1000).toFixed(1)} seconds`}
                      title="Click to edit this pose. Drag or use arrow keys to move its time. Resize the bar below to change animation duration."
                      onClick={() => {
                        onEditTrack(entity.id, track.id, frame.id);
                        onTime(frame.atMs);
                      }}
                      disabled={locked}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        keyDrag.current = {
                          trackId: track.id,
                          frameId: frame.id,
                          startX: event.clientX,
                          atMs: frame.atMs,
                          width: event.currentTarget.parentElement!.clientWidth,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        const active = keyDrag.current;
                        if (active?.frameId === frame.id)
                          setLive({
                            id: frame.id,
                            atMs: Math.max(
                              0,
                              Math.min(
                                60000,
                                Math.round(
                                  (active.atMs +
                                    ((event.clientX - active.startX) / Math.max(1, active.width)) * duration) /
                                    100,
                                ) * 100,
                              ),
                            ),
                          });
                      }}
                      onPointerUp={(event) => {
                        const active = keyDrag.current;
                        keyDrag.current = null;
                        setLive(null);
                        if (!active) return;
                        onEditTrack(entity.id, track.id, frame.id);
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
                        setLive(null);
                      }}
                      onContextMenu={(event) =>
                        menu.open(
                          event,
                          `${entity.name} keyframe`,
                          keyActions(track.id, frame.id, frame.atMs, Boolean(locked)),
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                          menu.open(
                            event,
                            `${entity.name} keyframe`,
                            keyActions(track.id, frame.id, frame.atMs, Boolean(locked)),
                          );
                        else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
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
      </div>
      {!draft.content.studio?.behaviors.length && !draft.content.studio?.animationTracks?.length && (
        <small>No tracks yet. Record an object keyframe or add a triggered spatial behavior.</small>
      )}
      <small>
        Drag an animation clip to move it; drag either edge to change its duration. Diamonds are keyframes; show/hide
        markers are instant actions.
      </small>
      {menu.menu}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./InspectorControls.module.css";

function bounded(value: number, min?: number, max?: number) {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

export function InspectorNumber({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.01,
  unit,
  compact = false,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  compact?: boolean;
}) {
  const [display, setDisplay] = useState({ source: value, text: String(value) });
  if (display.source !== value) setDisplay({ source: value, text: String(value) });
  const text = display.text;
  const setText = (next: string) => setDisplay({ source: value, text: next });
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setText(String(value));
      return;
    }
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }
    const next = bounded(parsed, min, max);
    setText(String(next));
    if (next !== value) onCommit(next);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      event.stopPropagation();
      cancelled.current = true;
      setText(String(value));
      event.currentTarget.blur();
    }
  };
  return (
    <label className={compact ? styles.compactNumber : undefined}>
      <span className={compact ? styles.visuallyHidden : undefined}>{label}</span>
      <span className={styles.numberWrap}>
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={keyDown}
        />
        {unit && <small>{unit}</small>}
      </span>
    </label>
  );
}

export function InspectorRange({
  label,
  value,
  onPreview,
  onCommit,
  onEnd,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onPreview?: (value: number) => void;
  onCommit: (value: number) => void;
  onEnd?: () => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  const [preview, setPreview] = useState(value);
  const previewRef = useRef(value);
  const dragging = useRef(false);
  const committedRef = useRef(value);
  useEffect(() => {
    if (!dragging.current) {
      previewRef.current = value;
      committedRef.current = value;
      setPreview(value);
    }
  }, [value]);
  const setPreviewValue = (next: number) => {
    previewRef.current = next;
    setPreview(next);
    onPreview?.(next);
  };
  const commit = () => {
    dragging.current = false;
    if (previewRef.current !== committedRef.current) {
      committedRef.current = previewRef.current;
      onCommit(previewRef.current);
    }
    onEnd?.();
  };
  return (
    <div className={styles.rangeControl}>
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={preview}
          onPointerDown={() => {
            dragging.current = true;
          }}
          onChange={(event) => setPreviewValue(Number(event.target.value))}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(
                event.key,
              )
            )
              commit();
          }}
          onBlur={commit}
        />
        <InspectorNumber
          label={`${label} numeric value`}
          value={preview}
          onCommit={(next) => {
            setPreviewValue(next);
            onCommit(next);
          }}
          min={min}
          max={max}
          step={step}
          unit={unit}
          compact
        />
      </div>
    </div>
  );
}

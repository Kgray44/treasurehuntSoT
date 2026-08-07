"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { computeProfileCropWindow } from "@/wayfarer/profile-crop";

export type CropValue = { centerX: number; centerY: number; scale: number; rotation: 0 };

type Props = {
  kind: "AVATAR" | "BANNER";
  previewUrl: string;
  value: CropValue;
  hasExisting: boolean;
  busy: boolean;
  onChange: (value: CropValue) => void;
  onSave: () => void;
  onReplace: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function CroppedProfileImage({
  kind,
  previewUrl,
  crop,
  alt,
}: {
  kind: "AVATAR" | "BANNER";
  previewUrl: string;
  crop: CropValue;
  alt: string;
}) {
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
  const cropWindow = sourceSize
    ? computeProfileCropWindow(sourceSize.width, sourceSize.height, kind === "AVATAR" ? 1 : 2.5, crop)
    : null;
  return (
    <Image
      className="profile-crop-image"
      src={previewUrl}
      alt={alt}
      width={sourceSize?.width ?? 1}
      height={sourceSize?.height ?? 1}
      unoptimized
      draggable={false}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (image.naturalWidth > 0 && image.naturalHeight > 0)
          setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
      }}
      style={
        cropWindow && sourceSize
          ? {
              left: `${(-cropWindow.left / cropWindow.width) * 100}%`,
              top: `${(-cropWindow.top / cropWindow.height) * 100}%`,
              width: `${(sourceSize.width / cropWindow.width) * 100}%`,
              height: `${(sourceSize.height / cropWindow.height) * 100}%`,
              opacity: 1,
            }
          : { inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0 }
      }
    />
  );
}

export function ProfileCropEditor({
  kind,
  previewUrl,
  value,
  hasExisting,
  busy,
  onChange,
  onSave,
  onReplace,
  onCancel,
  onRemove,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDistance = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const label = kind === "AVATAR" ? "avatar" : "banner";
  const titleId = useId();
  const instructionsId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => frameRef.current?.focus());
    return () => {
      document.body.style.overflow = priorOverflow;
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, []);

  const dialogKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), [tabindex='0']",
      ) ?? []),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateCenter = (dx: number, dy: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    onChange({
      ...value,
      centerX: clamp(value.centerX - dx / (frame.clientWidth * value.scale), 0, 1),
      centerY: clamp(value.centerY - dy / (frame.clientHeight * value.scale), 0, 1),
    });
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = [...pointers.current.values()];
    if (active.length >= 2) {
      const distance = Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y);
      if (lastPinchDistance.current)
        onChange({ ...value, scale: clamp(value.scale * (distance / lastPinchDistance.current), 1, 4) });
      lastPinchDistance.current = distance;
      return;
    }
    updateCenter(event.clientX - previous.x, event.clientY - previous.y);
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) lastPinchDistance.current = null;
    if (!pointers.current.size) setDragging(false);
  };

  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    onChange({ ...value, scale: clamp(value.scale + (event.deltaY > 0 ? -0.12 : 0.12), 1, 4) });
  };

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.015;
    const next = { ...value };
    if (event.key === "ArrowLeft") next.centerX = clamp(value.centerX - step, 0, 1);
    else if (event.key === "ArrowRight") next.centerX = clamp(value.centerX + step, 0, 1);
    else if (event.key === "ArrowUp") next.centerY = clamp(value.centerY - step, 0, 1);
    else if (event.key === "ArrowDown") next.centerY = clamp(value.centerY + step, 0, 1);
    else if (["+", "="].includes(event.key)) next.scale = clamp(value.scale + 0.1, 1, 4);
    else if (event.key === "-") next.scale = clamp(value.scale - 0.1, 1, 4);
    else return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div className="profile-crop-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="profile-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={instructionsId}
        onKeyDown={dialogKeyboard}
      >
        <header>
          <p className="personal-harbor__eyebrow">Profile imagery</p>
          <h2 id={titleId}>Position your {label}</h2>
          <p id={instructionsId}>
            Drag or use arrow keys to position. Use the slider, wheel, pinch, or plus/minus keys to zoom. The framed
            region is the saved result.
          </p>
        </header>
        <div
          ref={frameRef}
          className={`profile-crop-frame profile-crop-frame--${label}${dragging ? " is-dragging" : ""}`}
          tabIndex={0}
          aria-label={`${label} crop position`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={wheel}
          onKeyDown={keyboard}
        >
          <CroppedProfileImage kind={kind} previewUrl={previewUrl} crop={value} alt="Selected image preview" />
          <span className="profile-crop-mask" aria-hidden="true" />
          {kind === "BANNER" ? (
            <span className="profile-crop-safe-areas" aria-hidden="true">
              <span>Mobile safe area</span>
              <i>Avatar overlap</i>
            </span>
          ) : null}
        </div>
        <label className="profile-crop-zoom">
          <span>Zoom {value.scale.toFixed(2)}×</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={value.scale}
            onChange={(event) => onChange({ ...value, scale: Number(event.target.value) })}
          />
        </label>
        <p className="harbor-field-hint">
          {kind === "AVATAR"
            ? "Use a source at least 768 × 768 pixels. The stored result remains square; Voyagewright presents it through a circular mask."
            : "Use a source at least 1600 × 640 pixels. Keep important details inside the mobile safe area and away from the avatar overlap."}
        </p>
        <div className="profile-crop-actions">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => onChange({ centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 })}
          >
            Reset
          </button>
          <button type="button" className="button button--quiet" onClick={onReplace}>
            Choose different image
          </button>
          {hasExisting ? (
            <button type="button" className="button button--quiet" onClick={onRemove}>
              Remove existing {label}
            </button>
          ) : null}
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button button--primary" disabled={busy} onClick={onSave}>
            {busy ? "Working…" : "Use this crop"}
          </button>
        </div>
      </section>
    </div>
  );
}

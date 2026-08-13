"use client";

export function StudioCanvasViewControls({
  zoom,
  onZoomChange,
  onFit,
  onPan,
}: {
  zoom: number;
  onZoomChange: (next: number) => void;
  onFit: () => void;
  onPan: (direction: "up" | "down") => void;
}) {
  const percent = Math.round(zoom * 100);
  return (
    <div className="studio-canvas-view-controls" aria-label="Canvas view controls">
      <button type="button" onClick={() => onPan("up")} aria-label="Pan canvas up">
        Pan up
      </button>
      <button type="button" onClick={() => onPan("down")} aria-label="Pan canvas down">
        Pan down
      </button>
      <button type="button" onClick={() => onZoomChange(Math.max(0.8, Number((zoom - 0.1).toFixed(1))))}>
        Zoom out
      </button>
      <output role="status" aria-live="polite" aria-label={`Canvas zoom ${percent} percent`}>
        {percent}%
      </output>
      <button type="button" onClick={() => onZoomChange(Math.min(1.2, Number((zoom + 0.1).toFixed(1))))}>
        Zoom in
      </button>
      <button type="button" onClick={onFit}>
        Fit canvas
      </button>
    </div>
  );
}

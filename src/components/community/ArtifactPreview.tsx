"use client";

import { useState } from "react";

export function ArtifactPreview({
  title,
  description,
  posterUrl,
  kind,
  reducedMotion = false,
}: {
  title: string;
  description: string;
  posterUrl: string;
  kind: "2D" | "3D";
  reducedMotion?: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const interactive = kind === "3D" && !reducedMotion;
  return (
    <figure aria-labelledby="community-artifact-title" aria-describedby="community-artifact-description">
      <h2 id="community-artifact-title">{title}</h2>
      <img
        src={posterUrl}
        alt={description}
        style={
          interactive
            ? { transform: `rotate(${rotation}deg) scale(${zoom / 100})`, transformOrigin: "center", maxWidth: "100%" }
            : { maxWidth: "100%" }
        }
      />
      <figcaption id="community-artifact-description">{description}</figcaption>
      {kind === "3D" ? (
        <p role="status">
          {reducedMotion
            ? "Reduced motion is on. A static poster is shown."
            : `3D preview rotation ${rotation} degrees; zoom ${zoom} percent.`}
        </p>
      ) : null}
      {interactive ? (
        <div aria-label="3D preview controls">
          <button type="button" onClick={() => setRotation((value) => value - 15)}>
            Rotate left
          </button>
          <button type="button" onClick={() => setRotation((value) => value + 15)}>
            Rotate right
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.min(200, value + 10))}>
            Zoom in
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))}>
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => {
              setRotation(0);
              setZoom(100);
            }}
          >
            Reset preview
          </button>
        </div>
      ) : null}
    </figure>
  );
}

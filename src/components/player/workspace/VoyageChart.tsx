"use client";

/* eslint-disable @next/next/no-img-element -- The chart SVG is a layered animation surface. */

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import type { PublicSnapshot } from "@/domain/story";
import { LottieEffect } from "@/components/animation/LottieEffect";

export function VoyageChart({ snapshot, mode }: { snapshot: PublicSnapshot; mode: MotionMode }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const locations = useMemo(
    () => new Map(snapshot.mapLocations.map((location) => [location.key, location])),
    [snapshot.mapLocations],
  );
  return (
    <section
      className="physical-section voyage-chart-section"
      aria-labelledby="chart-heading"
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Released bearings only</p>
          <h2 id="chart-heading">Voyage Chart</h2>
        </div>
        <p>Pan, zoom, and inspect the chart without crossing into hidden waters.</p>
      </header>
      <div className="chart-instrument-bar" aria-label="Map controls">
        <button onClick={() => setScale((value) => Math.min(1.8, value + 0.2))}>Zoom in</button>
        <button onClick={() => setScale((value) => Math.max(0.8, value - 0.2))}>Zoom out</button>
        <button
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset chart
        </button>
        <span>Zoom {Math.round(scale * 100)}%</span>
      </div>
      <div
        className="chart-viewport"
        tabIndex={0}
        aria-label="Interactive voyage chart. Use arrow keys to pan."
        onKeyDown={(event) => {
          const amount = 28;
          if (event.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + amount }));
          if (event.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - amount }));
          if (event.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + amount }));
          if (event.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - amount }));
        }}
      >
        <motion.div
          className="illustrated-chart"
          animate={{ scale, x: pan.x, y: pan.y }}
          transition={mode === "reduced" ? { duration: 0.01 } : { type: "spring", stiffness: 180, damping: 26 }}
          data-animation-owner="motion"
        >
          <img src="/illustrations/chart/voyage-chart.svg" alt="" aria-hidden="true" />
          <svg viewBox="0 0 1200 780" className="route-overlay" aria-hidden="true">
            {snapshot.mapRoutes.map((route) => {
              const from = locations.get(route.fromKey);
              const to = locations.get(route.toKey);
              if (from?.x === undefined || from.y === undefined || to?.x === undefined || to.y === undefined)
                return null;
              return (
                <path
                  key={route.key}
                  data-scene-part="route-path"
                  data-gsap-owned
                  d={`M${from.x * 12} ${from.y * 7.8} C${from.x * 8 + to.x * 4} ${from.y * 7.8 - 70} ${from.x * 4 + to.x * 8} ${to.y * 7.8 + 50} ${to.x * 12} ${to.y * 7.8}`}
                />
              );
            })}
            <path data-route-motion-path d="M180 500C390 280 660 250 960 390" fill="none" />
          </svg>
          <div className="ship-token" data-scene-part="ship-token" data-gsap-owned aria-hidden="true">
            ▲
          </div>
          {snapshot.mapLocations
            .filter((location) => location.x !== undefined && location.y !== undefined)
            .map((location, index) => (
              <motion.button
                layout
                key={location.key}
                className="illustrated-marker"
                data-scene-part={index === snapshot.mapLocations.length - 1 ? "map-marker-new" : "map-marker"}
                data-gsap-owned
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                aria-label={`${location.name}, ${location.state.replaceAll("_", " ")}`}
              >
                <span aria-hidden="true">✦</span>
                <b>{location.name}</b>
                <small>{location.regionLabel}</small>
              </motion.button>
            ))}
          <div className="map-fog-mask" data-scene-part="map-fog" data-gsap-owned aria-hidden="true" />
          <LottieEffect
            asset={lottieAssets.rollingFog}
            mode={mode}
            label="Fog of war moving over unrevealed chart regions"
            className="chart-lottie-fog"
          />
        </motion.div>
      </div>
      <ol className="map-alternative" aria-label="Voyage locations">
        {snapshot.mapLocations.map((location) => (
          <li key={location.key}>
            <span aria-hidden="true">⌖</span>
            <div>
              <strong>{location.name}</strong>
              <small>
                {location.state.replaceAll("_", " ")}
                {location.regionLabel ? ` · ${location.regionLabel}` : ""}
              </small>
              {location.description && <p>{location.description}</p>}
            </div>
          </li>
        ))}
      </ol>
      {snapshot.mapRoutes.length > 0 && (
        <ol className="route-list" aria-label="Revealed route segments">
          {snapshot.mapRoutes.map((route) => (
            <li key={route.key}>
              <span aria-hidden="true">→</span>
              <b>
                {locations.get(route.fromKey)?.name ?? "Known mark"} to{" "}
                {locations.get(route.toKey)?.name ?? "Known mark"}
              </b>
              {route.annotation && <small>{route.annotation}</small>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

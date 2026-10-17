"use client";
import { useState } from "react";
import Image from "next/image";
import { presetNames } from "@/parallax/authoring";
import { spatialCatalog } from "@/parallax/element-authoring";
import styles from "./SpatialStudio.module.css";

export function AssetPreview({ name }: { name: string }) {
  const compass = name.includes("Compass"),
    trail = name.includes("Trail"),
    wall = name.includes("Wall");
  return (
    <svg viewBox="0 0 180 105" aria-hidden="true" className={styles.assetArt}>
      <path d="M12 87 90 105 170 86 90 68Z" fill="#162232" />
      {compass ? (
        <g transform="translate(90 47) rotate(-20)">
          <ellipse rx="34" ry="28" fill="#243e4e" stroke="#a6baa9" strokeWidth="4" />
          <path d="m0-24 8 22-8 22-8-22Z" fill="#8be4d4" />
          <path d="M-24 0H24M0-24V24" stroke="#7eabb2" />
        </g>
      ) : trail ? (
        <g fill="#78d4c3">
          {Array.from({ length: 4 }, (_, i) => (
            <g key={i} transform={`translate(${50 + i * 22} ${68 - i * 9}) rotate(-28)`}>
              <ellipse rx="6" ry="12" />
              <circle cy="-16" r="4" />
            </g>
          ))}
        </g>
      ) : (
        <g transform={wall ? "translate(56 13)" : "translate(30 25) rotate(-12 60 30)"}>
          <path
            d={wall ? "M0 0H70V66H0Z" : "M0 0 114 6 120 62 8 59Z"}
            fill={wall ? "#273b4c" : "#d7cbae"}
            stroke="#768a9b"
          />
          <path
            d={name.includes("Map") ? "m12 25 22-12 9 13 25-5 20 23-21 9-27-11-22 6Z" : "M15 16H55M15 27H55M15 38H50"}
            fill="none"
            stroke={wall ? "#99ded6" : "#788274"}
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  );
}
export function SpatialAssetBrowser({
  busy,
  onAdd,
  onNew,
}: {
  busy: boolean;
  onAdd: (name: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All");
  const categoryOf = (name: string) =>
    name.includes("Trail") ? "Trails" : name.includes("Wall") ? "Writing" : "Objects";
  const names = presetNames.filter(
    (n) =>
      n.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || category === "Classic presets" || categoryOf(n) === category),
  );
  const [type, setType] = useState("ALL");
  const catalog = spatialCatalog.filter(
    (a) =>
      `${a.name} ${a.description} ${a.family} ${a.type}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || a.family === category) &&
      (type === "ALL" || a.type === type),
  );
  return (
    <section className={styles.assetBrowser} aria-label="Spatial asset browser">
      <div className={styles.panelTitle}>
        <h3>Asset browser</h3>
        <button onClick={onNew} disabled={busy} title="Save the current draft and open a new spatial moment">
          New scene
        </button>
      </div>
      <input
        aria-label="Search spatial assets"
        placeholder="Search models, lights, effects, audio…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className={styles.assetCategories} aria-label="Asset categories">
        {[
          "All",
          "Furniture",
          "Storage",
          "Nautical Props",
          "Clue Objects",
          "Environmental Decor",
          "Interactive Props",
          "Lights",
          "Atmosphere",
          "Particles",
          "Projected Effects",
          "Spatial Audio",
          "Spatial Phenomena",
          "Interaction Volumes",
          "Compositions",
          "Classic presets",
        ].map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <label>
        Element type
        <select aria-label="Library element type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">All element types</option>
          {[...new Set(spatialCatalog.map((a) => a.type))].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.assetGrid}>
        {catalog.map((asset) => (
          <button
            className={styles.assetCard}
            key={asset.id}
            aria-label={`Add ${asset.name}`}
            draggable
            disabled={busy}
            onDragStart={(e) => e.dataTransfer.setData("application/parallax-preset", `sc02:${asset.id}`)}
            onClick={() => onAdd(`sc02:${asset.id}`)}
            title={`Add ${asset.name}. ${asset.description}`}
          >
            {asset.thumbnail ? (
              <Image src={asset.thumbnail} width={180} height={120} alt="" loading="lazy" unoptimized />
            ) : (
              <span className={styles.elementArt} aria-hidden="true">
                {
                  (
                    {
                      LIGHT: "✧",
                      ATMOSPHERE: "≋",
                      PARTICLES: "⁙",
                      PROJECTED_EFFECT: "◈",
                      SPATIAL_AUDIO: "♫",
                      SPATIAL_PHENOMENON: "◎",
                      INTERACTION_VOLUME: "▧",
                      COMPOSITION: "✦",
                    } as Record<string, string>
                  )[asset.type]
                }
              </span>
            )}
            <strong>{asset.name}</strong>
            {"visualBlocker" in asset && asset.visualBlocker && <small>Preview only · visual repair required</small>}
            <small>
              {asset.family} · {asset.type.replaceAll("_", " ").toLowerCase()}
            </small>
          </button>
        ))}
        {type === "ALL" &&
          names.map((name) => (
            <button
              className={styles.assetCard}
              key={name}
              draggable
              disabled={busy}
              onDragStart={(e) => e.dataTransfer.setData("application/parallax-preset", name)}
              onClick={() => onAdd(name)}
              title={`Add ${name} to this scene`}
            >
              <AssetPreview name={name} />
              <strong>{name}</strong>
              <small>{categoryOf(name)} · built-in</small>
            </button>
          ))}
      </div>
      {!catalog.length && !(type === "ALL" && names.length) && <p>No supported assets match this filter.</p>}
      <small>
        Click or drag to place. Models are original AI-assisted geometry. Compositions remain individually editable; use
        Save to Spatial Library to reuse an adjusted scene. Native presentation uses Guided View.
      </small>
    </section>
  );
}
